# Changelog

All notable changes to VoxForge will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial Rust + Tauri + React rewrite (from Python + PyQt6)
- Global hotkey listener for recording
- Real-time audio waveform visualization
- Transcription history with search
- Settings dialog (API key, language, hotkeys)
- System tray with state indicator (idle/recording/processing)
- Multi-language UI support (Ukrainian, English)
- Support for any OpenAI Whisper language
- Text injection via xdotool (X11) or ydotool (Wayland)
- Automatic config persistence
- Keyboard shortcut to open history

### Changed
- **Technology stack:** Python → Rust backend, PyQt6 → React frontend
- **Binary size:** ~200MB (PyInstaller) → ~50MB (Tauri)
- **Performance:** Faster startup and lower memory usage

### Fixed
- Audio recording on modern Linux kernels

### Removed
- PyQt6 dependency
- Terminal-only mode (GUI-first approach)

---

## [0.1.0] - 2024-04-24

### Added
- Initial release of VoxForge (Rust + Tauri + React)
- All core functionality from original Python version
- Improved UI with React
- Better performance with Rust backend

[Unreleased]: https://github.com/yourusername/voxforge/compare/v0.1.0...main
[0.1.0]: https://github.com/yourusername/voxforge/releases/tag/v0.1.0
