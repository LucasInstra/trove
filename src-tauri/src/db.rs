//! Local database: one SQLite file, one fact table.
//!
//! Every number the app shows comes from `transactions`, and every row carries
//! the key that proves it was not imported twice.

use crate::ofx;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::Path;

pub const SCHEMA: &str = r#"
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
        .execute_batch(SCHEMA)
        .map_err(|problem| problem.to_string())?;
    seed_categories(&connection)?;
    Ok(connection)
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
                "insert into categories (name, kind, color, seeded) values (?1, ?2, ?3, 1)",
                params![name, kind, color],
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
            "insert into accounts (name, kind, bank_id, acct_id, currency, created_at)
             values (?1, ?2, ?3, ?4, ?5, ?6)
             on conflict (bank_id, acct_id) do update set currency = excluded.currency
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
                  dedupe_key, source, created_at)
                 values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
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
            "insert into imports (path, account_id, imported_at, inserted, duplicates)
             values (?1, ?2, ?3, ?4, ?5)",
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
        .prepare("select id, name, kind, bank_id, acct_id, currency from accounts order by name")
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
        .prepare("select id, name, kind, color from categories order by name")
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
                    t.merchant, t.category_id, c.name, c.color, t.trntype
             from transactions t
             join accounts a on a.id = t.account_id
             left join categories c on c.id = t.category_id
             where (?1 is null
                    or t.description like ?1 collate nocase
                    or t.merchant like ?1 collate nocase
                    or c.name like ?1 collate nocase)
               and (?2 is null or t.posted_on like ?2)
             order by t.posted_on desc, t.id desc
             limit ?3",
        )
        .map_err(|problem| problem.to_string())?;

    let rows = statement
        .query_map(params![pattern, month_pattern, limit], |row| {
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
        .query_row("select max(substr(posted_on, 1, 7)) from transactions", [], |row| {
            row.get::<_, Option<String>>(0)
        })
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
             where posted_on like ?1",
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
             where t.posted_on like ?1 and t.amount_cents < 0
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
             where posted_on >= ?1
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

        let rows = list_transactions(&connection, None, None, 50).expect("should list");
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

        let empty_month = list_transactions(&connection, None, Some("2024-04"), 50).expect("should list");
        assert!(empty_month.is_empty());

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
        let rows = list_transactions(&connection, None, None, 10).expect("should list");
        let categories = list_categories(&connection).expect("should list");

        set_category(&connection, rows[0].id, Some(categories[0].id)).expect("should categorize");
        let after = list_transactions(&connection, Some(categories[0].name.as_str()), None, 10)
            .expect("should filter");
        assert_eq!(after.len(), 1);
        assert_eq!(after[0].category_id, Some(categories[0].id));

        let _ = std::fs::remove_file(&file);
        let _ = std::fs::remove_file(&path);
    }
}
