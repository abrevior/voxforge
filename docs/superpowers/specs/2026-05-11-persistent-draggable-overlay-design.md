# Persistent draggable overlay — design

Date: 2026-05-11
Status: approved (pending spec review)

## Goal

Make the recording overlay a reliable, persistent, always-on-top floating
widget:

1. Fix the bug where the overlay fails to show the **Transcribing** state and
   the post-transcription **result** (it currently disappears immediately when
   recording ends).
2. The overlay is **always visible** (while enabled), never auto-hides; after
   showing the result it returns to a calm **Idle** state instead of hiding.
3. Always on top of all windows; not shown in alt-tab / taskbar.
4. **Draggable** with the mouse; remembers its position across sessions.

## Root cause of the current bug

The overlay has **two competing sources of truth**:

- Rust commands set the overlay state directly:
  `start_recording` → `Recording`, `stop_recording` → `Transcribing`,
  `transcribe` → `Done(preview)` (with a 2.2 s auto-hide → `Hidden`).
- The React frontend has `useEffect([recordingState])` (`src/App.tsx:86-96`)
  that calls `invoke("set_overlay_visible", { visible: recordingState !== "idle" })`
  on every recording-state change, and `set_overlay_visible` forces the overlay
  to `Recording` (visible) or `Hidden` (not visible).

When `transcribe` returns, React runs `setRecordingState("idle")` →
`set_overlay_visible(false)` → `OverlayState::Hidden`, clobbering the `Done`
state that was just set on the Rust side. The user never sees the result, and
similar races can drop the `Transcribing` state too.

## Chosen approach

**Rust is the single source of truth for overlay state.** The React-driven
`set_overlay_visible` effect is removed. Overlay state is a pure function of the
same events the recording flow already handles (`start` / `stop` / `transcribe`)
plus the persisted config at startup.

Alternatives considered and rejected:

- *React owns a full overlay-state enum* (`set_overlay_state("recording" | ...)`):
  more IPC chatter, and React would need to carry the preview text and error
  messages that the Rust commands already have in hand.
- *Rust ignores `set_overlay_visible` while in a transient state*: fragile,
  hidden coupling between unrelated calls.

## Changes

### 1. `src-tauri/src/overlay.rs` — add a visible `Idle` state

- `OverlayState` becomes: `Hidden` (window not shown at all — used when
  `show_overlay = false`), `Idle` (window shown, calm look), `Recording`,
  `Transcribing`, `Done(String)`.
- Add a 4th named child to the `gtk::Stack`, `"idle"`: a muted mic dot plus a
  `VoxForge` label. **The window stays 280×36 in every state** — no resize
  logic, so the bar is always the same easy-to-grab target.
- The `Done(text)` auto-timer transitions to **`Idle`, not `Hidden`** (bump the
  delay to ~3 s).
- `set_state(Idle)`: stop RMS polling, stop spinner, clear waveform history,
  set stack child to `"idle"`, keep the window shown.
- After every `show_all()`, re-assert `window.set_keep_above(true)` for WMs that
  drop the hint on map.

### 2. Drag + click-to-toggle (GTK, on the existing `EventBox`)

- Enable events: `BUTTON_PRESS_MASK | BUTTON_RELEASE_MASK | POINTER_MOTION_MASK
  | BUTTON1_MOTION_MASK`.
- `button_press_event` (button 1): record the press root position and time;
  clear a `dragged` flag.
- `motion_notify_event`: if button 1 is held, the pointer has moved more than
  ~4 px from the press point, and we are not already dragging → call
  `window.begin_move_drag(1, root_x, root_y, time)` and set `dragged = true`.
- `button_release_event` (button 1): if `!dragged` → `request_toggle(app)`
  (unchanged behaviour: `Idle` → emit `hotkey:start`; `Recording` → emit
  `hotkey:stop`; `Processing` → no-op). Reset the press/`dragged` state.

### 3. Always-on-top / not in alt-tab

Keep the existing window setup — `WindowTypeHint::Utility`,
`set_keep_above(true)`, `set_skip_taskbar_hint(true)`, `set_skip_pager_hint(true)`,
`set_accept_focus(false)` — which is the correct combination for a draggable
tool window that stays out of alt-tab. The only addition is re-asserting
`set_keep_above(true)` after `show_all()` (see §1).

Rejected: switching to `WindowTypeHint::Notification` — guarantees exclusion
from alt-tab but breaks pointer input / drag on some window managers.

### 4. Persisted position

- `src-tauri/src/config.rs`: add `overlay_x: Option<i32>` and
  `overlay_y: Option<i32>`, both `#[serde(default)]` → `None`.
- `src/types/api.ts`: add `overlay_x: number | null` and `overlay_y: number | null`
  to the `Config` type.
- `overlay::create()`: if both `overlay_x` and `overlay_y` are present, use them
  in `window.move_(x, y)`; otherwise compute the current default (bottom-center
  of the primary monitor).
- Save on move: connect `configure-event` on the window. On each event, (re)arm a
  `glib::timeout_add_local` ~600 ms debounce; when it fires, read
  `window.position()`, lock `state.config`, update `overlay_x` / `overlay_y`,
  and call `config.save()`. Debounced so the file is not rewritten on every
  pixel of a drag.

### 5. React / Settings

- `src/App.tsx`: **delete** the `useEffect([recordingState])` block that calls
  `set_overlay_visible` (lines 86–96). Nothing else in React touches the
  overlay.
- `set_overlay_visible(visible)` command stays, with new semantics:
  `true` → `OverlayState::Idle`, `false` → `OverlayState::Hidden`. It is now
  invoked only from `SettingsTab` when the existing `show_overlay` toggle
  changes (the toggle currently only writes config; add
  `invoke("set_overlay_visible", { visible })` alongside).
- `src-tauri/src/main.rs`: after `voxforge::overlay::create(app)?`, if
  `config.show_overlay` is true call
  `overlay::set_state(app, OverlayState::Idle)`; otherwise leave it `Hidden`.
- `src-tauri/src/ipc.rs`: `overlay-hide` keeps mapping to `Hidden` (dev/test
  command); other `overlay-*` IPC commands are unchanged.

## Resulting flow

`Idle` (shown at startup, if `show_overlay`) → click overlay or press hotkey →
`Recording` (waveform + duration) → release → `Transcribing` (spinner) →
`transcribe` ok/err → `Done(preview)` for ~3 s → `Idle`.

The window never disappears while `show_overlay` is true, stays above other
windows, is draggable with the mouse, and reopens at its last position.

## Tests

- Rust unit tests:
  - `Done`-timer transition targets `Idle`, not `Hidden`.
  - `Config` deserializes with and without `overlay_x` / `overlay_y`
    (`None` when absent).
  - Default overlay position is computed when `overlay_x` / `overlay_y` are
    `None`.
- GTK/drag behaviour is verified manually via `cargo tauri dev` (not unit
  testable on this stack).

## Out of scope

- Real text translation (no translation feature exists today).
- Wiring up the other currently-unused config flags (`auto_paste`,
  `punctuation`).
