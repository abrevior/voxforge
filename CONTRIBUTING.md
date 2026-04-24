# Contributing to VoxForge

Thank you for your interest in contributing to VoxForge! 🙌

This guide will help you get started, whether you're fixing a bug, adding a feature, or improving documentation.

## Getting Started

### Prerequisites

- Rust 1.70+ ([Install](https://rustup.rs/))
- Node.js 16+ / npm
- Linux (for development and testing)
- Git

### Setup Your Development Environment

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/yourusername/voxforge.git
   cd voxforge
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cargo fetch
   ```

3. **Start the dev server:**
   ```bash
   cargo tauri dev
   ```
   This opens the app in dev mode with hot-reload enabled.

4. **Open a new terminal and run tests:**
   ```bash
   cargo test -p voxforge
   npm test
   ```

---

## How to Contribute

### 1. Report a Bug

Found an issue? Help us fix it!

1. **Check existing issues** — Your bug might already be reported
2. **Create a detailed issue** with:
   - Title: `[BUG] Short description`
   - Environment: Linux distro, DE (GNOME/KDE), Tauri version
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Logs: `RUST_LOG=debug cargo tauri dev 2>&1 | tee debug.log`

### 2. Suggest a Feature

Have a great idea?

1. **Check existing discussions** to avoid duplicates
2. **Create a discussion or issue** with:
   - Title: `[FEATURE] What you want to build`
   - Why: Use cases and benefits
   - Implementation idea (optional but helpful)
   - Examples: Sketches, mockups, or reference apps

### 3. Fix a Bug or Build a Feature

Ready to code?

#### Step 1: Create a Branch
```bash
git checkout -b fix/issue-title
# or
git checkout -b feature/feature-name
```

Naming convention:
- `fix/` — Bug fixes
- `feature/` — New features
- `docs/` — Documentation
- `refactor/` — Code cleanup (no behavior change)

#### Step 2: Make Your Changes

**For bug fixes:**
- Minimal changes (only what fixes the bug)
- Add a test that reproduces the bug
- Ensure the test passes after your fix

**For features:**
- Implement in the correct module (see CLAUDE.md)
- Add tests for new Rust functions
- Update UI if needed (React components)
- Update README if user-facing

**Code style:**

Rust:
```bash
cargo fmt              # Auto-format
cargo clippy --all    # Lint
```

TypeScript/React:
```bash
npm run format         # Prettier
npm run lint           # ESLint
```

#### Step 3: Commit with Clear Messages

```bash
git add <files>
git commit -m "fix: prevent RMS level overflow in audio recorder

When audio input was very loud, RMS calculation could exceed bounds.
Cap normalized level at 1.0 instead of allowing > 1.0.

Fixes #42"
```

Message format:
- **Type**: `fix:`, `feat:`, `docs:`, `refactor:`, `test:`
- **Scope** (optional): `fix(audio):`, `feat(settings):`
- **Subject**: What changed, not why
- **Body** (after blank line): Why the change, any gotchas
- **Footer**: Link to issue: `Fixes #123`

#### Step 4: Test Thoroughly

```bash
# Run all tests
cargo test -p voxforge

# Test manually
cargo tauri dev

# Test different scenarios:
# - [ ] Record audio with different lengths (1s, 30s, 2min)
# - [ ] Switch between languages
# - [ ] Change hotkeys
# - [ ] Network error (disconnect internet during transcription)
# - [ ] Stress test (rapid hotkey presses)
```

#### Step 5: Push and Open a Pull Request

```bash
git push origin fix/issue-title
```

On GitHub, create a Pull Request with:
- **Title**: `[FIX] What the PR fixes` or `[FEATURE] What it adds`
- **Description:**
  ```markdown
  ## What
  Brief description of what this PR does.

  ## Why
  Context and motivation for the change.

  ## How
  Implementation approach or key decisions.

  Fixes #42
  ```

### 4. Improve Documentation

Documentation is crucial! You can:
- Improve README clarity
- Fix typos
- Add examples or troubleshooting steps
- Write setup guides for different Linux distros
- Translate docs to other languages

For docs-only changes:
```bash
git checkout -b docs/improve-readme
# Edit README.md or add docs/
git commit -m "docs: improve installation instructions for Fedora"
git push origin docs/improve-readme
```

### 5. Add a Translation

Help VoxForge reach non-English speakers!

1. **Check `src/i18n/` for existing translations**
2. **Add your language file:** `src/i18n/ui_[language_code].json`
   ```json
   {
     "recording.title": "Recording...",
     "settings.api_key": "OpenAI API Key",
     ...
   }
   ```
3. **Register in `src/i18n/languages.ts`**
4. **Test in Settings → Language**

---

## Code Review Process

### Before Submitting

- [ ] `cargo fmt` — Code is formatted
- [ ] `cargo clippy` — No warnings
- [ ] `npm run lint` — TypeScript is valid
- [ ] Tests pass: `cargo test`
- [ ] Manual testing done (all scenarios)
- [ ] Commits are clear and focused
- [ ] PR description explains "what" and "why"

### What Reviewers Look For

- **Correctness:** Does it solve the problem?
- **Tests:** Are there tests? Do they pass?
- **Style:** Follows the repo's conventions?
- **Performance:** Any regressions?
- **Docs:** Is it documented?

### Iterating on Feedback

1. **Read review comments carefully**
2. **Discuss if unclear** — Ask clarifying questions
3. **Make changes** and commit again
4. **Push** (don't force-push; we want to see the iteration)
5. **Comment** on the PR: "Updated per feedback"

---

## Debugging Tips

### Rust Backend

```bash
# Enable logging
RUST_LOG=debug,tauri=info cargo tauri dev 2>&1 | tee debug.log

# Check what the frontend is sending
# (Use browser DevTools when running in dev mode)

# Test a single module
cargo test -p voxforge audio::tests
```

### Audio Recording

```bash
# List input devices
pactl list sources

# Test recording
arecord -d 5 /tmp/test.wav
aplay /tmp/test.wav

# Debug with sox
sox /tmp/test.wav -n stat
```

### Hotkey

```bash
# Check if event is captured
# (Monitor /dev/input, requires sudo)

# Test xdotool
xdotool key ctrl+shift+space
xdotool type "Hello VoxForge"
```

---

## Performance Benchmarking

If you're optimizing, include before/after metrics:

```bash
# Memory usage (RSS)
/usr/bin/time -v cargo tauri dev

# Compile time
time cargo build -p voxforge

# Binary size
ls -lh src-tauri/target/release/voxforge
```

---

## Common Tasks

### Adding a New Tauri Command

1. **Add to `src-tauri/src/commands.rs`:**
   ```rust
   #[tauri::command]
   fn my_new_command(state: tauri::State<AppState>) -> Result<String, String> {
       // Implementation
       Ok("result".to_string())
   }
   ```

2. **Register in `src-tauri/src/main.rs`:**
   ```rust
   .invoke_handler(tauri::generate_handler![
       my_new_command,
       // ... other commands
   ])
   ```

3. **Call from React:**
   ```typescript
   import { invoke } from '@tauri-apps/api';
   
   const result = await invoke<string>('my_new_command');
   ```

### Adding a Config Option

1. **Update `src-tauri/src/config.rs`** — Add to struct
2. **Update default config** — `~/.config/voxforge/config.json`
3. **Update `src/components/Settings.tsx`** — Add UI field
4. **Update README** — Document the option

### Bumping Dependencies

```bash
# Check for updates
cargo outdated
npm outdated

# Update
cargo update
npm update

# Test thoroughly before committing
cargo test
npm test
cargo tauri dev
```

---

## Questions?

- **Docs:** See [CLAUDE.md](./CLAUDE.md) for dev info
- **Issues:** Open a GitHub issue for bugs/features
- **Discussions:** Ask questions in GitHub Discussions
- **Email:** [maintainer contact if provided]

---

## Code of Conduct

Be respectful, inclusive, and professional. We're here to build cool things together. 🚀

---

**Thank you for contributing to VoxForge!** 🔥
