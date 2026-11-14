//! Sample data for trying the app: all of 2026, with December carrying the
//! bills, card invoices, goals and debts. Everything goes through the same
//! functions the screens use, so it obeys the same rules as real entries.

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{self, ManualInput};
use crate::planner::{
    self, BillInput, CardInput, DebtInput, DepositInput, GoalInput, IncomeInput, ShareInput,
};

const MARKER: &str = "demo_loaded";

/// (description, category, spends on the card?, typical cents)
const TEMPLATES: &[(&str, &str, bool, i64)] = &[
    ("PAO DE ACUCAR", "Groceries", true, 28000),
    ("HORTIFRUTI CENTRAL", "Groceries", false, 9500),
    ("IFOOD *RESTAURANTE", "Food", true, 6500),
    ("PADARIA BELA VISTA", "Food", false, 1800),
    ("UBER *TRIP", "Transport", true, 2400),
    ("POSTO SHELL", "Transport", false, 22000),
    ("NETFLIX.COM", "Subscriptions", true, 5590),
    ("SPOTIFY", "Subscriptions", true, 2190),
    ("DROGASIL", "Health", true, 8900),
    ("CINEMARK", "Leisure", true, 7200),
];

pub fn is_loaded(connection: &Connection) -> Result<bool, String> {
    Ok(planner::get_setting(connection, MARKER)?.is_some())
}

fn category_id(connection: &Connection, name: &str) -> Result<Option<i64>, String> {
    connection
        .query_row(
            "select id from categories where name = ?1 and deleted_at is null",
            params![name],
            |row| row.get(0),
        )
        .optional()
        .map_err(|problem| problem.to_string())
}

/// Small deterministic generator: the same sample every time, no extra crate.
struct Lcg(u64);

impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }
    fn below(&mut self, limit: u64) -> u64 {
        self.next() % limit
    }
}

/// Loads the sample. Refuses to run twice so the data is never doubled.
pub fn load(connection: &Connection) -> Result<(), String> {
    if is_loaded(connection)? {
        return Err("sample data is already loaded".to_string());
    }
    // One transaction: a failure halfway must not leave half a sample behind.
    connection.execute_batch("begin").map_err(|problem| problem.to_string())?;
    match fill(connection) {
        Ok(()) => connection.execute_batch("commit").map_err(|problem| problem.to_string()),
        Err(problem) => {
            let _ = connection.execute_batch("rollback");
            Err(problem)
        }
    }
}

fn fill(connection: &Connection) -> Result<(), String> {

    let checking = db::create_manual_account(connection, "Conta Corrente (exemplo)")?;
    let nubank = db::create_manual_account(connection, "Nubank (exemplo)")?;
    let itau = db::create_manual_account(connection, "Itaú Cartão (exemplo)")?;

    let cat = |name: &str| category_id(connection, name);
    let add = |account: i64, date: String, cents: i64, text: &str, category: Option<i64>| {
        db::save_manual_transaction(
            connection,
            &ManualInput {
                account_id: account,
                posted_on: date,
                amount_cents: cents,
                description: text.to_string(),
                category_id: category,
                notes: String::new(),
            },
        )
    };

    let salary = cat("Salary")?;
    let housing = cat("Housing")?;
    let leisure = cat("Leisure")?;
    let transport = cat("Transport")?;
    let health = cat("Health")?;
    let groceries = cat("Groceries")?;

    let mut random = Lcg(2026);
    for month in 1..=12_u32 {
        let on = |day: u32| format!("2026-{month:02}-{day:02}");
        add(checking, on(5), 1_250_000, "SALARIO EMPRESA LTDA", salary)?;
        add(checking, on(10), -320_000, "ALUGUEL APTO", housing)?;
        add(checking, on(12), -68_000, "CONDOMINIO", housing)?;
        add(checking, on(15), -12_000, "INTERNET FIBRA", housing)?;
        add(checking, on(20), -21_000, "ENERGIA ELETRICA", housing)?;
        for _ in 0..22 {
            let (text, category, on_card, typical) =
                TEMPLATES[random.below(TEMPLATES.len() as u64) as usize];
            let day = 1 + random.below(28) as u32;
            let factor = 60 + random.below(80) as i64;
            let cents = -(typical * factor / 100);
            let account = if !on_card {
                checking
            } else if random.below(2) == 0 {
                nubank
            } else {
                itau
            };
            add(account, on(day), cents, text, cat(category)?)?;
        }
        add(itau, on(6), -89_990, "AMAZON MARKETPLACE", leisure)?;
        if month >= 6 && month <= 12 {
            add(nubank, on(8), -45_000, "NOTEBOOK PARCELADO", leisure)?;
        }
    }

    // December: 13th salary, year-end shopping, the trip and the monthly bills.
    let dec = |day: u32| format!("2026-12-{day:02}");
    add(checking, dec(20), 625_000, "13O SALARIO EMPRESA LTDA", salary)?;
    add(itau, dec(18), -64_900, "AMAZON PRESENTES NATAL", leisure)?;
    add(nubank, dec(19), -129_900, "MAGAZINE LUIZA", leisure)?;
    add(checking, dec(22), -48_700, "CEIA DE NATAL MERCADO", groceries)?;
    add(itau, dec(23), -184_200, "VIAGEM AEREA LATAM", leisure)?;
    add(checking, dec(14), -38_000, "SEGURO AUTO PORTO", transport)?;
    add(checking, dec(16), -62_000, "PLANO DE SAUDE", health)?;

    planner::save_income(
        connection,
        &IncomeInput {
            id: None,
            name: "Salário".to_string(),
            amount_cents: 1_250_000,
            frequency: "monthly".to_string(),
            pay_day: 5,
            account_id: Some(checking),
            active: true,
        },
    )?;

    let bill = |name: &str, cents: i64, day: i64, category: Option<i64>, account: i64, starts: &str, ends: Option<&str>, parts: Option<i64>| BillInput {
        id: None,
        name: name.to_string(),
        amount_cents: cents,
        due_day: day,
        frequency: "monthly".to_string(),
        category_id: category,
        account_id: Some(account),
        goal_id: None,
        starts_on: starts.to_string(),
        ends_on: ends.map(str::to_string),
        installments_total: parts,
        active: true,
    };
    let rent = planner::save_bill(connection, &bill("Aluguel", 320_000, 10, housing, checking, "2026-01-01", None, None))?;
    let condo = planner::save_bill(connection, &bill("Condomínio", 68_000, 12, housing, checking, "2026-01-01", None, None))?;
    let internet = planner::save_bill(connection, &bill("Internet", 12_000, 15, housing, checking, "2026-01-01", None, None))?;
    let energy = planner::save_bill(connection, &bill("Energia", 21_000, 20, housing, checking, "2026-01-01", None, None))?;
    let laptop = planner::save_bill(connection, &bill("Notebook (10x)", 45_000, 8, leisure, nubank, "2026-06-01", Some("2027-03-01"), Some(10)))?;
    let insurance = planner::save_bill(connection, &bill("Seguro auto", 38_000, 14, transport, checking, "2026-01-01", None, None))?;
    let plan = planner::save_bill(connection, &bill("Plano de saúde", 62_000, 16, health, checking, "2026-01-01", None, None))?;
    let gym = planner::save_bill(connection, &bill("Academia", 12_990, 17, leisure, itau, "2026-01-01", None, None))?;

    // Every month up to November is paid; December keeps the later ones open.
    for month in 1..=12_u32 {
        let key = format!("2026-{month:02}");
        for (id, starts_in, day) in [
            (rent, 1, 10),
            (condo, 1, 12),
            (internet, 1, 15),
            (energy, 1, 20),
            (laptop, 6, 8),
            (insurance, 1, 14),
            (plan, 1, 16),
            (gym, 1, 17),
        ] {
            if month < starts_in || (month == 12 && day > 13) {
                continue;
            }
            planner::set_bill_paid(connection, id, &key, true)?;
        }
    }

    for (brand, last4, limit, closing, due, color, texture, account) in [
        ("mastercard", "9876", 800_000, 3, 10, "#8a05be", "waves", nubank),
        ("visa", "4410", 1_200_000, 20, 27, "#ec7000", "glow", itau),
    ] {
        planner::save_card(
            connection,
            &CardInput {
                id: None,
                account_id: account,
                brand: brand.to_string(),
                last4: last4.to_string(),
                limit_cents: limit,
                closing_day: closing,
                due_day: due,
                color: color.to_string(),
                texture: texture.to_string(),
            },
        )?;
    }

    let reserve = planner::save_goal(
        connection,
        &GoalInput {
            id: None,
            name: "Reserva de emergência".to_string(),
            kind: "reserve".to_string(),
            target_cents: 4_500_000,
            monthly_cents: 150_000,
            starts_on: "2026-01-01".to_string(),
            account_id: Some(checking),
            color: "#16a34a".to_string(),
        },
    )?;
    let trip = planner::save_goal(
        connection,
        &GoalInput {
            id: None,
            name: "Viagem Japão".to_string(),
            kind: "goal".to_string(),
            target_cents: 1_800_000,
            monthly_cents: 100_000,
            starts_on: "2026-01-01".to_string(),
            account_id: Some(checking),
            color: "#0ea5e9".to_string(),
        },
    )?;
    for month in 1..=12_u32 {
        for (goal, cents) in [(reserve, 150_000), (trip, 100_000)] {
            planner::save_deposit(
                connection,
                &DepositInput {
                    id: None,
                    goal_id: goal,
                    amount_cents: cents,
                    deposited_on: format!("2026-{month:02}-06"),
                },
            )?;
        }
    }

    let people = planner::ensure_people(connection)?;
    if let Some(other) = people.iter().find(|person| !person.is_self) {
        planner::set_share(connection, &ShareInput { bill_id: rent, person_id: other.id })?;
        planner::save_debt(
            connection,
            &DebtInput {
                id: None,
                person_id: other.id,
                label: "Jantar".to_string(),
                amount_cents: 8_500,
                month: "2026-12".to_string(),
            },
        )?;
    }

    planner::set_setting(connection, MARKER, "1")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loads_the_whole_year_once() {
        let mut path = std::env::temp_dir();
        path.push(format!("trove-demo-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let connection = db::open(&path).expect("should open");
        load(&connection).expect("should load");
        let december: i64 = connection
            .query_row(
                "select count(*) from transactions where posted_on like '2026-12-%' and deleted_at is null",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let january: i64 = connection
            .query_row(
                "select count(*) from transactions where posted_on like '2026-01-%' and deleted_at is null",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(december > 25 && january > 25);
        assert_eq!(planner::list_cards(&connection).unwrap().len(), 2);
        assert_eq!(planner::list_bills(&connection).unwrap().len(), 8);
        assert!(load(&connection).is_err(), "a second load must be refused");
        drop(connection);
        let _ = std::fs::remove_file(&path);
    }
}
