# Changelog

All notable changes to VoxForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.2.2] - 2026-05-08

### Fixed
- CI build failure caused by Tauri version drift between Rust crate and npm package — `tauri` Rust crate auto-bumped to `2.11.x` while `@tauri-apps/api` was still on `2.10.x`, breaking the `npm run build` step

### Changed
- `Cargo.lock` is now committed (it was ignored), pinning Rust dependency versions for reproducible CI builds
- Tightened SemVer for `tauri`/`tauri-build` in `Cargo.toml` (`~2.10` / `~2.5`) to prevent future minor-version drift; minor bumps now require an explicit, paired update with `@tauri-apps/api`

---

## [0.2.1] - 2026-05-08

### Fixed
- `.deb` package version mismatch (was packaging as `0.1.0` even when tagged `0.2.0`) — synced version in `tauri.conf.json` with `Cargo.toml` and `package.json`
- Missing application icon after `.deb` installation — added `postinst`/`postrm` scripts to refresh `gtk-update-icon-cache` and `update-desktop-database`
- Empty `Categories=` field in `.desktop` entry — set `bundle.category` to `Utility` so the launcher appears in the menu

### Changed
- `.deb` control metadata now sets `Section: utils` and `Priority: optional`

---

## [0.2.0] - 2026-04-27

### Added
- Tauri 2.x compatibility upgrade
- Improved build system with Cargo build.rs
- .deb package bundling support

### Changed
- **Tauri version:** 1.x → 2.x
- Updated to new @tauri-apps/api imports (core module)
- Migrated state management to parking_lot::Mutex (better async support)
- Simplified hotkey registration system
- Improved window API compatibility (getCurrentWindow)

### Fixed
- Build system compatibility with latest Tauri toolchain
- Icon asset handling for Linux bundling
- TypeScript API import paths for Tauri 2.x

---

## [0.1.0] - 2024-04-24

### Added
- Initial release of VoxForge (Rust + Tauri + React)
- All core functionality from original Python version
- Improved UI with React
- Better performance with Rust backend

[Unreleased]: https://github.com/yourusername/voxforge/compare/v0.1.0...main
[0.1.0]: https://github.com/yourusername/voxforge/releases/tag/v0.1.0
