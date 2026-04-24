# 🎙️ VoxForge

**Voice-to-text for Linux.** Hold a hotkey. Speak. Your words become text.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Rust](https://img.shields.io/badge/Made%20with-Rust-ce422b?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/UI-React-61dafb?logo=react)](https://react.dev)

[![Build Linux](https://github.com/yourusername/voxforge/actions/workflows/build-linux.yml/badge.svg)](https://github.com/yourusername/voxforge/actions/workflows/build-linux.yml)
[![Tests & Quality](https://github.com/yourusername/voxforge/actions/workflows/tests.yml/badge.svg)](https://github.com/yourusername/voxforge/actions/workflows/tests.yml)

---

## What is VoxForge?

VoxForge is a lightweight Linux desktop app that transcribes speech to text in real-time. **Hold a hotkey → Speak → Release → Text appears in your active window.**

No need to switch windows, open editors, or copy-paste. VoxForge works silently in the background, listening for your hotkey, recording audio, and injecting transcribed text directly where you need it.

Perfect for:
- ✍️ Writing emails, docs, or chat messages hands-free
- 💬 Transcribing meetings and notes
- 🎯 Coding by voice (variable names, comments, docstrings)
- ♿ Accessibility—voice input for any application
- 🌍 Multi-language support (Ukrainian, English, and more)

---

## Features

- **🎤 Real-time Speech Recording** — Hold hotkey to record, release to transcribe
- **🌍 Multi-Language Support** — Ukrainian, English, and any language Whisper supports
- **🔗 Global Hotkey** — Works in any application, no window focus required
- **📋 Transcription History** — View, search, and copy previous transcriptions
- **⚙️ Settings UI** — Configure hotkey, language, and API key without editing YAML
- **🎨 System Tray** — Minimal footprint; quick access to history and settings
- **🚀 Lightweight & Fast** — Built with Rust + Tauri; ~50MB standalone binary
- **🔐 Privacy-Friendly** — Your audio is sent only to OpenAI Whisper API (or your self-hosted instance)

---

## Quick Start

### Prerequisites

- Linux (Ubuntu 22.04+, Fedora 38+, Arch, or similar)
- **OpenAI API key** (get one at [platform.openai.com](https://platform.openai.com))
- System tools: `xdotool` (X11) or `ydotool` (Wayland)

### Installation

1. **Download the latest release** from [Releases](https://github.com/yourusername/voxforge/releases)
2. **Extract and run:**
   ```bash
   tar xzf voxforge-x86_64-unknown-linux-gnu.tar.gz
   ./voxforge
   ```
3. **First run:** VoxForge will open the Settings dialog. Paste your OpenAI API key and set your preferred hotkey.

### Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/voxforge.git
cd voxforge

# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install system dependencies
# Ubuntu/Debian
sudo apt-get install libgtk-3-dev libssl-dev libayatana-appindicator3-dev xdotool

# Fedora
sudo dnf install gtk3-devel openssl-devel xdotool

# Build and run
cargo tauri dev

# Build production binary
cargo tauri build
```

---

## Usage

### Default Hotkeys

| Action | Hotkey | Configurable |
|--------|--------|--------------|
| Start recording | `Ctrl+Shift+Space` | ✅ Yes |
| Stop recording | `Ctrl+Shift+Space` (release) | ✅ Yes |
| Open history | `Ctrl+Shift+H` | ✅ Yes |

### How It Works

1. **Press and hold** the hotkey → Microphone lights up (red tray icon)
2. **Speak clearly** → Audio waveform shows in the recording window
3. **Release the hotkey** → Audio is sent to OpenAI Whisper API (yellow tray icon)
4. **Text appears** → Automatically pasted into your active window or copied to clipboard

### Settings

Click **Settings** in the tray menu or press your configured hotkey to:
- 🔑 Update OpenAI API key
- 🎤 Change start/stop hotkeys
- 🌍 Choose transcription language
- 🔊 Select input microphone
- 📌 Pin window to stay on top

---

## Configuration

VoxForge stores settings in `~/.config/voxforge/config.json`:

```json
{
  "openai_api_key": "sk-...",
  "hotkey_start": "ctrl+shift+space",
  "hotkey_stop": "ctrl+shift+space",
  "hotkey_history": "ctrl+shift+h",
  "language": "uk",
  "model": "whisper-1",
  "ui_language": "uk",
  "openai_api_base": "https://api.openai.com/v1"
}
```

You can also set the API key via environment variable:
```bash
export OPENAI_API_KEY="sk-..."
./voxforge
```

### Supported Languages

VoxForge supports any language that OpenAI Whisper supports. A few examples:

- **uk** — Ukrainian 🇺🇦
- **en** — English 🇬🇧
- **es** — Spanish 🇪🇸
- **fr** — French 🇫🇷
- **de** — German 🇩🇪
- **zh** — Chinese 🇨🇳
- [Full list](https://platform.openai.com/docs/guides/speech-to-text#supported-languages)

---

## Architecture

```
┌─────────────────────────────────────┐
│  Frontend: React + Vite             │
│  - Recording UI with waveform       │
│  - Settings dialog                  │
│  - History viewer                   │
│  - Tray menu (system notifications) │
└──────────┬──────────────────────────┘
           │ Tauri invoke (IPC)
┌──────────▼──────────────────────────┐
│  Backend: Rust                      │
│  - Global hotkey listener           │
│  - Audio recording (cpal)           │
│  - OpenAI Whisper API client        │
│  - Text injection (xdotool/ydotool) │
│  - Config persistence               │
└─────────────────────────────────────┘
```

### Key Modules

- **`src-tauri/src/main.rs`** — Tauri app entry, window/tray setup
- **`src-tauri/src/hotkey.rs`** — Global hotkey listener
- **`src-tauri/src/audio.rs`** — Microphone recording using `cpal`
- **`src-tauri/src/transcribe.rs`** — OpenAI Whisper API integration
- **`src-tauri/src/inject.rs`** — Text injection via xdotool/ydotool
- **`src/components/`** — React components (Recording, Settings, History)

---

## Development

### Prerequisites

- Rust 1.70+
- Node.js 16+ / npm or yarn
- GTK 3 development files (Linux)

### Setup

```bash
git clone https://github.com/yourusername/voxforge.git
cd voxforge

# Install frontend dependencies
npm install

# Start dev server with hot reload
cargo tauri dev
```

### Project Structure

```
voxforge/
├── src/                     # React components & frontend logic
│   ├── components/          # React UI components
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript types
│   └── App.tsx              # Main React component
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── main.rs          # Tauri app setup
│   │   ├── hotkey.rs        # Hotkey listener
│   │   ├── audio.rs         # Audio recording
│   │   ├── transcribe.rs    # Whisper API
│   │   └── inject.rs        # Text injection
│   └── Cargo.toml
├── public/                  # Static assets
├── package.json
├── vite.config.ts
└── README.md
```

### Building

```bash
# Development build (debug symbols, longer compilation)
cargo tauri dev

# Production build (optimized binary)
cargo tauri build
# Binary location: src-tauri/target/release/voxforge
```

### Running Tests

```bash
# Rust backend tests
cargo test -p voxforge

# Frontend tests (if jest is configured)
npm test
```

---

## Troubleshooting

### "No audio captured" error

1. Check microphone is plugged in: `pactl list sources`
2. Set default microphone: `pactl set-default-source <index>`
3. Test with terminal: `arecord -d 3 /tmp/test.wav`

### Hotkey not working

- **X11 only:** VoxForge uses X11 features. Wayland support is experimental.
- Check if another app is using the same hotkey
- Try a different key combo (e.g., `ctrl+alt+v`)
- Restart the app after changing hotkey

### Text not injecting into window

1. Ensure `xdotool` is installed: `xdotool --version`
2. Some windows (Wayland, SSH sessions) don't support text injection
3. Copy-to-clipboard mode works universally; enable in Settings

### "Invalid API key" error

1. Check key format: `sk-...` (47+ characters)
2. Verify key is active: [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys)
3. Check account has available credit balance

### High latency / slow transcription

- Whisper API typically takes 2–10 seconds depending on audio length
- Longer clips = slower response; split into shorter segments
- Premium OpenAI account may have priority

---

## Performance

| Metric | Value |
|--------|-------|
| Binary size | ~50 MB |
| Memory usage (idle) | ~80 MB |
| Audio latency | <100 ms |
| API response time | 2–10 sec (depends on audio length) |
| Startup time | <1 sec |

---

## FAQ

**Q: Is my audio data logged or stored?**  
A: No. Audio is recorded to memory, sent directly to OpenAI's Whisper API, and discarded. Nothing is logged locally or sent to VoxForge servers (there are none).

**Q: Can I use a different speech-to-text API?**  
A: Currently, VoxForge only supports OpenAI Whisper. Self-hosted Whisper instances are planned.

**Q: Does VoxForge work on macOS / Windows?**  
A: Not currently. VoxForge is Linux-first. Porting to macOS/Windows is not planned for the MVP.

**Q: Can I use VoxForge offline?**  
A: No, because Whisper API requires internet. A faster-whisper backend (offline) is planned for a future release.

**Q: My hotkey conflicts with a system shortcut. How do I fix it?**  
A: Go to **Settings** and choose a different hotkey. Common alternatives: `Super+V`, `Ctrl+Alt+V`, `Ctrl+Super+Space`.

**Q: How much does it cost?**  
A: VoxForge is free. You pay OpenAI for API calls (~$0.02 per minute of audio). You can set usage limits in your OpenAI account.

---

## Contributing

We welcome contributions! Whether you're fixing bugs, adding features, or improving docs:

1. **Fork** the repository
2. **Create a branch:** `git checkout -b feature/amazing-thing`
3. **Make changes** and commit with clear messages
4. **Push** and open a **Pull Request**

### What We're Looking For

- Bug reports and fixes
- Translations (add to `src/i18n/`)
- Wayland support improvements
- Faster-Whisper integration
- Documentation and examples

### Code Style

- **Rust:** Follow [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/); use `cargo fmt` and `cargo clippy`
- **TypeScript:** Use `prettier` and `eslint`; format with `npm run format`

---

## Roadmap

- [x] Basic hotkey + recording + transcription
- [x] Multi-language support
- [x] Settings UI
- [x] Transcription history
- [x] System tray integration
- [ ] Faster-Whisper (offline mode)
- [ ] Wayland full support
- [ ] Custom API endpoint (for self-hosted Whisper)
- [ ] Keyboard shortcut to show/hide history
- [ ] Dark mode
- [ ] macOS support (non-MVP)
- [ ] Windows support (non-MVP)

---

## License

VoxForge is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- [OpenAI Whisper](https://openai.com/research/whisper) for speech recognition
- [Tauri](https://tauri.app) for the app framework
- [cpal](https://github.com/RustAudio/cpal) for audio I/O
- [pynput](https://pynput.readthedocs.io/) (original Python version) for hotkey inspiration

---

## Support

Found a bug? Have a feature request? 

- **Issues:** [GitHub Issues](https://github.com/yourusername/voxforge/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/voxforge/discussions)
- **Email:** your-email@example.com

---

**Made with ❤️ for Linux users who believe in open-source tools.**

Forge your voice. Own your words. 🔥
