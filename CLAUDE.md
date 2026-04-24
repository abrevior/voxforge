# CLAUDE.md

This file provides guidance to Claude Code when working with VoxForge.

## Project Overview

**VoxForge** — A lightweight Linux voice-to-text app. Hold hotkey → Speak → Text appears in the active window.

Tech stack: **Rust** + **Tauri** + **React** + **TypeScript**

This is a ground-up rewrite of the original Python + PyQt6 version, moving to a modern, performant architecture.

## Tech Stack

### Frontend
- **React 18** — UI framework
- **TypeScript** — Type-safe JavaScript
- **Vite** — Build tool (fast HMR)
- **TailwindCSS** — Styling
- **Tauri API** — IPC to Rust backend

### Backend (Rust)
- **Tauri 2.x** — App framework (window management, system tray, IPC)
- **cpal** — Cross-platform audio input
- **reqwest** — HTTP client for Whisper API
- **serde** — Serialization (JSON config)
- **global-hotkey** (via `tauri-plugin-global-shortcut`) — Global keyboard listener
- **x11-clipboard** / **ydotool wrapper** — Text injection

### Build & Packaging
- **Cargo** — Rust package manager
- **npm** — JavaScript package manager
- **PyInstaller** → replaced by **Tauri bundler** (produces .deb, .AppImage, snap)

## Commands

```bash
# Install dependencies (first time)
npm install
cargo fetch

# Development server with hot reload
cargo tauri dev

# Production build
cargo tauri build
# Binary: src-tauri/target/release/voxforge

# Format code
cargo fmt                  # Rust
npm run format            # TypeScript/React

# Lint
cargo clippy              # Rust
npm run lint              # TypeScript

# Run tests
cargo test -p voxforge    # Rust unit tests
```

## Project Structure

```
voxforge/
├── src/                           # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── Recording.tsx          # Recording window UI
│   │   ├── Settings.tsx           # Settings dialog
│   │   ├── History.tsx            # History viewer
│   │   └── TrayMenu.tsx           # Tray context menu
│   ├── hooks/
│   │   ├── useRecording.ts        # Recording state management
│   │   ├── useSettings.ts         # Settings persistence
│   │   └── useHistory.ts          # History queries
│   ├── types/
│   │   ├── api.ts                 # Tauri IPC types
│   │   ├── config.ts              # Config schema
│   │   └── history.ts             # History schema
│   ├── App.tsx                    # Root component
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Global styles
│
├── src-tauri/                     # Backend (Rust)
│   ├── src/
│   │   ├── main.rs                # Tauri app setup, window/tray init
│   │   ├── commands.rs            # Tauri commands (exposed to frontend)
│   │   ├── hotkey.rs              # Global hotkey listener
│   │   ├── audio.rs               # Audio recording (cpal)
│   │   ├── transcribe.rs          # Whisper API client
│   │   ├── inject.rs              # Text injection (xdotool/ydotool)
│   │   ├── config.rs              # Config file management
│   │   ├── history.rs             # History DB (SQLite)
│   │   └── state.rs               # App state (recording, processing, etc.)
│   ├── Cargo.toml
│   └── tauri.conf.json            # Tauri configuration
│
├── public/                        # Static assets (icons, etc.)
│   └── icon.*                     # App icon (Tauri generates variants)
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── README.md                      # User-facing documentation
├── CLAUDE.md                      # This file (developer guide)
└── LICENSE                        # MIT
```

## Architecture

### Frontend → Backend IPC (Tauri)

React components invoke Rust functions via `tauri.invoke()`:

```typescript
// React side
const result = await invoke<string>("transcribe", { 
  apiKey: "sk-...",
  language: "uk"
});

// Rust side (src-tauri/src/commands.rs)
#[tauri::command]
async fn transcribe(api_key: String, language: String) -> Result<String, String> {
    // ... Whisper API call
}
```

### Main Flow

1. **Hotkey pressed** → Rust hotkey listener fires
2. **Recording starts** → Rust opens recording window (React component)
3. **Audio streams** → Rust backend samples microphone via cpal
4. **RMS level** → Rust sends updates to React via `emit()` (events)
5. **Hotkey released** → Recording stops, audio sent to Whisper API
6. **Transcription received** → Rust injects text into active window
7. **Text injected** → Text also stored in SQLite history DB

### State Management

- **Frontend:** React hooks (useState, useEffect, Context API)
- **Backend:** Rust struct with Arc<Mutex<>> for thread-safe state
- **Persistence:** JSON config file + SQLite history database

## Configuration

Config file: `~/.config/voxforge/config.json`

```json
{
  "openai_api_key": "sk-...",
  "hotkey_start": "ctrl+shift+space",
  "hotkey_stop": "ctrl+shift+space",
  "hotkey_history": "ctrl+shift+h",
  "language": "uk",
  "model": "whisper-1",
  "ui_language": "uk",
  "openai_api_base": "https://api.openai.com/v1",
  "output_mode": "inject"  // "inject" or "clipboard"
}
```

Environment variable support: `OPENAI_API_KEY`

## System Dependencies

### Required

- **Linux kernel 5.10+** (for audio APIs)
- **libssl-dev** (OpenSSL for HTTPS)
- **GTK 3** (Tauri window framework on Linux)
- **xdotool** (X11 text injection) or **ydotool** (Wayland)

### Install on Ubuntu/Debian

```bash
sudo apt-get install -y \
  libgtk-3-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  xdotool
```

### Install on Fedora

```bash
sudo dnf install -y \
  gtk3-devel \
  openssl-devel \
  xdotool
```

## Development Workflow

### 1. Add a Feature

Example: Add pause/resume during recording

1. **Identify the modules:**
   - `src/components/Recording.tsx` — Add pause button to UI
   - `src-tauri/src/audio.rs` — Add `pause()` method
   - `src-tauri/src/commands.rs` — Expose `pause_recording` command

2. **Implement in Rust first,** then expose via command:
   ```rust
   #[tauri::command]
   fn pause_recording(state: tauri::State<AppState>) -> Result<(), String> {
       state.audio.pause()?;
       Ok(())
   }
   ```

3. **Call from React:**
   ```typescript
   const handlePause = async () => {
       await invoke("pause_recording");
   };
   ```

4. **Test:** `cargo tauri dev`

### 2. Fix a Bug

1. **Reproduce** in `cargo tauri dev` (dev mode)
2. **Identify** which module (Rust or React)
3. **Fix** and hot-reload (React auto-refreshes; Rust requires restart)
4. **Test** — including edge cases (fast clicks, network errors, etc.)

### 3. Add a Language

1. **Add to Whisper's supported list:** `src/i18n/languages.ts`
2. **Translate UI strings** (if any new strings)
3. **Update config.json** default

## Code Style

### Rust

- **Format:** `cargo fmt` (enforced in CI)
- **Lint:** `cargo clippy --all --all-targets` (fix warnings)
- **Comments:** Keep minimal; code should be self-explanatory
- **Error handling:** Use `Result<T, E>`; never `.unwrap()` in user-facing code

### TypeScript/React

- **Format:** `npm run format` (Prettier)
- **Lint:** `npm run lint` (ESLint)
- **Component names:** PascalCase (e.g., `Recording.tsx`)
- **Hooks:** Prefix with `use` (e.g., `useRecording`)
- **Props types:** Use TypeScript interfaces (no `any`)

## Testing

### Rust Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_rms_level() {
        let level = calculate_rms(&[0, 1000, -1000]);
        assert!(level > 0.0);
    }
}
```

Run: `cargo test -p voxforge`

### Frontend Tests

Set up jest (if not already):
```bash
npm install --save-dev jest @types/jest ts-jest
```

## Building & Distribution

### Debug Build (with symbols)

```bash
cargo tauri build --debug
# Binary: src-tauri/target/debug/voxforge
```

### Release Build (optimized)

```bash
cargo tauri build
# Binary: src-tauri/target/release/voxforge
```

### Packaging

Tauri automatically creates:
- `.deb` — Debian/Ubuntu
- `.AppImage` — Generic Linux
- `.snap` — Snapcraft (if snap.yaml exists)

Location: `src-tauri/target/release/bundle/`

## Debugging

### Rust Backend

```bash
# Enable debug logging
RUST_LOG=debug cargo tauri dev

# Use VSCode with CodeLLDB extension
# Launch config in .vscode/launch.json
```

### React Frontend

- Open DevTools: `Ctrl+F12` in dev mode
- React DevTools browser extension helpful
- Check console for Tauri IPC errors

### Audio Issues

```bash
# Test microphone
arecord -d 3 /tmp/test.wav

# List audio devices
pactl list sources

# Set default
pactl set-default-source <name>
```

## Performance Considerations

- **Audio thread:** Runs in separate thread (cpal) to avoid blocking UI
- **Transcription:** Offloaded to separate task (tokio async)
- **RMS updates:** Throttled to ~30 Hz (33 ms) to avoid UI lag
- **History DB:** Indexed on date for fast queries

## Known Limitations & TODOs

1. **X11 only** — Wayland hotkey/inject support is experimental
2. **No offline mode** — Whisper API required; faster-whisper planned
3. **Single hotkey mode** — Start and stop use same key; separate keys planned
4. **No input device selection** — UI only; backend ready
5. **No custom API endpoint** — Hardcoded to OpenAI; self-hosted Whisper planned

## Contributing Guidelines

1. **Branch naming:** `feature/thing`, `fix/bug-name`, `docs/something`
2. **Commit messages:** Clear, short (50 chars); reference issue if applicable
3. **PR title:** Concise; mention breaking changes with `BREAKING:`
4. **Tests:** Include unit tests for new Rust functions
5. **Documentation:** Update README if user-facing changes

## CI/CD Pipeline

GitHub Actions automatically builds and releases VoxForge on Linux.

### Workflows

1. **build-linux.yml** — Main build workflow
   - Triggers: Push to `main`/`develop`, PRs, tags (`v*`)
   - Steps: Lint → Format → Test → Build
   - Artifacts: `.AppImage`, `.deb` binaries
   - Releases: Auto-creates GitHub Release on version tags

2. **tests.yml** — Quality checks
   - Triggers: Push to `main`/`develop`, PRs
   - Steps: Rust tests + doc tests, Clippy lint, Rustfmt, ESLint, Prettier
   - Continues on failure (doesn't block CI)

### Version Tags & Releases

To create a release:

```bash
# Bump version
# - Update src-tauri/Cargo.toml (version)
# - Update package.json (version)
# - Update CHANGELOG.md

git add .
git commit -m "chore: bump version to v0.2.0"
git tag v0.2.0
git push origin main --tags
```

GitHub Actions will:
1. Build on `v0.2.0` tag
2. Generate `.AppImage` and `.deb`
3. Create GitHub Release with binaries and changelog

### Status Badges

Add to README or your profile:

```markdown
[![Build Linux](https://github.com/yourusername/voxforge/actions/workflows/build-linux.yml/badge.svg)](https://github.com/yourusername/voxforge/actions/workflows/build-linux.yml)
[![Tests & Quality](https://github.com/yourusername/voxforge/actions/workflows/tests.yml/badge.svg)](https://github.com/yourusername/voxforge/actions/workflows/tests.yml)
```

### Local Testing Before Push

```bash
# Simulate what CI does
cargo fmt --all
cargo clippy --all --all-targets -- -D warnings
cargo test -p voxforge --lib
npm run lint
npm run format
cargo tauri build
```

---

Happy forging! 🔥
