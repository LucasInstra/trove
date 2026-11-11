//! Local database: one SQLite file, one fact table.
//!
//! Every number the app shows comes from `transactions`, and every row carries
//! the key that proves it was not imported twice.

use crate::ofx;
use chrono::{Months, NaiveDate, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 6;

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
    if version < SCHEMA_VERSION {
        migrate_to_v6(&connection)?;
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

/// v5 to v6: one table only, so the fact table is untouched.
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

/// v4 to v5: one table only, so the fact table is untouched.
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
                set currency = excluded.currency, updated_at = excluded.updated_at
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

    for entry in &statement.transactions {
        let dedupe_key = ofx::dedupe_key(
            &account_key,
            &entry.fitid,
            &entry.posted_on,
            entry.amount_cents,
            &entry.description,
        );
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

    transaction.commit().map_err(|problem| problem.to_string())?;

    Ok(ImportReport {
        account_id,
        account_name: account_label(&statement.account),
        account_label: statement.account.acct_id.clone(),
        inserted,
        duplicates,
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

pub fn list_categories(connection: &Connection) -> Result<Vec<Category>, String> {
    let mut statement = connection
        .prepare("select id, name, kind, color from categories where deleted_at is null order by name")
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                color: row.get(3)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn list_transactions(
    connection: &Connection,
    search: Option<&str>,
    month: Option<&str>,
    account_id: Option<i64>,
    limit: i64,
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
                    t.merchant, t.category_id, c.name, c.color, t.trntype, t.source
             from transactions t
             join accounts a on a.id = t.account_id
             left join categories c on c.id = t.category_id
             where (?1 is null
                    or t.description like ?1 collate nocase
                    or t.merchant like ?1 collate nocase
                    or c.name like ?1 collate nocase)
               and (?2 is null or t.posted_on like ?2)
               and (?3 is null or t.account_id = ?3)
               and t.deleted_at is null
               and a.deleted_at is null
             order by t.posted_on desc, t.id desc
             limit ?4",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![pattern, month_pattern, account_id, limit], |row| {
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
                manual: row.get::<_, String>(11)? == "manual",
            })
        })
        .map_err(|problem| problem.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn set_category(
    connection: &Connection,
    transaction_id: i64,
    category_id: Option<i64>,
) -> Result<(), String> {
    let affected = connection
        .execute(
            "update transactions set category_id = ?1 where id = ?2",
            params![category_id, transaction_id],
        )
        .map_err(|problem| problem.to_string())?;
    if affected == 0 {
        return Err(format!("transaction {} does not exist", transaction_id));
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
    if input.posted_on.len() != 10 {
        return Err("date must be YYYY-MM-DD".to_string());
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
    let stamp = Utc::now().to_rfc3339();
    let trntype = if input.amount_cents < 0 { "DEBIT" } else { "CREDIT" };
    connection
        .execute(
            "insert into transactions
             (account_id, posted_on, amount_cents, description, merchant, memo, trntype,
              category_id, dedupe_key, source, created_at, uid, updated_at)
             values (?1, ?2, ?3, ?4, ?5, '', ?6, ?7,
                     'manual:' || lower(hex(randomblob(16))), 'manual', ?8,
                     lower(hex(randomblob(16))), ?8)",
            params![
                input.account_id,
                input.posted_on,
                input.amount_cents,
                description,
                crate::ofx::merchant_of(description),
                trntype,
                input.category_id,
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
    let transaction = connection
        .transaction()
        .map_err(|problem| problem.to_string())?;
    let prefix = format!("{month}%");
    let manual_deleted = transaction
        .execute(
            "delete from transactions
             where posted_on like ?1 and source = 'manual' and deleted_at is null",
            params![prefix],
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

pub fn month_totals(connection: &Connection, month: &str) -> Result<MonthTotals, String> {    let prefix = format!("{month}%");
    let (income, expense, count) = connection
        .query_row(
            "select
                coalesce(sum(case when amount_cents > 0 then amount_cents else 0 end), 0),
                coalesce(sum(case when amount_cents < 0 then -amount_cents else 0 end), 0),
                count(*)
             from transactions
             where posted_on like ?1 and deleted_at is null",
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
        income_cents: income,
        expense_cents: expense,
        transaction_count: count,
    })
}

/// Expense per category for one month, biggest first. Uncategorized spending is
/// kept as its own row so the numbers on screen always add up to the total.
pub fn category_totals(connection: &Connection, month: &str) -> Result<Vec<CategoryTotal>, String> {
    let prefix = format!("{month}%");
    let mut statement = connection
        .prepare(
            "select c.id, coalesce(c.name, 'Uncategorized'), coalesce(c.color, '#9aa3af'),
                    sum(-t.amount_cents) as total
             from transactions t
             left join categories c on c.id = t.category_id
             where t.posted_on like ?1 and t.amount_cents < 0 and t.deleted_at is null
             group by c.id
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
            "select substr(t.posted_on, 1, 7) as month, c.id,
                    coalesce(c.name, 'Uncategorized'), coalesce(c.color, '#9aa3af'),
                    sum(-t.amount_cents) as total
             from transactions t
             left join categories c on c.id = t.category_id
             where t.posted_on >= ?1 and substr(t.posted_on, 1, 7) <= ?2
               and t.amount_cents < 0 and t.deleted_at is null
             group by month, c.id
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
                    coalesce(sum(case when amount_cents > 0 then amount_cents else 0 end), 0),
                    coalesce(sum(case when amount_cents < 0 then -amount_cents else 0 end), 0)
             from transactions
             where posted_on >= ?1 and deleted_at is null
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

        let rows = list_transactions(&connection, None, None, None, 50).expect("should list");
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

        let empty_month = list_transactions(&connection, None, Some("2024-04"), None, 50).expect("should list");
        assert!(empty_month.is_empty());

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

        // The same statement imports exactly as before: manual rows never
        // collide with the import dedupe keys.
        let second = import_ofx(&mut connection, &file).expect("second import");
        assert_eq!(second.inserted, 0);
        assert_eq!(second.duplicates, 2);

        let rows = list_transactions(&connection, None, Some("2024-03"), None, 50)
            .expect("should list");
        assert_eq!(rows.len(), 3);
        let manual_row = rows.iter().find(|row| row.id == id).expect("manual row");
        assert!(manual_row.manual);
        assert_eq!(manual_row.merchant, "Feira livre");
        assert!(rows.iter().filter(|row| !row.manual).count() == 2);

        let totals = month_totals(&connection, "2024-03").expect("should total");
        assert_eq!(totals.expense_cents, 2390 + 12_000);
        assert_eq!(totals.transaction_count, 3);

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

        // Imports stay, April is untouched.
        let march = list_transactions(&connection, None, Some("2024-03"), None, 50)
            .expect("should list");
        assert_eq!(march.len(), 2);
        assert!(march.iter().all(|row| !row.manual));
        let april = list_transactions(&connection, None, Some("2024-04"), None, 50)
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
        let rows = list_transactions(&connection, None, None, None, 10).expect("should list");
        let categories = list_categories(&connection).expect("should list");

        set_category(&connection, rows[0].id, Some(categories[0].id)).expect("should categorize");
        let after = list_transactions(&connection, Some(categories[0].name.as_str()), None, None, 10)
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
            list_transactions(&connection, None, None, None, 50)
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
        let rows = list_transactions(&connection, None, None, None, 10).expect("should list");
        assert_eq!(rows.len(), 2);

        let expense = rows
            .iter()
            .find(|row| row.amount_cents < 0)
            .expect("should have an expense");
        soft_delete_transaction(&connection, expense.id).expect("should delete");

        let alive = list_transactions(&connection, None, None, None, 10).expect("should list");
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
            list_transactions(&connection, None, None, None, 10)
                .expect("should list")
                .len(),
            2
        );

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }
}
