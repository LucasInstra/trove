use std::fs;

fn main() {
    // The build number lives with the frontend label, so read it from there and
    // hand it to the updater comparator as a compile time value.
    let source = fs::read_to_string("../src/lib/build.ts").unwrap_or_default();
    let number = source
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once('=')?;
            if !name.trim().starts_with("export const BUILD_NUMBER") {
                return None;
            }
            value.trim().trim_end_matches(';').trim().parse::<u64>().ok()
        })
        .unwrap_or(0);
    println!("cargo:rustc-env=TROVE_BUILD_NUMBER={number}");
    println!("cargo:rerun-if-changed=../src/lib/build.ts");

    tauri_build::build()
}
