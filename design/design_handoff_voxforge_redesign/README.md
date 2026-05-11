# Handoff: VoxForge UI Redesign

## Overview
VoxForge is an open-source Linux voice-to-text app for vibe-coding workflows: press a global hotkey, dictate, and the transcribed text is pasted into the focused window. This handoff covers a redesign of the **main window** (Record / History / Settings tabs) and the **floating overlay** (recording, transcribing, done states), with both **dark and light themes**.

## About the Design Files
The files in this bundle are **design references created in HTML/React/JSX** — interactive prototypes showing intended look, layout, and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in the VoxForge codebase** using its established framework and patterns (GTK4 / libadwaita with Python or Vala, Tauri + web stack, Electron, etc.). If no UI shell exists yet, choose the most idiomatic Linux-native option — **GTK4 + libadwaita** is strongly recommended for native feel, theme integration, and HiDPI support.

The HTML mocks emulate GTK chrome (header bar with traffic-light buttons, status bar) for visual reference only — in a real GTK4 app, use the platform's own `AdwHeaderBar`, `AdwViewStack`, `AdwViewSwitcher`, `AdwPreferencesPage`, etc. Do not try to reproduce the chrome with custom-drawn widgets.

## Fidelity
**High-fidelity.** Colors, spacing, typography, and component structure are final. Recreate pixel-close in the target framework, swapping HTML primitives for native widgets where appropriate.

## Screenshots
Reference renders in `screenshots/`:
- `01-record-dark.png` / `02-record-light.png` — Record tab
- `03-history-dark.png` / `04-history-light.png` — History tab
- `05-settings-dark.png` / `06-settings-light.png` — Settings tab
- `07-overlay-recording-dark.png` / `10-overlay-recording-light.png` — Overlay (recording state)
- `08-overlay-transcribing-dark.png` / `11-overlay-transcribing-light.png` — Overlay (transcribing state)
- `09-overlay-done-dark.png` / `12-overlay-done-light.png` — Overlay (done state)

## Files in this bundle
- `VoxForge.html` — root file; mounts the design canvas with all artboards.
- `main-window.jsx` — main window: `<MainWindow>`, `<Tabs>`, `<RecordTab>`, `<HistoryTab>`, `<SettingsTab>`, design tokens (`darkTokens`, `lightTokens`), `<MicIcon>`, `<Kbd>`.
- `overlay.jsx` — floating overlay: `<Overlay>` (states: `recording`, `transcribing`, `done`), `<Waveform>`, `<RecDot>`, `<Spinner>`.
- `design-canvas.jsx`, `tweaks-panel.jsx` — design-tool scaffolding only; ignore for implementation.

---

## Design Tokens

### Dark theme
| Token | Value | Use |
|---|---|---|
| `bg` | `#0f1419` | window background |
| `headerBg` | `#161b22` | header bar |
| `statusBg` | `#0c1015` | status bar |
| `fg` | `#e4ecf5` | primary text |
| `fgMuted` | `#9aa6b8` | secondary text |
| `fgFaint` | `#5f6b7c` | tertiary / metadata |
| `divider` | `rgba(255,255,255,0.06)` | hairlines |
| `windowBorder` | `rgba(255,255,255,0.08)` | window outline |
| `cardBg` | `rgba(255,255,255,0.03)` | card surface |
| `cardBorder` | `rgba(255,255,255,0.06)` | card outline |
| `accent` | `#7aa2f7` | accent (blue) |

### Light theme
| Token | Value | Use |
|---|---|---|
| `bg` | `#fafbfc` | window background |
| `headerBg` | `#f1f3f6` | header bar |
| `statusBg` | `#eef1f5` | status bar |
| `fg` | `#1a2330` | primary text |
| `fgMuted` | `#5a6678` | secondary text |
| `fgFaint` | `#8b96a8` | tertiary / metadata |
| `divider` | `rgba(15,20,25,0.07)` | hairlines |
| `windowBorder` | `rgba(15,20,25,0.1)` | window outline |
| `cardBg` | `#ffffff` | card surface |
| `cardBorder` | `rgba(15,20,25,0.07)` | card outline |
| `accent` | `#3b6fd6` | accent (blue) |

### Overlay-specific
| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `rgba(20,25,33,0.92)` | `rgba(255,255,255,0.94)` | pill body (with 20px backdrop blur) |
| `rec` | `#f7768e` | `#d33b5e` | recording dot |
| `done` | `#7dd3a0` | `#2d8f5a` | success check |

### Typography
- **System stack**: `system-ui, -apple-system, "Cantarell", "Segoe UI", sans-serif` — on Linux this resolves to **Cantarell** (GNOME default). Do not override.
- **Mono stack** (kbd / durations / model names): `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace`.
- **Sizes**: 22 (hero), 14 (body in detail panes), 13 (tab labels, settings rows), 12.5 (recents text), 11.5 (metadata), 11 (statusbar / hints), 10.5 (uppercase section labels with `letter-spacing: 0.08em; font-weight: 600`).

### Spacing & radius
- Window radius: **14px**
- Card radius: **10–12px**
- Input/select/button radius: **7–8px**
- Pill (overlay): **100px** (full pill)
- Kbd radius: **6px**
- Standard padding: 12–14px (cards), 20–24px (panels), 32–36px (Record hero)

### Shadows
- Window dark: `0 24px 60px rgba(0,0,0,0.5)`
- Window light: `0 24px 60px rgba(15,20,25,0.18)`
- Overlay dark: `0 12px 40px rgba(0,0,0,0.5)`
- Overlay light: `0 12px 40px rgba(15,20,25,0.18)`

---

## Screens

### 1. Main window — chrome
- **Size**: 780×620 reference (resizable in real app; min ~640×500).
- **Header bar**: 44px, centered title "VoxForge", three round 26px window buttons (min/max/close) on the right. **In GTK4: use `AdwHeaderBar`** — do not redraw window controls.
- **Status bar**: 30px (toggleable), shows: green-on-tint "READY" pill, "VoxForge" label, right-aligned hotkey hint (`Ctrl + Shift + Space  to record`). Hide via setting.

### 2. Tabs
- Horizontal tab strip below header, 14px horizontal padding, 4px gap between tabs.
- Each tab: icon (13px) + label (13px / 500 weight), 8px×14px×10px padding, 2px bottom border in accent color when active. Icon tints accent color when active.
- Tabs: **Record** (target dot icon), **History** (3-line list icon), **Settings** (gear icon).
- **In GTK4**: `AdwViewStack` + `AdwViewSwitcher` covers this natively.

### 3. Record tab (idle "Ready" state)
Layout: vertical, two regions — hero (top, fills) and recents (bottom, auto-height).

**Hero**:
- 124×124 mic surround:
  - Outer radial-gradient halo (`accent22` → transparent, 65% radius)
  - 1px circular ring (`accent33`) inset 14px, **breathing animation** `vfBreathe` (4s ease-in-out infinite, scale 1→1.08, opacity 0.6→0.3)
  - 88×88 inner tile, radius 22, gradient bg (`#1d2330 → #161b25` dark / `#fff → #eef2f7` light), 1px card border, inset highlight + drop shadow
  - 48px **mic icon** (3 styles available: classic / minimal / wave — see below)
- Title "Ready" (22px / 600 / -0.01em letter-spacing)
- Subtitle "Press the hotkey to start recording" (13px / fgMuted)
- **Hotkey card**: pill-ish container, 12×18 padding, 2 columns separated by 1px divider:
  - Left: `Ctrl` + `Shift` + `Space` → "Record"
  - Right: `Ctrl` + `Shift` + `H` → "History"

**Recents section**:
- Section label "RECENT" (uppercase, 11px, fgFaint, 0.08em tracking) + right-aligned "View all →" link.
- 3 rows, each: `grid-template-columns: 70px 1fr auto`, 10×14 padding, card bg + border, radius 10:
  - Time ago (11px / fgFaint)
  - Transcription preview (12.5px / fg, single line, ellipsis)
  - Duration (11px / mono / fgFaint)

### 4. History tab
`grid-template-columns: 320px 1fr` split.

**Left list**:
- Search field at top: 7×10 padding, magnifier icon + "Search transcriptions" placeholder (12.5px / fgFaint).
- Items grouped by **Today / Yesterday / Earlier** (uppercase 10.5px section labels).
- Each item: 10×16 padding, 2px left border (accent when selected), 14% accent background tint when selected. Two rows: meta (time + duration mono) and 2-line clamped preview.

**Right detail**:
- Top metadata row: time · duration · word count (separated by 3px dots), and 3 icon buttons on the right (copy / play / more), 28×28, 7px radius, card surface.
- Body: 16px padded card with full transcription text (14px / 1.55 line-height).
- Footer: "Model: whisper-large-v3 · Language: English" (11px / fgFaint, model in mono).

### 5. Settings tab
Vertical stack of grouped sections, 20px gap between sections.

Each section:
- Uppercase 10.5px label
- Card container (radius 10) holding rows separated by 1px dividers
- Each row: `grid-template-columns: 1fr auto`, 12×14 padding
  - Left: label (13px / 500) + optional hint (11.5px / fgFaint, 2px gap)
  - Right: control (Select / Toggle / Kbd combo)

Sections & rows:
- **Transcription**: Model (`whisper-large-v3`), Language (`Auto-detect`), Punctuation (toggle, on)
- **Hotkeys**: Start recording (`Ctrl Shift Space`), Open history (`Ctrl Shift H`)
- **Appearance**: Show overlay (toggle), Auto-paste (toggle)

**Controls**:
- **Select**: 5×8×5×10 padding, subtle inset bg, card border, 7px radius, chevron-down on right, 160px min-width.
- **Toggle**: 36×20 pill, 16px circle thumb, accent fill when on, 160ms transition.
- **Kbd**: 24px height, 7px horizontal padding, mono 11px / 600, soft 6px-radius cap with inset shadow (see exact values in code).
- **In GTK4**: `AdwSwitchRow`, `AdwComboRow`, `AdwActionRow` collapse all of the above into native widgets — strongly preferred.

### 6. Mic icon (3 styles)
Toggleable via the Tweaks panel, recommend exposing in Appearance settings:
- **Classic**: filled rounded-rect capsule + arc base + 12% accent halo behind
- **Minimal**: outline-only capsule, no halo
- **Wave**: filled capsule with two side bars on each side suggesting waves

---

## Overlay
Floating **always-on-top, click-through-when-idle, draggable** pill positioned bottom-center of screen (default), 20px from bottom. Window size: auto (min 220×44).

**Common shell**: full pill (radius 100), 10×16 padding, 12px gap, system font 13px, **20px backdrop-blur**, semi-transparent bg (see overlay tokens), 1px border, 12×40 drop shadow + inset top highlight.

### State: `recording`
- Pulsing red **rec dot** (10px, `vfPulse` 1.6s — scale 1→1.6, opacity 0.5→0)
- 28-bar **waveform** (2.5px wide bars, 2px gap, 22px height, accent color, opacity 0.6–1, height varies via sine; updates every 110ms with smooth height transition)
- Right-aligned mono duration (12px / mono / fgMuted / tabular-nums)

### State: `transcribing`
- 14px **spinner** (rotating arc, accent color, 0.9s linear)
- "Transcribing" label (13px / 500 / fgMuted)
- 3 bouncing dots (`vfDot` 1.2s staggered 0.15s)
- Right-aligned mono duration

### State: `done`
- 18px circle with success check (accent-tinted background, success-color check)
- Single-line text preview (12.5px / 500 / fg, ellipsis), max-width 380.
- Auto-dismisses after ~2s in real app.

---

## Interactions & Behavior

### Global
- **Global hotkey** `Ctrl+Shift+Space` — toggles recording from any window. On Linux/X11 use libgnome-keybindings or GlobalShortcuts portal; on Wayland use the **XDG Desktop Portal GlobalShortcuts** API (org.freedesktop.portal.GlobalShortcuts).
- **Hotkey** `Ctrl+Shift+H` — opens main window on History tab.
- After transcription completes, text is **auto-pasted into the focused window** (configurable). Use `xdotool type` (X11) or `wtype` / `ydotool` (Wayland), or simulate via portal.

### Recording flow
1. Hotkey pressed → overlay appears in `recording` state, mic capture begins (PipeWire / PulseAudio via `libpulse` or `libspa`).
2. Hotkey pressed again (or stop button) → overlay transitions to `transcribing`, audio buffer sent to local Whisper.
3. Transcription complete → overlay transitions to `done` showing preview, text copied to clipboard + pasted, overlay fades out after ~2s.
4. Errors → red error pill (not yet designed; reuse `done` shell with red icon and message).

### Animations
All transitions: **160ms ease** unless noted. Tab indicator color, toggle thumb position, button states.
- Mic breathing: 4s ease-in-out infinite.
- Rec dot pulse: 1.6s ease-in-out infinite.
- Waveform: 110ms height interpolation (110ms tick from JS in mock; in real app, drive from actual mic level).

### Theme
- Default: follow system theme via `org.freedesktop.appearance color-scheme` portal. Manual override via Settings → Appearance.
- All colors come from token tables — implement as CSS custom properties or GTK `@define-color` rules, never inline.

---

## State Management
Minimum required state:

| Key | Type | Default | Notes |
|---|---|---|---|
| `recordingState` | `'idle' \| 'recording' \| 'transcribing'` | `'idle'` | drives main mic + overlay |
| `recordings` | `Recording[]` | `[]` | persisted to SQLite |
| `selectedRecordingId` | `string \| null` | `null` | History tab |
| `searchQuery` | `string` | `''` | History filter |
| `settings` | `Settings` | (see below) | persisted to `~/.config/voxforge/config.toml` |

```ts
type Recording = {
  id: string;            // uuid
  createdAt: number;     // epoch ms
  durationSec: number;
  text: string;
  model: string;         // e.g. "whisper-large-v3"
  language: string;      // ISO code or "auto"
  audioPath?: string;    // optional cached wav
};

type Settings = {
  theme: 'system' | 'dark' | 'light';
  micStyle: 'classic' | 'minimal' | 'wave';
  showStatusbar: boolean;
  showOverlay: boolean;
  autoPaste: boolean;
  model: string;
  language: string;
  punctuation: boolean;
  hotkeys: { record: string; history: string };
};
```

## Data fetching / backends
- **Whisper**: bundle `whisper.cpp` (or use `faster-whisper` Python binding). Models stored in `~/.local/share/voxforge/models/`. First-launch model download flow (not designed yet).
- **Recordings DB**: SQLite at `~/.local/share/voxforge/history.db`.

## Assets
- All iconography is inline SVG in the JSX files (mic, gear, list, dot, copy, play, more, search, chevron, check). For GTK, use `Adw.ButtonContent` + symbolic icons from the icon theme (`microphone-symbolic`, `emblem-system-symbolic`, `view-list-symbolic`, etc.) where equivalents exist; fall back to bundled symbolic SVGs in `data/icons/hicolor/symbolic/apps/`.
- No raster assets, no external fonts.

## Accessibility
- All toggles, selects, buttons must be keyboard-reachable with visible focus rings (use accent color, 2px outline, 2px offset).
- Overlay must announce state changes via ATSPI for screen readers (`aria-live="polite"` analog).
- Honor `prefers-reduced-motion` — disable mic breathing, overlay pulse, waveform animation; keep state transitions instant.

## Testing checklist
- [ ] Window renders identically in GNOME (Adwaita-dark + Adwaita-light) and KDE Breeze
- [ ] Global hotkey works on both X11 and Wayland (incl. KDE, GNOME, Sway)
- [ ] Overlay stays on top across all workspaces, click-through when idle
- [ ] Auto-paste targets the focused window even after focus stolen during transcription
- [ ] HiDPI (200%) and fractional scaling render crisp
- [ ] Theme switches live without restart
