mod db;
mod ofx;
mod planner;

use rusqlite::Connection;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|problem| problem.to_string())?;
    Ok(directory.join("trove.db"))
}

fn connection(app: &tauri::AppHandle) -> Result<Connection, String> {
    db::open(&database_path(app)?)
}

#[tauri::command]
fn import_ofx(app: tauri::AppHandle, path: String) -> Result<db::ImportReport, String> {
    let mut connection = connection(&app)?;
    db::import_ofx(&mut connection, Path::new(&path))
}

#[tauri::command]
fn list_accounts(app: tauri::AppHandle) -> Result<Vec<db::Account>, String> {
    let connection = connection(&app)?;
    db::list_accounts(&connection)
}

#[tauri::command]
fn list_categories(app: tauri::AppHandle) -> Result<Vec<db::Category>, String> {
    let connection = connection(&app)?;
    db::list_categories(&connection)
}

#[tauri::command]
fn list_transactions(
    app: tauri::AppHandle,
    search: Option<String>,
    month: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<db::TransactionRow>, String> {
    let connection = connection(&app)?;
    db::list_transactions(&connection, search.as_deref(), month.as_deref(), limit.unwrap_or(500))
}

#[tauri::command]
fn category_totals(app: tauri::AppHandle, month: String) -> Result<Vec<db::CategoryTotal>, String> {
    let connection = connection(&app)?;
    db::category_totals(&connection, &month)
}

#[tauri::command]
fn latest_month(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let connection = connection(&app)?;
    db::latest_month(&connection)
}

#[tauri::command]
fn list_imports(app: tauri::AppHandle, limit: Option<i64>) -> Result<Vec<db::ImportRow>, String> {
    let connection = connection(&app)?;
    db::list_imports(&connection, limit.unwrap_or(12))
}

#[tauri::command]
fn month_series(
    app: tauri::AppHandle,
    month: String,
    count: Option<i64>,
) -> Result<Vec<db::MonthPoint>, String> {
    let connection = connection(&app)?;
    db::month_series(&connection, &month, count.unwrap_or(6))
}

#[tauri::command]
fn set_category(
    app: tauri::AppHandle,
    transaction_id: i64,
    category_id: Option<i64>,
) -> Result<(), String> {
    let connection = connection(&app)?;
    db::set_category(&connection, transaction_id, category_id)
}

#[tauri::command]
fn month_totals(app: tauri::AppHandle, month: String) -> Result<db::MonthTotals, String> {
    let connection = connection(&app)?;
    db::month_totals(&connection, &month)
}

#[tauri::command]
fn database_location(app: tauri::AppHandle) -> Result<String, String> {
    Ok(database_path(&app)?.to_string_lossy().to_string())
}


#[tauri::command]
fn planner_state(app: tauri::AppHandle, month: String) -> Result<planner::PlannerState, String> {
    let connection = connection(&app)?;
    planner::state(&connection, &month)
}

#[tauri::command]
fn save_income(app: tauri::AppHandle, input: planner::IncomeInput) -> Result<i64, String> {
    let connection = connection(&app)?;
    planner::save_income(&connection, &input)
}

#[tauri::command]
fn delete_income(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let connection = connection(&app)?;
    planner::delete_income(&connection, id)
}

#[tauri::command]
fn save_bill(app: tauri::AppHandle, input: planner::BillInput) -> Result<i64, String> {
    let connection = connection(&app)?;
    planner::save_bill(&connection, &input)
}

#[tauri::command]
fn delete_bill(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let connection = connection(&app)?;
    planner::delete_bill(&connection, id)
}

#[tauri::command]
fn set_bill_paid(
    app: tauri::AppHandle,
    bill_id: i64,
    month: String,
    paid: bool,
) -> Result<(), String> {
    let connection = connection(&app)?;
    planner::set_bill_paid(&connection, bill_id, &month, paid)
}

#[tauri::command]
fn save_card(app: tauri::AppHandle, input: planner::CardInput) -> Result<i64, String> {
    let connection = connection(&app)?;
    planner::save_card(&connection, &input)
}

#[tauri::command]
fn save_goal(app: tauri::AppHandle, input: planner::GoalInput) -> Result<i64, String> {
    let connection = connection(&app)?;
    planner::save_goal(&connection, &input)
}

#[tauri::command]
fn card_usage(
    app: tauri::AppHandle,
    account_id: i64,
    from: String,
    to: String,
) -> Result<i64, String> {
    let connection = connection(&app)?;
    planner::card_usage(&connection, account_id, &from, &to)
}

#[tauri::command]
fn mark_notifications_read(app: tauri::AppHandle, keys: Vec<String>) -> Result<(), String> {
    let connection = connection(&app)?;
    planner::mark_read(&connection, &keys)
}

#[tauri::command]
fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let connection = connection(&app)?;
    planner::get_setting(&connection, &key)
}

#[tauri::command]
fn set_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let connection = connection(&app)?;
    planner::set_setting(&connection, &key, &value)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let path = database_path(app.handle())?;
            db::open(&path)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_ofx,
            list_accounts,
            list_categories,
            list_transactions,
            category_totals,
            month_series,
            latest_month,
            list_imports,
            set_category,
            month_totals,
            database_location,
            planner_state,
            save_income,
            delete_income,
            save_bill,
            delete_bill,
            set_bill_paid,
            save_card,
            save_goal,
            card_usage,
            mark_notifications_read,
            get_setting,
            set_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while running trove");
}
