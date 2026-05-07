# VoxForge UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the design from `design/design_handoff_voxforge_redesign/` (3 main-window tabs + 3 overlay states + dark/light theme + configurable mic icon variant) inside the existing Tauri + React + GTK3 stack — no framework migration.

**Architecture:** Frontend is rebuilt around CSS custom-property design tokens (data-theme attribute on `<html>`). React components mirror the JSX prototypes 1:1 in structure (`<MicIcon>`, `<Kbd>`, `<Tabs>`, `<RecordTab>`, `<HistoryTab>`, `<SettingsTab>`, `<StatusBar>`). System theme detection via `matchMedia('(prefers-color-scheme: dark)')` + manual override. Native GTK3 overlay (already in `src-tauri/src/overlay.rs`) is extended from one state to three (`Recording` / `Transcribing` / `Done`) with new cairo painters and a string payload for the done preview. Backend `Config` struct grows new persisted fields (`theme`, `mic_style`, `show_statusbar`, `show_overlay`, `auto_paste`).

**Tech Stack:** Rust + Tauri 2 + GTK3 + cairo, React 18 + TypeScript + Vite, vanilla CSS (no Tailwind for new design — all via tokens). System dependencies unchanged.

---

## File Map

### Frontend — new files
- `src/theme.ts` — token tables (`darkTokens`, `lightTokens`), helper to apply via CSS custom properties.
- `src/components/MicIcon.tsx` — SVG mic with three variants (`classic` / `minimal` / `wave`).
- `src/components/Kbd.tsx` — keyboard cap.
- `src/components/Tabs.tsx` — tab strip with active-underline.
- `src/components/StatusBar.tsx` — bottom status bar (READY pill + hotkey hint), toggleable.
- `src/components/icons.tsx` — small SVG icons (CircleDot, ListIcon, GearIcon, Copy, Play, More, Search, Chevron, Check).
- `src/components/tabs/RecordTab.tsx` — Record tab (hero + recents).
- `src/components/tabs/HistoryTab.tsx` — History tab (split list + detail).
- `src/components/tabs/SettingsTab.tsx` — Settings tab (sections of cards).

### Frontend — modified
- `src/App.tsx` — top-level theme state, mounts new tabs.
- `src/index.css` — new tokens + animations + reset; old `.rec-orb*`, `.kbd*`, `.tab*`, `.statusbar*` rules removed.
- `src/types/api.ts` — extend `RecordingState` with `"done"`; `Config` shape additions.
- `src/main.tsx` — unchanged.

### Frontend — deleted
- `src/components/Recording.tsx` — replaced by `RecordTab`.
- `src/components/Settings.tsx` — replaced by `SettingsTab`.
- `src/components/History.tsx` — replaced by `HistoryTab`.
- `src/hooks/` — kept untouched (still imported via existing get/save_config).

### Backend — modified
- `src-tauri/src/config.rs` — add `theme`, `mic_style`, `show_statusbar`, `show_overlay`, `auto_paste` fields with `#[serde(default)]` so existing configs keep loading.
- `src-tauri/src/state.rs` — add `Done` variant to `RecordingState` (kept private to backend; frontend infers from overlay events).
- `src-tauri/src/overlay.rs` — extend with `OverlayState { Hidden, Recording, Transcribing, Done(String) }`; expose `set_overlay_state(app, state)`; old `set_overlay_visible` rewired as a thin wrapper for compatibility but Recording/Transcribing/Done is the new path.
- `src-tauri/src/commands.rs` — `start_recording` → `Recording`, `stop_recording` → `Transcribing`, `transcribe` final result → `Done(text)` then auto-hide after 2 s.

---

## Task 1: Design tokens + theme provider

**Files:**
- Create: `src/theme.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.css` (add `:root` token defaults)

- [ ] **Step 1:** Create `src/theme.ts` with the token tables straight from the design README.

```ts
export type ThemeName = "dark" | "light";

export const darkTokens = {
  bg: "#0f1419",
  headerBg: "#161b22",
  statusBg: "#0c1015",
  fg: "#e4ecf5",
  fgMuted: "#9aa6b8",
  fgFaint: "#5f6b7c",
  divider: "rgba(255,255,255,0.06)",
  windowBorder: "rgba(255,255,255,0.08)",
  cardBg: "rgba(255,255,255,0.03)",
  cardBorder: "rgba(255,255,255,0.06)",
  accent: "#7aa2f7",
  // overlay-only
  overlayBg: "rgba(20, 25, 33, 0.92)",
  overlayBorder: "rgba(255,255,255,0.08)",
  rec: "#f7768e",
  done: "#7dd3a0",
} as const;

export const lightTokens = {
  bg: "#fafbfc",
  headerBg: "#f1f3f6",
  statusBg: "#eef1f5",
  fg: "#1a2330",
  fgMuted: "#5a6678",
  fgFaint: "#8b96a8",
  divider: "rgba(15,20,25,0.07)",
  windowBorder: "rgba(15,20,25,0.1)",
  cardBg: "#ffffff",
  cardBorder: "rgba(15,20,25,0.07)",
  accent: "#3b6fd6",
  overlayBg: "rgba(255, 255, 255, 0.94)",
  overlayBorder: "rgba(15,20,25,0.1)",
  rec: "#d33b5e",
  done: "#2d8f5a",
} as const;

export type Tokens = typeof darkTokens;

export function applyTheme(name: ThemeName): void {
  const t = name === "dark" ? darkTokens : lightTokens;
  const root = document.documentElement;
  root.dataset.theme = name;
  for (const [k, v] of Object.entries(t)) {
    root.style.setProperty(`--${k}`, v as string);
  }
}

export function detectSystemTheme(): ThemeName {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
```

- [ ] **Step 2:** Replace `src/index.css` first ~40 lines (the old `:root` Atom-One-Dark palette and the `*`/`html, body, #root` blocks) with token defaults + reset. Read the current file first to know exact line numbers.

```css
:root {
  /* Default to dark; theme.ts overrides immediately on mount. */
  --bg: #0f1419;
  --headerBg: #161b22;
  --statusBg: #0c1015;
  --fg: #e4ecf5;
  --fgMuted: #9aa6b8;
  --fgFaint: #5f6b7c;
  --divider: rgba(255, 255, 255, 0.06);
  --windowBorder: rgba(255, 255, 255, 0.08);
  --cardBg: rgba(255, 255, 255, 0.03);
  --cardBorder: rgba(255, 255, 255, 0.06);
  --accent: #7aa2f7;
  --overlayBg: rgba(20, 25, 33, 0.92);
  --overlayBorder: rgba(255, 255, 255, 0.08);
  --rec: #f7768e;
  --done: #7dd3a0;
  --font-sans: system-ui, -apple-system, "Cantarell", "Segoe UI",
    "SF Pro Text", sans-serif;
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  background: var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: 13px;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

input, select, textarea, button { font-family: inherit; font-size: inherit; }
button { cursor: pointer; }
```

- [ ] **Step 3:** Wire the theme into `src/App.tsx`. Replace its existing `import` block and the `useEffect`s with the additions below; keep handleStartRecording/handleStopRecording bodies intact.

In the imports add:
```tsx
import { applyTheme, detectSystemTheme, ThemeName } from "./theme";
```

Right after the `useState` declarations near the top of `App` add:
```tsx
const [theme, setTheme] = useState<ThemeName>(detectSystemTheme());

useEffect(() => {
  applyTheme(theme);
}, [theme]);

useEffect(() => {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => setTheme(detectSystemTheme());
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}, []);
```

(Manual override from Settings will plug into `setTheme` in Task 7.)

- [ ] **Step 4:** Build and confirm everything still compiles + the window paints with the new dark palette.

```bash
npx vite build 2>&1 | tail -3
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
```

Both: clean.

- [ ] **Step 5:** Commit.

```bash
git add src/theme.ts src/index.css src/App.tsx
git commit -m "feat(ui): design tokens + theme provider"
```

---

## Task 2: Shared primitives — MicIcon, Kbd, icons

**Files:**
- Create: `src/components/MicIcon.tsx`
- Create: `src/components/Kbd.tsx`
- Create: `src/components/icons.tsx`

- [ ] **Step 1:** Create `src/components/MicIcon.tsx` — port the JSX from `design/design_handoff_voxforge_redesign/main-window.jsx:7-43`.

```tsx
export type MicStyle = "classic" | "minimal" | "wave";

interface Props {
  style?: MicStyle;
  size?: number;
  color?: string;
  glow?: boolean;
}

export function MicIcon({
  style = "classic",
  size = 56,
  color = "var(--accent)",
  glow = true,
}: Props) {
  if (style === "minimal") {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="22" y="10" width="12" height="24" rx="6" stroke={color} strokeWidth="2.5" />
        <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === "wave") {
    return (
      <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
        <rect x="24" y="14" width="8" height="22" rx="4" fill={color} />
        <g stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path d="M14 22v12" />
          <path d="M18 18v20" />
          <path d="M38 18v20" />
          <path d="M42 22v12" />
        </g>
        <path d="M28 40v6" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      {glow && <circle cx="28" cy="26" r="18" fill={color} opacity="0.12" />}
      <rect x="22" y="12" width="12" height="22" rx="6" fill={color} />
      <path d="M16 26c0 6.6 5.4 12 12 12s12-5.4 12-12" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M28 38v8" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M22 46h12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
```

- [ ] **Step 2:** Create `src/components/Kbd.tsx`.

```tsx
import { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
```

And add to `src/index.css` (append at end):

```css
.kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  background: rgba(255, 255, 255, 0.06);
  color: #c8d3e0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 -1px 0 rgba(0, 0, 0, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.04);
}

[data-theme="light"] .kbd {
  background: rgba(15, 20, 25, 0.05);
  color: #3a4452;
  border-color: rgba(15, 20, 25, 0.08);
  box-shadow:
    inset 0 -1px 0 rgba(15, 20, 25, 0.06),
    0 1px 0 rgba(255, 255, 255, 0.8);
}
```

- [ ] **Step 3:** Create `src/components/icons.tsx` with the small SVGs used across tabs.

```tsx
export const CircleDot = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
    <circle cx="8" cy="8" r="2.4" fill="currentColor" />
  </svg>
);

export const ListIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const GearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8L3.4 3.4"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
    />
  </svg>
);

export const Copy = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

export const Play = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <path d="M5 3.5l8 4.5-8 4.5v-9z" fill="currentColor" />
  </svg>
);

export const More = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
  </svg>
);

export const Search = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const Chevron = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const Check = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
```

- [ ] **Step 4:** Build (no UI uses these yet but they should compile).

```bash
npx vite build 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 5:** Commit.

```bash
git add src/components/MicIcon.tsx src/components/Kbd.tsx src/components/icons.tsx src/index.css
git commit -m "feat(ui): MicIcon, Kbd, shared SVG icons"
```

---

## Task 3: Tabs strip + StatusBar

**Files:**
- Create: `src/components/Tabs.tsx`
- Create: `src/components/StatusBar.tsx`
- Modify: `src/index.css`

- [ ] **Step 1:** Create `src/components/Tabs.tsx`.

```tsx
import { CircleDot, ListIcon, GearIcon } from "./icons";

export type TabId = "record" | "history" | "settings";

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
}

const TABS: { id: TabId; label: string; icon: () => JSX.Element }[] = [
  { id: "record", label: "Record", icon: CircleDot },
  { id: "history", label: "History", icon: ListIcon },
  { id: "settings", label: "Settings", icon: GearIcon },
];

export function Tabs({ active, onChange }: Props) {
  return (
    <div className="tabs">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`tab ${isActive ? "tab-active" : ""}`}
          >
            <span className="tab-ic">
              <Icon />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** Create `src/components/StatusBar.tsx`.

```tsx
import { Kbd } from "./Kbd";
import { RecordingState } from "../types/api";

interface Props {
  state: RecordingState;
  visible: boolean;
}

const PILL_LABEL: Record<RecordingState, string> = {
  idle: "READY",
  recording: "REC",
  processing: "BUSY",
};

export function StatusBar({ state, visible }: Props) {
  if (!visible) return null;
  return (
    <div className="statusbar">
      <div className={`status-pill status-pill-${state}`}>
        <span className="status-dot" />
        {PILL_LABEL[state]}
      </div>
      <span className="status-name">VoxForge</span>
      <span className="status-hint">
        <Kbd>Ctrl</Kbd>
        <span className="kbd-sep">+</span>
        <Kbd>Shift</Kbd>
        <span className="kbd-sep">+</span>
        <Kbd>Space</Kbd>
        <span className="status-hint-text">to record</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 3:** Append the styles to `src/index.css`.

```css
.tabs {
  display: flex;
  padding: 8px 14px 0;
  gap: 4px;
  border-bottom: 1px solid var(--divider);
  background: var(--bg);
  flex-shrink: 0;
}
.tab {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 8px 14px 10px;
  border: none;
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--fgMuted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 160ms ease, border-color 160ms ease;
}
.tab .tab-ic { display: flex; opacity: 0.7; }
.tab-active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
.tab-active .tab-ic {
  color: var(--accent);
  opacity: 1;
}

.statusbar {
  height: 30px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 10px;
  border-top: 1px solid var(--divider);
  background: var(--statusBg);
  font-size: 11px;
  color: var(--fgMuted);
  flex-shrink: 0;
}
.status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.status-pill-recording {
  background: color-mix(in srgb, var(--rec) 18%, transparent);
  color: var(--rec);
}
.status-pill-processing {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
.status-name { color: var(--fgMuted); }
.status-hint {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.kbd-sep { color: var(--fgFaint); }
.status-hint-text { margin-left: 6px; color: var(--fgMuted); }
```

- [ ] **Step 4:** Build.

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 5:** Commit.

```bash
git add src/components/Tabs.tsx src/components/StatusBar.tsx src/index.css
git commit -m "feat(ui): tab strip + status bar"
```

---

## Task 4: RecordTab — hero, breathing ring, hotkey card, recents

**Files:**
- Create: `src/components/tabs/RecordTab.tsx`
- Modify: `src/index.css`

- [ ] **Step 1:** Create `src/components/tabs/RecordTab.tsx`.

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MicIcon, MicStyle } from "../MicIcon";
import { Kbd } from "../Kbd";
import { HistoryEntry } from "../../types/api";

interface Props {
  micStyle: MicStyle;
}

interface Recent {
  time: string;
  text: string;
  dur: string;
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec} sec ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hour ago`;
  return `${Math.floor(sec / 86400)} day ago`;
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function RecordTab({ micStyle }: Props) {
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const all = await invoke<HistoryEntry[]>("get_history");
        const top3 = all.slice(0, 3).map((h) => ({
          time: timeAgo(new Date(h.timestamp).getTime()),
          text: h.text,
          dur: fmtDur(h.duration),
        }));
        setRecents(top3);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <div className="record-tab">
      <div className="record-hero">
        <div className="mic-surround">
          <div className="mic-halo" />
          <div className="mic-ring" />
          <div className="mic-tile">
            <MicIcon style={micStyle} size={48} color="var(--accent)" />
          </div>
        </div>
        <div className="hero-text">
          <div className="hero-title">Ready</div>
          <div className="hero-subtitle">Press the hotkey to start recording</div>
        </div>
        <div className="hotkey-card">
          <HotkeyRow keys={["Ctrl", "Shift", "Space"]} label="Record" />
          <div className="hotkey-divider" />
          <HotkeyRow keys={["Ctrl", "Shift", "H"]} label="History" />
        </div>
      </div>

      <div className="recents">
        <div className="recents-header">
          <div className="recents-label">Recent</div>
          <div className="recents-link">View all →</div>
        </div>
        <div className="recents-list">
          {recents.length === 0 && (
            <div className="recents-empty">No recordings yet.</div>
          )}
          {recents.map((r, i) => (
            <div key={i} className="recent-row">
              <div className="recent-time">{r.time}</div>
              <div className="recent-text">{r.text}</div>
              <div className="recent-dur">{r.dur}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HotkeyRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="hotkey-row">
      <div className="hotkey-keys">
        {keys.map((k, i) => (
          <span key={i} className="hotkey-key-wrap">
            <Kbd>{k}</Kbd>
            {i < keys.length - 1 && <span className="kbd-sep">+</span>}
          </span>
        ))}
      </div>
      <span className="hotkey-label">{label}</span>
    </div>
  );
}
```

- [ ] **Step 2:** Append the styles to `src/index.css`.

```css
.record-tab {
  flex: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  padding: 32px 36px 20px;
  gap: 24px;
  min-height: 0;
}
.record-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding-top: 12px;
}

.mic-surround {
  position: relative;
  width: 124px;
  height: 124px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mic-halo {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--accent) 13%, transparent) 0%, transparent 65%);
}
.mic-ring {
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  animation: vfBreathe 4s ease-in-out infinite;
}
.mic-tile {
  width: 88px;
  height: 88px;
  border-radius: 22px;
  background: linear-gradient(160deg, #1d2330 0%, #161b25 100%);
  border: 1px solid var(--cardBorder);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 8px 24px rgba(0, 0, 0, 0.4);
}
[data-theme="light"] .mic-tile {
  background: linear-gradient(160deg, #ffffff 0%, #eef2f7 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 8px 24px rgba(15, 20, 25, 0.08);
}

@keyframes vfBreathe {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.08); opacity: 0.3; }
}
@media (prefers-reduced-motion: reduce) {
  .mic-ring { animation: none; }
}

.hero-text { text-align: center; display: flex; flex-direction: column; gap: 6px; }
.hero-title { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
.hero-subtitle { font-size: 13px; color: var(--fgMuted); }

.hotkey-card {
  display: flex;
  gap: 10px;
  margin-top: 4px;
  padding: 12px 18px;
  background: var(--cardBg);
  border: 1px solid var(--cardBorder);
  border-radius: 12px;
}
.hotkey-row { display: flex; align-items: center; gap: 8px; }
.hotkey-keys { display: flex; align-items: center; gap: 4px; }
.hotkey-key-wrap { display: inline-flex; align-items: center; gap: 4px; }
.hotkey-label { font-size: 11.5px; color: var(--fgMuted); font-weight: 500; }
.hotkey-divider { width: 1px; background: var(--divider); }

.recents { display: flex; flex-direction: column; gap: 10px; }
.recents-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}
.recents-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fgFaint);
}
.recents-link { font-size: 11px; color: var(--fgFaint); font-weight: 500; cursor: default; }
.recents-list { display: flex; flex-direction: column; gap: 6px; }
.recents-empty {
  padding: 16px;
  text-align: center;
  color: var(--fgFaint);
  font-size: 12px;
}
.recent-row {
  display: grid;
  grid-template-columns: 70px 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  background: var(--cardBg);
  border: 1px solid var(--cardBorder);
  border-radius: 10px;
  font-size: 12.5px;
}
.recent-time { color: var(--fgFaint); font-size: 11px; font-weight: 500; }
.recent-text {
  color: var(--fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}
.recent-dur { color: var(--fgFaint); font-size: 11px; font-family: var(--font-mono); }
```

- [ ] **Step 3:** Build.

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 4:** Commit.

```bash
git add src/components/tabs/RecordTab.tsx src/index.css
git commit -m "feat(ui): RecordTab with hero, hotkey card, recents"
```

---

## Task 5: HistoryTab — split list + detail

**Files:**
- Create: `src/components/tabs/HistoryTab.tsx`
- Modify: `src/index.css`
- Read: `src/types/api.ts` to confirm `HistoryEntry` shape (don't modify if it already has `id`, `text`, `timestamp`, `duration`, `language`).

- [ ] **Step 1:** Read `src/types/api.ts` and `src-tauri/src/history.rs` to confirm the HistoryEntry shape used over IPC.

```bash
cat src/types/api.ts
grep -A 10 "pub struct HistoryEntry" src-tauri/src/history.rs
```

If `HistoryEntry` lacks a `model` field, the detail panel just won't show one — the design footer line shows model+language, but our backend probably stores only `language`. Render `Model: whisper-1` literally from the loaded config (we already invoke `get_config`).

- [ ] **Step 2:** Create `src/components/tabs/HistoryTab.tsx`.

```tsx
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HistoryEntry, Config } from "../../types/api";
import { Search, Copy, Play, More } from "../icons";

type Group = "Today" | "Yesterday" | "Earlier";

function bucket(ts: number): Group {
  const now = new Date();
  const d = new Date(ts);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  ) {
    return "Yesterday";
  }
  return "Earlier";
}

function fmtDur(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec} sec ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} hour ago`;
  return `${Math.floor(sec / 86400)} day ago`;
}

export function HistoryTab() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("whisper-1");
  const [lang, setLang] = useState("Auto");

  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<HistoryEntry[]>("get_history");
        setItems(list);
        if (list.length) setSelectedId(list[0].id);
      } catch {
        /* ignore */
      }
      try {
        const cfg = await invoke<Config>("get_config");
        setModel(cfg.model);
        setLang(cfg.language || "Auto");
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.text.toLowerCase().includes(q));
  }, [items, query]);

  const groups: Record<Group, HistoryEntry[]> = useMemo(() => {
    const out: Record<Group, HistoryEntry[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const it of filtered) {
      out[bucket(new Date(it.timestamp).getTime())].push(it);
    }
    return out;
  }, [filtered]);

  const sel = items.find((it) => it.id === selectedId) ?? null;

  return (
    <div className="history-tab">
      <div className="history-list">
        <div className="history-search-wrap">
          <div className="history-search">
            <Search />
            <input
              className="history-search-input"
              placeholder="Search transcriptions"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        {(["Today", "Yesterday", "Earlier"] as Group[]).map((g) =>
          groups[g].length === 0 ? null : (
            <div key={g}>
              <div className="history-group">{g}</div>
              {groups[g].map((it) => {
                const isSel = it.id === selectedId;
                return (
                  <div
                    key={it.id}
                    onClick={() => setSelectedId(it.id)}
                    className={`history-item ${isSel ? "history-item-sel" : ""}`}
                  >
                    <div className="history-item-meta">
                      <span>{timeAgo(new Date(it.timestamp).getTime())}</span>
                      <span className="history-item-dur">{fmtDur(it.duration)}</span>
                    </div>
                    <div className="history-item-text">{it.text}</div>
                  </div>
                );
              })}
            </div>
          ),
        )}
      </div>

      <div className="history-detail">
        {sel ? (
          <>
            <div className="history-detail-meta">
              <div className="history-detail-meta-left">
                <div>{timeAgo(new Date(sel.timestamp).getTime())}</div>
                <span className="history-dot" />
                <div className="history-detail-mono">{fmtDur(sel.duration)}</div>
                <span className="history-dot" />
                <div>{sel.text.split(/\s+/).filter(Boolean).length} words</div>
              </div>
              <div className="history-detail-actions">
                <IconButton title="Copy">
                  <Copy />
                </IconButton>
                <IconButton title="Play">
                  <Play />
                </IconButton>
                <IconButton title="More">
                  <More />
                </IconButton>
              </div>
            </div>
            <div className="history-detail-body">{sel.text}</div>
            <div className="history-detail-footer">
              <span>
                Model: <span className="history-detail-mono">{model}</span>
              </span>
              <span>
                Language: <span className="history-detail-fgmuted">{lang}</span>
              </span>
            </div>
          </>
        ) : (
          <div className="history-detail-empty">Select a transcription</div>
        )}
      </div>
    </div>
  );
}

function IconButton({ title, children }: { title: string; children: JSX.Element }) {
  return (
    <button type="button" className="history-icon-btn" title={title}>
      {children}
    </button>
  );
}
```

- [ ] **Step 3:** Append the styles to `src/index.css`.

```css
.history-tab {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 0;
}
.history-list {
  border-right: 1px solid var(--divider);
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.history-search-wrap { padding: 14px 16px 8px; }
.history-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  background: var(--cardBg);
  border: 1px solid var(--cardBorder);
  border-radius: 8px;
  color: var(--fgFaint);
}
.history-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--fg);
  outline: none;
  font-size: 12.5px;
}
.history-search-input::placeholder { color: var(--fgFaint); }

.history-group {
  padding: 10px 16px 6px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fgFaint);
}
.history-item {
  padding: 10px 16px;
  cursor: pointer;
  border-left: 2px solid transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.history-item-sel {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-left-color: var(--accent);
}
.history-item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--fgFaint);
}
.history-item-dur { font-family: var(--font-mono); }
.history-item-text {
  font-size: 12.5px;
  color: var(--fg);
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.history-detail {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
}
.history-detail-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.history-detail-meta-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--fgFaint);
}
.history-detail-mono { font-family: var(--font-mono); }
.history-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--fgFaint);
}
.history-detail-actions { display: flex; gap: 6px; }
.history-icon-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--cardBorder);
  background: var(--cardBg);
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--fgMuted);
}
.history-detail-body {
  padding: 16px;
  background: var(--cardBg);
  border: 1px solid var(--cardBorder);
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.55;
  color: var(--fg);
}
.history-detail-footer {
  font-size: 11px;
  color: var(--fgFaint);
  display: flex;
  gap: 14px;
  padding: 0 4px;
}
.history-detail-fgmuted { color: var(--fgMuted); }
.history-detail-empty {
  padding: 40px 0;
  text-align: center;
  color: var(--fgFaint);
}
```

- [ ] **Step 4:** Build.

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 5:** Commit.

```bash
git add src/components/tabs/HistoryTab.tsx src/index.css
git commit -m "feat(ui): HistoryTab with split list + detail"
```

---

## Task 6: Backend Config — extend with new fields

**Files:**
- Modify: `src-tauri/src/config.rs`
- Modify: `src/types/api.ts`

- [ ] **Step 1:** Edit `src-tauri/src/config.rs`. Add the new fields with `#[serde(default)]` so older `~/.config/voxforge/config.json` files keep loading.

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub openai_api_key: String,
    pub hotkey_start: String,
    pub hotkey_stop: String,
    pub hotkey_history: String,
    pub language: String,
    pub model: String,
    pub ui_language: String,
    pub openai_api_base: String,
    pub output_mode: String,

    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_mic_style")]
    pub mic_style: String,
    #[serde(default = "default_true")]
    pub show_statusbar: bool,
    #[serde(default = "default_true")]
    pub show_overlay: bool,
    #[serde(default = "default_true")]
    pub auto_paste: bool,
    #[serde(default = "default_true")]
    pub punctuation: bool,
}

fn default_theme() -> String { "system".into() }
fn default_mic_style() -> String { "classic".into() }
fn default_true() -> bool { true }
```

And include the same defaults in `Default::default()`:

```rust
impl Default for Config {
    fn default() -> Self {
        Self {
            openai_api_key: std::env::var("OPENAI_API_KEY").unwrap_or_default(),
            hotkey_start: "ctrl+shift+space".to_string(),
            hotkey_stop: "ctrl+shift+space".to_string(),
            hotkey_history: "ctrl+shift+h".to_string(),
            language: "uk".to_string(),
            model: "whisper-1".to_string(),
            ui_language: "uk".to_string(),
            openai_api_base: "https://api.openai.com/v1".to_string(),
            output_mode: "inject".to_string(),
            theme: default_theme(),
            mic_style: default_mic_style(),
            show_statusbar: true,
            show_overlay: true,
            auto_paste: true,
            punctuation: true,
        }
    }
}
```

- [ ] **Step 2:** Mirror the additions in `src/types/api.ts`. Read it first to know its current shape, then extend `Config` to:

```ts
export interface Config {
  openai_api_key: string;
  hotkey_start: string;
  hotkey_stop: string;
  hotkey_history: string;
  language: string;
  model: string;
  ui_language: string;
  openai_api_base: string;
  output_mode: string;
  theme: "system" | "dark" | "light";
  mic_style: "classic" | "minimal" | "wave";
  show_statusbar: boolean;
  show_overlay: boolean;
  auto_paste: boolean;
  punctuation: boolean;
}
```

- [ ] **Step 3:** Build both ends.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
npx vite build 2>&1 | tail -3
```

- [ ] **Step 4:** Commit.

```bash
git add src-tauri/src/config.rs src/types/api.ts
git commit -m "feat(config): theme, mic_style, show_*, auto_paste, punctuation"
```

---

## Task 7: SettingsTab — sections, controls, persistence

**Files:**
- Create: `src/components/tabs/SettingsTab.tsx`
- Modify: `src/index.css`

- [ ] **Step 1:** Create `src/components/tabs/SettingsTab.tsx`.

```tsx
import { ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Config } from "../../types/api";
import { MicStyle } from "../MicIcon";
import { ThemeName } from "../../theme";
import { Kbd } from "../Kbd";
import { Chevron } from "../icons";

interface Props {
  onConfigChange: (cfg: Config) => void;
}

export function SettingsTab({ onConfigChange }: Props) {
  const [cfg, setCfg] = useState<Config | null>(null);

  useEffect(() => {
    (async () => {
      const c = await invoke<Config>("get_config");
      setCfg(c);
    })();
  }, []);

  if (!cfg) return <div className="settings-tab">Loading…</div>;

  const update = async (patch: Partial<Config>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    onConfigChange(next);
    try {
      await invoke("save_config", { config: next });
    } catch (e) {
      console.error("save_config failed", e);
    }
  };

  return (
    <div className="settings-tab">
      <Section title="Transcription">
        <Row
          label="Model"
          hint="Whisper model used by the API"
          control={
            <Select
              value={cfg.model}
              options={["whisper-1"]}
              onChange={(v) => update({ model: v })}
            />
          }
        />
        <Row
          label="Language"
          hint="Auto-detect or specify a language"
          control={
            <Select
              value={cfg.language || "auto"}
              options={["auto", "uk", "en", "de", "fr", "es", "pl"]}
              onChange={(v) => update({ language: v === "auto" ? "" : v })}
            />
          }
        />
        <Row
          label="Punctuation"
          hint="Add punctuation and capitalization automatically"
          control={
            <Toggle
              on={cfg.punctuation}
              onChange={(on) => update({ punctuation: on })}
            />
          }
          last
        />
      </Section>

      <Section title="Hotkeys">
        <Row
          label="Start recording"
          control={
            <KeyRow keys={["Ctrl", "Shift", "Space"]} />
          }
        />
        <Row
          label="Open history"
          control={<KeyRow keys={["Ctrl", "Shift", "H"]} />}
          last
        />
      </Section>

      <Section title="Appearance">
        <Row
          label="Theme"
          hint="Follow system or pick manually"
          control={
            <Select
              value={cfg.theme}
              options={["system", "dark", "light"]}
              onChange={(v) => update({ theme: v as ThemeName | "system" })}
            />
          }
        />
        <Row
          label="Mic icon"
          hint="Style of the hero microphone"
          control={
            <Select
              value={cfg.mic_style}
              options={["classic", "minimal", "wave"]}
              onChange={(v) => update({ mic_style: v as MicStyle })}
            />
          }
        />
        <Row
          label="Show overlay"
          hint="Floating recorder pill while recording"
          control={
            <Toggle
              on={cfg.show_overlay}
              onChange={(on) => update({ show_overlay: on })}
            />
          }
        />
        <Row
          label="Show status bar"
          hint="Bottom bar with READY / hotkey hint"
          control={
            <Toggle
              on={cfg.show_statusbar}
              onChange={(on) => update({ show_statusbar: on })}
            />
          }
        />
        <Row
          label="Auto-paste"
          hint="Inject transcription into the focused window"
          control={
            <Toggle
              on={cfg.auto_paste}
              onChange={(on) => update({ auto_paste: on })}
            />
          }
          last
        />
      </Section>

      <Section title="OpenAI API">
        <Row
          label="API key"
          hint="Stored locally in ~/.config/voxforge/config.json"
          control={
            <input
              className="settings-input"
              type="password"
              value={cfg.openai_api_key}
              onChange={(e) => update({ openai_api_key: e.target.value })}
              placeholder="sk-…"
            />
          }
        />
        <Row
          label="API base URL"
          control={
            <input
              className="settings-input"
              value={cfg.openai_api_base}
              onChange={(e) => update({ openai_api_base: e.target.value })}
            />
          }
          last
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-card">{children}</div>
    </div>
  );
}

function Row({
  label,
  hint,
  control,
  last,
}: {
  label: string;
  hint?: string;
  control: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`settings-row ${last ? "settings-row-last" : ""}`}>
      <div>
        <div className="settings-row-label">{label}</div>
        {hint && <div className="settings-row-hint">{hint}</div>}
      </div>
      <div className="settings-row-control">{control}</div>
    </div>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="settings-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <span className="settings-select-chevron">
        <Chevron />
      </span>
    </label>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`settings-toggle ${on ? "settings-toggle-on" : ""}`}
      aria-pressed={on}
    >
      <span className="settings-toggle-thumb" />
    </button>
  );
}

function KeyRow({ keys }: { keys: string[] }) {
  return (
    <div className="settings-keyrow">
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </div>
  );
}
```

- [ ] **Step 2:** Append styles to `src/index.css`.

```css
.settings-tab {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: auto;
}
.settings-section { display: flex; flex-direction: column; gap: 10px; }
.settings-section-title {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fgFaint);
}
.settings-card {
  background: var(--cardBg);
  border: 1px solid var(--cardBorder);
  border-radius: 10px;
  overflow: hidden;
}
.settings-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--divider);
}
.settings-row-last { border-bottom: none; }
.settings-row-label { font-size: 13px; color: var(--fg); font-weight: 500; }
.settings-row-hint { font-size: 11.5px; color: var(--fgFaint); margin-top: 2px; }
.settings-row-control { display: flex; align-items: center; }

.settings-select {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 160px;
}
.settings-select select {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  padding: 5px 28px 5px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--cardBorder);
  border-radius: 7px;
  font-size: 12.5px;
  color: var(--fg);
}
[data-theme="light"] .settings-select select {
  background: rgba(15, 20, 25, 0.04);
}
.settings-select-chevron {
  position: absolute;
  right: 8px;
  pointer-events: none;
  color: var(--fgMuted);
  display: flex;
}

.settings-toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  border: none;
  padding: 0;
  transition: background 160ms ease;
}
[data-theme="light"] .settings-toggle { background: rgba(15, 20, 25, 0.12); }
.settings-toggle-on { background: var(--accent); }
.settings-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: left 160ms ease;
}
.settings-toggle-on .settings-toggle-thumb { left: 18px; }

.settings-keyrow { display: flex; gap: 4px; }

.settings-input {
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--cardBorder);
  border-radius: 7px;
  font-size: 12.5px;
  color: var(--fg);
  width: 240px;
}
[data-theme="light"] .settings-input { background: rgba(15, 20, 25, 0.04); }
```

- [ ] **Step 3:** Build.

```bash
npx vite build 2>&1 | tail -3
```

- [ ] **Step 4:** Commit.

```bash
git add src/components/tabs/SettingsTab.tsx src/index.css
git commit -m "feat(ui): SettingsTab with sections, selects, toggles, persistence"
```

---

## Task 8: Wire App.tsx to new tabs + theme + config

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/Recording.tsx`, `src/components/Settings.tsx`, `src/components/History.tsx`

- [ ] **Step 1:** Read current `src/App.tsx` to know what to keep (start/stop handlers, listeners) versus what to replace.

- [ ] **Step 2:** Replace the body of `src/App.tsx` with the new wiring. The hotkey listeners, recording flow, status messages all stay; the tab routing changes to use the new tab components and the inline status-bar JSX is replaced by `<StatusBar>`.

```tsx
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Tabs, TabId } from "./components/Tabs";
import { StatusBar } from "./components/StatusBar";
import { RecordTab } from "./components/tabs/RecordTab";
import { HistoryTab } from "./components/tabs/HistoryTab";
import { SettingsTab } from "./components/tabs/SettingsTab";
import {
  applyTheme,
  detectSystemTheme,
  ThemeName,
} from "./theme";
import { Config, RecordingState } from "./types/api";
import { MicStyle } from "./components/MicIcon";

export default function App() {
  const [tab, setTab] = useState<TabId>("record");
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [statusMsg, setStatusMsg] = useState<{
    kind: "info" | "error";
    text: string;
  } | null>(null);

  // Theme: follows config (system/dark/light); reactive to OS changes when "system".
  const [themePref, setThemePref] = useState<"system" | ThemeName>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ThemeName>(
    detectSystemTheme(),
  );
  useEffect(() => applyTheme(resolvedTheme), [resolvedTheme]);
  useEffect(() => {
    if (themePref === "system") {
      setResolvedTheme(detectSystemTheme());
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => setResolvedTheme(detectSystemTheme());
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    setResolvedTheme(themePref);
  }, [themePref]);

  // Config-derived UI prefs.
  const [micStyle, setMicStyle] = useState<MicStyle>("classic");
  const [showStatusbar, setShowStatusbar] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<Config>("get_config");
        setMicStyle(cfg.mic_style);
        setShowStatusbar(cfg.show_statusbar);
        setThemePref(cfg.theme);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const onConfigChange = (cfg: Config) => {
    setMicStyle(cfg.mic_style);
    setShowStatusbar(cfg.show_statusbar);
    setThemePref(cfg.theme);
  };

  // Recording flow (unchanged behaviour).
  const isRecordingRef = useRef(false);
  useEffect(() => {
    const w = getCurrentWindow();
    const u1 = w.listen("hotkey:start", () => {
      setTab("record");
      w.hide();
      handleStart();
    });
    const u2 = w.listen("hotkey:stop", () => handleStop());
    const u3 = w.listen("hotkey:history", () => {
      setTab("history");
      w.show();
      w.setFocus();
    });
    const u4 = w.listen("show-history", () => setTab("history"));
    const u5 = w.listen("show-settings", () => setTab("settings"));
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
      u3.then((f) => f());
      u4.then((f) => f());
      u5.then((f) => f());
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await invoke("set_overlay_visible", {
          visible: recordingState !== "idle",
        });
      } catch {
        /* ignore */
      }
    })();
  }, [recordingState]);

  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 6000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const handleStart = async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;
    setRecordingState("recording");
    try {
      await invoke("start_recording");
    } catch (e) {
      setRecordingState("idle");
      isRecordingRef.current = false;
      setStatusMsg({ kind: "error", text: `Mic error: ${e}` });
    }
  };

  const handleStop = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    try {
      setRecordingState("processing");
      const audio = await invoke<number[]>("stop_recording");
      const text = await invoke<string>("transcribe", {
        audioBytes: Array.from(new Uint8Array(audio)),
      });
      if (text && text.trim()) {
        try {
          await invoke("inject_or_copy", { text });
        } catch (e) {
          setStatusMsg({ kind: "error", text: `Inject failed: ${e}` });
        }
        const dur = audio.length / 16000;
        await invoke("save_to_history", { text, duration: dur });
        setStatusMsg({
          kind: "info",
          text: `Transcribed: "${
            text.length > 60 ? text.slice(0, 57) + "…" : text
          }"`,
        });
      } else {
        setStatusMsg({ kind: "info", text: "Empty transcription" });
      }
      setRecordingState("idle");
    } catch (e) {
      setRecordingState("idle");
      setStatusMsg({ kind: "error", text: `Transcription failed: ${e}` });
    }
  };

  return (
    <div className="app">
      <Tabs active={tab} onChange={setTab} />
      <div className="app-page">
        {tab === "record" && <RecordTab micStyle={micStyle} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && <SettingsTab onConfigChange={onConfigChange} />}
      </div>
      <StatusBar state={recordingState} visible={showStatusbar} />
    </div>
  );
}
```

- [ ] **Step 3:** Replace the `.app` rule in `src/index.css`. Find and remove the existing `.app { display: grid; grid-template-rows: 36px 1fr 22px; ... }` block (and any other now-stale rules like `.statusbar-left`, `.statusbar-right`, `.tab-icon`, the old `.tab` block — they will be overridden but cleaning helps), then append:

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  background: var(--bg);
}
.app-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 4:** Delete the now-unused page components.

```bash
rm src/components/Recording.tsx src/components/Settings.tsx src/components/History.tsx
```

- [ ] **Step 5:** Build everything; the React tree must mount without console errors.

```bash
npx vite build 2>&1 | tail -3
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
```

If vite reports unresolved imports for the deleted files, grep for their names and fix the leftover imports:

```bash
grep -rn "from \"./components/Recording\"\|from \"./components/Settings\"\|from \"./components/History\"" src/
```

- [ ] **Step 6:** Commit.

```bash
git add src/App.tsx src/index.css
git rm src/components/Recording.tsx src/components/Settings.tsx src/components/History.tsx
git commit -m "feat(ui): wire App.tsx to redesigned tabs + theme + config"
```

---

## Task 9: Native overlay — three states (Recording / Transcribing / Done)

**Files:**
- Modify: `src-tauri/src/overlay.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1:** In `src-tauri/src/overlay.rs`, replace the existing `set_overlay_visible(bool)` API with a state-based API that still keeps a `visible(bool)` shim for the React side. Read the current `imp` module first; then change the `Overlay` struct, the `OVERLAY` thread-local, and the public functions:

```rust
#[derive(Clone, Debug)]
pub enum OverlayState {
    Hidden,
    Recording,
    Transcribing,
    Done(String),
}
```

Add this enum to the top of the file (outside the cfg gate so non-Linux builds compile too).

Inside the `imp` module, change `Overlay` to also remember the current state and the `Done` text:

```rust
struct Overlay {
    window: gtk::Window,
    history: Arc<Mutex<Vec<f32>>>,
    timer: RefCell<Option<glib::SourceId>>,
    state: RefCell<OverlayState>,
    elapsed_start: RefCell<Option<std::time::Instant>>,
    auto_hide: RefCell<Option<glib::SourceId>>,
    bg: gtk::DrawingArea,
}
```

Move the orb button and the waveform `DrawingArea` references too if needed for show/hide per state — simpler approach: keep a `gtk::Stack` (or keep `gtk::Overlay` you already have) with three child rows, and toggle visibility per state.

Pragmatic implementation that re-uses the existing single-row layout:
- Always render the same three-area pill: `[icon-or-spinner-or-check] [main content] [right-aligned duration or empty]`.
- Repaint the *background* (`paint_pill_bg`) the same way for all states.
- Repaint the *content area* differently per state via a single `gtk::Box` whose children we rebuild.

Concretely, replace the orb-button + waveform packing with a stack of three pre-built rows wrapped in `gtk::Stack`:

```rust
let inner_stack = gtk::Stack::new();
inner_stack.set_transition_type(gtk::StackTransitionType::Crossfade);
inner_stack.set_transition_duration(160);

// Row 1 — recording: rec dot + waveform + duration
let rec_row = build_recording_row(&app, history.clone(), elapsed_start.clone());
inner_stack.add_named(&rec_row, "recording");

// Row 2 — transcribing: spinner + label + dots + duration
let trans_row = build_transcribing_row(elapsed_start.clone());
inner_stack.add_named(&trans_row, "transcribing");

// Row 3 — done: check + text preview
let (done_row, done_label) = build_done_row();
inner_stack.add_named(&done_row, "done");

stack.add_overlay(&inner_stack);
```

Each `build_*` returns a `gtk::Box` with widgets matching the design (rec dot is a small `DrawingArea` painted via cairo, spinner is a `gtk::Spinner`, dots are three `gtk::Label` with cyclic opacity via timer, check is a `DrawingArea`).

For brevity in this plan, here are the three builder functions in full:

```rust
fn build_recording_row<R: Runtime>(
    app: &tauri::AppHandle<R>,
    history: Arc<Mutex<Vec<f32>>>,
    elapsed_start: std::cell::Ref<RefCell<Option<std::time::Instant>>>,
) -> gtk::Box {
    use gtk::prelude::*;
    let row = gtk::Box::new(gtk::Orientation::Horizontal, 12);
    row.set_margin_start(16);
    row.set_margin_end(16);
    row.set_valign(gtk::Align::Center);

    // Rec dot
    let dot = gtk::DrawingArea::new();
    dot.set_size_request(10, 10);
    dot.set_valign(gtk::Align::Center);
    dot.connect_draw(|w, cr| {
        let sz = w.allocated_width().min(w.allocated_height()) as f64;
        let r = sz / 2.0;
        cr.set_source_rgb(247.0/255.0, 118.0/255.0, 142.0/255.0); // --rec
        cr.arc(r, r, r * 0.85, 0.0, std::f64::consts::TAU);
        let _ = cr.fill();
        glib::Propagation::Proceed
    });
    row.pack_start(&dot, false, false, 0);

    // Click to toggle (entire row clickable via the parent EventBox at create())
    let toggle_app = app.clone();
    dot.add_events(gtk::gdk::EventMask::BUTTON_PRESS_MASK);
    dot.connect_button_press_event(move |_, _| {
        request_toggle(&toggle_app);
        glib::Propagation::Stop
    });

    // Waveform
    let wave = gtk::DrawingArea::new();
    wave.set_hexpand(true);
    wave.set_size_request(-1, 22);
    wave.set_valign(gtk::Align::Center);
    let history_for_draw = history.clone();
    wave.connect_draw(move |w, cr| {
        paint_waveform_bars(w, cr, &history_for_draw);
        glib::Propagation::Proceed
    });
    row.pack_start(&wave, true, true, 0);

    // Duration label (mono)
    let dur = gtk::Label::new(Some("0:00"));
    dur.set_widget_name("vf-duration");
    dur.set_valign(gtk::Align::Center);
    dur.set_markup("<span font_family='monospace' size='11000' foreground='#9aa6b8'>0:00</span>");
    row.pack_start(&dur, false, false, 0);

    let _ = elapsed_start; // captured for the tick timer; the actual tick lives in start_polling
    row
}

fn build_transcribing_row(
    _elapsed: std::cell::Ref<RefCell<Option<std::time::Instant>>>,
) -> gtk::Box {
    use gtk::prelude::*;
    let row = gtk::Box::new(gtk::Orientation::Horizontal, 10);
    row.set_margin_start(16);
    row.set_margin_end(16);
    row.set_valign(gtk::Align::Center);

    let sp = gtk::Spinner::new();
    sp.set_size_request(14, 14);
    sp.start();
    row.pack_start(&sp, false, false, 0);

    let lbl = gtk::Label::new(None);
    lbl.set_markup("<span size='11500' foreground='#9aa6b8'>Transcribing</span>");
    row.pack_start(&lbl, false, false, 0);

    let dots = gtk::Label::new(None);
    dots.set_markup("<span foreground='#9aa6b8'>…</span>");
    row.pack_start(&dots, false, false, 0);

    let dur = gtk::Label::new(Some("0:00"));
    dur.set_markup("<span font_family='monospace' size='11000' foreground='#9aa6b8'>0:00</span>");
    let spacer = gtk::Box::new(gtk::Orientation::Horizontal, 0);
    spacer.set_hexpand(true);
    row.pack_start(&spacer, true, true, 0);
    row.pack_start(&dur, false, false, 0);

    row
}

fn build_done_row() -> (gtk::Box, gtk::Label) {
    use gtk::prelude::*;
    let row = gtk::Box::new(gtk::Orientation::Horizontal, 10);
    row.set_margin_start(16);
    row.set_margin_end(16);
    row.set_valign(gtk::Align::Center);

    let check = gtk::DrawingArea::new();
    check.set_size_request(18, 18);
    check.connect_draw(|w, cr| {
        let sz = w.allocated_width() as f64;
        let r = sz / 2.0;
        cr.set_source_rgba(125.0/255.0, 211.0/255.0, 160.0/255.0, 0.15); // --done @ 26
        cr.arc(r, r, r, 0.0, std::f64::consts::TAU);
        let _ = cr.fill();
        cr.set_source_rgb(125.0/255.0, 211.0/255.0, 160.0/255.0);
        cr.set_line_width(1.6);
        cr.move_to(sz * 0.30, sz * 0.55);
        cr.line_to(sz * 0.45, sz * 0.70);
        cr.line_to(sz * 0.72, sz * 0.35);
        let _ = cr.stroke();
        glib::Propagation::Proceed
    });
    row.pack_start(&check, false, false, 0);

    let lbl = gtk::Label::new(Some(""));
    lbl.set_ellipsize(gtk::pango::EllipsizeMode::End);
    lbl.set_max_width_chars(40);
    lbl.set_xalign(0.0);
    lbl.set_hexpand(true);
    row.pack_start(&lbl, true, true, 0);

    (row, lbl)
}
```

Then add the `pub fn set_state<R: Runtime>(app, state)` entry point and rewire the existing `set_overlay_visible(visible)` to delegate:

```rust
pub fn set_state<R: Runtime>(
    app: &tauri::AppHandle<R>,
    state: OverlayState,
) -> Result<(), String> {
    let app_for_main = app.clone();
    let state_for_main = state.clone();
    app.run_on_main_thread(move || {
        OVERLAY.with(|cell| {
            let Some(ov_ref) = cell.borrow().as_ref().map(|o| (
                o.window.clone(),
                o.history.clone(),
                o.elapsed_start.clone(),
                o.auto_hide.clone(),
                o.state.clone(),
                o.bg.clone(),
            )) else { return; };
            let (window, history, elapsed_start, auto_hide, state_cell, _bg) = ov_ref;

            // Cancel any pending auto-hide.
            if let Some(id) = auto_hide.borrow_mut().take() {
                id.remove();
            }

            *state_cell.borrow_mut() = state_for_main.clone();

            match &state_for_main {
                OverlayState::Hidden => {
                    window.hide();
                    stop_polling();
                    *elapsed_start.borrow_mut() = None;
                }
                OverlayState::Recording => {
                    *elapsed_start.borrow_mut() = Some(std::time::Instant::now());
                    set_inner_stack(&window, "recording");
                    window.show_all();
                    start_polling(&app_for_main, history);
                }
                OverlayState::Transcribing => {
                    set_inner_stack(&window, "transcribing");
                    stop_polling();
                    window.show_all();
                }
                OverlayState::Done(text) => {
                    set_done_text(&window, text);
                    set_inner_stack(&window, "done");
                    stop_polling();
                    window.show_all();

                    // Auto-hide after 2s.
                    let app_after = app_for_main.clone();
                    let id = glib::timeout_add_local_once(
                        std::time::Duration::from_millis(2000),
                        move || {
                            let _ = set_state_internal(&app_after, OverlayState::Hidden);
                        },
                    );
                    *auto_hide.borrow_mut() = Some(id);
                }
            }
        });
    })
    .map_err(|e| e.to_string())
}

fn set_state_internal<R: Runtime>(
    app: &tauri::AppHandle<R>,
    state: OverlayState,
) -> Result<(), String> { set_state(app, state) }

fn set_inner_stack(window: &gtk::Window, name: &str) {
    use gtk::prelude::*;
    if let Some(child) = window.child() {
        for w in walk_all(&child) {
            if let Ok(stack) = w.dynamic_cast::<gtk::Stack>() {
                stack.set_visible_child_name(name);
                return;
            }
        }
    }
}

fn set_done_text(window: &gtk::Window, text: &str) {
    use gtk::prelude::*;
    if let Some(child) = window.child() {
        for w in walk_all(&child) {
            if w.widget_name() == "vf-done-label" {
                if let Ok(lbl) = w.dynamic_cast::<gtk::Label>() {
                    lbl.set_text(text);
                    return;
                }
            }
        }
    }
}

fn walk_all(root: &gtk::Widget) -> Vec<gtk::Widget> {
    use gtk::prelude::*;
    let mut out = vec![root.clone()];
    if let Some(c) = root.dynamic_cast_ref::<gtk::Container>() {
        for child in c.children() {
            out.extend(walk_all(&child));
        }
    }
    out
}

// Keep the old shim so the React side keeps working while we transition:
pub fn set_overlay_visible<R: Runtime>(
    app: &tauri::AppHandle<R>,
    visible: bool,
) -> Result<(), String> {
    if visible {
        set_state(app, OverlayState::Recording)
    } else {
        set_state(app, OverlayState::Hidden)
    }
}
```

(Tag the `done` row's label with `set_widget_name("vf-done-label")` inside `build_done_row()` so `set_done_text` can find it.)

- [ ] **Step 2:** In `src-tauri/src/commands.rs`, route the three states from the recording flow:

```rust
#[tauri::command]
pub fn start_recording(state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    state.set_state(RecordingState::Recording);
    let mut recorder = state.recorder.lock();
    recorder.start().map_err(|e| e.to_string())?;
    let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Recording);
    set_tray_recording(&app, true);
    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, AppState>, app: AppHandle) -> Result<Vec<u8>, String> {
    let mut recorder = state.recorder.lock();
    recorder.stop().map_err(|e| e.to_string())?;
    let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Transcribing);
    set_tray_recording(&app, false);
    recorder.get_wav_bytes().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn transcribe(
    audio_bytes: Vec<u8>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    state.set_state(RecordingState::Processing);
    let config = state.config.lock();
    let client = TranscribeClient::new(
        config.openai_api_key.clone(),
        config.openai_api_base.clone(),
        config.model.clone(),
    );
    let language = config.language.clone();
    drop(config);
    let text = tauri::async_runtime::block_on(async {
        client.transcribe(audio_bytes, &language).await
    })
    .map_err(|e| e.to_string())?;
    state.set_state(RecordingState::Idle);

    let preview = if text.trim().is_empty() {
        "Empty transcription".to_string()
    } else if text.len() > 80 {
        format!("{}…", &text[..78])
    } else {
        text.clone()
    };
    let _ = crate::overlay::set_state(&app, crate::overlay::OverlayState::Done(preview));

    Ok(text)
}
```

- [ ] **Step 3:** Build.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -10
```

Iterate on compile errors (most likely import paths for `gtk::Stack`, `gtk::Spinner`, `gtk::pango::EllipsizeMode`).

- [ ] **Step 4:** Commit.

```bash
git add src-tauri/src/overlay.rs src-tauri/src/commands.rs
git commit -m "feat(overlay): three states (recording / transcribing / done)"
```

---

## Task 10: Window chrome — borderless, rounded

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/index.css`

The design wants a borderless 14px-radius window. Tauri can request that via `decorations: false` + `transparent: true`.

- [ ] **Step 1:** Read `src-tauri/tauri.conf.json` and update the `main` window block:

```json
{
  "label": "main",
  "title": "VoxForge",
  "width": 780,
  "height": 620,
  "minWidth": 640,
  "minHeight": 500,
  "resizable": true,
  "fullscreen": false,
  "visible": true,
  "center": true,
  "decorations": false,
  "transparent": true
}
```

- [ ] **Step 2:** Add the chrome styles to `src/index.css` (header bar with traffic lights, title centred). The original design shows a custom header bar; we render it in React inside `App.tsx`. Insert the header into App.tsx **above** `<Tabs>`:

```tsx
<div className="window-chrome">
  <div className="window-title">VoxForge</div>
  <div className="window-buttons">
    <button className="winbtn winbtn-min" aria-label="Minimize" onClick={() => getCurrentWindow().minimize()}>
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
    </button>
    <button className="winbtn winbtn-max" aria-label="Maximize" onClick={() => getCurrentWindow().toggleMaximize()}>
      <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg>
    </button>
    <button className="winbtn winbtn-close" aria-label="Close" onClick={() => getCurrentWindow().close()}>
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
    </button>
  </div>
</div>
```

CSS:

```css
.app {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--windowBorder);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
[data-theme="light"] .app {
  box-shadow: 0 24px 60px rgba(15, 20, 25, 0.18);
}
.window-chrome {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px 0 16px;
  background: var(--headerBg);
  border-bottom: 1px solid var(--divider);
  position: relative;
  -webkit-app-region: drag;
}
.window-title {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--fgMuted);
  pointer-events: none;
}
.window-buttons {
  margin-left: auto;
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}
.winbtn {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: var(--fgMuted);
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
[data-theme="light"] .winbtn { background: rgba(15, 20, 25, 0.06); color: #5a6678; }
```

Update `app` grid to four rows: `auto auto 1fr auto` (chrome / tabs / page / status). Update the rule:

```css
.app {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  height: 100vh;
  background: var(--bg);
}
```

- [ ] **Step 3:** Add `tauri-plugin-window` capability to support `minimize`/`toggleMaximize`/`close` in `src-tauri/capabilities/default.json`:

```json
"core:window:allow-minimize",
"core:window:allow-toggle-maximize",
"core:window:allow-close",
```

(`core:window:allow-close` is likely already there.)

- [ ] **Step 4:** Build and visually confirm the window opens borderless with our custom chrome.

```bash
npm run build:frontend && cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
pkill voxforge 2>/dev/null; sleep 1
src-tauri/target/debug/voxforge &
sleep 4
pkill voxforge 2>/dev/null
```

- [ ] **Step 5:** Commit.

```bash
git add src-tauri/tauri.conf.json src-tauri/capabilities/default.json src/App.tsx src/index.css
git commit -m "feat(ui): borderless window with custom chrome"
```

---

## Task 11: Smoke test the redesign end-to-end

**Files:** none — runtime verification.

- [ ] **Step 1:** Build a fresh debug binary and run it.

```bash
pkill voxforge 2>/dev/null; sleep 1
RUST_LOG=voxforge=info src-tauri/target/debug/voxforge > /tmp/voxforge-redesign.log 2>&1 &
APP_PID=$!
sleep 5
```

- [ ] **Step 2:** Trigger the recording flow via the IPC helper (no microphone needed; we just exercise the UI transitions).

```bash
src-tauri/target/debug/voxforge-ctl start
sleep 2
src-tauri/target/debug/voxforge-ctl stop
sleep 3
```

Visually confirm:
- Main window opens **borderless, dark**, with the redesigned tabs and the new mic hero on Record.
- Switching to History shows the split list+detail with empty state if no history yet.
- Settings shows the four sections, toggles work, theme switch flips dark↔light immediately.
- Overlay during recording is the rec-dot + waveform pill; transitions to a `Transcribing` spinner row, then a `Done` row showing the text preview, then auto-hides.

- [ ] **Step 3:** Kill the app.

```bash
pkill voxforge 2>/dev/null; sleep 1
```

- [ ] **Step 4:** Inspect the log for warnings.

```bash
grep -E "WARN|ERROR" /tmp/voxforge-redesign.log
```

Expect: nothing about overlay; the existing portal-shortcut WARN line is fine.

- [ ] **Step 5:** Build the production deb so we have a tagged artifact.

```bash
npm run build 2>&1 | tail -8
```

Expect: a fresh `.deb` and `.AppImage` produced.

- [ ] **Step 6:** Commit any final polish you found from visual testing.

```bash
git status
# git add … && git commit -m "polish: …" if anything is dirty
```

---

## Task 12: Final cleanup verification

**Files:** none — repository hygiene.

- [ ] **Step 1:** Confirm there are no orphan references to deleted files or old design tokens.

```bash
grep -rn "components/Recording\|components/Settings\|components/History\|--bgElevated\|--bgHover\|--accentStrong\|Atom One Dark" src/ src-tauri/src/ 2>&1 | grep -v node_modules
```

Expected: empty (or only matches inside comments — judge case-by-case).

- [ ] **Step 2:** Confirm the redesign test passes:

```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib 2>&1 | tail -3
```

Expected: `test result: ok. 1 passed`.

- [ ] **Step 3:** Recap commits since the rollback point `71099f6`.

```bash
git log --oneline 71099f6..HEAD
```

Expected: 9–10 commits matching the task headers.
