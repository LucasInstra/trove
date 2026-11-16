//! Sample data for trying the app: all of 2026, with December carrying the
//! bills, card invoices, goals and debts. Everything goes through the same
//! functions the screens use, so it obeys the same rules as real entries.

use rusqlite::{params, Connection, OptionalExtension};

use crate::db::{self, HoldingInput, ManualInput, RuleInput};
use crate::planner::{
    self, BillInput, CardInput, DebtInput, DepositInput, GoalInput, IncomeInput, ShareInput,
};

const MARKER: &str = "demo_loaded";
/// When the sample data was loaded: a holding created later is the person's, even if it reuses a sample name.
const LOADED_AT: &str = "demo_loaded_at";

const ACCOUNTS: [&str; 3] = ["Conta Corrente (exemplo)", "Nubank (exemplo)", "Itaú Cartão (exemplo)"];
const GOALS: [&str; 2] = ["Reserva de emergência", "Viagem Japão"];

/// Monthly pay, in cents: a household where one person earns three times the
/// minimum wage and the partner two. Money moves around it: some months leave a
/// surplus, others overspend.
const USER_SALARY: i64 = 486_300;
const PARTNER_SALARY: i64 = 324_200;

/// Irregular entries on the joint account: (month, day, cents, description, category).
const EXTRAS: &[(u32, u32, i64, &str, &str)] = &[
    (1, 15, -45_000, "IPTU 2026 COTA UNICA", "Housing"),
    (3, 20, -62_000, "OFICINA REVISAO CARRO", "Transport"),
    (5, 10, -38_000, "PRESENTE DIA DAS MAES", "Leisure"),
    (7, 14, -95_000, "HOTEL FERIAS BOOKING", "Leisure"),
    (8, 12, 120_000, "RESTITUICAO IMPOSTO DE RENDA", "Salary"),
    (9, 12, -48_000, "DENTISTA CLINICA SORRISO", "Health"),
    (11, 28, -110_000, "BLACK FRIDAY ELETRO", "Leisure"),
];

/// Installment purchases on the cards, all starting in 2026:
/// (bill name, entry description, cents per parcel, day, category, on the Nubank card?, first month, parcels)
const INSTALLMENTS: &[(&str, &str, i64, u32, &str, bool, u32, i64)] = &[
    ("Notebook (10x)", "NOTEBOOK PARCELADO", 24_900, 8, "Leisure", true, 6, 10),
    ("Celular (12x)", "CELULAR PARCELADO", 12_900, 12, "Leisure", false, 3, 12),
    ("Sofá (6x)", "SOFA MAGAZINE PARC", 18_000, 5, "Housing", false, 8, 6),
    ("Geladeira (10x)", "GELADEIRA PARCELADA", 16_900, 22, "Housing", true, 5, 10),
    ("Viagem Japão (6x)", "AGENCIA VIAGENS PARC", 19_000, 25, "Leisure", false, 10, 6),
    ("Curso de inglês (12x)", "CURSO INGLES PARC", 9_900, 18, "Education", true, 2, 12),
];

/// First day of the last parcel's month.
fn installment_end(start: u32, parcels: i64) -> String {
    let index = (start as i64 - 1) + (parcels - 1);
    format!("{}-{:02}-01", 2026 + index / 12, index % 12 + 1)
}

/// Auto-categorization rules, one per merchant of the sample: (pattern, category, sign).
const RULES: &[(&str, &str, &str)] = &[
    ("PAO DE ACUCAR", "Groceries", "out"),
    ("HORTIFRUTI", "Groceries", "out"),
    ("IFOOD", "Food", "out"),
    ("PADARIA", "Food", "out"),
    ("UBER", "Transport", "out"),
    ("POSTO", "Transport", "out"),
    ("SEGURO AUTO", "Transport", "out"),
    ("NETFLIX", "Subscriptions", "out"),
    ("SPOTIFY", "Subscriptions", "out"),
    ("DROGASIL", "Health", "out"),
    ("PLANO DE SAUDE", "Health", "out"),
    ("CINEMARK", "Leisure", "out"),
    ("AMAZON", "Leisure", "out"),
    ("ALUGUEL", "Housing", "out"),
    ("CONDOMINIO", "Housing", "out"),
    ("ENERGIA", "Housing", "out"),
    ("INTERNET", "Housing", "out"),
    ("SALARIO", "Salary", "in"),
];

/// (name, kind, amount, cost, indexer, rate in bps, term in months, started on)
const HOLDINGS: &[(&str, &str, i64, i64, &str, i64, i64, &str)] = &[
    ("Conta remunerada", "cash", 380_000, 380_000, "cdi", 10_000, 0, "2026-01-02"),
    ("Tesouro Selic 2029", "investment", 1_450_000, 1_350_000, "selic", 10_000, 36, "2026-01-05"),
    ("CDB 110% do CDI", "investment", 820_000, 760_000, "cdi", 11_000, 24, "2026-03-10"),
    ("Tesouro IPCA+ 2035", "investment", 540_000, 480_000, "ipca", 600, 108, "2026-02-01"),
    ("Fundo imobiliário", "investment", 310_000, 295_000, "none", 0, 0, "2026-04-15"),
    ("Ações", "investment", 240_000, 215_000, "none", 0, 0, "2026-05-20"),
];

/// (description, category, spends on the card?, typical cents)
const TEMPLATES: &[(&str, &str, bool, i64)] = &[
    ("PAO DE ACUCAR", "Groceries", true, 21000),
    ("HORTIFRUTI CENTRAL", "Groceries", false, 6500),
    ("IFOOD *RESTAURANTE", "Food", true, 5800),
    ("PADARIA BELA VISTA", "Food", false, 2300),
    ("UBER *TRIP", "Transport", true, 2600),
    ("POSTO SHELL", "Transport", false, 17500),
    ("NETFLIX.COM", "Subscriptions", true, 5590),
    ("SPOTIFY", "Subscriptions", true, 2190),
    ("DROGASIL", "Health", true, 7200),
    ("CINEMARK", "Leisure", true, 6400),
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
        add(checking, on(5), USER_SALARY, "SALARIO EMPRESA LTDA", salary)?;
        add(checking, on(7), PARTNER_SALARY, "SALARIO CLINICA VIDA", salary)?;
        add(checking, on(10), -180_000, "ALUGUEL APTO", housing)?;
        add(checking, on(12), -42_000, "CONDOMINIO", housing)?;
        add(checking, on(14), -21_000, "SEGURO AUTO PORTO", transport)?;
        add(checking, on(15), -11_990, "INTERNET FIBRA", housing)?;
        add(checking, on(16), -46_000, "PLANO DE SAUDE", health)?;
        add(itau, on(17), -9_990, "ACADEMIA SMARTFIT", leisure)?;
        add(checking, on(20), -(15_000 + random.below(9_000) as i64), "ENERGIA ELETRICA", housing)?;
        for _ in 0..28 {
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
        add(itau, on(6), -19_990, "AMAZON MARKETPLACE", leisure)?;
        for (_, description, cents, day, category, on_nubank, start, _) in INSTALLMENTS {
            if month >= *start {
                let card = if *on_nubank { nubank } else { itau };
                add(card, on(*day), -*cents, description, cat(category)?)?;
            }
        }
    }

    // The months that are not ordinary: a tax, a repair, a holiday, a refund.
    for (month, day, cents, text, category) in EXTRAS {
        add(checking, format!("2026-{month:02}-{day:02}"), *cents, text, cat(category)?)?;
    }

    // December: the year-end shopping.
    let dec = |day: u32| format!("2026-12-{day:02}");
    add(itau, dec(18), -28_000, "AMAZON PRESENTES NATAL", leisure)?;
    add(nubank, dec(19), -45_000, "MAGAZINE LUIZA", leisure)?;
    add(checking, dec(22), -32_000, "CEIA DE NATAL MERCADO", groceries)?;
    add(itau, dec(23), -76_000, "VIAGEM AEREA LATAM", leisure)?;

    let household = planner::ensure_people(connection)?;
    let partner_id = household.iter().find(|person| !person.is_self).map(|person| person.id);
    let self_id = household.iter().find(|person| person.is_self).map(|person| person.id);
    planner::save_income(
        connection,
        &IncomeInput {
            id: None,
            name: "Salário".to_string(),
            amount_cents: USER_SALARY,
            frequency: "monthly".to_string(),
            pay_day: 5,
            account_id: Some(checking),
            active: true,
            person_id: self_id,
        },
    )?;
    planner::save_income(
        connection,
        &IncomeInput {
            id: None,
            name: "Salário (parceiro)".to_string(),
            amount_cents: PARTNER_SALARY,
            frequency: "monthly".to_string(),
            pay_day: 7,
            account_id: Some(checking),
            active: true,
            person_id: partner_id,
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
    let rent = planner::save_bill(connection, &bill("Aluguel", 180_000, 10, housing, checking, "2026-01-01", None, None))?;
    let condo = planner::save_bill(connection, &bill("Condomínio", 42_000, 12, housing, checking, "2026-01-01", None, None))?;
    let internet = planner::save_bill(connection, &bill("Internet", 11_990, 15, housing, checking, "2026-01-01", None, None))?;
    let energy = planner::save_bill(connection, &bill("Energia", 19_000, 20, housing, checking, "2026-01-01", None, None))?;
    let insurance = planner::save_bill(connection, &bill("Seguro auto", 21_000, 14, transport, checking, "2026-01-01", None, None))?;
    let plan = planner::save_bill(connection, &bill("Plano de saúde", 46_000, 16, health, checking, "2026-01-01", None, None))?;
    let gym = planner::save_bill(connection, &bill("Academia", 9_990, 17, leisure, itau, "2026-01-01", None, None))?;
    let mut installment_bills: Vec<(i64, u32, u32)> = Vec::new();
    for (name, _, cents, day, category, on_nubank, start, parcels) in INSTALLMENTS {
        let card = if *on_nubank { nubank } else { itau };
        let ends = installment_end(*start, *parcels);
        let id = planner::save_bill(
            connection,
            &bill(name, *cents, *day as i64, cat(category)?, card, &format!("2026-{start:02}-01"), Some(&ends), Some(*parcels)),
        )?;
        installment_bills.push((id, *start, *day));
    }

    // Every month up to November is paid; December keeps the later ones open.
    for month in 1..=12_u32 {
        let key = format!("2026-{month:02}");
        for (id, starts_in, day) in [
            (rent, 1, 10),
            (condo, 1, 12),
            (internet, 1, 15),
            (energy, 1, 20),
            (insurance, 1, 14),
            (plan, 1, 16),
            (gym, 1, 17),
        ]
        .into_iter()
        .chain(installment_bills.iter().copied())
        {
            if month < starts_in || (month == 12 && day > 13) {
                continue;
            }
            planner::set_bill_paid(connection, id, &key, true)?;
        }
    }

    for (brand, last4, limit, closing, due, color, texture, account) in [
        ("mastercard", "9876", 600_000, 3, 10, "#8a05be", "waves", nubank),
        ("visa", "4410", 900_000, 20, 27, "#ec7000", "glow", itau),
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
            target_cents: 2_400_000,
            monthly_cents: 60_000,
            starts_on: "2026-01-01".to_string(),
            account_id: Some(checking),
            color: "#16a34a".to_string(),
            icon: "piggy".to_string(),
        },
    )?;
    let trip = planner::save_goal(
        connection,
        &GoalInput {
            id: None,
            name: "Viagem Japão".to_string(),
            kind: "goal".to_string(),
            target_cents: 1_200_000,
            monthly_cents: 40_000,
            starts_on: "2026-01-01".to_string(),
            account_id: Some(checking),
            color: "#0ea5e9".to_string(),
            icon: "plane".to_string(),
        },
    )?;
    for month in 1..=12_u32 {
        for (goal, cents) in [(reserve, 60_000), (trip, 40_000)] {
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
                ..Default::default()
            },
        )?;
    }

    for (pattern, category, sign) in RULES {
        if let Some(category_id) = category_id(connection, category)? {
            db::save_rule(
                connection,
                &RuleInput {
                    id: None,
                    pattern: (*pattern).to_string(),
                    target: "both".to_string(),
                    category_id,
                    sign: (*sign).to_string(),
                    min_amount_cents: None,
                    max_amount_cents: None,
                    priority: 0,
                },
            )?;
        }
    }

    for (name, kind, amount, cost, indexer, rate, term, started) in HOLDINGS {
        db::save_holding(
            connection,
            &HoldingInput {
                id: None,
                name: (*name).to_string(),
                kind: (*kind).to_string(),
                amount_cents: *amount,
                updated_on: "2026-12-01".to_string(),
                cost_cents: *cost,
                indexer: (*indexer).to_string(),
                rate_bps: *rate,
                term_months: *term,
                started_on: (*started).to_string(),
                taxable: true,
                ..Default::default()
            },
        )?;
    }

    planner::set_setting(connection, MARKER, "1")?;
    planner::set_setting(connection, LOADED_AT, &chrono::Utc::now().to_rfc3339())?;
    Ok(())
}

/// Takes the sample back out. Only what `load` made goes: the three example
/// accounts with their entries, the bills, income, cards, goals and deposits
/// tied to them, the example debt, the example holdings and the example rules. Rows are deleted
/// for real, not tombstoned, so loading the sample again does not trip over
/// names that must be unique.
pub fn remove(connection: &Connection) -> Result<(), String> {
    if !is_loaded(connection)? {
        return Err("there is no sample data to remove".to_string());
    }
    connection.execute_batch("begin").map_err(|problem| problem.to_string())?;
    match wipe(connection) {
        Ok(()) => connection.execute_batch("commit").map_err(|problem| problem.to_string()),
        Err(problem) => {
            let _ = connection.execute_batch("rollback");
            Err(problem)
        }
    }
}

/// Everything the user entered, gone: accounts, transactions, plans, rules and
/// tags. Categories, settings and the user's own profile stay.
pub fn erase_all(connection: &Connection) -> Result<(), String> {
    connection.execute_batch("begin").map_err(|problem| problem.to_string())?;
    let result = (|| {
        for sql in [
            "delete from notification_reads",
            "delete from transaction_tags",
            "delete from tags",
            "delete from shares",
            "delete from bill_payments",
            "delete from goal_deposits",
            "delete from bills",
            "delete from goals",
            "delete from incomes",
            "delete from cards",
            "delete from debts",
            "delete from holdings",
            "delete from budgets",
            "delete from rules",
            "delete from csv_profiles",
            "delete from transactions",
            "delete from imports",
            "delete from accounts",
            "delete from people where is_self = 0",
        ] {
            connection.execute(sql, []).map_err(|problem| problem.to_string())?;
        }
        connection
            .execute("delete from settings where key = ?1", params![MARKER])
            .map_err(|problem| problem.to_string())?;
        Ok::<(), String>(())
    })();
    match result {
        Ok(()) => connection.execute_batch("commit").map_err(|problem| problem.to_string()),
        Err(problem) => {
            let _ = connection.execute_batch("rollback");
            Err(problem)
        }
    }
}

fn quoted(names: &[&str]) -> String {
    names.iter().map(|name| format!("'{name}'")).collect::<Vec<_>>().join(", ")
}

fn wipe(connection: &Connection) -> Result<(), String> {
    let accounts = format!("select id from accounts where name in ({})", quoted(&ACCOUNTS));
    let bills = format!("select id from bills where account_id in ({accounts})");
    let goals = format!(
        "select id from goals where account_id in ({accounts}) and name in ({})",
        quoted(&GOALS)
    );
    let holdings: Vec<&str> = HOLDINGS.iter().map(|entry| entry.0).collect();
    let patterns: Vec<&str> = RULES.iter().map(|entry| entry.0).collect();
    let steps = [
        format!("delete from bill_payments where bill_id in ({bills})"),
        format!("delete from shares where bill_id in ({bills})"),
        format!("delete from goal_deposits where goal_id in ({goals})"),
        format!("delete from bills where account_id in ({accounts})"),
        format!("delete from goals where id in ({goals})"),
        format!("delete from incomes where account_id in ({accounts})"),
        format!("delete from cards where account_id in ({accounts})"),
        "delete from debts where label = 'Jantar' and month = '2026-12' and amount_cents = 8500".to_string(),
        format!("delete from transactions where account_id in ({accounts})"),
        format!("delete from accounts where name in ({})", quoted(&ACCOUNTS)),
        format!(
            "delete from holdings where name in ({}) and created_at <= coalesce((select value from settings where key = '{LOADED_AT}'), created_at)",
            quoted(&holdings)
        ),
        format!("delete from rules where pattern in ({})", quoted(&patterns)),
    ];
    for sql in steps {
        connection.execute(&sql, []).map_err(|problem| problem.to_string())?;
    }
    connection
        .execute("delete from settings where key = ?1", params![MARKER])
        .map_err(|problem| problem.to_string())?;
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
        assert_eq!(planner::list_bills(&connection).unwrap().len(), 7 + INSTALLMENTS.len());
        assert!(load(&connection).is_err(), "a second load must be refused");
        assert_eq!(db::list_holdings(&connection).unwrap().len(), HOLDINGS.len());
        assert_eq!(db::list_rules(&connection).unwrap().len(), RULES.len());

        remove(&connection).expect("should remove");
        assert!(!is_loaded(&connection).unwrap());
        assert!(remove(&connection).is_err(), "nothing left to remove");
        for table in ["transactions", "bills", "cards", "goals", "goal_deposits", "incomes", "holdings", "rules"] {
            let left: i64 = connection
                .query_row(&format!("select count(*) from {table}"), [], |row| row.get(0))
                .unwrap();
            assert_eq!(left, 0, "{table} must be empty after removing the sample");
        }
        load(&connection).expect("the sample can be loaded again after removing it");
        erase_all(&connection).expect("should erase everything");
        for table in ["accounts", "transactions", "bills", "goals", "incomes", "holdings", "rules", "debts"] {
            let left: i64 = connection
                .query_row(&format!("select count(*) from {table}"), [], |row| row.get(0))
                .unwrap();
            assert_eq!(left, 0, "{table} must be empty after erasing");
        }
        assert!(!is_loaded(&connection).unwrap());
        drop(connection);
        let _ = std::fs::remove_file(&path);
    }
}
