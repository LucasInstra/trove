//! The planning layer: income, recurring bills, card metadata, goals and the
//! read state of notifications. Facts still come from `transactions`; this
//! module only stores what the user plans, never anything derived from it.

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Income {
    pub id: i64,
    pub name: String,
    pub amount_cents: i64,
    pub frequency: String,
    pub pay_day: i64,
    pub account_id: Option<i64>,
    pub active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bill {
    pub id: i64,
    pub name: String,
    pub amount_cents: i64,
    pub due_day: i64,
    pub frequency: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub category_color: Option<String>,
    pub account_id: Option<i64>,
    pub goal_id: Option<i64>,
    pub starts_on: String,
    pub ends_on: Option<String>,
    pub installments_total: Option<i64>,
    pub active: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BillPayment {
    pub id: i64,
    pub bill_id: i64,
    pub month: String,
    pub paid_on: String,
    pub amount_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CardMeta {
    pub id: i64,
    pub account_id: i64,
    pub account_name: String,
    pub brand: String,
    pub last4: String,
    pub limit_cents: i64,
    pub closing_day: i64,
    pub due_day: i64,
    pub color: String,
    pub texture: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub target_cents: i64,
    pub monthly_cents: i64,
    pub starts_on: String,
    pub account_id: Option<i64>,
    pub color: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalTotal {
    pub goal_id: i64,
    pub paid_cents: i64,
    pub payments: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Deposit {
    pub id: i64,
    pub goal_id: i64,
    pub amount_cents: i64,
    pub deposited_on: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositInput {
    pub id: Option<i64>,
    pub goal_id: i64,
    pub amount_cents: i64,
    pub deposited_on: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Person {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub is_self: bool,
    pub weight_pct: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Share {
    pub bill_id: i64,
    pub person_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareInput {
    pub bill_id: i64,
    pub person_id: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Debt {
    pub id: i64,
    pub person_id: i64,
    pub person_name: Option<String>,
    pub label: String,
    pub amount_cents: i64,
    pub month: String,
    pub settled_on: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DebtInput {
    pub id: Option<i64>,
    pub person_id: i64,
    pub label: String,
    pub amount_cents: i64,
    pub month: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlannerState {
    pub incomes: Vec<Income>,
    pub bills: Vec<Bill>,
    pub payments: Vec<BillPayment>,
    pub cards: Vec<CardMeta>,
    pub goals: Vec<Goal>,
    pub goal_totals: Vec<GoalTotal>,
    pub reads: Vec<String>,
    pub people: Vec<Person>,
    pub shares: Vec<Share>,
    pub debts: Vec<Debt>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomeInput {
    pub id: Option<i64>,
    pub name: String,
    pub amount_cents: i64,
    pub frequency: String,
    pub pay_day: i64,
    pub account_id: Option<i64>,
    pub active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BillInput {
    pub id: Option<i64>,
    pub name: String,
    pub amount_cents: i64,
    pub due_day: i64,
    pub frequency: String,
    pub category_id: Option<i64>,
    pub account_id: Option<i64>,
    pub goal_id: Option<i64>,
    pub starts_on: String,
    pub ends_on: Option<String>,
    #[serde(default)]
    pub installments_total: Option<i64>,
    pub active: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardInput {
    pub id: Option<i64>,
    pub account_id: i64,
    pub brand: String,
    pub last4: String,
    pub limit_cents: i64,
    pub closing_day: i64,
    pub due_day: i64,
    pub color: String,
    pub texture: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalInput {
    pub id: Option<i64>,
    pub name: String,
    pub kind: String,
    pub target_cents: i64,
    pub monthly_cents: i64,
    pub starts_on: String,
    pub account_id: Option<i64>,
    pub color: String,
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

pub fn list_incomes(connection: &Connection) -> Result<Vec<Income>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, amount_cents, frequency, pay_day, account_id, active
             from incomes
             where deleted_at is null
             order by amount_cents desc, id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Income {
                id: row.get(0)?,
                name: row.get(1)?,
                amount_cents: row.get(2)?,
                frequency: row.get(3)?,
                pay_day: row.get(4)?,
                account_id: row.get(5)?,
                active: row.get::<_, i64>(6)? == 1,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_income(connection: &Connection, input: &IncomeInput) -> Result<i64, String> {
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update incomes
                     set name = ?1, amount_cents = ?2, frequency = ?3, pay_day = ?4,
                         account_id = ?5, active = ?6, updated_at = ?7
                     where id = ?8",
                    params![
                        input.name,
                        input.amount_cents,
                        input.frequency,
                        input.pay_day,
                        input.account_id,
                        input.active as i64,
                        stamp,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into incomes
                     (uid, name, amount_cents, frequency, pay_day, account_id, active,
                      visibility, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, 'shared', ?7, ?7)",
                    params![
                        input.name,
                        input.amount_cents,
                        input.frequency,
                        input.pay_day,
                        input.account_id,
                        input.active as i64,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(connection.last_insert_rowid())
        }
    }
}

pub fn delete_income(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = now();
    connection
        .execute(
            "update incomes set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

pub fn list_bills(connection: &Connection) -> Result<Vec<Bill>, String> {
    let mut statement = connection
        .prepare(
            "select b.id, b.name, b.amount_cents, b.due_day, b.frequency, b.category_id,
                    c.name, c.color, b.account_id, b.goal_id, b.starts_on, b.ends_on, b.active,
                    b.installments_total
             from bills b
             left join categories c on c.id = b.category_id
             where b.deleted_at is null
             order by b.due_day, b.name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Bill {
                id: row.get(0)?,
                name: row.get(1)?,
                amount_cents: row.get(2)?,
                due_day: row.get(3)?,
                frequency: row.get(4)?,
                category_id: row.get(5)?,
                category_name: row.get(6)?,
                category_color: row.get(7)?,
                account_id: row.get(8)?,
                goal_id: row.get(9)?,
                starts_on: row.get(10)?,
                ends_on: row.get(11)?,
                active: row.get::<_, i64>(12)? == 1,
                installments_total: row.get(13)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_bill(connection: &Connection, input: &BillInput) -> Result<i64, String> {
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update bills
                     set name = ?1, amount_cents = ?2, due_day = ?3, frequency = ?4,
                         category_id = ?5, account_id = ?6, goal_id = ?7, starts_on = ?8,
                         ends_on = ?9, active = ?10, updated_at = ?11, installments_total = ?12
                     where id = ?13",
                    params![
                        input.name,
                        input.amount_cents,
                        input.due_day,
                        input.frequency,
                        input.category_id,
                        input.account_id,
                        input.goal_id,
                        input.starts_on,
                        input.ends_on,
                        input.active as i64,
                        stamp,
                        input.installments_total,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into bills
                     (uid, name, amount_cents, due_day, frequency, category_id, account_id,
                      goal_id, starts_on, ends_on, active, installments_total, visibility, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                             'shared', ?12, ?12)",
                    params![
                        input.name,
                        input.amount_cents,
                        input.due_day,
                        input.frequency,
                        input.category_id,
                        input.account_id,
                        input.goal_id,
                        input.starts_on,
                        input.ends_on,
                        input.active as i64,
                        input.installments_total,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(connection.last_insert_rowid())
        }
    }
}

pub fn delete_bill(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = now();
    connection
        .execute(
            "update bills set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

pub fn list_payments(connection: &Connection, month: &str) -> Result<Vec<BillPayment>, String> {
    let mut statement = connection
        .prepare(
            "select id, bill_id, month, paid_on, amount_cents
             from bill_payments
             where month = ?1 and deleted_at is null
             order by paid_on",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map(params![month], |row| {
            Ok(BillPayment {
                id: row.get(0)?,
                bill_id: row.get(1)?,
                month: row.get(2)?,
                paid_on: row.get(3)?,
                amount_cents: row.get(4)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// Idempotent: marking twice keeps one payment, unmarking removes the row. The
/// amount is copied from the bill so a later price change does not rewrite
/// history.
pub fn set_bill_paid(
    connection: &Connection,
    bill_id: i64,
    month: &str,
    paid: bool,
) -> Result<(), String> {
    if paid {
        let stamp = now();
        connection
            .execute(
                "insert into bill_payments
                 (uid, bill_id, month, paid_on, amount_cents, created_at, updated_at)
                 values (lower(hex(randomblob(16))), ?1, ?2, ?3,
                         (select amount_cents from bills where id = ?1), ?3, ?3)
                 on conflict (bill_id, month) do update
                    set paid_on = excluded.paid_on, updated_at = excluded.updated_at",
                params![bill_id, month, stamp],
            )
            .map_err(|problem| problem.to_string())?;
    } else {
        connection
            .execute(
                "delete from bill_payments where bill_id = ?1 and month = ?2",
                params![bill_id, month],
            )
            .map_err(|problem| problem.to_string())?;
    }
    Ok(())
}

pub fn list_cards(connection: &Connection) -> Result<Vec<CardMeta>, String> {
    let mut statement = connection
        .prepare(
            "select k.id, k.account_id, a.name, k.brand, k.last4, k.limit_cents,
                    k.closing_day, k.due_day, k.color, k.texture
             from cards k
             join accounts a on a.id = k.account_id
             where k.deleted_at is null and a.deleted_at is null
             order by a.name",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CardMeta {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                brand: row.get(3)?,
                last4: row.get(4)?,
                limit_cents: row.get(5)?,
                closing_day: row.get(6)?,
                due_day: row.get(7)?,
                color: row.get(8)?,
                texture: row.get(9)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_card(connection: &Connection, input: &CardInput) -> Result<i64, String> {
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update cards
                     set account_id = ?1, brand = ?2, last4 = ?3, limit_cents = ?4,
                         closing_day = ?5, due_day = ?6, color = ?7, texture = ?8, updated_at = ?9
                     where id = ?10",
                    params![
                        input.account_id,
                        input.brand,
                        input.last4,
                        input.limit_cents,
                        input.closing_day,
                        input.due_day,
                        input.color,
                        input.texture,
                        stamp,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into cards
                     (uid, account_id, brand, last4, limit_cents, closing_day, due_day, color,
                      texture, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
                     on conflict (account_id) do update
                        set brand = excluded.brand, last4 = excluded.last4,
                            limit_cents = excluded.limit_cents,
                            closing_day = excluded.closing_day, due_day = excluded.due_day,
                            color = excluded.color, texture = excluded.texture,
                            updated_at = excluded.updated_at",
                    params![
                        input.account_id,
                        input.brand,
                        input.last4,
                        input.limit_cents,
                        input.closing_day,
                        input.due_day,
                        input.color,
                        input.texture,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            let id: i64 = connection
                .query_row(
                    "select id from cards where account_id = ?1",
                    params![input.account_id],
                    |row| row.get(0),
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
    }
}

pub fn list_goals(connection: &Connection) -> Result<Vec<Goal>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, kind, target_cents, monthly_cents, starts_on, account_id, color
             from goals
             where deleted_at is null
             order by id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Goal {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                target_cents: row.get(3)?,
                monthly_cents: row.get(4)?,
                starts_on: row.get(5)?,
                account_id: row.get(6)?,
                color: row.get(7)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_goal(connection: &Connection, input: &GoalInput) -> Result<i64, String> {
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update goals
                     set name = ?1, kind = ?2, target_cents = ?3, monthly_cents = ?4,
                         starts_on = ?5, account_id = ?6, color = ?7, updated_at = ?8
                     where id = ?9",
                    params![
                        input.name,
                        input.kind,
                        input.target_cents,
                        input.monthly_cents,
                        input.starts_on,
                        input.account_id,
                        input.color,
                        stamp,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into goals
                     (uid, name, kind, target_cents, monthly_cents, starts_on, account_id, color,
                      visibility, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'shared', ?8, ?8)",
                    params![
                        input.name,
                        input.kind,
                        input.target_cents,
                        input.monthly_cents,
                        input.starts_on,
                        input.account_id,
                        input.color,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(connection.last_insert_rowid())
        }
    }
}

/// What a card actually moved inside the invoice window, in cents: purchases
/// minus payments and refunds, never below zero.
pub fn card_usage(connection: &Connection, account_id: i64, from: &str, to: &str) -> Result<i64, String> {
    connection
        .query_row(
            "select coalesce(sum(case when amount_cents < 0 then -amount_cents else 0 end), 0)
                    - coalesce(sum(case when amount_cents > 0 then amount_cents else 0 end), 0)
             from transactions
             where account_id = ?1 and posted_on > ?2 and posted_on <= ?3
               and deleted_at is null",
            params![account_id, from, to],
            |row| row.get::<_, i64>(0),
        )
        .map(|value| value.max(0))
        .map_err(|problem| problem.to_string())
}

/// Progress of a goal comes from two places: slices of paid bills linked to
/// the goal, and hand-entered deposits. Nothing is inferred from the
/// statement, so the bar cannot move on its own.
pub fn goal_totals(connection: &Connection) -> Result<Vec<GoalTotal>, String> {
    let mut statement = connection
        .prepare(
            "select goal_id, coalesce(sum(amount_cents), 0), count(*)
             from (
                 select b.goal_id as goal_id, p.amount_cents as amount_cents
                 from bill_payments p
                 join bills b on b.id = p.bill_id
                 where b.goal_id is not null and p.deleted_at is null and b.deleted_at is null
                 union all
                 select d.goal_id as goal_id, d.amount_cents as amount_cents
                 from goal_deposits d
                 join goals g on g.id = d.goal_id
                 where d.deleted_at is null and g.deleted_at is null
             )
             group by goal_id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(GoalTotal {
                goal_id: row.get(0)?,
                paid_cents: row.get(1)?,
                payments: row.get(2)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn list_reads(connection: &Connection) -> Result<Vec<String>, String> {
    let mut statement = connection
        .prepare("select key from notification_reads order by read_at desc")
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn mark_read(connection: &Connection, keys: &[String]) -> Result<(), String> {
    let stamp = now();
    for key in keys {
        connection
            .execute(
                "insert into notification_reads (uid, key, read_at)
                 values (lower(hex(randomblob(16))), ?1, ?2)
                 on conflict (key) do nothing",
                params![key, stamp],
            )
            .map_err(|problem| problem.to_string())?;
    }
    Ok(())
}

pub fn get_setting(connection: &Connection, key: &str) -> Result<Option<String>, String> {
    connection
        .query_row("select value from settings where key = ?1", params![key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|problem| problem.to_string())
}

pub fn set_setting(connection: &Connection, key: &str, value: &str) -> Result<(), String> {
    connection
        .execute(
            "insert into settings (key, value) values (?1, ?2)
             on conflict (key) do update set value = excluded.value",
            params![key, value],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

pub fn list_people(connection: &Connection) -> Result<Vec<Person>, String> {
    let mut statement = connection
        .prepare(
            "select id, name, color, is_self, weight_pct
             from people
             where deleted_at is null
             order by is_self desc, id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Person {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                is_self: row.get::<_, i64>(3)? == 1,
                weight_pct: row.get(4)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// Two people are the whole model for now: me and whoever shares the house.
/// Seeding is idempotent and happens on read, so the UI never has to guess.
pub fn ensure_people(connection: &Connection) -> Result<Vec<Person>, String> {
    let existing = list_people(connection)?;
    if !existing.is_empty() {
        return Ok(existing);
    }
    let stamp = now();
    for (name, color, is_self, weight) in [
        ("Você", "#2563eb", 1_i64, 50_i64),
        ("Parceiro(a)", "#f43f5e", 0, 50),
    ] {
        connection
            .execute(
                "insert into people (uid, name, color, is_self, weight_pct, created_at, updated_at)
                 values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?5)",
                params![name, color, is_self, weight, stamp],
            )
            .map_err(|problem| problem.to_string())?;
    }
    list_people(connection)
}

pub fn list_shares(connection: &Connection) -> Result<Vec<Share>, String> {
    let mut statement = connection
        .prepare(
            "select bill_id, person_id
             from shares
             where deleted_at is null
             order by bill_id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(Share {
                bill_id: row.get(0)?,
                person_id: row.get(1)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

/// One payer per bill: assigning the same bill twice replaces the payer.
pub fn set_share(connection: &Connection, input: &ShareInput) -> Result<(), String> {
    let stamp = now();
    connection
        .execute(
            "insert into shares (uid, bill_id, person_id, percent, created_at, updated_at)
             values (lower(hex(randomblob(16))), ?1, ?2, 100, ?3, ?3)
             on conflict (bill_id) do update
                set person_id = excluded.person_id, updated_at = excluded.updated_at",
            params![input.bill_id, input.person_id, stamp],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

pub fn list_debts(connection: &Connection, month: &str) -> Result<Vec<Debt>, String> {
    let mut statement = connection
        .prepare(
            "select d.id, d.person_id, p.name, d.label, d.amount_cents, d.month, d.settled_on
             from debts d
             left join people p on p.id = d.person_id
             where d.month = ?1 and d.deleted_at is null
             order by d.settled_on, d.id",
        )
        .map_err(|problem| problem.to_string())?;
    let rows = statement
        .query_map(params![month], |row| {
            Ok(Debt {
                id: row.get(0)?,
                person_id: row.get(1)?,
                person_name: row.get(2)?,
                label: row.get(3)?,
                amount_cents: row.get(4)?,
                month: row.get(5)?,
                settled_on: row.get(6)?,
            })
        })
        .map_err(|problem| problem.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())
}

pub fn save_debt(connection: &Connection, input: &DebtInput) -> Result<i64, String> {
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update debts
                     set person_id = ?1, label = ?2, amount_cents = ?3, month = ?4, updated_at = ?5
                     where id = ?6",
                    params![
                        input.person_id,
                        input.label,
                        input.amount_cents,
                        input.month,
                        stamp,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into debts
                     (uid, person_id, label, amount_cents, month, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?5, ?5)",
                    params![
                        input.person_id,
                        input.label,
                        input.amount_cents,
                        input.month,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(connection.last_insert_rowid())
        }
    }
}

/// Receiving is per debt: settling one leaves the others exactly as they were.
pub fn set_debt_settled(connection: &Connection, id: i64, settled: bool) -> Result<(), String> {
    let stamp = now();
    let settled_on: Option<String> = if settled { Some(stamp.clone()) } else { None };
    connection
        .execute(
            "update debts set settled_on = ?1, updated_at = ?2 where id = ?3",
            params![settled_on, stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

pub fn delete_debt(connection: &Connection, id: i64) -> Result<(), String> {
    let stamp = now();
    connection
        .execute(
            "update debts set deleted_at = ?1, updated_at = ?1 where id = ?2 and deleted_at is null",
            params![stamp, id],
        )
        .map_err(|problem| problem.to_string())?;
    Ok(())
}

/// A hand-entered aporte: money moved into a goal outside any bill.
pub fn save_deposit(connection: &Connection, input: &DepositInput) -> Result<i64, String> {
    if input.amount_cents <= 0 {
        return Err("deposit amount must be positive".to_string());
    }
    if input.deposited_on.len() != 10 {
        return Err("date must be YYYY-MM-DD".to_string());
    }
    let stamp = now();
    match input.id {
        Some(id) => {
            connection
                .execute(
                    "update goal_deposits
                     set goal_id = ?1, amount_cents = ?2, deposited_on = ?3, updated_at = ?4
                     where id = ?5",
                    params![
                        input.goal_id,
                        input.amount_cents,
                        input.deposited_on,
                        stamp,
                        id
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(id)
        }
        None => {
            connection
                .execute(
                    "insert into goal_deposits
                     (uid, goal_id, amount_cents, deposited_on, created_at, updated_at)
                     values (lower(hex(randomblob(16))), ?1, ?2, ?3, ?4, ?4)",
                    params![
                        input.goal_id,
                        input.amount_cents,
                        input.deposited_on,
                        stamp
                    ],
                )
                .map_err(|problem| problem.to_string())?;
            Ok(connection.last_insert_rowid())
        }
    }
}

pub fn state(connection: &Connection, month: &str) -> Result<PlannerState, String> {
    Ok(PlannerState {
        incomes: list_incomes(connection)?,
        bills: list_bills(connection)?,
        payments: list_payments(connection, month)?,
        cards: list_cards(connection)?,
        goals: list_goals(connection)?,
        goal_totals: goal_totals(connection)?,
        reads: list_reads(connection)?,
        people: ensure_people(connection)?,
        shares: list_shares(connection)?,
        debts: list_debts(connection, month)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::path::PathBuf;

    fn temporary_database(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("trove-planner-{}-{}.db", name, std::process::id()));
        let _ = std::fs::remove_file(&path);
        path
    }

    fn bill_input() -> BillInput {
        BillInput {
            id: None,
            name: "Aluguel".into(),
            amount_cents: 480_000,
            due_day: 5,
            frequency: "monthly".into(),
            category_id: None,
            account_id: None,
            goal_id: None,
            starts_on: "2026-01-01".into(),
            ends_on: None,
            installments_total: None,
            active: true,
        }
    }

    #[test]
    fn a_bill_can_be_created_paid_unpaid_and_removed() {
        let path = temporary_database("bill");
        let connection = db::open(&path).expect("should open");

        let id = save_bill(&connection, &bill_input()).expect("should save");
        assert_eq!(list_bills(&connection).expect("should list").len(), 1);

        set_bill_paid(&connection, id, "2026-12", true).expect("should pay");
        let paid = list_payments(&connection, "2026-12").expect("should list");
        assert_eq!(paid.len(), 1);
        assert_eq!(paid[0].amount_cents, 480_000);

        // Marking twice must not duplicate the payment.
        set_bill_paid(&connection, id, "2026-12", true).expect("should pay again");
        assert_eq!(list_payments(&connection, "2026-12").expect("list").len(), 1);

        set_bill_paid(&connection, id, "2026-12", false).expect("should unpay");
        assert_eq!(list_payments(&connection, "2026-12").expect("list").len(), 0);

        delete_bill(&connection, id).expect("should delete");
        assert_eq!(list_bills(&connection).expect("list").len(), 0);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn installments_round_trip_through_save_and_list() {
        let path = temporary_database("installments");
        let connection = db::open(&path).expect("should open");

        let mut input = bill_input();
        input.installments_total = Some(24);
        let id = save_bill(&connection, &input).expect("should save");
        let bills = list_bills(&connection).expect("should list");
        assert_eq!(bills.len(), 1);
        assert_eq!(bills[0].installments_total, Some(24));

        input.id = Some(id);
        input.installments_total = None;
        save_bill(&connection, &input).expect("should update");
        assert_eq!(
            list_bills(&connection).expect("list")[0].installments_total,
            None
        );

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn debts_settle_one_by_one() {
        let path = temporary_database("debts");
        let connection = db::open(&path).expect("should open");
        let people = ensure_people(&connection).expect("should seed");
        let partner = people.iter().find(|person| !person.is_self).expect("partner");

        let first = save_debt(
            &connection,
            &DebtInput {
                id: None,
                person_id: partner.id,
                label: "Cobasi".into(),
                amount_cents: 6_800,
                month: "2026-11".into(),
            },
        )
        .expect("should save");
        let second = save_debt(
            &connection,
            &DebtInput {
                id: None,
                person_id: partner.id,
                label: "Cinema".into(),
                amount_cents: 4_000,
                month: "2026-11".into(),
            },
        )
        .expect("should save");

        let debts = list_debts(&connection, "2026-11").expect("should list");
        assert_eq!(debts.len(), 2);
        assert_eq!(debts[0].person_name, Some(partner.name.clone()));
        assert!(debts.iter().all(|debt| debt.settled_on.is_none()));

        set_debt_settled(&connection, first, true).expect("should settle");
        let debts = list_debts(&connection, "2026-11").expect("list");
        let settled: Vec<_> = debts.iter().filter(|debt| debt.settled_on.is_some()).collect();
        assert_eq!(settled.len(), 1);
        assert_eq!(settled[0].id, first);

        // Other months and deleted rows stay out of the list.
        save_debt(
            &connection,
            &DebtInput {
                id: None,
                person_id: partner.id,
                label: "Outubro".into(),
                amount_cents: 1_000,
                month: "2026-10".into(),
            },
        )
        .expect("should save");
        delete_debt(&connection, second).expect("should delete");
        assert_eq!(list_debts(&connection, "2026-11").expect("list").len(), 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn income_round_trips_and_feeds_the_goal_progress() {
        let path = temporary_database("income");
        let connection = db::open(&path).expect("should open");

        let income_id = save_income(
            &connection,
            &IncomeInput {
                id: None,
                name: "Salário".into(),
                amount_cents: 2_800_000,
                frequency: "monthly".into(),
                pay_day: 5,
                account_id: None,
                active: true,
            },
        )
        .expect("should save");
        assert_eq!(list_incomes(&connection).expect("list")[0].amount_cents, 2_800_000);

        save_income(
            &connection,
            &IncomeInput {
                id: Some(income_id),
                name: "Salário".into(),
                amount_cents: 3_000_000,
                frequency: "monthly".into(),
                pay_day: 5,
                account_id: None,
                active: true,
            },
        )
        .expect("should update");
        let incomes = list_incomes(&connection).expect("list");
        assert_eq!(incomes.len(), 1);
        assert_eq!(incomes[0].amount_cents, 3_000_000);

        let goal_id = save_goal(
            &connection,
            &GoalInput {
                id: None,
                name: "Reserva".into(),
                kind: "reserve".into(),
                target_cents: 1_000_000,
                monthly_cents: 100_000,
                starts_on: "2026-01-01".into(),
                account_id: None,
                color: "#1f6b4f".into(),
            },
        )
        .expect("should save the goal");

        let mut input = bill_input();
        input.name = "Reserva".into();
        input.amount_cents = 100_000;
        input.goal_id = Some(goal_id);
        let bill_id = save_bill(&connection, &input).expect("should save the bill");
        set_bill_paid(&connection, bill_id, "2026-12", true).expect("should pay");

        let totals = goal_totals(&connection).expect("should total");
        assert_eq!(totals.len(), 1);
        assert_eq!(totals[0].paid_cents, 100_000);
        assert_eq!(totals[0].payments, 1);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn the_house_starts_with_two_people_and_one_payer_per_bill() {
        let path = temporary_database("people");
        let connection = db::open(&path).expect("should open");

        let people = ensure_people(&connection).expect("should seed");
        assert_eq!(people.len(), 2);
        assert!(people[0].is_self, "the first person is me");
        assert_eq!(people[0].weight_pct + people[1].weight_pct, 100);

        // Seeding twice must not duplicate the pair.
        assert_eq!(ensure_people(&connection).expect("should not reseed").len(), 2);

        let id = save_bill(&connection, &bill_input()).expect("should save");
        set_share(
            &connection,
            &ShareInput {
                bill_id: id,
                person_id: people[1].id,
            },
        )
        .expect("should share");
        assert_eq!(list_shares(&connection).expect("list").len(), 1);

        // Assigning the same bill again replaces the payer instead of adding one.
        set_share(
            &connection,
            &ShareInput {
                bill_id: id,
                person_id: people[0].id,
            },
        )
        .expect("should reassign");
        let shares = list_shares(&connection).expect("list");
        assert_eq!(shares.len(), 1);
        assert_eq!(shares[0].person_id, people[0].id);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn deposits_feed_the_goal_progress_next_to_paid_bills() {
        let path = temporary_database("deposits");
        let connection = db::open(&path).expect("should open");

        let goal_id = save_goal(
            &connection,
            &GoalInput {
                id: None,
                name: "Reserva".into(),
                kind: "reserve".into(),
                target_cents: 1_000_000,
                monthly_cents: 100_000,
                starts_on: "2026-01-01".into(),
                account_id: None,
                color: "#1f6b4f".into(),
            },
        )
        .expect("should save the goal");

        let deposit = DepositInput {
            id: None,
            goal_id,
            amount_cents: 25_000,
            deposited_on: "2026-11-05".into(),
        };
        save_deposit(&connection, &deposit).expect("should save");
        save_deposit(&connection, &deposit).expect("should save again");

        // Zero and negative amounts are refused.
        assert!(save_deposit(
            &connection,
            &DepositInput { amount_cents: 0, ..deposit.clone() }
        )
        .is_err());
        assert!(save_deposit(
            &connection,
            &DepositInput { amount_cents: -100, ..deposit.clone() }
        )
        .is_err());

        let totals = goal_totals(&connection).expect("should total");
        assert_eq!(totals.len(), 1);
        assert_eq!(totals[0].goal_id, goal_id);
        assert_eq!(totals[0].paid_cents, 50_000);
        assert_eq!(totals[0].payments, 2);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn a_card_keeps_its_window_and_only_counts_inside_it() {
        let path = temporary_database("card");
        let connection = db::open(&path).expect("should open");

        connection
            .execute(
                "insert into accounts (name, kind, bank_id, acct_id, currency, created_at, uid, updated_at)
                 values ('Card 1', 'credit_card', '341', '1', 'BRL', '2026-01-01T00:00:00Z', 'u1', '2026-01-01T00:00:00Z')",
                [],
            )
            .expect("should insert the account");
        for (date, amount, key) in [
            ("2026-12-04", -10_000i64, "inside"),
            ("2026-12-06", -20_000i64, "after"),
            ("2026-11-05", -40_000i64, "before"),
        ] {
            connection
                .execute(
                    "insert into transactions
                     (account_id, posted_on, amount_cents, description, dedupe_key, created_at, uid, updated_at)
                     values (1, ?1, ?2, 'x', ?3, '2026-12-06T00:00:00Z', ?3, '2026-12-06T00:00:00Z')",
                    params![date, amount, key],
                )
                .expect("should insert the transaction");
        }

        // Window for the invoice due in December with closing on day 5.
        let usage = card_usage(&connection, 1, "2026-11-05", "2026-12-05").expect("should measure");
        assert_eq!(usage, 10_000, "only the purchase after the previous close counts");
        let next = card_usage(&connection, 1, "2026-12-05", "2027-01-05").expect("should measure");
        assert_eq!(next, 20_000);

        let _ = std::fs::remove_file(&path);
    }
}
