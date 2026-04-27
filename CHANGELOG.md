# Changelog

All notable changes to VoxForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
