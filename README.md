<div align="center">

# trove

**A personal finance app that runs on your computer, with no account and no server.**

[![CI](https://github.com/LucasInstra/trove/actions/workflows/ci.yml/badge.svg)](https://github.com/LucasInstra/trove/actions/workflows/ci.yml)
[![release](https://img.shields.io/github/v/release/LucasInstra/trove?color=4c9f70)](https://github.com/LucasInstra/trove/releases)
[![license](https://img.shields.io/badge/license-MIT-4c9f70)](LICENSE)

[![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-stable-000000?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Windows](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)](#requirements)

</div>

## Why another finance app

Because the existing ones want your bank password, a cloud account and a subscription. This one goes the other way: you import the OFX file the bank **already gives you**, and the data stays in a SQLite file on your machine.

The rule is simple: every number on screen answers "where did this come from". Each entry keeps the file and the line that produced it.

## The keeper

<img src="docs/mascot.png" width="620" alt="the keeper in five moods">

A piggy bank with a face guards the trove. It is drawn on a canvas, so the body can be grabbed and pulled like silicone, and it has its own habits: it follows the pointer, blinks, looks around when nothing is happening and hops when you boop it.

The mood follows the month: happy when you spend less than you earn, worried when the month closes negative, sleepy when there is nothing imported yet, and celebrating when a statement lands.

When it looks to the side the whole head yaws: the body narrows, the snout leads slightly and the far ear shrinks, so the parts move as one instead of the face sliding over a still body.

Click **Customize** in the sidebar to change the shape, the colour and the eyes (style, size, spacing, tilt and ink), and to turn the snout, ears, curl tail and blush on or off. The look is stored locally.

## What it has today (0.1.0)

- **OFX import**, by dragging the file or picking it from the computer. Reads both the SGML dialect of OFX 1.x and the XML one of OFX 2.x, and accepts several files at once.
- **Account read from the file**: bank, account number, and the difference between a checking account and a credit card.
- **Real deduplication**: `FITID` when the bank keeps the identifier stable, a fingerprint of the transaction when it does not. Reimporting the same period duplicates nothing.
- **Ledger with search** by description, merchant or category, with the category editable right on the row.
- **Month navigation** with a category breakdown and a six month spending series, and the app opens on the most recent month that has data.
- **Import history**: every file that ever entered the ledger, with how many entries it added and how many were already there.
- **Clean merchant names**: `IFD*IFOOD SAO PAULO` becomes `IFOOD SAO PAULO`.
- **In, out and net** for the month, computed from the local database.
- **English and Portuguese**, switched in Settings and remembered between launches.
- **Signed auto-update**, checked on launch and available as a manual button in Settings.

## What it does not have yet

CSV and PDF import, category dashboard, end-of-month projection, subscription radar, receipts and tax tags, brokerage notes. The order is in the [roadmap](#roadmap).

## Install

Download `trove_x.y.z_x64-setup.exe` from the [releases](https://github.com/LucasInstra/trove/releases) page. There is also `trove-portable-x64.zip`, which is the executable alone.

The build is not code signed, so Windows SmartScreen may warn on first run.

## Run from source

Requirements: Node 20+, Rust stable (MSVC toolchain) and Visual Studio Build Tools with the C++ workload.

```powershell
npm install
npm run tauri dev
```

To test without a bank statement, drag [`fixtures/sample.ofx`](fixtures/sample.ofx) onto the Import screen. Import the same file twice: the second time it should say all eight entries were already there.

## Checks

```powershell
npm run test:unit                          # front, including the version and build comparison
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml   # OFX parser, deduplication and database
npm run version:check                      # all four copies of the version in sync
```

## Release

1. `npm version patch` (or `minor`), which syncs `package.json`, `Cargo.toml`, `Cargo.lock` and `tauri.conf.json`, and resets the build to 1.
2. Write `release-notes/<version>.md`.
3. `git tag v<version>` and `git push --follow-tags`.

A fix build without changing the version: bump `BUILD_NUMBER` in `src/lib/build.ts` and publish the tag again. The manifest announces `0.1.0 build 2`, and the app compares semver plus build, so a machine already on `0.1.0 build 1` receives the fix.

Updates are signed with minisign. The public key lives in `src-tauri/tauri.conf.json`; the private one goes in the `TAURI_SIGNING_PRIVATE_KEY` repository secret.

## Roadmap

- [x] OFX, deduplication, ledger and categories
- [ ] CSV with per-bank column mapping
- [ ] Category dashboard, comparison against the average and end-of-month projection
- [ ] Subscription radar and price-increase alerts
- [ ] Receipts with OCR, tax tags and a dossier for the accountant
- [ ] Brokerage notes, positions and a net-worth curve

## Privacy

No financial data leaves the computer. There is no login, no telemetry and no request to a server of ours; the only network call is the update check against GitHub. The database lives in `%APPDATA%\com.lucas.trove\trove.db`, and Settings shows the folder.

## Structure

```
src/                      React + TypeScript front end
  lib/updater.ts          check, download and install
  lib/release.ts          semver and build comparison
src-tauri/src/            Rust core
  ofx.rs                  parser for both OFX dialects
  db.rs                   schema, import and queries
scripts/                  version sync and updater manifest
fixtures/                 sample statement
```

## License

MIT. See [LICENSE](LICENSE).
