# Development

How to build trove from source, run the checks and ship a release. For what the app is and how to install it, see the [README](../README.md).

## Run from source

Requirements: Node 20+, Rust stable (MSVC toolchain) and Visual Studio Build Tools with the C++ workload.

```powershell
npm install
npm run tauri dev
```

## Checks

```powershell
npm run test:unit                          # front, including the version and build comparison
npm run lint
npm run build
cargo test --manifest-path src-tauri/Cargo.toml   # OFX parser, deduplication and database
npm run version:check                      # all four copies of the version in sync
```

Money lives in integer cents. Nothing derived is persisted. The domain layer stays free of React and SQL: rules that depend on the selected scope are re-derived in the view on purpose.

## Release

1. `npm version patch` (or `minor`), which syncs `package.json`, `Cargo.toml`, `Cargo.lock` and `tauri.conf.json`, and resets the build to 1.
2. Write `release-notes/<version>.md` — the Release workflow fails without it.
3. `git tag v<version>` and `git push --follow-tags`.

A fix build without changing the version: bump `BUILD_NUMBER` in `src/lib/build.ts`, extend the version's release notes, and publish the tag again. The manifest announces e.g. `0.1.2 build 2`, and the app compares semver plus build, so a machine already on `0.1.2 build 1` receives the fix.

Updates are signed with minisign. The public key lives in `src-tauri/tauri.conf.json`; the private one goes in the `TAURI_SIGNING_PRIVATE_KEY` repository secret. Locally `tauri build` fails on the signing step after generating the bundles — that is expected; only CI signs.

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
