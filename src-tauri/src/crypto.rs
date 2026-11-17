//! Optional crypto prices: a holding with a symbol and a quantity is worth
//! quantity x price. The only network call the app makes besides updates, and it
//! only runs when the user turned crypto on in Settings.

use rusqlite::{params, Connection};
use std::collections::HashMap;

/// Setting that holds the user's choice: absent = never asked, "on" or "off".
pub const SETTING: &str = "crypto_enabled";

/// Symbols the app knows, with the id the price service uses for each.
pub const COINS: &[(&str, &str)] = &[
    ("BTC", "bitcoin"),
    ("ETH", "ethereum"),
    ("SOL", "solana"),
    ("BNB", "binancecoin"),
    ("XRP", "ripple"),
    ("ADA", "cardano"),
    ("DOGE", "dogecoin"),
    ("LTC", "litecoin"),
    ("USDT", "tether"),
    ("USDC", "usd-coin"),
];

fn coin_id(symbol: &str) -> Option<&'static str> {
    COINS
        .iter()
        .find(|(known, _)| known.eq_ignore_ascii_case(symbol))
        .map(|(_, id)| *id)
}

/// Parses the price service answer: {"bitcoin":{"brl":350000.5}, ...} into id -> price in reais.
fn parse_prices(body: &str) -> Result<HashMap<String, f64>, String> {
    let value: serde_json::Value = serde_json::from_str(body).map_err(|problem| problem.to_string())?;
    let object = value.as_object().ok_or("unexpected price answer")?;
    Ok(object
        .iter()
        .filter_map(|(id, entry)| entry.get("brl").and_then(|price| price.as_f64()).map(|price| (id.clone(), price)))
        .collect())
}

/// Sets each crypto holding's value to units x price (cents) and stamps today's date.
/// Returns how many holdings were updated.
pub fn apply_prices(connection: &Connection, prices: &HashMap<String, f64>, today: &str) -> Result<usize, String> {
    let rows: Vec<(i64, String, String)> = {
        let mut statement = connection
            .prepare("select id, symbol, units from holdings where deleted_at is null and symbol <> ''")
            .map_err(|problem| problem.to_string())?;
        let found = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|problem| problem.to_string())?;
        found.collect::<Result<Vec<_>, _>>().map_err(|problem| problem.to_string())?
    };
    let mut updated = 0;
    for (id, symbol, units) in rows {
        let Some(price) = coin_id(&symbol).and_then(|coin| prices.get(coin)) else { continue };
        let units: f64 = units.trim().replace(',', ".").parse().unwrap_or(0.0);
        if units < 0.0 || !price.is_finite() {
            continue;
        }
        let cents = (units * price * 100.0).round() as i64;
        connection
            .execute(
                "update holdings set amount_cents = ?1, updated_on = ?2, updated_at = ?3 where id = ?4",
                params![cents, today, chrono::Utc::now().to_rfc3339(), id],
            )
            .map_err(|problem| problem.to_string())?;
        updated += 1;
    }
    Ok(updated)
}

/// The coin ids the user's holdings need, so only those are requested.
pub fn wanted_coins(connection: &Connection) -> Result<Vec<&'static str>, String> {
    let mut statement = connection
        .prepare("select distinct symbol from holdings where deleted_at is null and symbol <> ''")
        .map_err(|problem| problem.to_string())?;
    let symbols = statement
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|problem| problem.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|problem| problem.to_string())?;
    let mut ids: Vec<&'static str> = symbols.iter().filter_map(|symbol| coin_id(symbol)).collect();
    ids.sort_unstable();
    ids.dedup();
    Ok(ids)
}

/// Asks the price service for the given coins, in reais.
pub fn fetch_prices(ids: &[&str]) -> Result<HashMap<String, f64>, String> {
    let url = format!(
        "https://api.coingecko.com/api/v3/simple/price?ids={}&vs_currencies=brl",
        ids.join(",")
    );
    let body = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|problem| problem.to_string())?
        .into_string()
        .map_err(|problem| problem.to_string())?;
    parse_prices(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Hits the real CoinGecko API: `cargo test live_prices -- --ignored`.
    #[test]
    #[ignore]
    fn live_prices() {
        let prices = fetch_prices(&["bitcoin", "ethereum"]).expect("live fetch");
        assert!(prices["bitcoin"] > 1000.0, "bitcoin price looks wrong: {prices:?}");
    }

    #[test]
    fn parses_the_price_answer() {
        let prices = parse_prices(r#"{"bitcoin":{"brl":350000.5},"ethereum":{"brl":12000}}"#).expect("parse");
        assert_eq!(prices["bitcoin"], 350000.5);
        assert_eq!(prices["ethereum"], 12000.0);
        assert!(parse_prices("[]").is_err());
    }

    #[test]
    fn knows_the_coins_by_symbol_in_any_case() {
        assert_eq!(coin_id("btc"), Some("bitcoin"));
        assert_eq!(coin_id("DOGE"), Some("dogecoin"));
        assert_eq!(coin_id("nope"), None);
    }
}

#[cfg(test)]
mod apply_tests {
    use super::*;
    use crate::db::{self, HoldingInput};

    #[test]
    fn crypto_holdings_follow_the_price() {
        let path = std::env::temp_dir().join(format!("trove-crypto-{}.db", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let connection = db::open(&path).expect("open");
        let save = |name: &str, symbol: &str, units: &str| {
            db::save_holding(
                &connection,
                &HoldingInput {
                    name: name.into(),
                    kind: "investment".into(),
                    updated_on: "2026-01-01".into(),
                    symbol: symbol.into(),
                    units: units.into(),
                    ..Default::default()
                },
            )
            .expect("save")
        };
        save("Bitcoin", "btc", "0,5");
        save("CDB", "", "");
        assert_eq!(wanted_coins(&connection).expect("wanted"), vec!["bitcoin"]);
        let prices = HashMap::from([("bitcoin".to_string(), 300_000.0)]);
        assert_eq!(apply_prices(&connection, &prices, "2026-11-17").expect("apply"), 1);
        let holdings = db::list_holdings(&connection).expect("list");
        let bitcoin = holdings.iter().find(|row| row.name == "Bitcoin").expect("bitcoin");
        assert_eq!((bitcoin.amount_cents, bitcoin.symbol.as_str(), bitcoin.updated_on.as_str()), (150_000_00, "BTC", "2026-11-17"));
        let _ = std::fs::remove_file(&path);
    }
}
