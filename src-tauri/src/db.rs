//! Local database: one SQLite file, one fact table.
//!
//! Every number the app shows comes from `transactions`, and every row carries
//! the key that proves it was not imported twice.

use crate::ofx;
use chrono::{Months, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 15;

/// Frozen snapshot of the schema that shipped in 0.1.0. Never edited: it is the
/// starting point every migration builds on, and what the migration test replays
/// to prove an old database still opens.
pub const BASELINE_V1: &str = r#"
create table if not exists accounts (
    id         integer primary key,
    name       text    not null,
    kind       text    not null default 'checking',
    bank_id    text    not null default '',
    acct_id    text    not null,
    currency   text    not null default 'BRL',
    created_at text    not null,
    unique (bank_id, acct_id)
);

create table if not exists categories (
    id     integer primary key,
    name   text    not null unique,
    kind   text    not null default 'expense',
    color  text    not null default '#8b93a1',
    seeded integer not null default 0
);

create table if not exists transactions (
    id          integer primary key,
    account_id  integer not null references accounts(id),
    posted_on   text    not null,
    amount_cents integer not null,
    description text    not null,
    merchant    text    not null default '',
    memo        text    not null default '',
    trntype     text    not null default '',
    category_id integer references categories(id),
    dedupe_key  text    not null,
    source      text    not null default '',
    created_at  text    not null,
    unique (dedupe_key)
);

create index if not exists idx_transactions_posted_on on transactions (posted_on desc);
create index if not exists idx_transactions_account on transactions (account_id, posted_on desc);

create table if not exists imports (
    id          integer primary key,
    path        text    not null,
    account_id  integer not null references accounts(id),
    imported_at text    not null,
    inserted    integer not null,
    duplicates  integer not null
);

create table if not exists settings (
    key   text primary key,
    value text not null
);
"#;

/// Created before anything else, so the version of an existing file can be read
/// before deciding which schema to apply.
const BOOTSTRAP: &str = r#"
create table if not exists settings (
    key   text primary key,
    value text not null
);
"#;

/// Tables added in v2. Every row carries `uid` for stable identity, `updated_at`
/// for conflict resolution and `deleted_at` as a tombstone.
const NEW_TABLES_V2: &str = r#"
create table if not exists goals (
    id            integer primary key,
    uid           text    not null unique,
    name          text    not null,
    kind          text    not null default 'reserve',
    target_cents  integer not null default 0,
    monthly_cents integer not null default 0,
    starts_on     text    not null,
    account_id    integer,
    color         text    not null default '#8a6a2f',
    visibility    text    not null default 'shared',
    created_at    text    not null,
    updated_at    text    not null,
    deleted_at    text
);

create table if not exists incomes (
    id           integer primary key,
    uid          text    not null unique,
    name         text    not null,
    amount_cents integer not null,
    frequency    text    not null default 'monthly',
    pay_day      integer not null default 5,
    account_id   integer,
    active       integer not null default 1,
    visibility   text    not null default 'shared',
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text
);

create table if not exists bills (
    id           integer primary key,
    uid          text    not null unique,
    name         text    not null,
    amount_cents integer not null,
    due_day      integer not null default 5,
    frequency    text    not null default 'monthly',
    category_id  integer,
    account_id   integer,
    goal_id      integer,
    starts_on    text    not null,
    ends_on      text,
    active       integer not null default 1,
    visibility   text    not null default 'shared',
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text
);

create table if not exists bill_payments (
    id           integer primary key,
    uid          text    not null unique,
    bill_id      integer not null references bills(id),
    month        text    not null,
    paid_on      text    not null,
    amount_cents integer not null,
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text,
    unique (bill_id, month)
);

create index if not exists idx_bills_active on bills (active, due_day);

create table if not exists cards (
    id           integer primary key,
    uid          text    not null unique,
    account_id   integer not null unique,
    brand        text    not null default '',
    last4        text    not null default '',
    limit_cents  integer not null default 0,
    closing_day  integer not null default 1,
    due_day      integer not null default 10,
    color        text    not null default '#2b2b2d',
    texture      text    not null default 'plain',
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text
);

create table if not exists notification_reads (
    id      integer primary key,
    uid     text    not null unique,
    key     text    not null unique,
    read_at text    not null
);
"#;

/// v3: the house is shared between people, and each bill has one payer.
const NEW_TABLES_V3: &str = r#"
create table if not exists people (
    id         integer primary key,
    uid        text    not null unique,
    name       text    not null,
    color      text    not null default '#2563eb',
    is_self    integer not null default 0,
    weight_pct integer not null default 50,
    created_at text    not null,
    updated_at text    not null,
    deleted_at text
);

create table if not exists shares (
    id         integer primary key,
    uid        text    not null unique,
    bill_id    integer not null,
    person_id  integer not null,
    percent    integer not null default 100,
    created_at text    not null,
    updated_at text    not null,
    deleted_at text,
    unique (bill_id)
);
"#;

const SEED_CATEGORIES: &[(&str, &str, &str)] = &[
    ("Groceries", "expense", "#4c9f70"),
    ("Food", "expense", "#d98c3f"),
    ("Transport", "expense", "#4a7fd4"),
    ("Housing", "expense", "#8a6fd1"),
    ("Health", "expense", "#d1536f"),
    ("Education", "expense", "#3f9ba6"),
    ("Leisure", "expense", "#c96fb4"),
    ("Subscriptions", "expense", "#b58b2e"),
    ("Taxes", "expense", "#7a7f8a"),
    ("Other", "expense", "#8b93a1"),
    ("Salary", "income", "#3f9f5f"),
    ("Transfer", "transfer", "#6f7b8b"),
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub bank_id: String,
    pub acct_id: String,
    pub currency: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub color: String,
    pub parent_id: Option<i64>,
    pub emoji: String,
    pub sort_order: i64,
    pub archived_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRow {
    pub id: i64,
    pub account_id: i64,
    pub account_name: String,
    pub posted_on: String,
    pub amount_cents: i64,
    pub description: String,
    pub merchant: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub trntype: String,
    pub manual: bool,
    pub notes: String,
    pub origin: String,
    pub transfer_group: Option<String>,
    pub refund_of: Option<i64>,
    pub has_refund: bool,
    pub tags: Vec<Tag>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthTotals {
    pub month: String,
    pub income_cents: i64,
    pub expense_cents: i64,
    pub transaction_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category_id: Option<i64>,
    pub name: String,
    pub color: String,
    pub total_cents: i64,
    pub budget_cents: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthPoint {
    pub month: String,
    pub income_cents: i64,
    pub expense_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryMonth {
    pub month: String,
    pub category_id: Option<i64>,
    pub name: String,
    pub color: String,
    pub total_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportRow {
    pub id: i64,
    pub path: String,
    pub account_name: String,
    pub imported_at: String,
    pub inserted: i64,
    pub duplicates: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub account_id: i64,
    pub account_name: String,
    pub account_label: String,
    pub inserted: i64,
    pub duplicates: i64,
    pub skipped: i64,
    pub categorized: i64,
    pub ledger_balance_cents: Option<i64>,
    pub ledger_balance_on: Option<String>,
}

pub fn open(path: &Path) -> Result<Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|problem| problem.to_string())?;
    }
    let connection = Connection::open(path).map_err(|problem| problem.to_string())?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|problem| problem.to_string())?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|problem| problem.to_string())?;
    connection
        .execute_batch(BOOTSTRAP)
        .map_err(|problem| problem.to_string())?;

    let stored = read_version(&connection)?;
    let version = if stored == 0 {
        // No version recorded: either a brand new file or one written by 0.1.0,
        // which had no version at all. A file with `accounts` is the old format.
        if !has_table(&connection, "accounts")? {
            connection
                .execute_batch(BASELINE_V1)
                .map_err(|problem| problem.to_string())?;
        }
        write_version(&connection, 1)?;
        1
    } else {
        stored
    };

    if version < 2 {
        migrate_to_v2(&connection)?;
        write_version(&connection, 2)?;
    }
    if version < 3 {
        migrate_to_v3(&connection)?;
        write_version(&connection, 3)?;
    }
    if version < 4 {
        migrate_to_v4(&connection)?;
        write_version(&connection, 4)?;
    }
    if version < 5 {
        migrate_to_v5(&connection)?;
        write_version(&connection, 5)?;
    }
    if version < 6 {
        migrate_to_v6(&connection)?;
        write_version(&connection, 6)?;
    }
    if version < 7 {
        migrate_to_v7(&connection)?;
        write_version(&connection, 7)?;
    }
    if version < 8 {
        migrate_to_v8(&connection)?;
        write_version(&connection, 8)?;
    }
    if version < 9 {
        migrate_to_v9(&connection)?;
        write_version(&connection, 9)?;
    }
    if version < 10 {
        migrate_to_v10(&connection)?;
        write_version(&connection, 10)?;
    }
    if version < 11 {
        migrate_to_v11(&connection)?;
        write_version(&connection, 11)?;
    }
    if version < 12 {
        migrate_to_v12(&connection)?;
        write_version(&connection, 12)?;
    }
    if version < 13 {
        migrate_to_v13(&connection)?;
        write_version(&connection, 13)?;
    }
    if version < 14 {
        migrate_to_v14(&connection)?;
        write_version(&connection, 14)?;
    }
    if version < SCHEMA_VERSION {
        migrate_to_v15(&connection)?;
        write_version(&connection, SCHEMA_VERSION)?;
    }

    seed_categories(&connection)?;
    Ok(connection)
}

fn read_version(connection: &Connection) -> Result<i64, String> {
    let value: Option<String> = connection
        .query_row("select value from settings where key = 'schema_version'", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|problem| problem.to_string())?;
    Ok(value.and_then(|text| text.parse::<i64>().ok()).unwrap_or(0))
}

fn write_version(connection: &Connection, version: i64) -> Result<(), String> {
    connection
        .execute(
            "insert into settings (key, value) values ('schema_version', ?1)
             on conflict (key) do update set value = excluded.value",
            params![version.to_string()],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

fn has_table(connection: &Connection, table: &str) -> Result<bool, String> {
    let count: i64 = connection
        .query_row(
            "select count(*) from sqlite_master where type = 'table' and name = ?1",
            params![table],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    Ok(count > 0)
}

pub(crate) fn check_month(month: &str) -> Result<(), String> {
    let bytes = month.as_bytes();
    let valid = month.len() == 7
        && month.is_ascii()
        && bytes[4] == b'-'
        && month[..4].parse::<u32>().is_ok()
        && matches!(month[5..].parse::<u32>(), Ok(1..=12));
    if valid {
        Ok(())
    } else {
        Err(format!("month must be YYYY-MM, got {month}"))
    }
}

pub(crate) fn check_date(iso: &str) -> Result<(), String> {
    NaiveDate::parse_from_str(iso, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| format!("date must be a real YYYY-MM-DD, got {iso}"))
}

fn has_column(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("pragma table_info({table})"))
        .map_err(|problem| problem.to_string())?;
    let names = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|problem| problem.to_string())?;
    for name in names {
        if name.map_err(|problem| problem.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_column(
    connection: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), String> {
    if has_column(connection, table, column)? {
        return Ok(());
    }
    connection
        .execute_batch(&format!("alter table {table} add column {column} {definition}"))
        .map_err(|problem| problem.to_string())
}

/// v6 to v7: monthly spending targets per category. Null means no target.
fn migrate_to_v7(connection: &Connection) -> Result<(), String> {
    add_column(connection, "categories", "budget_cents", "integer")
}

/// v9 to v10: saved CSV mapping profiles, one per bank layout.
const NEW_TABLES_V10: &str = r#"
create table if not exists csv_profiles (
    id            integer primary key,
    uid           text    not null unique,
    name          text    not null unique,
    separator     text    not null default ';',
    encoding      text    not null default 'auto',
    has_header    integer not null default 1,
    date_col      integer not null default 0,
    date_format   text    not null default '%d/%m/%Y',
    description_col integer not null default 1,
    amount_col    integer,
    debit_col     integer,
    credit_col    integer,
    decimal_sep   text    not null default ',',
    created_at    text    not null,
    updated_at    text    not null,
    deleted_at    text
);
"#;

/// v13 to v14: free-form tags plus the join to transactions. Tags are user
/// metadata like categories — they stick to any row, imported or manual —
/// and power the ledger filter and the bulk editor.
const NEW_TABLES_V14: &str = r#"
create table if not exists tags (
    id            integer primary key,
    uid           text    not null unique,
    name          text    not null unique,
    created_at    text    not null,
    updated_at    text    not null
);
create table if not exists transaction_tags (
    transaction_id integer not null,
    tag_id        integer not null,
    unique (transaction_id, tag_id)
);
"#;

/// v13 to v14: tags and their assignments.
fn migrate_to_v14(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V14)
        .map_err(|problem| problem.to_string())
}

/// v14 to v15: off-ledger holdings. Goals track earmarked reserves; holdings
/// are everything else the statements never see — cash, investments
/// elsewhere, property. One row each, updated in place, never derived.
const NEW_TABLES_V15: &str = r#"
create table if not exists holdings (
    id            integer primary key,
    uid           text    not null unique,
    name          text    not null unique,
    kind          text    not null default 'other',
    amount_cents  integer not null,
    updated_on    text    not null,
    created_at    text    not null,
    updated_at    text    not null,
    deleted_at    text
);
"#;

/// v14 to v15: manual asset holdings for the net-worth total.
fn migrate_to_v15(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V15)
        .map_err(|problem| problem.to_string())
}

/// v12 to v13: monthly budget rows. A row overrides the category's base cap
/// for one month (`category_id` null is the whole-month cap); `carryover`
/// lets the unused part roll forward. Limits are the only thing stored —
/// spent, leftover and pace are always computed on read.
const NEW_TABLES_V13: &str = r#"
create table if not exists budgets (
    id            integer primary key,
    uid           text    not null unique,
    month         text    not null,
    category_id   integer,
    limit_cents   integer not null,
    carryover     integer not null default 0,
    created_at    text    not null,
    updated_at    text    not null,
    unique (month, category_id)
);
"#;

/// v12 to v13: per-month budget overrides plus the whole-month cap.
fn migrate_to_v13(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V13)
        .map_err(|problem| problem.to_string())
}

/// v11 to v12: auto-categorization rules. Each rule names a substring plus
/// an optional amount window; the predicate mirrors `src/domain/rules.ts`
/// (`instr(lower(...))`, first match by priority) so the app and the tests
/// agree on what matches.
const NEW_TABLES_V12: &str = r#"
create table if not exists rules (
    id            integer primary key,
    uid           text    not null unique,
    pattern       text    not null,
    target        text    not null default 'both',
    category_id   integer not null,
    sign          text    not null default 'any',
    min_amount_cents integer,
    max_amount_cents integer,
    priority      integer not null default 0,
    created_at    text    not null,
    updated_at    text    not null,
    deleted_at    text
);
"#;

/// v11 to v12: named auto-categorization rules applied on every import.
fn migrate_to_v12(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V12)
        .map_err(|problem| problem.to_string())
}

/// v10 to v11: transfers link two legs through a shared group id, refunds
/// point at the row they return. Both columns are nullable and every link is
/// validated in Rust, matching the parent_id precedent.
fn migrate_to_v11(connection: &Connection) -> Result<(), String> {
    add_column(connection, "transactions", "transfer_group", "text")?;
    add_column(connection, "transactions", "refund_of", "integer")?;
    Ok(())
}

/// v9 to v10: named CSV mapping profiles so each bank file keeps its layout.
fn migrate_to_v10(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V10)
        .map_err(|problem| problem.to_string())
}

/// v8 to v9: repairs databases stamped 8 without the v8 columns, which can
/// happen when the version number and the migration land in separate builds.
/// Every step below is idempotent, so healthy databases pass through
/// untouched and stuck ones gain exactly what they missed.
fn migrate_to_v9(connection: &Connection) -> Result<(), String> {
    add_column(connection, "transactions", "notes", "text not null default ''")?;
    add_column(connection, "transactions", "origin", "text not null default 'ofx'")?;
    connection
        .execute(
            "update transactions set origin = 'manual' where source = 'manual' and origin = 'ofx'",
            [],
        )
        .map_err(|problem| problem.to_string())?;
    add_column(connection, "categories", "parent_id", "integer")?;
    add_column(connection, "categories", "emoji", "text not null default ''")?;
    add_column(connection, "categories", "sort_order", "integer not null default 0")?;
    add_column(connection, "categories", "archived_at", "text")?;
    Ok(())
}

/// v7 to v8: manual entries grow up, categories grow a tree. Transactions gain
/// free-form notes and an origin tag ('ofx' | 'manual' | 'csv'); existing
/// manual rows are backfilled from `source`. Categories gain an optional
/// parent, an emoji, an explicit order and an archive timestamp instead of
/// deletion.
fn migrate_to_v8(connection: &Connection) -> Result<(), String> {
    add_column(connection, "transactions", "notes", "text not null default ''")?;
    add_column(connection, "transactions", "origin", "text not null default 'ofx'")?;
    connection
        .execute(
            "update transactions set origin = 'manual' where source = 'manual' and origin = 'ofx'",
            [],
        )
        .map_err(|problem| problem.to_string())?;
    // No foreign key on the added column: SQLite cannot attach one to an
    // existing table without a rebuild, so the parent is validated in Rust.
    add_column(connection, "categories", "parent_id", "integer")?;
    add_column(connection, "categories", "emoji", "text not null default ''")?;
    add_column(connection, "categories", "sort_order", "integer not null default 0")?;
    add_column(connection, "categories", "archived_at", "text")?;
    Ok(())
}

/// v5 to v6: hand-entered goal deposits. An aporte is a transfer into savings,
/// not spending, so it lives in its own table instead of inflating the
/// expense totals. Goal progress counts deposits next to paid bill slices.
const NEW_TABLES_V6: &str = r#"
create table if not exists goal_deposits (
    id           integer primary key,
    uid          text    not null unique,
    goal_id      integer not null references goals(id),
    amount_cents integer not null,
    deposited_on text    not null,
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text
);

create index if not exists idx_deposits_goal on goal_deposits (goal_id, deposited_on);
"#;

/// v5 to v6: the deposits table only; the fact table is untouched.
fn migrate_to_v6(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V6)
        .map_err(|problem| problem.to_string())
}

/// v4 to v5: money other people owe me. A debt is its own record with an
/// individual settlement, not derived from the split, so marking one as
/// received never touches the others.
const NEW_TABLES_V5: &str = r#"
create table if not exists debts (
    id           integer primary key,
    uid          text    not null unique,
    person_id    integer not null references people(id),
    label        text    not null,
    amount_cents integer not null,
    month        text    not null,
    settled_on   text,
    created_at   text    not null,
    updated_at   text    not null,
    deleted_at   text
);

create index if not exists idx_debts_month on debts (month, settled_on);
"#;

/// v4 to v5: the debts table only; the fact table is untouched.
fn migrate_to_v5(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V5)
        .map_err(|problem| problem.to_string())
}

/// v3 to v4: installment purchases. A bill can carry the total number of
/// monthly parcels; the current one is derived from `starts_on`, so no row
/// per parcel is ever stored. Additive and idempotent like the rest.
fn migrate_to_v4(connection: &Connection) -> Result<(), String> {
    add_column(connection, "bills", "installments_total", "integer")
}

/// v2 to v3: new tables only, so nothing on the fact table changes.
fn migrate_to_v3(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(NEW_TABLES_V3)
        .map_err(|problem| problem.to_string())
}

/// v1 to v2: identity, conflict resolution and tombstones on the existing tables,
/// plus the planning tables. Additive only, inside one transaction, and safe to
/// run again: every step is skipped when it is already there.
fn migrate_to_v2(connection: &Connection) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    connection
        .execute_batch("begin")
        .map_err(|problem| problem.to_string())?;

    let result = (|| -> Result<(), String> {
        for table in ["accounts", "categories", "transactions", "imports"] {
            add_column(connection, table, "uid", "text not null default ''")?;
            add_column(connection, table, "updated_at", "text not null default ''")?;
            add_column(connection, table, "deleted_at", "text")?;
        }
        // No foreign key on the added column: SQLite cannot attach one to an
        // existing table without a rebuild.
        add_column(connection, "transactions", "goal_id", "integer")?;
        add_column(connection, "transactions", "visibility", "text not null default 'shared'")?;

        for table in ["accounts", "categories", "transactions", "imports"] {
            connection
                .execute(
                    &format!(
                        "update {table} set uid = lower(hex(randomblob(16))) where uid = ''"
                    ),
                    [],
                )
                .map_err(|problem| problem.to_string())?;
            if table == "categories" {
                connection
                    .execute(
                        &format!("update {table} set updated_at = ?1 where updated_at = ''"),
                        params![now],
                    )
                    .map_err(|problem| problem.to_string())?;
            } else if table == "imports" {
                connection
                    .execute(
                        &format!("update {table} set updated_at = imported_at where updated_at = ''"),
                        [],
                    )
                    .map_err(|problem| problem.to_string())?;
            } else {
                connection
                    .execute(
                        &format!("update {table} set updated_at = created_at where updated_at = ''"),
                        [],
                    )
                    .map_err(|problem| problem.to_string())?;
            }
            // A unique index, not a column constraint: SQLite refuses to add a
            // unique column to an existing table.
            connection
                .execute_batch(&format!(
                    "create unique index if not exists idx_{table}_uid on {table} (uid)"
                ))
                .map_err(|problem| problem.to_string())?;
            connection
                .execute_batch(&format!(
                    "create index if not exists idx_{table}_alive on {table} (deleted_at)"
                ))
                .map_err(|problem| problem.to_string())?;
        }

        connection
            .execute_batch(NEW_TABLES_V2)
            .map_err(|problem| problem.to_string())?;
        Ok(())
    })();

    match result {
        Ok(()) => connection
            .execute_batch("commit")
            .map_err(|problem| problem.to_string()),
        Err(problem) => {
            let _ = connection.execute_batch("rollback");
            Err(problem)
        }
    }
}

fn seed_categories(connection: &Connection) -> Result<(), String> {
    let existing: i64 = connection
        .query_row("select count(*) from categories", [], |row| row.get(0))
        .map_err(|problem| problem.to_string())?;
    if existing > 0 {
        return Ok(());
    }
    for (name, kind, color) in SEED_CATEGORIES {
        connection
            .execute(
                "insert into categories (name, kind, color, seeded, uid, updated_at)
                 values (?1, ?2, ?3, 1, lower(hex(randomblob(16))), ?4)",
                params![name, kind, color, Utc::now().to_rfc3339()],
            )
            .map_err(|problem| problem.to_string())?;
    }
    Ok(())
}

/// OFX 1.x files are usually Windows-1252, even when the header claims US-ASCII.
fn decode(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned(),
    }
}

fn account_label(account: &ofx::OfxAccount) -> String {
    if account.is_credit_card {
        format!("Card {}", account.acct_id)
    } else {
        format!("Account {}", account.acct_id)
    }
}

fn upsert_account(connection: &Connection, account: &ofx::OfxAccount) -> Result<i64, String> {
    let created_at = Utc::now().to_rfc3339();
    let kind = if account.is_credit_card {
        "credit_card"
    } else {
        "checking"
    };
    connection
        .query_row(
            "insert into accounts (name, kind, bank_id, acct_id, currency, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, ?6, lower(hex(randomblob(16))), ?6)
             on conflict (bank_id, acct_id) do update
                set currency = excluded.currency, updated_at = excluded.updated_at,
                    deleted_at = null
             returning id",
            params![
                account_label(account),
                kind,
                account.bank_id,
                account.acct_id,
                account.currency,
                created_at
            ],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())
}

/// Two real, identical purchases on the same day share a fingerprint. Within one
/// file the second and later copies get an occurrence suffix, so they are kept,
/// while re-importing the same file still maps each row onto the same key.
fn occurrence_key(seen: &mut std::collections::HashMap<String, u32>, key: String) -> String {
    if !key.starts_with("hash|") {
        return key;
    }
    let count = seen.entry(key.clone()).or_insert(0);
    *count += 1;
    if *count == 1 { key } else { format!("{key}|#{count}") }
}

pub fn import_ofx(connection: &mut Connection, path: &Path) -> Result<ImportReport, String> {
    let bytes = std::fs::read(path).map_err(|problem| problem.to_string())?;
    let statement = ofx::parse(&decode(&bytes)).map_err(|problem| problem.to_string())?;
    let account_key = format!("{}-{}", statement.account.bank_id, statement.account.acct_id);

    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let account_id = upsert_account(&transaction, &statement.account)?;

    let imported_at = Utc::now().to_rfc3339();
    let source = path.to_string_lossy().to_string();
    let mut inserted = 0i64;
    let mut duplicates = 0i64;

    let mut seen = std::collections::HashMap::new();
    for entry in &statement.transactions {
        let dedupe_key = occurrence_key(&mut seen, ofx::dedupe_key(
            &account_key,
            &entry.fitid,
            &entry.posted_on,
            entry.amount_cents,
            &entry.description,
        ));
        let affected = transaction
            .execute(
                "insert or ignore into transactions
                 (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
                  dedupe_key, source, created_at, uid, updated_at)
                 values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                         lower(hex(randomblob(16))), ?10)",
                params![
                    account_id,
                    entry.posted_on,
                    entry.amount_cents,
                    entry.description,
                    ofx::merchant_of(&entry.description),
                    entry.memo,
                    entry.trntype,
                    dedupe_key,
                    source,
                    imported_at
                ],
            )
            .map_err(|problem| problem.to_string())?;
        if affected == 1 {
            inserted += 1;
        } else {
            duplicates += 1;
        }
    }

    transaction
        .execute(
            "insert into imports (path, account_id, imported_at, inserted, duplicates, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, lower(hex(randomblob(16))), ?3)",
            params![source, account_id, imported_at, inserted, duplicates],
        )
        .map_err(|problem| problem.to_string())?;

    let categorized = apply_rules_in(&transaction)?;

    transaction.commit().map_err(|problem| problem.to_string())?;

    Ok(ImportReport {
        account_id,
        account_name: account_label(&statement.account),
        account_label: statement.account.acct_id.clone(),
        inserted,
        duplicates,
        skipped: 0,
        categorized,
        ledger_balance_cents: statement.ledger_balance_cents,
        ledger_balance_on: statement.ledger_balance_on,
    })
}

pub fn list_accounts(connection: &Connection) -> Result<Vec<Account>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, kind, bank_id, acct_id, currency
             from accounts
             where deleted_at is null
             order by name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Account {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                bank_id: row.get(3)?,
                acct_id: row.get(4)?,
                currency: row.get(5)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// A hand-made account: no bank file behind it, so it takes an `acct_id` in
/// the manual namespace, which can never collide with an import's
/// (bank_id, acct_id) pair.
pub fn create_manual_account(connection: &Connection, name: &str) -> Result<i64, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("account name must not be empty".to_string());
    }
    let stamp = Utc::now().to_rfc3339();
    connection
        .query_row(
            "insert into accounts (name, kind, bank_id, acct_id, currency, created_at, uid, updated_at)
             values (?1, 'checking', '', 'manual:' || lower(hex(randomblob(16))), 'BRL', ?2, lower(hex(randomblob(16))), ?2)
             returning id",
            params![name, stamp],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())
}

/// Renames a manual account. Imported accounts keep the bank's name, because
/// the next import would silently revert any other choice.
pub fn rename_account(connection: &Connection, id: i64, name: &str) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("account name must not be empty".to_string());
    }
    let manual: Option<i64> = connection
        .query_row(
            "select id from accounts where id = ?1 and bank_id = '' and acct_id like 'manual:%' and deleted_at is null",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if manual.is_none() {
        return Err("only manual accounts can be renamed".to_string());
    }
    let affected = connection
        .execute(
            "update accounts set name = ?1, updated_at = ?2 where id = ?3",
            params![name, Utc::now().to_rfc3339(), id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("account {id} does not exist"));
    }
    Ok(())
}

/// Archives an account: it leaves every picker, but its history stays in the
/// database and keeps counting wherever it already counted.
pub fn archive_account(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update accounts set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("account {id} does not exist or is already archived"));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryInput {
    pub id: Option<i64>,
    pub name: String,
    pub kind: String,
    pub color: String,
    pub parent_id: Option<i64>,
    pub emoji: String,
    pub sort_order: i64,
}

/// Walks up the parent chain looking for `id`: finding it means assigning
/// `parent_id` would close a loop.
fn reaches_itself(connection: &Connection, start: i64, id: i64) -> Result<bool, String> {
    let mut current = Some(start);
    let mut steps = 0;
    while let Some(node) = current {
        if node == id {
            return Ok(true);
        }
        steps += 1;
        if steps > 64 {
            return Err("category hierarchy is too deep".to_string());
        }
        current = connection
            .query_row(
                "select parent_id from categories where id = ?1 and deleted_at is null",
                params![node],
                |row| row.get::<_, Option<i64>>(0),
            )
            .optional()
            .map_err(|problem| problem.to_string())?
            .flatten();
    }
    Ok(false)
}

fn check_category_parent(
    connection: &Connection,
    id: Option<i64>,
    parent_id: Option<i64>,
) -> Result<(), String> {
    let Some(parent) = parent_id else {
        return Ok(());
    };
    if Some(parent) == id {
        return Err("a category cannot be its own parent".to_string());
    }
    let exists: Option<i64> = connection
        .query_row(
            "select id from categories where id = ?1 and deleted_at is null",
            params![parent],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if exists.is_none() {
        return Err(format!("parent category {parent} does not exist"));
    }
    if let Some(own) = id {
        if reaches_itself(connection, parent, own)? {
            return Err("a category cannot descend from itself".to_string());
        }
    }
    Ok(())
}

pub fn save_category(connection: &Connection, input: &CategoryInput) -> Result<i64, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("category name must not be empty".to_string());
    }
    if !["expense", "income", "transfer"].contains(&input.kind.as_str()) {
        return Err("category kind must be expense, income or transfer".to_string());
    }
    check_category_parent(connection, input.id, input.parent_id)?;
    let stamp = Utc::now().to_rfc3339();
    let result = match input.id {
        Some(id) => connection.execute(
            "update categories
             set name = ?1, kind = ?2, color = ?3, parent_id = ?4,
                 emoji = ?5, sort_order = ?6, updated_at = ?7
             where id = ?8 and deleted_at is null",
            params![
                name,
                input.kind,
                input.color,
                input.parent_id,
                input.emoji,
                input.sort_order,
                stamp,
                id
            ],
        ),
        None => connection.execute(
            "insert into categories
             (uid, name, kind, color, parent_id, emoji, sort_order, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                name,
                input.kind,
                input.color,
                input.parent_id,
                input.emoji,
                input.sort_order,
                stamp
            ],
        ),
    }
    .map_err(|problem| {
        if problem.to_string().contains("UNIQUE constraint failed") {
            "a category with this name already exists".to_string()
        } else {
            problem.to_string()
        }
    })?;
    if result == 0 {
        return Err("category does not exist".to_string());
    }
    Ok(input.id.unwrap_or_else(|| connection.last_insert_rowid()))
}

/// Archives instead of deleting: history keeps counting, pickers stop offering.
pub fn archive_category(connection: &Connection, id: i64, archived: bool) -> Result<(), String> {
    let stamp = Utc::now().to_rfc3339();
    let affected = if archived {
        connection.execute(
            "update categories set archived_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
    } else {
        connection.execute(
            "update categories set archived_at = null, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
    }
    .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("category {id} does not exist"));
    }
    Ok(())
}

/// Deletes a category only when nothing points at it: transactions, bills and
/// live children all block, so history never dangles.
pub fn delete_category(connection: &Connection, id: i64) -> Result<(), String> {
    let used: i64 = connection
        .query_row(
            "select (select count(*) from transactions where category_id = ?1 and deleted_at is null)
                  + (select count(*) from bills where category_id = ?1 and deleted_at is null)
                  + (select count(*) from categories where parent_id = ?1 and deleted_at is null)",
            params![id],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    if used > 0 {
        return Err("category is in use and cannot be deleted".to_string());
    }
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update categories set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("category {id} does not exist"));
    }
    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvProfile {
    pub id: i64,
    pub name: String,
    pub separator: String,
    pub encoding: String,
    pub has_header: bool,
    pub date_col: i64,
    pub date_format: String,
    pub description_col: i64,
    pub amount_col: Option<i64>,
    pub debit_col: Option<i64>,
    pub credit_col: Option<i64>,
    pub decimal_sep: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvProfileInput {
    pub id: Option<i64>,
    pub name: String,
    pub separator: String,
    pub encoding: String,
    pub has_header: bool,
    pub date_col: i64,
    pub date_format: String,
    pub description_col: i64,
    pub amount_col: Option<i64>,
    pub debit_col: Option<i64>,
    pub credit_col: Option<i64>,
    pub decimal_sep: String,
}

#[cfg(test)]
impl CsvProfile {
    pub fn mapping(&self) -> crate::csv::CsvMapping {
        crate::csv::CsvMapping {
            separator: self.separator.clone(),
            encoding: self.encoding.clone(),
            has_header: self.has_header,
            date_col: self.date_col.max(0) as usize,
            date_format: self.date_format.clone(),
            description_col: self.description_col.max(0) as usize,
            amount_col: self.amount_col.map(|column| column.max(0) as usize),
            debit_col: self.debit_col.map(|column| column.max(0) as usize),
            credit_col: self.credit_col.map(|column| column.max(0) as usize),
            decimal_sep: self.decimal_sep.clone(),
        }
    }
}

fn csv_mapping_of(input: &CsvProfileInput) -> crate::csv::CsvMapping {
    crate::csv::CsvMapping {
        separator: input.separator.clone(),
        encoding: input.encoding.clone(),
        has_header: input.has_header,
        date_col: input.date_col.max(0) as usize,
        date_format: input.date_format.clone(),
        description_col: input.description_col.max(0) as usize,
        amount_col: input.amount_col.map(|column| column.max(0) as usize),
        debit_col: input.debit_col.map(|column| column.max(0) as usize),
        credit_col: input.credit_col.map(|column| column.max(0) as usize),
        decimal_sep: input.decimal_sep.clone(),
    }
}

pub fn save_csv_profile(connection: &Connection, input: &CsvProfileInput) -> Result<i64, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("profile name must not be empty".to_string());
    }
    crate::csv::validate_mapping(&csv_mapping_of(input))?;
    let stamp = Utc::now().to_rfc3339();
    let result = match input.id {
        Some(id) => connection.execute(
            "update csv_profiles
             set name = ?1, separator = ?2, encoding = ?3, has_header = ?4, date_col = ?5,
                 date_format = ?6, description_col = ?7, amount_col = ?8, debit_col = ?9,
                 credit_col = ?10, decimal_sep = ?11, updated_at = ?12
             where id = ?13 and deleted_at is null",
            params![
                name,
                input.separator,
                input.encoding,
                input.has_header as i64,
                input.date_col,
                input.date_format,
                input.description_col,
                input.amount_col,
                input.debit_col,
                input.credit_col,
                input.decimal_sep,
                stamp,
                id
            ],
        ),
        None => connection.execute(
            "insert into csv_profiles
             (uid, name, separator, encoding, has_header, date_col, date_format,
              description_col, amount_col, debit_col, credit_col, decimal_sep, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
            params![
                name,
                input.separator,
                input.encoding,
                input.has_header as i64,
                input.date_col,
                input.date_format,
                input.description_col,
                input.amount_col,
                input.debit_col,
                input.credit_col,
                input.decimal_sep,
                stamp
            ],
        ),
    }
    .map_err(|problem| {
        if problem.to_string().contains("UNIQUE constraint failed") {
            "a profile with this name already exists".to_string()
        } else {
            problem.to_string()
        }
    })?;
    if result == 0 {
        return Err("csv profile does not exist".to_string());
    }
    Ok(input.id.unwrap_or_else(|| connection.last_insert_rowid()))
}

pub fn delete_csv_profile(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update csv_profiles set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("csv profile {id} does not exist"));
    }
    Ok(())
}

pub fn list_csv_profiles(connection: &Connection) -> Result<Vec<CsvProfile>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, separator, encoding, has_header, date_col, date_format,
                    description_col, amount_col, debit_col, credit_col, decimal_sep
             from csv_profiles
             where deleted_at is null
             order by name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CsvProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                separator: row.get(2)?,
                encoding: row.get(3)?,
                has_header: row.get::<_, i64>(4)? != 0,
                date_col: row.get(5)?,
                date_format: {
                    let format: String = row.get(6)?;
                    if format == "%d-%m/%Y" { "%d-%m-%Y".to_string() } else { format }
                },
                description_col: row.get(7)?,
                amount_col: row.get(8)?,
                debit_col: row.get(9)?,
                credit_col: row.get(10)?,
                decimal_sep: row.get(11)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: i64,
    pub pattern: String,
    pub target: String,
    pub category_id: i64,
    pub category_name: String,
    pub category_color: String,
    pub sign: String,
    pub min_amount_cents: Option<i64>,
    pub max_amount_cents: Option<i64>,
    pub priority: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleInput {
    pub id: Option<i64>,
    pub pattern: String,
    pub target: String,
    pub category_id: i64,
    pub sign: String,
    pub min_amount_cents: Option<i64>,
    pub max_amount_cents: Option<i64>,
    pub priority: i64,
}

fn check_rule_target(target: &str) -> Result<(), String> {
    match target {
        "merchant" | "description" | "both" => Ok(()),
        other => Err(format!("unknown rule target: {other}")),
    }
}

fn check_rule_sign(sign: &str) -> Result<(), String> {
    match sign {
        "any" | "in" | "out" => Ok(()),
        other => Err(format!("unknown rule sign: {other}")),
    }
}

pub fn save_rule(connection: &Connection, input: &RuleInput) -> Result<i64, String> {
    let pattern = input.pattern.trim();
    if pattern.is_empty() {
        return Err("rule pattern must not be empty".to_string());
    }
    check_rule_target(&input.target)?;
    check_rule_sign(&input.sign)?;
    if let (Some(min), Some(max)) = (input.min_amount_cents, input.max_amount_cents) {
        if min > max {
            return Err("rule minimum is above its maximum".to_string());
        }
    }
    let category: Option<i64> = connection
        .query_row(
            "select id from categories where id = ?1 and deleted_at is null",
            params![input.category_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if category.is_none() {
        return Err(format!("category {} does not exist", input.category_id));
    }
    let stamp = Utc::now().to_rfc3339();
    let affected = match input.id {
        Some(id) => connection.execute(
            "update rules
             set pattern = ?1, target = ?2, category_id = ?3, sign = ?4,
                 min_amount_cents = ?5, max_amount_cents = ?6, priority = ?7, updated_at = ?8
             where id = ?9 and deleted_at is null",
            params![
                pattern,
                input.target,
                input.category_id,
                input.sign,
                input.min_amount_cents,
                input.max_amount_cents,
                input.priority,
                stamp,
                id
            ],
        ),
        None => connection.execute(
            "insert into rules
             (uid, pattern, target, category_id, sign, min_amount_cents, max_amount_cents,
              priority, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                pattern,
                input.target,
                input.category_id,
                input.sign,
                input.min_amount_cents,
                input.max_amount_cents,
                input.priority,
                stamp
            ],
        ),
    }
    .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err("rule does not exist".to_string());
    }
    Ok(input.id.unwrap_or_else(|| connection.last_insert_rowid()))
}

pub fn delete_rule(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update rules set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("rule {id} does not exist"));
    }
    Ok(())
}

pub fn list_rules(connection: &Connection) -> Result<Vec<Rule>, String> {
    let mut statement = connection
        .prepare(
            "select r.id, r.pattern, r.target, r.category_id, c.name, c.color,
                    r.sign, r.min_amount_cents, r.max_amount_cents, r.priority
             from rules r
             join categories c on c.id = r.category_id
             where r.deleted_at is null and c.deleted_at is null
             order by r.priority, r.id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Rule {
                id: row.get(0)?,
                pattern: row.get(1)?,
                target: row.get(2)?,
                category_id: row.get(3)?,
                category_name: row.get(4)?,
                category_color: row.get(5)?,
                sign: row.get(6)?,
                min_amount_cents: row.get(7)?,
                max_amount_cents: row.get(8)?,
                priority: row.get(9)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// The one predicate behind every categorization, in SQL form. It mirrors
/// `ruleMatches` in `src/domain/rules.ts`: a literal case-insensitive
/// substring (`instr` has no wildcards to escape) plus the amount window,
/// first match by priority. Transfer legs never qualify — they must stay
/// uncategorized so the totals keep ignoring them.
const RULE_MATCH: &str = "rules r
              join categories c on c.id = r.category_id and c.deleted_at is null
              where r.deleted_at is null and length(r.pattern) > 0
                and ((r.target in ('merchant', 'both')
                      and instr(lower(t.merchant), lower(r.pattern)) > 0)
                     or (r.target in ('description', 'both')
                         and instr(lower(t.description), lower(r.pattern)) > 0))
                and (r.sign = 'any'
                     or (r.sign = 'in' and t.amount_cents > 0)
                     or (r.sign = 'out' and t.amount_cents < 0))
                and (r.min_amount_cents is null or t.amount_cents >= r.min_amount_cents)
                and (r.max_amount_cents is null or t.amount_cents <= r.max_amount_cents)";

fn apply_rules_in(transaction: &rusqlite::Transaction) -> Result<i64, String> {
    let affected = transaction
        .execute(
            &format!(
                "update transactions as t set category_id =
                   (select r.category_id from {RULE_MATCH} order by r.priority, r.id limit 1)
                 where t.category_id is null and t.transfer_group is null and t.deleted_at is null
                   and exists (select 1 from {RULE_MATCH} order by r.priority, r.id limit 1)"
            ),
            [],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(affected as i64)
}

/// Runs every rule over all uncategorized rows. Imports call this themselves;
/// the command below re-runs it after the user edits the rulebook.
pub fn apply_rules(connection: &mut Connection) -> Result<i64, String> {
    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let affected = apply_rules_in(&transaction)?;
    transaction.commit().map_err(|problem| problem.to_string())?;
    Ok(affected)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetLimitInput {
    pub month: String,
    pub category_id: Option<i64>,
    pub limit_cents: Option<i64>,
    pub carryover: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetLine {
    pub category_id: Option<i64>,
    pub name: String,
    pub color: String,
    pub limit_cents: i64,
    pub overridden: bool,
    pub carryover: bool,
    pub carry_in_cents: i64,
    pub effective_cents: i64,
    pub spent_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetStatus {
    pub month: String,
    pub global: Option<BudgetLine>,
    pub lines: Vec<BudgetLine>,
}

/// Writes one monthly row. A null limit deletes the row, falling back to the
/// base cap (or no cap). Overrides live on top-level categories only, because
/// spending rolls up to them; the whole-month cap is a single row enforced
/// here, since SQLite treats every NULL as distinct under UNIQUE.
pub fn save_budget_limit(connection: &Connection, input: &BudgetLimitInput) -> Result<(), String> {
    check_month(&input.month)?;
    if let Some(limit) = input.limit_cents {
        if limit <= 0 {
            return Err("budget limit must be positive".to_string());
        }
    }
    if let Some(category_id) = input.category_id {
        let parent: Option<Option<i64>> = connection
            .query_row(
                "select parent_id from categories where id = ?1 and deleted_at is null",
                params![category_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|problem| problem.to_string())?
            .ok_or_else(|| format!("category {category_id} does not exist"))?;
        if parent.is_some() {
            return Err("monthly limits live on top-level categories".to_string());
        }
    }

    let stamp = Utc::now().to_rfc3339();
    if input.limit_cents.is_none() {
        connection
            .execute(
                "delete from budgets where month = ?1 and ((?2 is null and category_id is null) or category_id = ?2)",
                params![input.month, input.category_id],
            )
            .map_err(|problem| problem.to_string())?;
        return Ok(());
    }
    let limit = input.limit_cents.unwrap_or(0);
    if input.category_id.is_none() {
        connection
            .execute(
                "delete from budgets where month = ?1 and category_id is null",
                params![input.month],
            )
            .map_err(|problem| problem.to_string())?;
    }
    connection
        .execute(
            "insert into budgets (uid, month, category_id, limit_cents, carryover, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?5)
             on conflict (month, category_id) do update
             set limit_cents = excluded.limit_cents, carryover = excluded.carryover,
                 updated_at = excluded.updated_at",
            params![
                input.month,
                input.category_id,
                limit,
                input.carryover as i64,
                stamp
            ],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

struct MonthRow {
    limit: i64,
    carryover: bool,
}

fn budget_row_of(
    connection: &Connection,
    month: &str,
    category_id: Option<i64>,
) -> Result<Option<MonthRow>, String> {
    connection
        .query_row(
            "select limit_cents, carryover from budgets
             where month = ?1 and ((?2 is null and category_id is null) or category_id = ?2)",
            params![month, category_id],
            |row| {
                Ok(MonthRow {
                    limit: row.get(0)?,
                    carryover: row.get::<_, i64>(1)? != 0,
                })
            },
        )
        .optional()
        .map_err(|problem| problem.to_string())
}

fn month_key_of(month: &str, delta: i32) -> Result<String, String> {
    let end = NaiveDate::parse_from_str(&format!("{month}-01"), "%Y-%m-%d")
        .map_err(|problem| problem.to_string())?;
    let shifted = if delta >= 0 {
        end.checked_add_months(Months::new(delta as u32))
    } else {
        end.checked_sub_months(Months::new((-delta) as u32))
    };
    shifted
        .map(|date| date.format("%Y-%m").to_string())
        .ok_or_else(|| "month out of range".to_string())
}

/// Key under which a spent map stores the month's total spending. `None` already
/// means uncategorized spending, so the global budget needs its own slot.
const TOTAL_SPENT_KEY: Option<i64> = Some(i64::MIN);

fn spent_map_of(connection: &Connection, month: &str) -> Result<std::collections::HashMap<Option<i64>, i64>, String> {
    let mut map = std::collections::HashMap::new();
    for total in category_totals(connection, month)? {
        map.insert(total.category_id, total.total_cents);
    }
    map.insert(TOTAL_SPENT_KEY, month_totals(connection, month)?.expense_cents);
    Ok(map)
}

/// Leftover that flows into `month`: the previous month's unused effective
/// cap, when either side opted into carryover. The previous effective cap is
/// itself recursive, bounded twelve months back so history cannot loop.
fn carry_into(
    connection: &Connection,
    month: &str,
    category_id: Option<i64>,
    base: Option<i64>,
    spent: &std::collections::HashMap<String, std::collections::HashMap<Option<i64>, i64>>,
    depth: u32,
) -> Result<i64, String> {
    // budget_status loads spending for the twelve months before the current one.
    if depth >= 12 {
        return Ok(0);
    }
    let previous = month_key_of(month, -1)?;
    let current_row = budget_row_of(connection, month, category_id)?;
    let previous_row = budget_row_of(connection, &previous, category_id)?;
    let pulls = current_row.as_ref().is_some_and(|row| row.carryover)
        || previous_row.as_ref().is_some_and(|row| row.carryover);
    if !pulls {
        return Ok(0);
    }
    let previous_limit = previous_row.map(|row| row.limit).or(base).unwrap_or(0);
    if previous_limit <= 0 {
        return Ok(0);
    }
    let previous_spent = spent
        .get(&previous)
        .and_then(|map| map.get(&category_id.or(TOTAL_SPENT_KEY)))
        .copied()
        .unwrap_or(0);
    let previous_carry =
        carry_into(connection, &previous, category_id, base, spent, depth + 1)?;
    Ok((previous_limit + previous_carry - previous_spent).max(0))
}

fn line_of(
    connection: &Connection,
    month: &str,
    category_id: Option<i64>,
    name: String,
    color: String,
    base: Option<i64>,
    spent: &std::collections::HashMap<String, std::collections::HashMap<Option<i64>, i64>>,
    global_spent: i64,
    spent_now: &std::collections::HashMap<Option<i64>, i64>,
) -> Result<Option<BudgetLine>, String> {
    let row = budget_row_of(connection, month, category_id)?;
    let limit = match (row.as_ref().map(|entry| entry.limit), base) {
        (Some(value), _) | (None, Some(value)) => value,
        (None, None) => return Ok(None),
    };
    let carryover = row.as_ref().is_some_and(|entry| entry.carryover);
    let carry_in = carry_into(connection, month, category_id, base, spent, 0)?;
    let spent_cents = if category_id.is_none() {
        global_spent
    } else {
        spent_now.get(&category_id).copied().unwrap_or(0)
    };
    Ok(Some(BudgetLine {
        category_id,
        name,
        color,
        limit_cents: limit,
        overridden: row.is_some(),
        carryover,
        carry_in_cents: carry_in,
        effective_cents: limit + carry_in,
        spent_cents,
    }))
}

/// Every cap that applies to `month`, with what was already spent against it.
/// Limits come from the monthly row or fall back to the base cap; spending
/// reuses the netted category totals, so refunds and transfers behave here
/// exactly like they do on the dashboard.
pub fn budget_status(connection: &Connection, month: &str) -> Result<BudgetStatus, String> {
    check_month(month)?;
    // Carryover looks backwards, so the spent maps cover a trailing year.
    let mut spent = std::collections::HashMap::new();
    for back in 0..13 {
        let key = month_key_of(month, -(back as i32))?;
        spent.insert(key.clone(), spent_map_of(connection, &key)?);
    }
    let spent_now = spent.get(month).cloned().unwrap_or_default();
    let global_spent = month_totals(connection, month)?.expense_cents;

    let global = line_of(
        connection,
        month,
        None,
        String::new(),
        "#8b8798".to_string(),
        None,
        &spent,
        global_spent,
        &spent_now,
    )?;

    let mut roots: Vec<(i64, String, String, Option<i64>)> = Vec::new();
    let mut statement = connection
        .prepare(
            "select c.id, c.name, c.color, c.budget_cents
             from categories c
             where c.parent_id is null and c.deleted_at is null and c.archived_at is null
               and (c.budget_cents is not null
                    or exists (select 1 from budgets b
                               where b.month = ?1 and b.category_id = c.id))
             order by c.sort_order, c.name",
        )
        .map_err(|problem| problem.to_string())?;
    let fetched = statement
        .query_map(params![month], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|problem| problem.to_string())?;
    for entry in fetched {
        roots.push(entry.map_err(|problem| problem.to_string())?);
    }
    let mut lines = Vec::new();
    for (id, name, color, base) in roots {
        if let Some(line) = line_of(
            connection,
            month,
            Some(id),
            name,
            color,
            base,
            &spent,
            global_spent,
            &spent_now,
        )? {
            lines.push(line);
        }
    }

    Ok(BudgetStatus { month: month.to_string(), global, lines })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurrenceRow {
    pub posted_on: String,
    pub merchant: String,
    pub description: String,
    pub amount_cents: i64,
}

/// Flat history for the recurrence radar: date, who and how much, trailing
/// `count` months ending at `end_month`. Pure input for the domain detector —
/// no grouping or verdicts are persisted. Transfers stay out, since moving
/// money between own accounts is not a subscription.
pub fn recurrence_rows(
    connection: &Connection,
    end_month: &str,
    count: i64,
) -> Result<Vec<RecurrenceRow>, String> {
    check_month(end_month)?;
    let end = NaiveDate::parse_from_str(&format!("{end_month}-01"), "%Y-%m-%d")
        .map_err(|problem| problem.to_string())?;
    let start = end
        .checked_sub_months(Months::new(count.max(1) as u32 - 1))
        .ok_or_else(|| "month window out of range".to_string())?;
    let mut statement = connection
        .prepare(
            "select posted_on, merchant, description, amount_cents
             from transactions
             where posted_on >= ?1 and substr(posted_on, 1, 7) <= ?2
               and transfer_group is null and deleted_at is null
             order by posted_on asc",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map(
            params![start.format("%Y-%m-%d").to_string(), end_month],
            |row| {
                Ok(RecurrenceRow {
                    posted_on: row.get(0)?,
                    merchant: row.get(1)?,
                    description: row.get(2)?,
                    amount_cents: row.get(3)?,
                })
            },
        )
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyPoint {
    pub day: String,
    pub income_cents: i64,
    pub expense_cents: i64,
}

/// One row per calendar day of `month`, zeros filled in. Same honesty rules
/// as the monthly totals: transfers stay out, refund legs net their own side.
/// The chart domain accumulates these; nothing derived is stored.
pub fn daily_expense(connection: &Connection, month: &str) -> Result<Vec<DailyPoint>, String> {
    check_month(month)?;
    let first = NaiveDate::parse_from_str(&format!("{month}-01"), "%Y-%m-%d")
        .map_err(|problem| problem.to_string())?;
    let days = first
        .checked_add_months(Months::new(1))
        .map(|next| (next - first).num_days())
        .ok_or_else(|| "month out of range".to_string())?;
    let prefix = format!("{month}%");
    let mut statement = connection
        .prepare(
            "select posted_on,
                    max(0, coalesce(sum(case when amount_cents > 0 and refund_of is null then amount_cents else 0 end), 0)
                           - coalesce(sum(case when amount_cents < 0 and refund_of is not null then -amount_cents else 0 end), 0)),
                    max(0, coalesce(sum(case when amount_cents < 0 and refund_of is null then -amount_cents else 0 end), 0)
                           - coalesce(sum(case when amount_cents > 0 and refund_of is not null then amount_cents else 0 end), 0))
             from transactions
             where posted_on like ?1 and transfer_group is null and deleted_at is null
             group by posted_on",
        )
        .map_err(|problem| problem.to_string())?;
    let mut by_day = std::collections::HashMap::new();
    let fetched = statement
        .query_map(params![prefix], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?, row.get::<_, i64>(2)?))
        })
        .map_err(|problem| problem.to_string())?;
    for entry in fetched {
        let (day, income, expense) = entry.map_err(|problem| problem.to_string())?;
        by_day.insert(day, (income, expense));
    }
    Ok((1..=days)
        .map(|day| {
            let key = format!("{month}-{:02}", day);
            let (income_cents, expense_cents) = by_day.get(&key).copied().unwrap_or((0, 0));
            DailyPoint { day: key, income_cents, expense_cents }
        })
        .collect())
}

/// Imports a bank CSV into one account. Rows carry no FITID, so the dedupe
/// falls back to the statement fingerprint — the same key an OFX without
/// FITID would produce, which is what makes reimports and OFX/CSV overlaps
/// land on `duplicates` instead of doubling the ledger.
pub fn import_csv(
    connection: &mut Connection,
    path: &Path,
    account_id: i64,
    mapping: &crate::csv::CsvMapping,
) -> Result<ImportReport, String> {
    let bytes = std::fs::read(path).map_err(|problem| problem.to_string())?;
    let text = crate::csv::decode_bytes(&bytes, &mapping.encoding)?;
    let (rows, issues) = crate::csv::parse_csv(&text, mapping)?;
    let skipped = issues.len() as i64;

    let (bank_id, acct_id, account_name): (String, String, String) = connection
        .query_row(
            "select bank_id, acct_id, name from accounts where id = ?1 and deleted_at is null",
            params![account_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|problem| problem.to_string())?
        .ok_or_else(|| format!("account {account_id} does not exist"))?;
    let account_key = format!("{bank_id}-{acct_id}");

    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let imported_at = Utc::now().to_rfc3339();
    let source = path.to_string_lossy().to_string();
    let mut inserted = 0i64;
    let mut duplicates = 0i64;
    let mut seen = std::collections::HashMap::new();
    for row in &rows {
        let dedupe_key = occurrence_key(&mut seen, crate::ofx::dedupe_key(
            &account_key,
            "",
            &row.posted_on,
            row.amount_cents,
            &row.description,
        ));
        let trntype = if row.amount_cents < 0 { "DEBIT" } else { "CREDIT" };
        let affected = transaction
            .execute(
                "insert or ignore into transactions
                 (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
                  dedupe_key, source, origin, created_at, uid, updated_at)
                 values (?1, ?2, ?3, ?4, ?5, '', ?6, ?7, ?8, 'csv', ?9,
                         lower(hex(randomblob(16))), ?9)",
                params![
                    account_id,
                    row.posted_on,
                    row.amount_cents,
                    row.description,
                    crate::ofx::merchant_of(&row.description),
                    trntype,
                    dedupe_key,
                    source,
                    imported_at
                ],
            )
            .map_err(|problem| problem.to_string())?;
        if affected == 1 {
            inserted += 1;
        } else {
            duplicates += 1;
        }
    }

    transaction
        .execute(
            "insert into imports (path, account_id, imported_at, inserted, duplicates, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, lower(hex(randomblob(16))), ?3)",
            params![source, account_id, imported_at, inserted, duplicates],
        )
        .map_err(|problem| problem.to_string())?;

    let categorized = apply_rules_in(&transaction)?;

    transaction.commit().map_err(|problem| problem.to_string())?;

    Ok(ImportReport {
        account_id,
        account_name,
        account_label: acct_id,
        inserted,
        duplicates,
        skipped,
        categorized,
        ledger_balance_cents: None,
        ledger_balance_on: None,
    })
}

pub fn list_categories(connection: &Connection) -> Result<Vec<Category>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, kind, color, parent_id, emoji, sort_order, archived_at
             from categories
             where deleted_at is null and archived_at is null
             order by sort_order, name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                color: row.get(3)?,
                parent_id: row.get(4)?,
                emoji: row.get(5)?,
                sort_order: row.get(6)?,
                archived_at: row.get(7)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: i64,
    pub name: String,
}

pub fn list_tags(connection: &Connection) -> Result<Vec<Tag>, String> {
    let mut statement = connection
        .prepare("select id, name from tags order by name")
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| Ok(Tag { id: row.get(0)?, name: row.get(1)? }))
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_tag(connection: &Connection, name: &str) -> Result<i64, String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("tag name must not be empty".to_string());
    }
    if name.chars().count() > 40 {
        return Err("tag name is too long".to_string());
    }
    let stamp = Utc::now().to_rfc3339();
    connection
        .execute(
            "insert into tags (uid, name, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?2)",
            params![name, stamp],
        )
        .map_err(|problem| {
            if problem.to_string().contains("UNIQUE constraint failed") {
                "a tag with this name already exists".to_string()
            } else {
                problem.to_string()
            }
        })?;
    Ok(connection.last_insert_rowid())
}

pub fn delete_tag(connection: &Connection, id: i64) -> Result<(), String> {
    let affected = connection
        .execute("delete from tags where id = ?1", params![id])
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("tag {id} does not exist"));
    }
    connection
        .execute("delete from transaction_tags where tag_id = ?1", params![id])
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Holding {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub updated_on: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HoldingInput {
    pub id: Option<i64>,
    pub name: String,
    pub kind: String,
    pub amount_cents: i64,
    pub updated_on: String,
}

fn check_holding_kind(kind: &str) -> Result<(), String> {
    match kind {
        "cash" | "investment" | "property" | "other" => Ok(()),
        other => Err(format!("unknown holding kind: {other}")),
    }
}

pub fn list_holdings(connection: &Connection) -> Result<Vec<Holding>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, kind, amount_cents, updated_on from holdings
             where deleted_at is null order by name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Holding {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                amount_cents: row.get(3)?,
                updated_on: row.get(4)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_holding(connection: &Connection, input: &HoldingInput) -> Result<i64, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("holding name must not be empty".to_string());
    }
    if name.chars().count() > 60 {
        return Err("holding name is too long".to_string());
    }
    check_holding_kind(&input.kind)?;
    if input.amount_cents < 0 {
        return Err("holding amount must not be negative".to_string());
    }
    check_date(&input.updated_on)?;
    let stamp = Utc::now().to_rfc3339();
    let affected = match input.id {
        Some(id) => connection.execute(
            "update holdings set name = ?1, kind = ?2, amount_cents = ?3, updated_on = ?4, updated_at = ?5
             where id = ?6 and deleted_at is null",
            params![name, input.kind, input.amount_cents, input.updated_on, stamp, id],
        ),
        None => connection.execute(
            "insert into holdings (uid, name, kind, amount_cents, updated_on, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?5)",
            params![name, input.kind, input.amount_cents, input.updated_on, stamp],
        ),
    }
    .map_err(|problem| {
        if problem.to_string().contains("UNIQUE constraint failed") {
            "a holding with this name already exists".to_string()
        } else {
            problem.to_string()
        }
    })?;
    if affected == 0 {
        return Err("holding does not exist".to_string());
    }
    Ok(input.id.unwrap_or_else(|| connection.last_insert_rowid()))
}

pub fn delete_holding(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update holdings set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("holding {id} does not exist"));
    }
    Ok(())
}

fn placeholders(count: usize) -> String {
    (0..count).map(|_| "?").collect::<Vec<_>>().join(", ")
}

/// Recategorizes many rows at once. Transfer legs are never touched: their
/// null category is load-bearing for the totals, not a gap to fill.
pub fn bulk_set_category(
    connection: &Connection,
    ids: &[i64],
    category_id: Option<i64>,
) -> Result<i64, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    if let Some(category) = category_id {
        let found: Option<i64> = connection
            .query_row(
                "select id from categories where id = ?1 and deleted_at is null",
                params![category],
                |row| row.get(0),
            )
            .optional()
            .map_err(|problem| problem.to_string())?;
        if found.is_none() {
            return Err(format!("category {category} does not exist"));
        }
    }
    let query = format!(
        "update transactions set category_id = ?1
         where id in ({}) and transfer_group is null and deleted_at is null",
        placeholders(ids.len())
    );
    let mut statement = connection
        .prepare(&query)
        .map_err(|problem| problem.to_string())?;
    let mut values: Vec<&dyn rusqlite::ToSql> = vec![&category_id];
    for id in ids {
        values.push(id);
    }
    let affected = statement
        .execute(values.as_slice())
        .map_err(|problem| problem.to_string())?;
    // Refunds net against their original's category, so they follow it.
    let refunds = format!(
        "update transactions set category_id = ?1
         where refund_of in ({}) and transfer_group is null and deleted_at is null",
        placeholders(ids.len())
    );
    connection
        .execute(&refunds, values.as_slice())
        .map_err(|problem| problem.to_string())?;
    Ok(affected as i64)
}

/// Attaches or detaches one tag on many rows. Tags are metadata, so imported
/// rows take them like manual ones; deleted rows are silently skipped.
pub fn bulk_tag(connection: &Connection, ids: &[i64], tag_id: i64, assign: bool) -> Result<i64, String> {
    if ids.is_empty() {
        return Ok(0);
    }
    let found: Option<i64> = connection
        .query_row("select id from tags where id = ?1", params![tag_id], |row| row.get(0))
        .optional()
        .map_err(|problem| problem.to_string())?;
    if found.is_none() {
        return Err(format!("tag {tag_id} does not exist"));
    }
    let mut affected = 0i64;
    if assign {
        for id in ids {
            affected += connection
                .execute(
                    "insert or ignore into transaction_tags (transaction_id, tag_id)
                     select ?1, ?2 where exists
                       (select 1 from transactions where id = ?1 and deleted_at is null)",
                    params![id, tag_id],
                )
                .map_err(|problem| problem.to_string())? as i64;
        }
    } else {
        let query = format!(
            "delete from transaction_tags where tag_id = ?1 and transaction_id in ({})",
            placeholders(ids.len())
        );
        let mut statement = connection
            .prepare(&query)
            .map_err(|problem| problem.to_string())?;
        let mut values: Vec<&dyn rusqlite::ToSql> = vec![&tag_id];
        for id in ids {
            values.push(id);
        }
        affected = statement.execute(values.as_slice()).map_err(|problem| problem.to_string())? as i64;
    }
    Ok(affected)
}

pub fn list_transactions(
    connection: &Connection,
    search: Option<&str>,
    month: Option<&str>,
    account_id: Option<i64>,
    limit: i64,
    tag_id: Option<i64>,
) -> Result<Vec<TransactionRow>, String> {
    let pattern = search
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| format!("%{}%", value));
    let month_pattern = month
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| format!("{value}%"));

    let mut statement = connection
        .prepare(
            "select t.id, t.account_id, a.name, t.posted_on, t.amount_cents, t.description,
                    t.merchant, t.category_id, c.name, c.color, t.trntype, t.origin, t.notes,
                    t.transfer_group, t.refund_of,
                    exists(select 1 from transactions r where r.refund_of = t.id and r.deleted_at is null)
             from transactions t
             join accounts a on a.id = t.account_id
             left join categories c on c.id = t.category_id
             where (?1 is null
                    or t.description like ?1 collate nocase
                    or t.merchant like ?1 collate nocase
                    or c.name like ?1 collate nocase
                    or exists (select 1 from transaction_tags tt
                               join tags tg on tg.id = tt.tag_id
                               where tt.transaction_id = t.id and tg.name like ?1 collate nocase))
               and (?2 is null or t.posted_on like ?2)
               and (?3 is null or t.account_id = ?3)
               and (?5 is null
                    or exists (select 1 from transaction_tags tt
                               where tt.transaction_id = t.id and tt.tag_id = ?5))
               and t.deleted_at is null
               and a.deleted_at is null
             order by t.posted_on desc, t.id desc
             limit ?4",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![pattern, month_pattern, account_id, limit, tag_id], |row| {
            let origin: String = row.get(11)?;
            Ok(TransactionRow {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                posted_on: row.get(3)?,
                amount_cents: row.get(4)?,
                description: row.get(5)?,
                merchant: row.get(6)?,
                category_id: row.get(7)?,
                category_name: row.get(8)?,
                category_color: row.get(9)?,
                trntype: row.get(10)?,
                manual: origin == "manual",
                notes: row.get(12)?,
                origin,
                transfer_group: row.get(13)?,
                refund_of: row.get(14)?,
                has_refund: row.get(15)?,
                tags: Vec::new(),
            })
        })
        .map_err(|problem| problem.to_string())?;

    let mut rows = rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())?;
    if !rows.is_empty() {
        let ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
        let query = format!(
            "select tt.transaction_id, g.id, g.name from transaction_tags tt
             join tags g on g.id = tt.tag_id
             where tt.transaction_id in ({}) order by g.name",
            placeholders(ids.len())
        );
        let mut statement = connection
            .prepare(&query)
            .map_err(|problem| problem.to_string())?;
        let mut values: Vec<&dyn rusqlite::ToSql> = Vec::new();
        for id in &ids {
            values.push(id);
        }
        let mapped = statement
            .query_map(values.as_slice(), |row| {
                Ok((row.get::<_, i64>(0)?, Tag { id: row.get(1)?, name: row.get(2)? }))
            })
            .map_err(|problem| problem.to_string())?;
        let mut by_row: std::collections::HashMap<i64, Vec<Tag>> = std::collections::HashMap::new();
        for entry in mapped {
            let (transaction_id, tag) = entry.map_err(|problem| problem.to_string())?;
            by_row.entry(transaction_id).or_default().push(tag);
        }
        for row in &mut rows {
            row.tags = by_row.remove(&row.id).unwrap_or_default();
        }
    }
    Ok(rows)
}

pub fn set_category(
    connection: &Connection,
    transaction_id: i64,
    category_id: Option<i64>,
) -> Result<(), String> {
    let exists: Option<i64> = connection
        .query_row(
            "select id from transactions where id = ?1 and deleted_at is null",
            params![transaction_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if exists.is_none() {
        return Err(format!("transaction {} does not exist", transaction_id));
    }
    let affected = bulk_set_category(connection, &[transaction_id], category_id)?;
    if affected == 0 {
        return Err(format!("transaction {} is a transfer and has no category", transaction_id));
    }
    Ok(())
}

/// Dumps the filtered ledger to a `;`-separated file the import understands:
/// date (DD/MM/YYYY), description and amount (comma decimal) come first, so
/// reimporting with columns 0/1/2 is a no-op through the fingerprint dedupe.
/// Account, category, origin and notes ride along as context, never as keys.
pub fn export_csv(
    connection: &Connection,
    path: &Path,
    search: Option<&str>,
    month: Option<&str>,
    account_id: Option<i64>,
    tag_id: Option<i64>,
) -> Result<i64, String> {
    let pattern = search
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| format!("%{}%", value));
    let month_pattern = month
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| format!("{value}%"));

    let mut statement = connection
        .prepare(
            "select t.posted_on, t.description, t.amount_cents, a.name,
                    coalesce(c.name, ''), t.origin, coalesce(t.notes, '')
             from transactions t
             join accounts a on a.id = t.account_id
             left join categories c on c.id = t.category_id
             where (?1 is null
                    or t.description like ?1 collate nocase
                    or t.merchant like ?1 collate nocase
                    or c.name like ?1 collate nocase
                    or exists (select 1 from transaction_tags tt
                               join tags tg on tg.id = tt.tag_id
                               where tt.transaction_id = t.id and tg.name like ?1 collate nocase))
               and (?2 is null or t.posted_on like ?2)
               and (?3 is null or t.account_id = ?3)
               and (?4 is null
                    or exists (select 1 from transaction_tags tt
                               where tt.transaction_id = t.id and tt.tag_id = ?4))
               and t.deleted_at is null
               and a.deleted_at is null
             order by t.posted_on asc, t.id asc",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![pattern, month_pattern, account_id, tag_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|problem| problem.to_string())?;

    let cell = |value: &str| {
        if value.contains([';', '"', '\n', '\r']) {
            format!("\"{}\"", value.replace('"', "\"\""))
        } else {
            value.to_string()
        }
    };
    let br_date = |iso: &str| match iso.split('-').collect::<Vec<_>>().as_slice() {
        [year, month, day] => format!("{day}/{month}/{year}"),
        _ => iso.to_string(),
    };
    let br_amount = |cents: i64| {
        let sign = if cents < 0 { "-" } else { "" };
        let abs = cents.abs();
        format!("{sign}{},{:02}", abs / 100, abs % 100)
    };

    let mut text = String::from("data;descricao;valor;conta;categoria;origem;notas\n");
    let mut count = 0i64;
    for row in rows {
        let (posted_on, description, amount_cents, account, category, origin, notes) =
            row.map_err(|problem| problem.to_string())?;
        text.push_str(&format!(
            "{};{};{};{};{};{};{}\n",
            cell(&br_date(&posted_on)),
            cell(&description),
            cell(&br_amount(amount_cents)),
            cell(&account),
            cell(&category),
            cell(&origin),
            cell(&notes),
        ));
        count += 1;
    }
    std::fs::write(path, text).map_err(|problem| problem.to_string())?;
    Ok(count)
}

/// Copies the live database to `dest` as one consistent snapshot. `VACUUM
/// INTO` reads through the WAL, so the backup is complete even while the app
/// holds the file open.
pub fn backup_to(connection: &Connection, dest: &Path) -> Result<(), String> {
    if dest.to_string_lossy().trim().is_empty() {
        return Err("backup destination must not be empty".to_string());
    }
    // VACUUM INTO refuses an existing file, so write next to it and swap in.
    let mut temp_name = dest.file_name().unwrap_or_default().to_os_string();
    temp_name.push(".tmp");
    let temp = dest.with_file_name(temp_name);
    let _ = std::fs::remove_file(&temp);
    let quoted = temp.to_string_lossy().replace('\'', "''");
    let result = connection
        .execute_batch(&format!("VACUUM INTO '{quoted}'"))
        .map_err(|problem| problem.to_string())
        .and_then(|()| std::fs::rename(&temp, dest).map_err(|problem| problem.to_string()));
    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    result
}

/// Refuses anything that is not a trove database before it can replace the
/// live file: the file must open, pass `integrity_check`, carry a schema
/// version in range and contain the transactions table.
pub fn validate_backup_source(path: &Path) -> Result<(), String> {
    let connection = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| "not a trove database".to_string())?;
    let check: String = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|_| "not a trove database".to_string())?;
    if check.to_lowercase() != "ok" {
        return Err("not a trove database".to_string());
    }
    let version: Option<String> = connection
        .query_row("select value from settings where key = 'schema_version'", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|_| "not a trove database".to_string())?;
    let version = version
        .and_then(|text| text.parse::<i64>().ok())
        .ok_or_else(|| "not a trove database".to_string())?;
    if !(1..=SCHEMA_VERSION).contains(&version) {
        return Err("backup is from an incompatible app version".to_string());
    }
    if !has_table(&connection, "transactions").map_err(|problem| problem.to_string())? {
        return Err("not a trove database".to_string());
    }
    Ok(())
}

/// A monthly spending target for a category. Null removes the target.
pub fn set_category_budget(
    connection: &Connection,
    category_id: i64,
    budget_cents: Option<i64>,
) -> Result<(), String> {
    if budget_cents.is_some_and(|budget| budget <= 0) {
        return Err("budget must be positive".to_string());
    }
    let affected = connection
        .execute(
            "update categories set budget_cents = ?1 where id = ?2",
            params![budget_cents, category_id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("category {category_id} does not exist"));
    }
    Ok(())
}

/// Soft deletes a transaction and frees its dedupe key, so importing the same
/// statement again brings the row back instead of being swallowed by the unique
/// key. SQLite cannot drop the inline `unique (dedupe_key)` without rebuilding
/// the fact table, so the tombstone takes a suffixed key instead.
#[allow(dead_code)] // the delete path of the tombstone design, covered by tests
pub fn soft_delete_transaction(connection: &Connection, transaction_id: i64) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update transactions
             set deleted_at = ?1,
                 updated_at = ?1,
                 dedupe_key = dedupe_key || ':del:' || uid
             where id = ?2 and deleted_at is null",
            params![now, transaction_id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!(
            "transaction {transaction_id} does not exist or is already deleted"
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualInput {
    pub account_id: i64,
    pub posted_on: String,
    pub amount_cents: i64,
    pub description: String,
    pub category_id: Option<i64>,
    pub notes: String,
}

/// A hand-entered row. It takes a unique key in the manual namespace, so it
/// can never collide with an import and the dedupe rule stays import-only.
/// Signs follow the OFX convention: negative is spending, positive is income.
pub fn save_manual_transaction(
    connection: &Connection,
    input: &ManualInput,
) -> Result<i64, String> {
    if input.amount_cents == 0 {
        return Err("amount must not be zero".to_string());
    }
    let description = input.description.trim();
    if description.is_empty() {
        return Err("description must not be empty".to_string());
    }
    check_date(&input.posted_on)?;
    let account: Option<i64> = connection
        .query_row(
            "select id from accounts where id = ?1 and deleted_at is null",
            params![input.account_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if account.is_none() {
        return Err(format!("account {} does not exist", input.account_id));
    }
    if let Some(category_id) = input.category_id {
        let category: Option<i64> = connection
            .query_row(
                "select id from categories where id = ?1 and deleted_at is null",
                params![category_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|problem| problem.to_string())?;
        if category.is_none() {
            return Err(format!("category {category_id} does not exist"));
        }
    }
    let stamp = Utc::now().to_rfc3339();
    let trntype = if input.amount_cents < 0 { "DEBIT" } else { "CREDIT" };
    connection
        .execute(
            "insert into transactions
             (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
              category_id, notes, origin, dedupe_key, source, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, '', ?6, ?7, ?8, 'manual',
                     'manual:' || lower(hex(randomblob(16))), 'manual', ?9,
                     lower(hex(randomblob(16))), ?9)",
            params![
                input.account_id,
                input.posted_on,
                input.amount_cents,
                description,
                crate::ofx::merchant_of(description),
                trntype,
                input.category_id,
                input.notes,
                stamp
            ],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(connection.last_insert_rowid())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualEdit {
    pub id: i64,
    pub account_id: i64,
    pub posted_on: String,
    pub amount_cents: i64,
    pub description: String,
    pub category_id: Option<i64>,
    pub notes: String,
}

/// Edits a hand-entered row. Imported statements are read-only history: only
/// `origin = 'manual'` rows open here, so an edit can never rewrite a bank file.
pub fn update_manual_transaction(
    connection: &Connection,
    input: &ManualEdit,
) -> Result<(), String> {
    if input.amount_cents == 0 {
        return Err("amount must not be zero".to_string());
    }
    let description = input.description.trim();
    if description.is_empty() {
        return Err("description must not be empty".to_string());
    }
    check_date(&input.posted_on)?;
    let existing: Option<(String, Option<String>, Option<i64>)> = connection
        .query_row(
            "select origin, transfer_group, refund_of from transactions where id = ?1 and deleted_at is null",
            params![input.id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    match existing {
        None => return Err(format!("transaction {} does not exist", input.id)),
        Some((origin, _, _)) if origin != "manual" => {
            return Err("only manual entries can be edited".to_string())
        }
        // Legs carry derived amounts and links: editing one would silently
        // unbalance its pair, so they are deleted and recreated instead.
        Some((_, Some(_), _)) | Some((_, _, Some(_))) => {
            return Err("transfer and refund entries cannot be edited".to_string())
        }
        _ => {}
    }
    let account: Option<i64> = connection
        .query_row(
            "select id from accounts where id = ?1 and deleted_at is null",
            params![input.account_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if account.is_none() {
        return Err(format!("account {} does not exist", input.account_id));
    }
    if let Some(category_id) = input.category_id {
        let category: Option<i64> = connection
            .query_row(
                "select id from categories where id = ?1 and deleted_at is null",
                params![category_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|problem| problem.to_string())?;
        if category.is_none() {
            return Err(format!("category {category_id} does not exist"));
        }
    }
    let stamp = Utc::now().to_rfc3339();
    let trntype = if input.amount_cents < 0 { "DEBIT" } else { "CREDIT" };
    let affected = connection
        .execute(
            "update transactions
             set account_id = ?1, posted_on = ?2, amount_cents = ?3, description = ?4,
                 merchant = ?5, trntype = ?6, category_id = ?7, notes = ?8, updated_at = ?9
             where id = ?10 and origin = 'manual' and deleted_at is null",
            params![
                input.account_id,
                input.posted_on,
                input.amount_cents,
                description,
                crate::ofx::merchant_of(description),
                trntype,
                input.category_id,
                input.notes,
                stamp,
                input.id
            ],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("transaction {} does not exist", input.id));
    }
    Ok(())
}

/// Deletes a hand-entered row through the tombstone, freeing nothing else:
/// manual keys live in their own namespace, so no import can collide.
/// A transfer leg routes here too and takes its pair along; an original with
/// a live refund is refused, so the link never dangles.
pub fn delete_manual_transaction(connection: &Connection, id: i64) -> Result<(), String> {
    let found: Option<(String, Option<String>)> = connection
        .query_row(
            "select origin, transfer_group from transactions where id = ?1 and deleted_at is null",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    let transfer_group = match found {
        None => return Err(format!("transaction {id} does not exist")),
        Some((origin, _group)) if origin != "manual" => {
            return Err("only manual entries can be deleted".to_string())
        }
        Some((_, group)) => group,
    };
    if transfer_group.is_some() {
        return delete_transfer(connection, id);
    }
    let refunds: i64 = connection
        .query_row(
            "select count(*) from transactions where refund_of = ?1 and deleted_at is null",
            params![id],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    if refunds > 0 {
        return Err("entry has a refund linked to it".to_string());
    }
    soft_delete_transaction(connection, id)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferInput {
    pub from_account_id: i64,
    pub to_account_id: i64,
    pub posted_on: String,
    pub amount_cents: i64,
    pub description: String,
    pub notes: String,
}

fn live_account(connection: &Connection, id: i64) -> Result<(), String> {
    let found: Option<i64> = connection
        .query_row(
            "select id from accounts where id = ?1 and deleted_at is null",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    if found.is_none() {
        return Err(format!("account {id} does not exist"));
    }
    Ok(())
}

/// Moves money between own accounts as one atomic event: a debit leg and a
/// credit leg sharing a group id. Both legs stay out of income, spending and
/// category totals, and neither leg can be edited alone — the pair only
/// moves or vanishes together.
pub fn save_transfer(connection: &mut Connection, input: &TransferInput) -> Result<String, String> {
    if input.amount_cents <= 0 {
        return Err("transfer amount must be positive".to_string());
    }
    if input.from_account_id == input.to_account_id {
        return Err("transfer needs two different accounts".to_string());
    }
    let description = input.description.trim();
    if description.is_empty() {
        return Err("description must not be empty".to_string());
    }
    check_date(&input.posted_on)?;
    live_account(connection, input.from_account_id)?;
    live_account(connection, input.to_account_id)?;

    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let stamp = Utc::now().to_rfc3339();
    let merchant = crate::ofx::merchant_of(description);
    transaction
        .execute(
            "insert into transactions
             (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
              notes, origin, transfer_group, dedupe_key, source, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, '', 'DEBIT', ?6, 'manual',
                     'transfer:' || lower(hex(randomblob(16))),
                     'transfer:' || lower(hex(randomblob(16))) || ':out', 'manual', ?7,
                     lower(hex(randomblob(16))), ?7)",
            params![
                input.from_account_id,
                input.posted_on,
                -input.amount_cents,
                description,
                merchant,
                input.notes,
                stamp
            ],
        )
        .map_err(|problem| problem.to_string())?;
    // Two random ids cannot pair up, so the out leg lends its group to the in
    // leg through the row it just wrote.
    let group: String = transaction
        .query_row(
            "select transfer_group from transactions where id = last_insert_rowid()",
            [],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    transaction
        .execute(
            "insert into transactions
             (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
              notes, origin, transfer_group, dedupe_key, source, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, '', 'CREDIT', ?6, 'manual', ?7,
                     ?7 || ':in', 'manual', ?8,
                     lower(hex(randomblob(16))), ?8)",
            params![
                input.to_account_id,
                input.posted_on,
                input.amount_cents,
                description,
                merchant,
                input.notes,
                group,
                stamp
            ],
        )
        .map_err(|problem| problem.to_string())?;
    transaction.commit().map_err(|problem| problem.to_string())?;
    Ok(group)
}

/// Deletes both legs of a transfer through the tombstone. Single-leg deletes
/// would leave money appearing from nowhere, so the group only vanishes whole.
pub fn delete_transfer(connection: &Connection, id: i64) -> Result<(), String> {
    let group: Option<Option<String>> = connection
        .query_row(
            "select transfer_group from transactions where id = ?1 and deleted_at is null",
            params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())?;
    let group = match group {
        None => return Err(format!("transaction {id} does not exist")),
        Some(None) => return Err("entry is not a transfer".to_string()),
        Some(Some(group)) => group,
    };
    let stamp = Utc::now().to_rfc3339();
    let affected = connection
        .execute(
            "update transactions
             set deleted_at = ?1, updated_at = ?1, dedupe_key = dedupe_key || ':del:' || uid
             where transfer_group = ?2 and deleted_at is null",
            params![stamp, group],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("transaction {id} does not exist"));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefundInput {
    pub original_id: i64,
    pub posted_on: Option<String>,
    pub notes: Option<String>,
}

/// Returns money on one row: a mirrored leg linked through `refund_of` that
/// nets against the same side instead of inflating the other. One refund per
/// original, full amount, same account and category — partial or chained
/// refunds would silently rewrite history, so they are refused.
pub fn save_refund(connection: &Connection, input: &RefundInput) -> Result<i64, String> {
    let original: Option<(i64, String, String, String, Option<i64>, Option<String>, Option<i64>)> =
        connection
            .query_row(
                "select amount_cents, posted_on, description, merchant, category_id,
                        transfer_group, refund_of
                 from transactions where id = ?1 and deleted_at is null",
                params![input.original_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                    ))
                },
            )
            .optional()
            .map_err(|problem| problem.to_string())?;
    let (amount, posted_on, description, merchant, category_id, transfer_group, refund_of) =
        original.ok_or_else(|| format!("transaction {} does not exist", input.original_id))?;
    if transfer_group.is_some() {
        return Err("transfer legs cannot be refunded".to_string());
    }
    if refund_of.is_some() {
        return Err("a refund cannot be refunded again".to_string());
    }
    let already: i64 = connection
        .query_row(
            "select count(*) from transactions where refund_of = ?1 and deleted_at is null",
            params![input.original_id],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    if already > 0 {
        return Err("entry already has a refund".to_string());
    }
    let posted_on = input.posted_on.clone().unwrap_or(posted_on);
    check_date(&posted_on)?;
    let account: i64 = connection
        .query_row(
            "select account_id from transactions where id = ?1",
            params![input.original_id],
            |row| row.get(0),
        )
        .map_err(|problem| problem.to_string())?;
    let stamp = Utc::now().to_rfc3339();
    let trntype = if amount > 0 { "DEBIT" } else { "CREDIT" };
    connection
        .execute(
            "insert into transactions
             (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
              category_id, notes, origin, refund_of, dedupe_key, source, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, '', ?6, ?7, ?8, 'manual', ?9,
                     'refund:' || lower(hex(randomblob(16))), 'manual', ?10,
                     lower(hex(randomblob(16))), ?10)",
            params![
                account,
                posted_on,
                -amount,
                description,
                merchant,
                trntype,
                category_id,
                input.notes.clone().unwrap_or_default(),
                input.original_id,
                stamp
            ],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(connection.last_insert_rowid())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearReport {
    pub manual_deleted: i64,
    pub payments_cleared: i64,
}

/// Resets a month to its imported state: hand-entered rows and bill-payment
/// marks go away, imported statements never do. Debts are records of their
/// own and stay, settled or not.
pub fn clear_month(connection: &mut Connection, month: &str) -> Result<ClearReport, String> {
    check_month(month)?;
    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let prefix = format!("{month}%");
    let now = Utc::now().to_rfc3339();
    let cleared = "select id from transactions
                   where posted_on like ?1 and source = 'manual' and deleted_at is null";
    // Manual refunds of a cleared purchase go with it; imported ones stay but
    // lose the link, since there is no purchase left to net against.
    transaction
        .execute(
            &format!(
                "update transactions set deleted_at = ?2, updated_at = ?2
                 where refund_of in ({cleared}) and source = 'manual' and deleted_at is null"
            ),
            params![prefix, now],
        )
        .map_err(|problem| problem.to_string())?;
    transaction
        .execute(
            &format!(
                "update transactions set refund_of = null, updated_at = ?2
                 where refund_of in ({cleared}) and deleted_at is null"
            ),
            params![prefix, now],
        )
        .map_err(|problem| problem.to_string())?;
    transaction
        .execute(
            &format!("delete from transaction_tags where transaction_id in ({cleared})"),
            params![prefix],
        )
        .map_err(|problem| problem.to_string())?;
    let manual_deleted = transaction
        .execute(
            "update transactions set deleted_at = ?2, updated_at = ?2
             where posted_on like ?1 and source = 'manual' and deleted_at is null",
            params![prefix, now],
        )
        .map_err(|problem| problem.to_string())?;
    let payments_cleared = transaction
        .execute("delete from bill_payments where month = ?1", params![month])
        .map_err(|problem| problem.to_string())?;
    transaction
        .commit()
        .map_err(|problem| problem.to_string())?;
    Ok(ClearReport {
        manual_deleted: manual_deleted as i64,
        payments_cleared: payments_cleared as i64,
    })
}

/// Every file that ever entered the ledger, newest first.
pub fn list_imports(connection: &Connection, limit: i64) -> Result<Vec<ImportRow>, String> {
    let mut statement = connection
        .prepare(
            "select i.id, i.path, a.name, i.imported_at, i.inserted, i.duplicates
             from imports i
             join accounts a on a.id = i.account_id
             order by i.imported_at desc
             limit ?1",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![limit], |row| {
            Ok(ImportRow {
                id: row.get(0)?,
                path: row.get(1)?,
                account_name: row.get(2)?,
                imported_at: row.get(3)?,
                inserted: row.get(4)?,
                duplicates: row.get(5)?,
            })
        })
        .map_err(|problem| problem.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// The most recent month that actually has an entry, so the app opens on data
/// instead of on an empty current month.
pub fn latest_month(connection: &Connection) -> Result<Option<String>, String> {
    connection
        .query_row(
            "select max(substr(posted_on, 1, 7)) from transactions where deleted_at is null",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .map_err(|problem| problem.to_string())
}

pub fn month_totals(connection: &Connection, month: &str) -> Result<MonthTotals, String> {
    check_month(month)?;
    let prefix = format!("{month}%");
    // Transfers move money between own accounts, so both legs stay out of
    // income and spending. Refund legs net against their own side instead of
    // inflating the other: a returned purchase lowers spending, not raises
    // income. The balance stays exact because both sides move together.
    let (income, expense, count): (i64, i64, i64) = connection
        .query_row(
            "select
                coalesce(sum(case when amount_cents > 0 and refund_of is null then amount_cents else 0 end), 0)
                - coalesce(sum(case when amount_cents < 0 and refund_of is not null then -amount_cents else 0 end), 0),
                coalesce(sum(case when amount_cents < 0 and refund_of is null then -amount_cents else 0 end), 0)
                - coalesce(sum(case when amount_cents > 0 and refund_of is not null then amount_cents else 0 end), 0),
                count(*)
             from transactions
             where posted_on like ?1 and transfer_group is null and deleted_at is null",
            params![prefix],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        )
        .map_err(|problem| problem.to_string())?;

    Ok(MonthTotals {
        month: month.to_string(),
        // A refund dated into an emptier month nets below zero; the screen
        // never shows a negative side, and the common same-month case is exact.
        income_cents: income.max(0),
        expense_cents: expense.max(0),
        transaction_count: count,
    })
}

/// Expense per category for one month, biggest first. Spending in a child
/// category rolls up into its top-level parent, so the bar and the budget
/// compare against the same household buckets. Uncategorized spending is kept
/// as its own row so the numbers on screen always add up to the total.
/// Transfers are not spending and stay out; linked refunds net against the
/// same bucket, so a returned purchase lowers its category instead of
/// inflating income.
pub fn category_totals(connection: &Connection, month: &str) -> Result<Vec<CategoryTotal>, String> {
    check_month(month)?;
    let prefix = format!("{month}%");
    let mut statement = connection
        .prepare(
            "with recursive roots(id, root_id) as (
               select id, id from categories where parent_id is null
               union all
               select c.id, roots.root_id from categories c join roots on c.parent_id = roots.id
             )
             select coalesce(g.id, t.category_id),
                    coalesce(g.name, 'Uncategorized'), coalesce(g.color, '#9aa3af'),
                    max(0, sum(case when t.amount_cents < 0 and t.refund_of is null then -t.amount_cents else 0 end)
                          - sum(case when t.amount_cents > 0 and t.refund_of is not null then t.amount_cents else 0 end)) as total,
                    max(g.budget_cents)
             from transactions t
             left join roots r on r.id = t.category_id
             left join categories g on g.id = coalesce(r.root_id, t.category_id)
             where t.posted_on like ?1 and t.transfer_group is null
               and ((t.amount_cents < 0 and t.refund_of is null)
                    or (t.amount_cents > 0 and t.refund_of is not null))
               and t.deleted_at is null
             group by coalesce(g.id, t.category_id)
             order by total desc",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![prefix], |row| {
            Ok(CategoryTotal {
                category_id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                total_cents: row.get(3)?,
                budget_cents: row.get(4)?,
            })
        })
        .map_err(|problem| problem.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// Spending per category per month inside a calendar window, biggest slice
/// first within each month. Sparse by design: a missing (month, category)
/// pair spent nothing, and income never shows up here.
pub fn category_month_series(
    connection: &Connection,
    end_month: &str,
    count: i64,
) -> Result<Vec<CategoryMonth>, String> {
    let end = NaiveDate::parse_from_str(&format!("{end_month}-01"), "%Y-%m-%d")
        .map_err(|problem| problem.to_string())?;
    let start = end
        .checked_sub_months(Months::new(count.max(1) as u32 - 1))
        .ok_or_else(|| "month window out of range".to_string())?;
    let mut statement = connection
        .prepare(
            "with recursive roots(id, root_id) as (
               select id, id from categories where parent_id is null
               union all
               select c.id, roots.root_id from categories c join roots on c.parent_id = roots.id
             )
             select substr(t.posted_on, 1, 7) as month, coalesce(c.id, t.category_id),
                    coalesce(c.name, 'Uncategorized'), coalesce(c.color, '#9aa3af'),
                    max(0, sum(case when t.amount_cents < 0 and t.refund_of is null then -t.amount_cents else 0 end)
                          - sum(case when t.amount_cents > 0 and t.refund_of is not null then t.amount_cents else 0 end)) as total
             from transactions t
             left join roots r on r.id = t.category_id
             left join categories c on c.id = coalesce(r.root_id, t.category_id)
             where t.posted_on >= ?1 and substr(t.posted_on, 1, 7) <= ?2
               and t.transfer_group is null
               and ((t.amount_cents < 0 and t.refund_of is null)
                    or (t.amount_cents > 0 and t.refund_of is not null))
               and t.deleted_at is null
             group by month, coalesce(c.id, t.category_id)
             order by month, total desc",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map(
            params![start.format("%Y-%m-%d").to_string(), end_month],
            |row| {
                Ok(CategoryMonth {
                    month: row.get(0)?,
                    category_id: row.get(1)?,
                    name: row.get(2)?,
                    color: row.get(3)?,
                    total_cents: row.get(4)?,
                })
            },
        )
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// A calendar window ending at `end_month`, with empty months filled in so the
/// chart never jumps around while there is little history.
pub fn month_series(
    connection: &Connection,
    end_month: &str,
    count: i64,
) -> Result<Vec<MonthPoint>, String> {
    if count <= 0 {
        return Ok(Vec::new());
    }

    let end = chrono::NaiveDate::parse_from_str(&format!("{end_month}-01"), "%Y-%m-%d")
        .map_err(|_| format!("invalid month: {end_month}"))?;
    let start = end - chrono::Months::new((count - 1) as u32);

    let mut points: Vec<MonthPoint> = (0..count)
        .map(|step| {
            let date = start + chrono::Months::new(step as u32);
            MonthPoint {
                month: date.format("%Y-%m").to_string(),
                income_cents: 0,
                expense_cents: 0,
            }
        })
        .collect();

    let from = points
        .first()
        .map(|point| format!("{}-01", point.month))
        .unwrap_or_else(|| format!("{end_month}-01"));

    let mut statement = connection
        .prepare(
            "select substr(posted_on, 1, 7) as month,
                    max(0, coalesce(sum(case when amount_cents > 0 and refund_of is null then amount_cents else 0 end), 0)
                           - coalesce(sum(case when amount_cents < 0 and refund_of is not null then -amount_cents else 0 end), 0)),
                    max(0, coalesce(sum(case when amount_cents < 0 and refund_of is null then -amount_cents else 0 end), 0)
                           - coalesce(sum(case when amount_cents > 0 and refund_of is not null then amount_cents else 0 end), 0))
             from transactions
             where posted_on >= ?1 and transfer_group is null and deleted_at is null
             group by month",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![from], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
            ))
        })
        .map_err(|problem| problem.to_string())?;

    for row in rows {
        let (month, income_cents, expense_cents) = row.map_err(|problem| problem.to_string())?;
        if let Some(point) = points.iter_mut().find(|point| point.month == month) {
            point.income_cents = income_cents;
            point.expense_cents = expense_cents;
        }
    }

    Ok(points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identical_rows_in_one_file_get_distinct_keys() {
        let mut seen = std::collections::HashMap::new();
        let first = occurrence_key(&mut seen, "hash|a|2024-03-05|-500|padaria".to_string());
        let second = occurrence_key(&mut seen, "hash|a|2024-03-05|-500|padaria".to_string());
        let fitid = occurrence_key(&mut seen, "fitid|a|1".to_string());
        assert_eq!(first, "hash|a|2024-03-05|-500|padaria");
        assert_eq!(second, "hash|a|2024-03-05|-500|padaria|#2");
        assert_eq!(fitid, "fitid|a|1");
    }
    use std::path::PathBuf;

    fn temporary_database(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("trove-test-{}-{}.db", name, std::process::id()));
        let _ = std::fs::remove_file(&path);
        path
    }

    const STATEMENT: &str = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>12345-6<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240305<TRNAMT>-23.90<FITID>A1<NAME>IFD*IFOOD SAO PAULO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240310<TRNAMT>1500.00<FITID>A2<NAME>SALARIO</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1476.10<DTASOF>20240331</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";

    #[test]
    fn imports_and_ignores_the_same_statement_twice() {
        let path = temporary_database("dedupe");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let first = import_ofx(&mut connection, &file).expect("first import");
        assert_eq!(first.inserted, 2);
        assert_eq!(first.duplicates, 0);
        assert_eq!(first.ledger_balance_cents, Some(147610));

        let second = import_ofx(&mut connection, &file).expect("second import");
        assert_eq!(second.inserted, 0);
        assert_eq!(second.duplicates, 2);

        let rows = list_transactions(&connection, None, None, None, 50, None).expect("should list");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].merchant, "SALARIO");

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.income_cents, 150000);
        assert_eq!(totals.expense_cents, 2390);

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn reports_category_totals_and_a_month_series() {
        let path = temporary_database("charts");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");

        let totals = category_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.len(), 1);
        assert_eq!(totals[0].name, "Uncategorized");
        assert_eq!(totals[0].total_cents, 2390);

        let series = month_series(&connection, "2024-03", 3).expect("should build the series");
        assert_eq!(series.len(), 3);
        assert_eq!(series[0].month, "2024-01");
        assert_eq!(series[2].month, "2024-03");
        assert_eq!(series[2].income_cents, 150000);
        assert_eq!(series[2].expense_cents, 2390);
        assert_eq!(series[0].expense_cents, 0);

        let empty_month = list_transactions(&connection, None, Some("2024-04"), None, 50, None).expect("should list");
        assert!(empty_month.is_empty());

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn category_budgets_ride_along_with_the_totals() {
        let path = temporary_database("budgets");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");

        let categories = list_categories(&connection).expect("should list");
        let food = categories.iter().find(|category| category.name == "Food").expect("seeded");
        set_category_budget(&connection, food.id, Some(90_000)).expect("should set");
        assert!(set_category_budget(&connection, food.id, Some(0)).is_err());
        assert!(set_category_budget(&connection, 999_999, Some(10_000)).is_err());

        let debit = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")
            .into_iter()
            .find(|row| row.amount_cents < 0)
            .expect("spending row");
        set_category(&connection, debit.id, Some(food.id)).expect("should categorize");

        let totals = category_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.len(), 1);
        assert_eq!(totals[0].name, "Food");
        assert_eq!(totals[0].budget_cents, Some(90_000));

        set_category_budget(&connection, food.id, None).expect("should clear");
        let totals = category_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals[0].budget_cents, None);

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn category_month_series_groups_spending_by_month() {
        let path = temporary_database("bymonth");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let report = import_ofx(&mut connection, &file).expect("should import");
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: report.account_id,
                posted_on: "2024-04-05".into(),
                amount_cents: -5_000,
                description: "Feira".into(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save");

        // Income never shows up; manual rows flow in like the rest.
        let rows = category_month_series(&connection, "2024-04", 3).expect("should group");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].month, "2024-03");
        assert_eq!(rows[0].total_cents, 2390);        assert_eq!(rows[0].name, "Uncategorized");
        assert_eq!(rows[1].month, "2024-04");
        assert_eq!(rows[1].total_cents, 5_000);

        // The window cuts older months out.
        let narrow = category_month_series(&connection, "2024-04", 1).expect("narrow");
        assert_eq!(narrow.len(), 1);
        assert_eq!(narrow[0].month, "2024-04");

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn manual_entries_skip_dedupe_and_count_in_the_month() {
        let path = temporary_database("manual");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let report = import_ofx(&mut connection, &file).expect("should import");

        let entry = |description: &str, amount_cents: i64| ManualInput {
            account_id: report.account_id,
            posted_on: "2024-03-12".into(),
            amount_cents,
            description: description.into(),
            category_id: None,
            notes: "nota".into(),
        };
        let id = save_manual_transaction(&connection, &entry("Feira livre", -12_000))
            .expect("should save");
        assert!(id > 0);

        // Zero, empty and unknown accounts are refused instead of stored.
        assert!(save_manual_transaction(
            &connection,
            &ManualInput { amount_cents: 0, ..entry("Nada", 0) }
        )
        .is_err());
        assert!(save_manual_transaction(&connection, &entry("   ", -100)).is_err());
        assert!(save_manual_transaction(
            &connection,
            &ManualInput { account_id: 999_999, ..entry("Feira", -100) }
        )
        .is_err());
        // Impossible dates and unknown categories are refused too.
        assert!(save_manual_transaction(
            &connection,
            &ManualInput { posted_on: "2026-99-99".into(), ..entry("Feira", -100) }
        )
        .is_err());
        assert!(save_manual_transaction(
            &connection,
            &ManualInput { posted_on: "ontem".into(), ..entry("Feira", -100) }
        )
        .is_err());
        assert!(save_manual_transaction(
            &connection,
            &ManualInput { category_id: Some(999_999), ..entry("Feira", -100) }
        )
        .is_err());

        // The same statement imports exactly as before: manual rows never
        // collide with the import dedupe keys.
        let second = import_ofx(&mut connection, &file).expect("second import");
        assert_eq!(second.inserted, 0);
        assert_eq!(second.duplicates, 2);

        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        assert_eq!(rows.len(), 3);
        let manual_row = rows.iter().find(|row| row.id == id).expect("manual row");
        assert!(manual_row.manual);
        assert_eq!(manual_row.merchant, "Feira livre");
        assert_eq!(manual_row.notes, "nota");
        assert_eq!(manual_row.origin, "manual");
        assert!(rows.iter().filter(|row| !row.manual).count() == 2);

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.expense_cents, 2390 + 12_000);
        assert_eq!(totals.transaction_count, 3);

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn manual_accounts_can_be_created_renamed_and_archived() {
        let path = temporary_database("manual-account");
        let connection = open(&path).expect("should open");

        let id = create_manual_account(&connection, "  Carteira  ").expect("should create");
        assert!(id > 0);
        assert!(create_manual_account(&connection, "   ").is_err());

        let accounts = list_accounts(&connection).expect("should list");
        let wallet = accounts.iter().find(|account| account.id == id).expect("wallet");
        assert!(wallet.acct_id.starts_with("manual:"));
        assert_eq!(wallet.name, "Carteira");

        rename_account(&connection, id, "Bolso").expect("should rename");
        let renamed: String = connection
            .query_row("select name from accounts where id = ?1", params![id], |row| row.get(0))
            .expect("should read");
        assert_eq!(renamed, "Bolso");

        // Imported accounts keep the bank's name: no silent revert on reimport.
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");
        let mut connection = open(&path).expect("should reopen");
        let report = import_ofx(&mut connection, &file).expect("should import");
        assert!(rename_account(&connection, report.account_id, "Outro nome").is_err());

        archive_account(&connection, id).expect("should archive");
        assert!(list_accounts(&connection).expect("list").iter().all(|account| account.id != id));
        assert!(archive_account(&connection, id).is_err());

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn manual_entries_can_be_edited_and_deleted_but_imports_cannot() {
        let path = temporary_database("manual-edit");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let report = import_ofx(&mut connection, &file).expect("should import");
        let id = save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: report.account_id,
                posted_on: "2024-03-12".into(),
                amount_cents: -1_000,
                description: "Feira".into(),
                category_id: None,
                notes: "semanal".into(),
            },
        )
        .expect("should save");

        update_manual_transaction(
            &connection,
            &ManualEdit {
                id,
                account_id: report.account_id,
                posted_on: "2024-03-13".into(),
                amount_cents: -1_500,
                description: "Feira grande".into(),
                category_id: None,
                notes: "semanal".into(),
            },
        )
        .expect("should update");
        let edited = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")
            .into_iter()
            .find(|row| row.id == id)
            .expect("edited row");
        assert_eq!(edited.amount_cents, -1_500);
        assert_eq!(edited.posted_on, "2024-03-13");
        assert_eq!(edited.notes, "semanal");
        assert!(update_manual_transaction(
            &connection,
            &ManualEdit {
                id,
                account_id: report.account_id,
                posted_on: "ontem".into(),
                amount_cents: -1_500,
                description: "Feira".into(),
                category_id: None,
                notes: String::new(),
            }
        )
        .is_err());

        // Imported rows are read-only history.
        let imported = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")
            .into_iter()
            .find(|row| !row.manual)
            .expect("imported row");
        assert!(update_manual_transaction(
            &connection,
            &ManualEdit {
                id: imported.id,
                account_id: report.account_id,
                posted_on: "2024-03-12".into(),
                amount_cents: -1,
                description: "hack".into(),
                category_id: None,
                notes: String::new(),
            }
        )
        .is_err());
        assert!(delete_manual_transaction(&connection, imported.id).is_err());

        delete_manual_transaction(&connection, id).expect("should delete");
        assert!(list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("list")
            .iter()
            .all(|row| row.id != id));

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn categories_form_a_tree_children_roll_up_and_deletion_is_blocked() {
        let path = temporary_database("categories");
        let connection = open(&path).expect("should open");

        let food = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Comida".into(),
                kind: "expense".into(),
                color: "#d98c3f".into(),
                parent_id: None,
                emoji: "🍽".into(),
                sort_order: 1,
            },
        )
        .expect("should save root");
        let market = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Mercado".into(),
                kind: "expense".into(),
                color: "#4c9f70".into(),
                parent_id: Some(food),
                emoji: "🧺".into(),
                sort_order: 0,
            },
        )
        .expect("should save child");
        let delivery = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Delivery".into(),
                kind: "expense".into(),
                color: "#d1536f".into(),
                parent_id: Some(food),
                emoji: "🛵".into(),
                sort_order: 2,
            },
        )
        .expect("should save second child");

        // Unknown parents, self-parents and cycles are refused.
        assert!(save_category(
            &connection,
            &CategoryInput { id: None, name: "X".into(), kind: "expense".into(), color: "#000".into(), parent_id: Some(999_999), emoji: String::new(), sort_order: 0 }
        )
        .is_err());
        assert!(save_category(
            &connection,
            &CategoryInput { id: Some(food), name: "Comida".into(), kind: "expense".into(), color: "#000".into(), parent_id: Some(food), emoji: String::new(), sort_order: 1 }
        )
        .is_err());
        assert!(save_category(
            &connection,
            &CategoryInput { id: Some(food), name: "Comida".into(), kind: "expense".into(), color: "#000".into(), parent_id: Some(market), emoji: String::new(), sort_order: 1 }
        )
        .is_err());
        // A fresh tree is still a tree, so a valid update works.
        save_category(
            &connection,
            &CategoryInput { id: Some(market), name: "Mercado".into(), kind: "expense".into(), color: "#4c9f70".into(), parent_id: Some(food), emoji: "🧺".into(), sort_order: 5 }
        )
        .expect("should update");

        // Children roll up into the parent in the totals.
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");
        let mut connection = open(&path).expect("should reopen");
        let report = import_ofx(&mut connection, &file).expect("should import");
        for description in ["IFD*IFOOD MERCADO", "IFD*IFOOD DELIVERY"] {
            let id = save_manual_transaction(
                &connection,
                &ManualInput {
                    account_id: report.account_id,
                    posted_on: "2024-03-10".into(),
                    amount_cents: -100_00,
                    description: description.into(),
                    category_id: None,
                    notes: String::new(),
                },
            )
            .expect("should save");
            connection
                .execute(
                    "update transactions set category_id = ?1 where id = ?2",
                    params![if description.contains("MERCADO") { market } else { delivery }, id],
                )
                .expect("should categorize");
        }
        let totals = category_totals(&connection, "2024-03").expect("should total");
        let food_total = totals.iter().find(|entry| entry.category_id == Some(food)).expect("parent row");
        assert_eq!(food_total.total_cents, 200_00);
        assert!(totals.iter().all(|entry| entry.category_id != Some(market)));
        assert!(totals.iter().all(|entry| entry.category_id != Some(delivery)));

        // In use means: transactions, bills and children block the delete.
        assert!(delete_category(&connection, market).is_err());
        assert!(delete_category(&connection, food).is_err());
        let empty = save_category(
            &connection,
            &CategoryInput { id: None, name: "Vazia".into(), kind: "expense".into(), color: "#000".into(), parent_id: None, emoji: String::new(), sort_order: 9 }
        )
        .expect("should save");
        delete_category(&connection, empty).expect("unused deletes fine");

        // Archiving hides from pickers but keeps counting in the totals.
        archive_category(&connection, delivery, true).expect("should archive");
        assert!(list_categories(&connection).expect("list").iter().all(|category| category.id != delivery));
        let totals = category_totals(&connection, "2024-03").expect("should total");
        assert_eq!(
            totals.iter().find(|entry| entry.category_id == Some(food)).expect("parent row").total_cents,
            200_00
        );

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn clear_month_keeps_imports_and_drops_the_rest() {
        let path = temporary_database("clear");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let report = import_ofx(&mut connection, &file).expect("should import");
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: report.account_id,
                posted_on: "2024-03-12".into(),
                amount_cents: -1_000,
                description: "Feira".into(),
                category_id: None,
                notes: "feira da semana".into(),
            },
        )
        .expect("should save");
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: report.account_id,
                posted_on: "2024-04-02".into(),
                amount_cents: -2_000,
                description: "Cinema".into(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save");

        let bill = crate::planner::save_bill(
            &connection,
            &crate::planner::BillInput {
                id: None,
                name: "Aluguel".into(),
                amount_cents: 50_000,
                due_day: 5,
                frequency: "monthly".into(),
                category_id: None,
                account_id: None,
                goal_id: None,
                starts_on: "2024-01-01".into(),
                ends_on: None,
                installments_total: None,
                active: true,
            },
        )
        .expect("should save the bill");
        crate::planner::set_bill_paid(&connection, bill, "2024-03", true).expect("should pay");
        crate::planner::set_bill_paid(&connection, bill, "2024-04", true).expect("should pay");

        let cleared = clear_month(&mut connection, "2024-03").expect("should clear");
        assert_eq!(cleared.manual_deleted, 1);
        assert_eq!(cleared.payments_cleared, 1);

        // A malformed month never becomes a LIKE wildcard.
        assert!(clear_month(&mut connection, "2024").is_err());
        assert!(clear_month(&mut connection, "2024-13").is_err());
        assert!(clear_month(&mut connection, "").is_err());

        // Imports stay, April is untouched.
        let march = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        assert_eq!(march.len(), 2);
        assert!(march.iter().all(|row| !row.manual));
        let april = list_transactions(&connection, None, Some("2024-04"), None, 50, None)
            .expect("should list");
        assert_eq!(april.len(), 1);
        assert!(crate::planner::list_payments(&connection, "2024-03")
            .expect("list")
            .is_empty());
        assert_eq!(
            crate::planner::list_payments(&connection, "2024-04")
                .expect("list")
                .len(),
            1
        );

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn seeding_is_idempotent() {
        let path = temporary_database("seed");
        let connection = open(&path).expect("should open");
        let first = list_categories(&connection).expect("should list").len();
        drop(connection);

        let connection = open(&path).expect("should reopen");
        let second = list_categories(&connection).expect("should list").len();
        assert_eq!(first, second);
        assert_eq!(first, SEED_CATEGORIES.len());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn a_transaction_can_be_categorized() {
        let path = temporary_database("category");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");
        let rows = list_transactions(&connection, None, None, None, 10, None).expect("should list");
        let categories = list_categories(&connection).expect("should list");

        set_category(&connection, rows[0].id, Some(categories[0].id)).expect("should categorize");
        let after = list_transactions(&connection, Some(categories[0].name.as_str()), None, None, 10, None)
            .expect("should filter");
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].category_id, Some(categories[0].id));

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    /// Rebuilds the 0.1.0 format: the frozen baseline plus rows, with no version
    /// recorded anywhere. This is the file a user already has on disk.
    fn build_v1_database(path: &Path) {
        let connection = Connection::open(path).expect("should open a v1 file");
        connection.execute_batch(BASELINE_V1).expect("should apply v1");
        connection
            .execute(
                "insert into accounts (name, kind, bank_id, acct_id, currency, created_at)
                 values ('Card 9999', 'credit_card', '341', '9999', 'BRL', '2024-03-01T00:00:00Z')",
                [],
            )
            .expect("should insert the account");
        for (key, amount) in [("K1", -2390i64), ("K2", 150000i64)] {
            connection
                .execute(
                    "insert into transactions
                     (account_id, posted_on, amount_cents, description, dedupe_key, created_at)
                     values (1, '2024-03-05', ?1, 'row', ?2, '2024-03-05T00:00:00Z')",
                    params![amount, key],
                )
                .expect("should insert the transaction");
        }
        connection
            .execute(
                "insert into imports (path, account_id, imported_at, inserted, duplicates)
                 values ('a.ofx', 1, '2024-03-05T00:00:00Z', 2, 0)",
                [],
            )
            .expect("should insert the import");
    }

    #[test]
    fn migrates_a_010_database_without_losing_rows() {
        let path = temporary_database("migrate");
        build_v1_database(&path);

        let connection = open(&path).expect("should migrate");
        let version: String = connection
            .query_row("select value from settings where key = 'schema_version'", [], |row| {
                row.get(0)
            })
            .expect("should read the version");
        assert_eq!(version, SCHEMA_VERSION.to_string());
        assert!(has_table(&connection, "people").expect("should inspect"));
        assert!(has_table(&connection, "shares").expect("should inspect"));
        assert!(has_table(&connection, "rules").expect("should inspect"));

        let (count, distinct, blank): (i64, i64, i64) = connection
            .query_row(
                "select count(*), count(distinct uid),
                        coalesce(sum(case when uid = '' then 1 else 0 end), 0)
                 from transactions",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("should inspect the migrated rows");
        assert_eq!(count, 2);
        assert_eq!(distinct, 2);
        assert_eq!(blank, 0);

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.income_cents, 150000);
        assert_eq!(totals.expense_cents, 2390);

        let before: String = connection
            .query_row("select uid from transactions order by id limit 1", [], |row| row.get(0))
            .expect("should read the uid");
        drop(connection);

        let again = open(&path).expect("should reopen");
        let after: String = again
            .query_row("select uid from transactions order by id limit 1", [], |row| row.get(0))
            .expect("should read the uid again");
        assert_eq!(before, after, "reopening must not rewrite identity");
        assert!(has_table(&again, "bills").expect("should inspect"));
        assert!(has_table(&again, "bill_payments").expect("should inspect"));
        assert!(has_column(&again, "bills", "installments_total").expect("should inspect"));
        assert!(has_table(&again, "debts").expect("should inspect"));
        assert!(has_table(&again, "goal_deposits").expect("should inspect"));
        assert!(has_column(&again, "categories", "budget_cents").expect("should inspect"));
        assert!(has_column(&again, "transactions", "notes").expect("should inspect"));
        assert!(has_column(&again, "transactions", "origin").expect("should inspect"));
        assert!(has_column(&again, "categories", "parent_id").expect("should inspect"));
        assert!(has_column(&again, "categories", "emoji").expect("should inspect"));
        assert!(has_column(&again, "categories", "sort_order").expect("should inspect"));
        assert!(has_column(&again, "categories", "archived_at").expect("should inspect"));
        assert!(has_column(&again, "transactions", "transfer_group").expect("should inspect"));
        assert!(has_column(&again, "transactions", "refund_of").expect("should inspect"));

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn reopening_a_database_stamped_ahead_without_its_columns_repairs_it() {
        // A version stamped without its migration leaves a database the app
        // cannot query. Reopening must add exactly what is missing.
        let path = temporary_database("stuck");
        build_v1_database(&path);
        {
            let connection = Connection::open(&path).expect("should open raw");
            migrate_to_v2(&connection).expect("v2");
            write_version(&connection, 2).expect("should stamp");
            migrate_to_v3(&connection).expect("v3");
            write_version(&connection, 3).expect("should stamp");
            migrate_to_v4(&connection).expect("v4");
            write_version(&connection, 4).expect("should stamp");
            migrate_to_v5(&connection).expect("v5");
            write_version(&connection, 5).expect("should stamp");
            migrate_to_v6(&connection).expect("v6");
            write_version(&connection, 6).expect("should stamp");
            migrate_to_v7(&connection).expect("v7");
            write_version(&connection, 8).expect("should stamp ahead");
        }
        assert!(!has_column(
            &Connection::open(&path).expect("should peek"),
            "transactions",
            "origin"
        )
        .expect("should inspect"));

        let connection = open(&path).expect("should repair on open");
        let version: String = connection
            .query_row("select value from settings where key = 'schema_version'", [], |row| {
                row.get(0)
            })
            .expect("should read the version");
        assert_eq!(version, SCHEMA_VERSION.to_string());
        assert!(has_column(&connection, "transactions", "notes").expect("should inspect"));
        assert!(has_column(&connection, "transactions", "origin").expect("should inspect"));
        assert!(has_column(&connection, "categories", "parent_id").expect("should inspect"));
        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.income_cents, 150000);
        assert_eq!(totals.expense_cents, 2390);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn backfill_marks_source_manual_rows_as_manual_origin() {
        let path = temporary_database("backfill");
        let connection = open(&path).expect("should open");
        connection
            .execute(
                "insert into accounts (name, kind, bank_id, acct_id, currency, created_at, uid, updated_at)
                 values ('Manual', 'checking', '', 'manual-1', 'BRL', '2026-01-01T00:00:00Z', 'u1', '2026-01-01T00:00:00Z')",
                [],
            )
            .expect("should insert the account");
        connection
            .execute(
                "insert into transactions (account_id, posted_on, amount_cents, description, dedupe_key, source, created_at, uid, updated_at, origin)
                 values (1, '2026-03-05', -100, 'Feira', 'k1', 'manual', '2026-03-05T00:00:00Z', 'u2', '2026-03-05T00:00:00Z', 'ofx')",
                [],
            )
            .expect("should insert a manual row with a stale origin");
        connection
            .execute(
                "update transactions set origin = 'manual' where source = 'manual' and origin = 'ofx'",
                [],
            )
            .expect("should backfill");
        let origin: String = connection
            .query_row("select origin from transactions where id = 1", [], |row| row.get(0))
            .expect("should read the origin");
        assert_eq!(origin, "manual");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn a_new_database_lands_on_the_current_version() {
        let path = temporary_database("fresh");
        let connection = open(&path).expect("should open");
        let version: String = connection
            .query_row("select value from settings where key = 'schema_version'", [], |row| {
                row.get(0)
            })
            .expect("should read the version");
        assert_eq!(version, SCHEMA_VERSION.to_string());
        assert_eq!(
            list_categories(&connection).expect("should list").len(),
            SEED_CATEGORIES.len()
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn two_accounts_keep_the_same_statement_apart() {
        let path = temporary_database("accounts");
        let first = path.with_extension("a.ofx");
        let second = path.with_extension("b.ofx");
        std::fs::write(&first, STATEMENT).expect("should write the first fixture");
        std::fs::write(&second, STATEMENT.replace("12345-6", "99999-1"))
            .expect("should write the second fixture");

        let mut connection = open(&path).expect("should open");
        let a = import_ofx(&mut connection, &first).expect("first account");
        let b = import_ofx(&mut connection, &second).expect("second account");
        assert_eq!(a.inserted, 2);
        assert_eq!(b.inserted, 2, "the same line in another account is not a duplicate");
        assert_eq!(
            list_transactions(&connection, None, None, None, 50, None)
                .expect("should list")
                .len(),
            4
        );
        assert_eq!(list_accounts(&connection).expect("should list").len(), 2);

        let again = import_ofx(&mut connection, &first).expect("first account again");
        assert_eq!(again.inserted, 0);
        assert_eq!(again.duplicates, 2);

        let _ = std::fs::remove_file(&first);
        let _ = std::fs::remove_file(&second);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn soft_delete_frees_the_dedupe_key_and_hides_the_row() {
        let path = temporary_database("tombstone");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");
        let rows = list_transactions(&connection, None, None, None, 10, None).expect("should list");
        assert_eq!(rows.len(), 2);

        let expense = rows
            .iter()
            .find(|row| row.amount_cents < 0)
            .expect("should have an expense");
        soft_delete_transaction(&connection, expense.id).expect("should delete");

        let alive = list_transactions(&connection, None, None, None, 10, None).expect("should list");
        assert_eq!(alive.len(), 1, "a tombstone must not be listed");
        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.expense_cents, 0, "a tombstone must not count");
        assert_eq!(totals.income_cents, 150000);

        // The same statement again brings the deleted line back, because the
        // tombstone released the dedupe key.
        let third = import_ofx(&mut connection, &file).expect("should import again");
        assert_eq!(third.inserted, 1);
        assert_eq!(third.duplicates, 1);
        assert_eq!(
            list_transactions(&connection, None, None, None, 10, None)
                .expect("should list")
                .len(),
            2
        );

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    fn csv_mapping() -> crate::csv::CsvMapping {
        crate::csv::CsvMapping {
            separator: ";".to_string(),
            encoding: "auto".to_string(),
            has_header: true,
            date_col: 0,
            date_format: "%d/%m/%Y".to_string(),
            description_col: 1,
            amount_col: Some(2),
            debit_col: None,
            credit_col: None,
            decimal_sep: ",".to_string(),
        }
    }

    const SHEET: &str = "Data;Descricao;Valor\n05/03/2024;IFD*IFOOD SAO PAULO;-23,90\n10/03/2024;SALARIO;1500,00\n";

    #[test]
    fn csv_reimport_inserts_nothing_the_second_time() {
        let path = temporary_database("csv-dedupe");
        let file = path.with_extension("csv");
        std::fs::write(&file, SHEET).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let mapping = csv_mapping();

        let first = import_csv(&mut connection, &file, account, &mapping).expect("first import");
        assert_eq!(first.inserted, 2);
        assert_eq!(first.duplicates, 0);
        assert_eq!(first.skipped, 0);

        let second = import_csv(&mut connection, &file, account, &mapping).expect("second import");
        assert_eq!(second.inserted, 0);
        assert_eq!(second.duplicates, 2);

        let rows = list_transactions(&connection, None, None, Some(account), 50, None).expect("should list");
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().all(|row| row.origin == "csv"));

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn csv_shares_the_fingerprint_with_ofx_without_fitid() {
        let path = temporary_database("csv-ofx");
        let ofx_file = path.with_extension("ofx");
        let csv_file = path.with_extension("csv");
        // Same two lines, once as OFX without FITID and once as CSV: the
        // fingerprint (date + amount + description) is identical.
        let ofx = "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>99999-1<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20240305<TRNAMT>-23.90<NAME>IFD*IFOOD SAO PAULO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20240310<TRNAMT>1500.00<NAME>SALARIO</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>";
        std::fs::write(&ofx_file, ofx).expect("should write ofx");
        std::fs::write(&csv_file, SHEET).expect("should write csv");

        let mut connection = open(&path).expect("should open");
        let ofx_report = import_ofx(&mut connection, &ofx_file).expect("ofx first");
        assert_eq!(ofx_report.inserted, 2);

        // The CSV lands in the same bank account the OFX created.
        let csv_report =
            import_csv(&mut connection, &csv_file, ofx_report.account_id, &csv_mapping())
                .expect("csv second");
        assert_eq!(csv_report.inserted, 0);
        assert_eq!(csv_report.duplicates, 2);

        let _ = std::fs::remove_file(&ofx_file);
        let _ = std::fs::remove_file(&csv_file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn csv_import_rejects_unknown_accounts_and_bad_cells() {
        let path = temporary_database("csv-errors");
        let file = path.with_extension("csv");
        std::fs::write(&file, SHEET).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let mapping = csv_mapping();
        assert!(import_csv(&mut connection, &file, 999_999, &mapping).is_err());

        let bad = "Data;Descricao;Valor\nontem;X;1,00\n05/03/2024;Y;abc\n05/03/2024;Z;0,00\n";
        std::fs::write(&file, bad).expect("should write bad rows");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let report = import_csv(&mut connection, &file, account, &mapping).expect("should skip");
        assert_eq!(report.inserted, 0);
        assert_eq!(report.skipped, 3);

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn csv_profiles_round_trip_and_reject_bad_mappings() {
        let path = temporary_database("csv-profiles");
        let connection = open(&path).expect("should open");
        assert!(list_csv_profiles(&connection).expect("should list").is_empty());

        let input = CsvProfileInput {
            id: None,
            name: "Nubank".to_string(),
            separator: ";".to_string(),
            encoding: "auto".to_string(),
            has_header: true,
            date_col: 0,
            date_format: "%d/%m/%Y".to_string(),
            description_col: 1,
            amount_col: Some(2),
            debit_col: None,
            credit_col: None,
            decimal_sep: ",".to_string(),
        };
        let id = save_csv_profile(&connection, &input).expect("should save");
        let profiles = list_csv_profiles(&connection).expect("should list");
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].mapping().description_col, 1);

        // Same name twice is refused.
        assert!(save_csv_profile(&connection, &input).is_err());
        // A mapping with both amount and debit columns is refused.
        let bad = CsvProfileInput {
            debit_col: Some(1),
            ..CsvProfileInput {
                id: None,
                name: "Ruim".to_string(),
                separator: ";".to_string(),
                encoding: "auto".to_string(),
                has_header: true,
                date_col: 0,
                date_format: "%d/%m/%Y".to_string(),
                description_col: 1,
                amount_col: Some(2),
                debit_col: None,
                credit_col: None,
                decimal_sep: ",".to_string(),
            }
        };
        assert!(save_csv_profile(&connection, &bad).is_err());

        delete_csv_profile(&connection, id).expect("should delete");
        assert!(list_csv_profiles(&connection).expect("should list").is_empty());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn export_writes_what_the_import_reads() {
        let path = temporary_database("csv-export");
        let file = path.with_extension("csv");
        let out = path.with_extension("out.csv");
        std::fs::write(&file, SHEET).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let mapping = csv_mapping();
        let imported = import_csv(&mut connection, &file, account, &mapping).expect("should import");
        assert_eq!(imported.inserted, 2);

        let count =
            export_csv(&connection, &out, None, Some("2024-03"), Some(account), None).expect("should export");
        assert_eq!(count, 2);
        let text = std::fs::read_to_string(&out).expect("should read back");
        let mut lines = text.lines();
        assert_eq!(lines.next(), Some("data;descricao;valor;conta;categoria;origem;notas"));
        let first = lines.next().expect("should have a first row");
        assert!(first.starts_with("05/03/2024;"), "dates leave as DD/MM/YYYY: {first}");
        assert!(first.contains("-23,90"), "amounts leave as comma decimals: {first}");

        // The export reimports cleanly through columns 0/1/2: the fingerprint
        // sees the same rows and reports only duplicates.
        let again = import_csv(&mut connection, &out, account, &mapping).expect("should reimport");
        assert_eq!(again.inserted, 0);
        assert_eq!(again.duplicates, 2);

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&out);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn backup_copies_a_database_that_reopens_intact() {
        let path = temporary_database("backup");
        let file = path.with_extension("ofx");
        let snapshot = path.with_extension("backup.db");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");
        backup_to(&connection, &snapshot).expect("should back up");
        drop(connection);

        validate_backup_source(&snapshot).expect("should validate");
        let restored = open(&snapshot).expect("should reopen the backup");
        assert_eq!(
            list_transactions(&restored, None, None, None, 50, None)
                .expect("should list")
                .len(),
            2
        );
        let version: String = restored
            .query_row("select value from settings where key = 'schema_version'", [], |row| {
                row.get(0)
            })
            .expect("should read the version");
        assert_eq!(version, SCHEMA_VERSION.to_string());

        // Garbage in, garbage out: a text file is never a valid source.
        let junk = path.with_extension("junk.db");
        std::fs::write(&junk, "not a database").expect("should write junk");
        assert!(validate_backup_source(&junk).is_err());
        assert!(validate_backup_source(&path.with_extension("missing.db")).is_err());
        assert!(backup_to(&restored, Path::new("")).is_err());

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&snapshot);
        let _ = std::fs::remove_file(&junk);
        let _ = std::fs::remove_file(&path);
    }

    fn transfer_fixture(connection: &Connection) -> (i64, i64) {
        let from = create_manual_account(connection, "Conta A").expect("should create A");
        let to = create_manual_account(connection, "Conta B").expect("should create B");
        (from, to)
    }

    #[test]
    fn transfers_move_money_without_touching_totals() {
        let path = temporary_database("transfer");
        let mut connection = open(&path).expect("should open");
        let (from, to) = transfer_fixture(&connection);

        let group = save_transfer(
            &mut connection,
            &TransferInput {
                from_account_id: from,
                to_account_id: to,
                posted_on: "2024-03-05".to_string(),
                amount_cents: 10000,
                description: "Reserva".to_string(),
                notes: String::new(),
            },
        )
        .expect("should transfer");
        assert!(group.starts_with("transfer:"));

        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        assert_eq!(rows.len(), 2);
        assert!(rows.iter().all(|row| row.transfer_group.as_deref() == Some(group.as_str())));
        assert_eq!(
            rows.iter().map(|row| row.amount_cents).sum::<i64>(),
            0,
            "the pair nets to zero"
        );

        // Moving money between own accounts is neither income nor spending.
        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.income_cents, 0);
        assert_eq!(totals.expense_cents, 0);
        assert!(category_totals(&connection, "2024-03").expect("should total").is_empty());
        let series = month_series(&connection, "2024-03", 1).expect("should build the series");
        assert_eq!(series[0].income_cents, 0);
        assert_eq!(series[0].expense_cents, 0);

        // One leg out, the pair goes: money cannot appear from nowhere.
        delete_transfer(&connection, rows[0].id).expect("should delete the group");
        assert!(
            list_transactions(&connection, None, Some("2024-03"), None, 50, None)
                .expect("should list")
                .is_empty()
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn transfers_refuse_nonsense_and_legs_stay_paired() {
        let path = temporary_database("transfer-guards");
        let mut connection = open(&path).expect("should open");
        let (from, to) = transfer_fixture(&connection);
        let good = TransferInput {
            from_account_id: from,
            to_account_id: to,
            posted_on: "2024-03-05".to_string(),
            amount_cents: 1000,
            description: "Ok".to_string(),
            notes: String::new(),
        };
        assert!(save_transfer(&mut connection, &good).is_ok());
        // Same account, non-positive amount, bad date, unknown account.
        for bad in [
            TransferInput { from_account_id: from, to_account_id: from, posted_on: "2024-03-05".to_string(), amount_cents: 1000, description: "X".to_string(), notes: String::new() },
            TransferInput { from_account_id: from, to_account_id: to, posted_on: "2024-03-05".to_string(), amount_cents: 0, description: "X".to_string(), notes: String::new() },
            TransferInput { from_account_id: from, to_account_id: to, posted_on: "ontem".to_string(), amount_cents: 1000, description: "X".to_string(), notes: String::new() },
            TransferInput { from_account_id: from, to_account_id: 999_999, posted_on: "2024-03-05".to_string(), amount_cents: 1000, description: "X".to_string(), notes: String::new() },
            TransferInput { from_account_id: from, to_account_id: to, posted_on: "2024-03-05".to_string(), amount_cents: 1000, description: "  ".to_string(), notes: String::new() },
        ] {
            assert!(save_transfer(&mut connection, &bad).is_err());
        }

        let leg = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")[0]
            .id;
        // Legs are derived: no solo edits, and plain entries are not groups.
        assert!(update_manual_transaction(
            &connection,
            &ManualEdit {
                id: leg,
                account_id: from,
                posted_on: "2024-03-05".to_string(),
                amount_cents: -1,
                description: "X".to_string(),
                category_id: None,
                notes: String::new(),
            }
        )
        .is_err());
        let plain = save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: from,
                posted_on: "2024-03-06".to_string(),
                amount_cents: -100,
                description: "Café".to_string(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save a plain entry");
        assert!(delete_transfer(&connection, plain).is_err());
        // Deleting through the manual path still removes the whole group.
        delete_manual_transaction(&connection, leg).expect("should delete the group");
        assert_eq!(
            list_transactions(&connection, None, Some("2024-03"), None, 50, None)
                .expect("should list")
                .len(),
            1,
            "only the plain entry survives"
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn refunds_net_against_their_own_side() {
        let path = temporary_database("refund");
        let connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let food = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Comida".into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the category");
        let original = save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: account,
                posted_on: "2024-03-05".to_string(),
                amount_cents: -5000,
                description: "Mercado".to_string(),
                category_id: Some(food),
                notes: String::new(),
            },
        )
        .expect("should save the expense");
        assert_eq!(month_totals(&connection, "2024-03").expect("should total").expense_cents, 5000);

        let refund = save_refund(
            &connection,
            &RefundInput { original_id: original, posted_on: None, notes: None },
        )
        .expect("should refund");
        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        let leg = rows.iter().find(|row| row.id == refund).expect("should list the refund");
        assert_eq!(leg.amount_cents, 5000);
        assert_eq!(leg.refund_of, Some(original));
        assert_eq!(leg.category_id, Some(food));
        assert!(rows.iter().find(|row| row.id == original).expect("original").has_refund);

        // A returned purchase lowers spending instead of raising income.
        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.income_cents, 0);
        assert_eq!(totals.expense_cents, 0);
        assert_eq!(totals.income_cents - totals.expense_cents, 0);
        let by_category = category_totals(&connection, "2024-03").expect("should total");
        assert_eq!(by_category.len(), 1);
        assert_eq!(by_category[0].total_cents, 0);

        // One full refund per original, no chains, no transfer refunds.
        assert!(save_refund(&connection, &RefundInput { original_id: original, posted_on: None, notes: None }).is_err());
        assert!(save_refund(&connection, &RefundInput { original_id: refund, posted_on: None, notes: None }).is_err());
        assert!(delete_manual_transaction(&connection, original).is_err());
        assert!(update_manual_transaction(
            &connection,
            &ManualEdit {
                id: refund,
                account_id: account,
                posted_on: "2024-03-05".to_string(),
                amount_cents: 1,
                description: "X".to_string(),
                category_id: None,
                notes: String::new(),
            }
        )
        .is_err());

        let _ = std::fs::remove_file(&path);
    }

    fn rule_input(pattern: &str, target: &str, category_id: i64) -> RuleInput {
        RuleInput {
            id: None,
            pattern: pattern.to_string(),
            target: target.to_string(),
            category_id,
            sign: "any".to_string(),
            min_amount_cents: None,
            max_amount_cents: None,
            priority: 0,
        }
    }

    #[test]
    fn rules_categorize_on_import_and_never_overwrite() {
        let path = temporary_database("rules-import");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        let food = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Comida".into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the category");
        save_rule(&connection, &rule_input("IFOOD", "both", food)).expect("should save the rule");
        // A merchant-only rule for the salary row proves the target matters.
        let other = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Salário".into(),
                kind: "income".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the second category");
        let mut salary_rule = rule_input("SALARIO", "merchant", other);
        salary_rule.priority = 5;
        save_rule(&connection, &salary_rule).expect("should save the salary rule");

        let report = import_ofx(&mut connection, &file).expect("should import");
        assert_eq!(report.inserted, 2);
        assert_eq!(report.categorized, 2);
        let rows = list_transactions(&connection, None, None, None, 50, None).expect("should list");
        let food_row = rows.iter().find(|row| row.amount_cents < 0).expect("expense");
        let pay_row = rows.iter().find(|row| row.amount_cents > 0).expect("income");
        assert_eq!(food_row.category_id, Some(food));
        assert_eq!(pay_row.category_id, Some(other));

        // The user's explicit choice wins over every later run.
        set_category(&connection, food_row.id, None).expect("should uncategorize");
        set_category(&connection, pay_row.id, Some(food)).expect("should pin");
        let rerun = apply_rules(&mut connection).expect("should rerun");
        assert_eq!(rerun, 1, "only the uncategorized row moves");
        let rows = list_transactions(&connection, None, None, None, 50, None).expect("should list");
        assert_eq!(
            rows.iter().find(|row| row.id == pay_row.id).expect("pinned").category_id,
            Some(food)
        );

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn rules_refuse_garbage_and_first_priority_wins() {
        let path = temporary_database("rules-guards");
        let mut connection = open(&path).expect("should open");
        let food = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Comida".into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the category");
        let second = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Outros".into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the second category");

        assert!(save_rule(&connection, &rule_input("   ", "both", food)).is_err());
        let mut bad = rule_input("x", "everywhere", food);
        assert!(save_rule(&connection, &bad).is_err());
        bad = rule_input("x", "both", food);
        bad.sign = "sometimes".to_string();
        assert!(save_rule(&connection, &bad).is_err());
        assert!(save_rule(&connection, &rule_input("x", "both", 999_999)).is_err());
        let mut inverted = rule_input("x", "both", food);
        inverted.min_amount_cents = Some(100);
        inverted.max_amount_cents = Some(-100);
        assert!(save_rule(&connection, &inverted).is_err());
        let ghost = RuleInput { id: Some(999_999), ..rule_input("x", "both", food) };
        assert!(save_rule(&connection, &ghost).is_err());
        assert!(delete_rule(&connection, 999_999).is_err());

        // Same substring, two owners: the lower priority takes the row.
        let mut low = rule_input("IFOOD", "both", food);
        low.priority = 10;
        save_rule(&connection, &low).expect("should save the low rule");
        let mut high = rule_input("IFOOD", "both", second);
        high.priority = 1;
        save_rule(&connection, &high).expect("should save the high rule");
        let rules = list_rules(&connection).expect("should list");
        assert_eq!(rules.len(), 2);
        assert_eq!(rules[0].category_id, second, "ordered by priority");

        let account = create_manual_account(&connection, "Carteira").expect("should create");
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: account,
                posted_on: "2024-03-05".to_string(),
                amount_cents: -100,
                description: "ifood".to_string(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save the expense");
        assert_eq!(apply_rules(&mut connection).expect("should run"), 1);
        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].category_id, Some(second), "the lower priority takes the row");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn rules_skip_transfer_legs() {
        let path = temporary_database("rules-transfers");
        let mut connection = open(&path).expect("should open");
        let food = save_category(
            &connection,
            &CategoryInput {
                id: None,
                name: "Comida".into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the category");
        // A catch-all rule would claim everything categorizable.
        let mut catch_all = rule_input("a", "both", food);
        catch_all.sign = "any".to_string();
        save_rule(&connection, &catch_all).expect("should save the rule");

        let from = create_manual_account(&connection, "A").expect("should create A");
        let to = create_manual_account(&connection, "B").expect("should create B");
        save_transfer(
            &mut connection,
            &TransferInput {
                from_account_id: from,
                to_account_id: to,
                posted_on: "2024-03-05".to_string(),
                amount_cents: 1000,
                description: "Caixa para banco".to_string(),
                notes: String::new(),
            },
        )
        .expect("should transfer");
        assert_eq!(apply_rules(&mut connection).expect("should run"), 0);
        let legs = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list");
        assert_eq!(legs.len(), 2);
        assert!(legs.iter().all(|row| row.category_id.is_none()));

        let _ = std::fs::remove_file(&path);
    }

    fn budget_category(connection: &Connection, name: &str) -> i64 {
        save_category(
            connection,
            &CategoryInput {
                id: None,
                name: name.into(),
                kind: "expense".into(),
                color: "#000".into(),
                parent_id: None,
                emoji: String::new(),
                sort_order: 0,
            },
        )
        .expect("should save the category")
    }

    fn spend(
        connection: &Connection,
        account: i64,
        category: i64,
        posted_on: &str,
        amount_cents: i64,
    ) {
        save_manual_transaction(
            connection,
            &ManualInput {
                account_id: account,
                posted_on: posted_on.to_string(),
                amount_cents,
                description: "Compra".to_string(),
                category_id: Some(category),
                notes: String::new(),
            },
        )
        .expect("should spend");
    }

    #[test]
    fn budget_status_uses_base_caps_and_monthly_overrides() {
        let path = temporary_database("budget-status");
        let connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let food = budget_category(&connection, "Comida");
        set_category_budget(&connection, food, Some(10000)).expect("should set the base cap");
        spend(&connection, account, food, "2024-03-05", -3000);

        let status = budget_status(&connection, "2024-03").expect("should load");
        assert_eq!(status.lines.len(), 1);
        let line = &status.lines[0];
        assert_eq!(line.limit_cents, 10000);
        assert!(!line.overridden);
        assert_eq!(line.effective_cents, 10000);
        assert_eq!(line.spent_cents, 3000);
        assert!(status.global.is_none());

        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(food), limit_cents: Some(5000), carryover: false },
        )
        .expect("should override");
        let status = budget_status(&connection, "2024-03").expect("should reload");
        assert_eq!(status.lines[0].limit_cents, 5000);
        assert!(status.lines[0].overridden);

        // A null limit deletes the row: the base cap shows through again.
        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(food), limit_cents: None, carryover: false },
        )
        .expect("should clear the override");
        assert!(!budget_status(&connection, "2024-03").expect("should reload").lines[0].overridden);

        // The whole-month cap is one row: saving twice keeps a single cap.
        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-03".to_string(), category_id: None, limit_cents: Some(50000), carryover: false },
        )
        .expect("should save the global cap");
        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-03".to_string(), category_id: None, limit_cents: Some(40000), carryover: true },
        )
        .expect("should replace the global cap");
        let status = budget_status(&connection, "2024-03").expect("should reload");
        let global = status.global.expect("should have a global cap");
        assert_eq!(global.limit_cents, 40000);
        assert!(global.carryover);
        assert_eq!(global.spent_cents, 3000);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn budget_carryover_pulls_last_month_leftover() {
        let path = temporary_database("budgets-carry");
        let connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let food = budget_category(&connection, "Comida");
        set_category_budget(&connection, food, Some(10000)).expect("should set the base cap");
        spend(&connection, account, food, "2024-02-10", -6000);
        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-02".to_string(), category_id: Some(food), limit_cents: Some(10000), carryover: true },
        )
        .expect("should enable carryover");

        let status = budget_status(&connection, "2024-03").expect("should load");
        // Envelope math: January left its full base cap unused, February spent
        // 6000 of its 20000 available, so March holds 10000 + 14000. Budgeted
        // Jan-Mar (30000) minus spent (6000) equals available (24000).
        assert_eq!(status.lines[0].carry_in_cents, 14000);
        assert_eq!(status.lines[0].effective_cents, 24000);

        // Without carryover on either side, nothing rolls forward.
        save_budget_limit(
            &connection,
            &BudgetLimitInput { month: "2024-02".to_string(), category_id: Some(food), limit_cents: Some(10000), carryover: false },
        )
        .expect("should disable carryover");
        assert_eq!(budget_status(&connection, "2024-03").expect("should reload").lines[0].carry_in_cents, 0);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn budget_limits_refuse_nonsense() {
        let path = temporary_database("budgets-guards");
        let connection = open(&path).expect("should open");
        let food = budget_category(&connection, "Comida");
        let child = save_category(
            &connection,
            &CategoryInput {
                id: None, name: "Mercado".into(), kind: "expense".into(), color: "#000".into(),
                parent_id: Some(food), emoji: String::new(), sort_order: 0,
            },
        )
        .expect("should save the child");
        let good = BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(food), limit_cents: Some(1000), carryover: false };
        assert!(save_budget_limit(&connection, &good).is_ok());
        for bad in [
            BudgetLimitInput { month: "março".to_string(), category_id: Some(food), limit_cents: Some(1000), carryover: false },
            BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(food), limit_cents: Some(0), carryover: false },
            BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(food), limit_cents: Some(-5), carryover: false },
            BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(999_999), limit_cents: Some(1000), carryover: false },
            // Children roll up, so only top-level categories take a monthly cap.
            BudgetLimitInput { month: "2024-03".to_string(), category_id: Some(child), limit_cents: Some(1000), carryover: false },
        ] {
            assert!(save_budget_limit(&connection, &bad).is_err());
        }
        assert!(budget_status(&connection, "março").is_err());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn recurrence_rows_returns_transfer_free_history() {
        let path = temporary_database("recurrence");
        let mut connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        for month in ["2024-01", "2024-02", "2024-03"] {
            save_manual_transaction(
                &connection,
                &ManualInput {
                    account_id: account,
                    posted_on: format!("{month}-05"),
                    amount_cents: -1990,
                    description: "NETFLIX.COM".to_string(),
                    category_id: None,
                    notes: String::new(),
                },
            )
            .expect("should spend");
        }
        let other = create_manual_account(&connection, "Banco").expect("should create");
        save_transfer(
            &mut connection,
            &TransferInput {
                from_account_id: account,
                to_account_id: other,
                posted_on: "2024-02-06".to_string(),
                amount_cents: 1990,
                description: "NETFLIX.COM".to_string(),
                notes: String::new(),
            },
        )
        .expect("should transfer");

        // The transfer legs share the label and amount but are not charges.
        let rows = recurrence_rows(&connection, "2024-03", 3).expect("should read");
        assert_eq!(rows.len(), 3);
        assert!(rows.iter().all(|row| row.merchant == "NETFLIX.COM"));
        assert!(recurrence_rows(&connection, "março", 3).is_err());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn daily_expense_covers_every_day_and_matches_the_totals() {
        let path = temporary_database("daily");
        let connection = open(&path).expect("should open");
        let account = create_manual_account(&connection, "Carteira").expect("should create");
        let food = budget_category(&connection, "Comida");
        spend(&connection, account, food, "2024-03-05", -3000);
        spend(&connection, account, food, "2024-03-05", -1500);
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: account,
                posted_on: "2024-03-10".to_string(),
                amount_cents: 100000,
                description: "Salário".to_string(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save the income");
        // A same-month refund bends the 5th back down, like the totals do.
        let original = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")
            .into_iter()
            .find(|row| row.amount_cents == -3000)
            .expect("expense")
            .id;
        save_refund(&connection, &RefundInput { original_id: original, posted_on: None, notes: None })
            .expect("should refund");

        let days = daily_expense(&connection, "2024-03").expect("should read");
        assert_eq!(days.len(), 31, "March has 31 rows even when empty");
        assert!(days.iter().all(|point| point.day.starts_with("2024-03-")));
        let fifth = days.iter().find(|point| point.day == "2024-03-05").expect("5th");
        assert_eq!(fifth.expense_cents, 1500, "3000 - 1500 refund nets on the day");
        let tenth = days.iter().find(|point| point.day == "2024-03-10").expect("10th");
        assert_eq!(tenth.income_cents, 100000);
        let first = days.iter().find(|point| point.day == "2024-03-01").expect("1st");
        assert_eq!((first.income_cents, first.expense_cents), (0, 0));

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(
            days.iter().map(|point| point.expense_cents).sum::<i64>(),
            totals.expense_cents
        );
        assert_eq!(
            days.iter().map(|point| point.income_cents).sum::<i64>(),
            totals.income_cents
        );
        assert!(daily_expense(&connection, "março").is_err());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn tags_stick_to_any_row_and_filter_the_ledger() {
        let path = temporary_database("tags");
        let file = path.with_extension("ofx");
        std::fs::write(&file, STATEMENT).expect("should write the fixture");

        let mut connection = open(&path).expect("should open");
        import_ofx(&mut connection, &file).expect("should import");
        assert!(list_tags(&connection).expect("should list").is_empty());

        assert!(save_tag(&connection, "   ").is_err());
        let long = "x".repeat(41);
        assert!(save_tag(&connection, &long).is_err());
        let trip = save_tag(&connection, "viagem").expect("should save");
        assert!(save_tag(&connection, "viagem").is_err());
        assert!(delete_tag(&connection, 999_999).is_err());

        // Imported rows take tags like manual ones do.
        let rows = list_transactions(&connection, None, None, None, 50, None).expect("should list");
        assert!(rows.iter().all(|row| row.tags.is_empty()));
        let ids: Vec<i64> = rows.iter().map(|row| row.id).collect();
        assert_eq!(bulk_tag(&connection, &ids, trip, true).expect("should attach"), 2);
        // Attaching twice is idempotent, and unknown tags or rows are refused.
        assert_eq!(bulk_tag(&connection, &ids, trip, true).expect("should reattach"), 0);
        assert!(bulk_tag(&connection, &ids, 999_999, true).is_err());
        let rows = list_transactions(&connection, None, None, None, 50, None).expect("should list");
        assert!(rows.iter().all(|row| row.tags.len() == 1 && row.tags[0].name == "viagem"));

        // The tag narrows the ledger both as a filter and as a search term.
        assert_eq!(list_transactions(&connection, None, None, None, 50, Some(trip)).expect("should filter").len(), 2);
        assert_eq!(list_transactions(&connection, None, None, None, 50, Some(999_999)).expect("should miss").len(), 0);
        assert_eq!(list_transactions(&connection, Some("viagem"), None, None, 50, None).expect("should search").len(), 2);

        assert_eq!(bulk_tag(&connection, &ids[..1], trip, false).expect("should detach"), 1);
        assert_eq!(list_transactions(&connection, None, None, None, 50, Some(trip)).expect("should filter").len(), 1);
        delete_tag(&connection, trip).expect("should delete");
        assert!(list_tags(&connection).expect("should list").is_empty());
        assert!(list_transactions(&connection, None, None, None, 50, None).expect("should list").iter().all(|row| row.tags.is_empty()));

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn bulk_category_skips_transfer_legs_and_validates() {
        let path = temporary_database("bulk");
        let mut connection = open(&path).expect("should open");
        let from = create_manual_account(&connection, "A").expect("should create A");
        let to = create_manual_account(&connection, "B").expect("should create B");
        let food = budget_category(&connection, "Comida");
        save_transfer(
            &mut connection,
            &TransferInput {
                from_account_id: from,
                to_account_id: to,
                posted_on: "2024-03-05".to_string(),
                amount_cents: 1000,
                description: "Caixa".to_string(),
                notes: String::new(),
            },
        )
        .expect("should transfer");
        let plain = save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: from,
                posted_on: "2024-03-06".to_string(),
                amount_cents: -100,
                description: "Café".to_string(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should save");

        assert_eq!(bulk_set_category(&connection, &[], Some(food)).expect("empty"), 0);
        assert!(bulk_set_category(&connection, &[plain], Some(999_999)).is_err());
        let legs: Vec<i64> = list_transactions(&connection, None, Some("2024-03"), None, 50, None)
            .expect("should list")
            .into_iter()
            .filter(|row| row.transfer_group.is_some())
            .map(|row| row.id)
            .collect();
        assert_eq!(legs.len(), 2);
        let mut all = legs.clone();
        all.push(plain);
        // Only the plain entry moves; the legs keep their load-bearing null.
        assert_eq!(bulk_set_category(&connection, &all, Some(food)).expect("should skip legs"), 1);
        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50, None).expect("should list");
        assert!(rows.iter().filter(|row| row.transfer_group.is_some()).all(|row| row.category_id.is_none()));
        assert_eq!(rows.iter().find(|row| row.id == plain).expect("plain").category_id, Some(food));
        // Clearing works the same way.
        assert_eq!(bulk_set_category(&connection, &[plain], None).expect("should clear"), 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn holdings_round_trip_and_validate() {        let path = temporary_database("holdings");
        let connection = open(&path).expect("should open");
        assert!(list_holdings(&connection).expect("should list").is_empty());
        assert!(has_table(&open(&path).expect("should reopen"), "holdings").expect("should inspect"));

        let input = HoldingInput {
            id: None,
            name: "Nu Reserva".to_string(),
            kind: "cash".to_string(),
            amount_cents: 150000,
            updated_on: "2024-03-15".to_string(),
        };
        let id = save_holding(&connection, &input).expect("should save");
        assert!(save_holding(&connection, &input).is_err());
        let bad_kind = HoldingInput { kind: "yacht".to_string(), ..HoldingInput { id: None, name: "X".to_string(), kind: String::new(), amount_cents: 1, updated_on: "2024-03-15".to_string() } };
        assert!(save_holding(&connection, &bad_kind).is_err());
        let negative = HoldingInput { id: None, name: "Neg".to_string(), kind: "cash".to_string(), amount_cents: -1, updated_on: "2024-03-15".to_string() };
        assert!(save_holding(&connection, &negative).is_err());
        let bad_date = HoldingInput { id: None, name: "Data".to_string(), kind: "cash".to_string(), amount_cents: 1, updated_on: "ontem".to_string() };
        assert!(save_holding(&connection, &bad_date).is_err());
        assert!(save_holding(&connection, &HoldingInput { id: Some(999_999), name: "X".to_string(), kind: "cash".to_string(), amount_cents: 1, updated_on: "2024-03-15".to_string() }).is_err());

        let update = HoldingInput { id: Some(id), name: "Nu Reserva".to_string(), kind: "investment".to_string(), amount_cents: 160000, updated_on: "2024-03-20".to_string() };
        assert_eq!(save_holding(&connection, &update).expect("should update"), id);
        let holdings = list_holdings(&connection).expect("should list");
        assert_eq!(holdings.len(), 1);
        assert_eq!(holdings[0].amount_cents, 160000);

        assert!(delete_holding(&connection, 999_999).is_err());
        delete_holding(&connection, id).expect("should delete");
        assert!(list_holdings(&connection).expect("should list").is_empty());

        let _ = std::fs::remove_file(&path);
    }

    /// The Fase 1 acceptance script, pinned as a regression test: a Carteira
    /// account, a R$50 manual entry, a CSV import and its reimport with zero
    /// duplicates, plus an export and a backup that both survive the round trip.
    #[test]
    fn acceptance_carteira_flow() {
        let path = temporary_database("acceptance");
        let csv = path.with_extension("csv");
        let out = path.with_extension("out.csv");
        let snapshot = path.with_extension("backup.db");
        std::fs::write(
            &csv,
            "Data;Descricao;Valor\n05/03/2024;IFD*IFOOD SAO PAULO;-23,90\n10/03/2024;SALARIO;1500,00\n",
        )
        .expect("should write the csv");

        let mut connection = open(&path).expect("should open");
        let wallet = create_manual_account(&connection, "Carteira").expect("should create Carteira");
        save_manual_transaction(
            &connection,
            &ManualInput {
                account_id: wallet,
                posted_on: "2024-03-05".to_string(),
                amount_cents: -5000,
                description: "Feira".to_string(),
                category_id: None,
                notes: String::new(),
            },
        )
        .expect("should launch R$50");

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.expense_cents, 5000);

        let mapping = crate::csv::CsvMapping {
            separator: ";".to_string(),
            encoding: "auto".to_string(),
            has_header: true,
            date_col: 0,
            date_format: "%d/%m/%Y".to_string(),
            description_col: 1,
            amount_col: Some(2),
            debit_col: None,
            credit_col: None,
            decimal_sep: ",".to_string(),
        };
        let first = import_csv(&mut connection, &csv, wallet, &mapping).expect("should import");
        assert_eq!((first.inserted, first.duplicates, first.skipped), (2, 0, 0));
        let second = import_csv(&mut connection, &csv, wallet, &mapping).expect("should reimport");
        assert_eq!((second.inserted, second.duplicates), (0, 2));

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!((totals.income_cents, totals.expense_cents), (150000, 7390));

        let exported = export_csv(&connection, &out, None, Some("2024-03"), Some(wallet), None)
            .expect("should export");
        assert_eq!(exported, 3);
        backup_to(&connection, &snapshot).expect("should back up");
        drop(connection);
        validate_backup_source(&snapshot).expect("should validate the backup");
        let lines = std::fs::read_to_string(&out).expect("should read the export").lines().count();
        assert_eq!(lines, 4, "header plus three rows");

        let _ = std::fs::remove_file(&csv);
        let _ = std::fs::remove_file(&out);
        let _ = std::fs::remove_file(&snapshot);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn shipped_samples_parse() {
        // The files under samples/ are the ones handed out for manual
        // testing; if they stop parsing, the handout is broken.
        let bytes = std::fs::read("../samples/extrato-itau-nov2026.ofx").expect("should read ofx");
        let statement = crate::ofx::parse(&decode(&bytes)).expect("should parse ofx");
        assert_eq!(statement.transactions.len(), 32);
        let text = std::fs::read_to_string("../samples/fatura-nubank-nov2026.csv").expect("should read csv");
        let mapping = crate::csv::CsvMapping {
            separator: ";".to_string(),
            encoding: "auto".to_string(),
            has_header: true,
            date_col: 0,
            date_format: "%d/%m/%Y".to_string(),
            description_col: 1,
            amount_col: Some(2),
            debit_col: None,
            credit_col: None,
            decimal_sep: ",".to_string(),
        };
        let (rows, issues) = crate::csv::parse_csv(&text, &mapping).expect("should parse csv");
        assert_eq!(rows.len(), 25);
        assert_eq!(issues.len(), 1);
    }
}
