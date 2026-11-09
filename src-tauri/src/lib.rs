mod db;
mod ofx;

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
            database_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running trove");
}
