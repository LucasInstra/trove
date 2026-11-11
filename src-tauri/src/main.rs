// No console window behind the app in a release build. In dev the console stays,
// which is where the Rust logs go while you are working on it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    trove_lib::run()
}
