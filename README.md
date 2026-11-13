<div align="center">

# trove

**A personal finance app that runs on your computer, with no account and no server.**

[![CI](https://github.com/LucasInstra/trove/actions/workflows/ci.yml/badge.svg)](https://github.com/LucasInstra/trove/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/LucasInstra/trove?color=4c9f70)](https://github.com/LucasInstra/trove/releases)
[![license](https://img.shields.io/badge/license-MIT-4c9f70)](LICENSE)

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Windows](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)](#install)

</div>

## Why another finance app

Because the existing ones want your bank password, a cloud account and a subscription. This one goes the other way: you import the OFX file the bank **already gives you**, and the data stays in a SQLite file on your machine.

The rule is simple: every number on screen answers "where did this come from". Imported entries keep the file and line that produced them; manual entries are clearly marked.

## Install

Download from the [releases](https://github.com/LucasInstra/trove/releases) page:

- `trove-setup.msi` — the installer (in-app updates use this package)
- `trove-setup.exe` — NSIS installer alternative, when included in the release
- `trove-portable-x64.zip` — the executable alone, for when you do not want to install anything

Updates are automatic: the app checks on launch and offers the install from Settings. The build is not code signed, so Windows SmartScreen may warn on first run.

## What it does

- **A dashboard that is yours.** Drag cards anywhere in the grid with a live preview, set each card's width in columns, and pick how much detail it shows: compact, minimised or expanded. A wide card shows more of it, not the same content stretched.
- **A ledger you can manage.** Import statements or create manual accounts and entries; search by description, merchant or category; edit manual entries; and export filtered results to CSV.
- **OFX and CSV import.** Reads OFX 1.x/2.x and configurable bank CSV layouts, with preview, saved profiles and import history. Reimports deduplicate by `FITID` or fingerprint, including matching transactions between OFX and CSV.
- **Categories and rules.** Organize categories in a tree, set budgets, and use matching rules to categorize imports without overwriting explicit choices.
- **Transfers and refunds.** Paired transfers stay out of income and spending totals; refunds net against their original transaction.
- **Cash flow and planning.** Category and whole-month budgets, carryover, free-to-spend, recurring-charge detection, 3/6/12-month forecasts and monthly reports.
- **Charts and net worth.** Daily spending, KPI sparklines, a running balance, tags and holdings alongside statement balances.
- **Backup and restore.** Create a local database backup and restore a validated backup from Settings.
- **Clean merchant names**: `IFD*IFOOD SAO PAULO` becomes `IFOOD SAO PAULO`.
- **Month navigation** with in, out and net computed locally, opening on the most recent month that has data.
- **Import history**: every file that ever entered the ledger, with how many entries it added and how many were already there.
- **English and Portuguese**, switched in Settings and remembered between launches.

## Privacy

No financial data leaves the computer. There is no login, no telemetry and no server of ours; the app only connects to GitHub to check for and download updates. The database lives in `%APPDATA%\com.lucas.trove\trove.db`, and Settings shows the folder.

## Roadmap

- [x] OFX import, deduplication, ledger and categories
- [x] Rearrangeable dashboard, transactions tab and planning tabs
- [x] Spending breakdown and cash flow
- [ ] Price-increase alerts for recurring charges
- [ ] Receipts with OCR, tax tags and a dossier for the accountant
- [ ] Brokerage account integration, notes and positions

## For developers

Run from source, checks, the release process and the code map live in [docs/development.md](docs/development.md). To try the app without a bank statement, drag [`fixtures/sample.ofx`](fixtures/sample.ofx) onto the Import screen — importing it twice should report all eight entries as already there.

## License

MIT. See [LICENSE](LICENSE).
