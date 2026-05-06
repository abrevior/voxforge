# Native GTK Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WebKit-based recording overlay with a native GTK window so the overlay can be any size (current WebKit2GTK 4.1 silently clamps it to ≥132×170 px on Wayland and X11).

**Architecture:** Overlay becomes a plain `gtk::Window` (no WebView, no React, no HTML/CSS) created at startup on the GTK main thread. Inside it: a horizontal `GtkBox` with a `GtkButton` (orb) and a `GtkDrawingArea` (waveform painted via cairo). State changes from the rest of the app come in over a `glib::Sender` channel; show/hide is invoked from Tauri commands using `app_handle.run_on_main_thread()`, which on Linux runs on the same thread as the GTK main loop. The waveform drawing reads RMS samples from `AppState.recorder` on a 33 ms `glib::timeout_add_local`.

**Tech Stack:** Rust, gtk-rs (gtk 0.18 — already a dep), cairo (transitive), Tauri 2, glib channels, parking_lot Mutex (already a dep). Frontend: React (existing main window only — overlay no longer involves the frontend at all).

---

## File Map

- **Replace** `src-tauri/src/overlay.rs` — drop all the debug instrumentation and the WebView-based builder; reimplement as native GTK window controller. Module name stays the same so `lib.rs` and external callers don't change.
- **Modify** `src-tauri/src/main.rs` — drop the temp debug block (force-show, dump_widget_tree); call new `overlay::create(app)` once in `setup()`.
- **Modify** `src-tauri/src/commands.rs` — `set_overlay_visible` and `toggle_recording` keep their signatures; their body now goes through `overlay::set_visible` / `overlay::toggle_request`.
- **Modify** `src-tauri/Cargo.toml` — drop `webkit2gtk` (no longer needed). Keep `gtk = "0.18"` as a target-specific dep.
- **Delete** `src/components/Overlay.tsx`.
- **Modify** `src/main.tsx` — drop the `?overlay=1` routing and the `overlay-root` class; mount `<App/>` unconditionally.
- **Modify** `src/App.tsx` — remove the `emit("recording:state", ...)` call (the overlay no longer listens for it). Keep the `set_overlay_visible` invoke; the Rust side reroutes to native overlay.
- **Modify** `src/index.css` — delete the `.overlay-*` and `html.overlay-root` blocks (lines ~632–729).
- **Modify** `src-tauri/capabilities/default.json` — remove `"overlay"` from `windows` (no Tauri webview window any more).

---

## Task 1: Snapshot current state, branch isolation

**Files:** none — git only.

- [ ] **Step 1:** Make sure we're on a clean working tree for the experiment. We expect uncommitted in-progress work; stash it.

```bash
cd /home/serhiikolesnyk/projects/voxforge
git status
git stash push -u -m "wip: webview-overlay debug session pre-native-rewrite"
git status   # should be clean
```

- [ ] **Step 2:** Confirm we're back on the last clean commit so the new work starts from a known base.

```bash
git log --oneline -3
# Expect: 1194ee1 feat: working tray, hotkeys, capabilities, and Atom One Dark UI
```

---

## Task 2: Drop WebView overlay and the temporary debug code

**Files:**
- Replace: `src-tauri/src/overlay.rs`
- Modify: `src-tauri/src/main.rs` — remove temp debug spawn, keep `create_overlay_window` call (will be re-pointed in Task 4)
- Modify: `src-tauri/Cargo.toml` — drop `webkit2gtk` dep, keep `gtk`

- [ ] **Step 1:** Replace `src-tauri/src/overlay.rs` with a stub that compiles but does nothing yet:

```rust
//! Recording-state overlay window. Currently a stub; replaced with a
//! native GTK implementation in Task 3.

use tauri::{AppHandle, Manager, Runtime};

pub fn create<R: Runtime, M: Manager<R>>(_manager: &M) -> tauri::Result<()> {
    Ok(())
}

pub fn set_overlay_visible(_app: &AppHandle, _visible: bool) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 2:** Edit `src-tauri/src/main.rs` — remove the entire `tauri::async_runtime::spawn(async move { ... 800ms POST-SHOW ... })` debug block (everything between `// TEMP DEBUG: force-show overlay shortly after startup` and the closing `});`). Replace the line `let _overlay = voxforge::overlay::create_overlay_window(app)?;` with `voxforge::overlay::create(app)?;`.

- [ ] **Step 3:** Edit `src-tauri/Cargo.toml` — change the Linux target deps block to:

```toml
[target.'cfg(target_os = "linux")'.dependencies]
gtk = "0.18"
```

(Remove `webkit2gtk = "2.0"`.)

- [ ] **Step 4:** Build and confirm it compiles cleanly.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
# Expect: Finished `dev` profile [unoptimized + debuginfo]
```

- [ ] **Step 5:** Commit checkpoint.

```bash
git add src-tauri/src/overlay.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "refactor: stub out webview overlay before native rewrite"
```

---

## Task 3: Implement native GTK overlay window

**Files:**
- Replace: `src-tauri/src/overlay.rs`

This is the core of the rewrite. The window is created exactly once on the GTK main thread (in `create()`), stored in a thread-local. All show/hide/state-change requests come in via `AppHandle::run_on_main_thread`, which on Linux dispatches onto the GTK thread and can therefore reach the thread-local.

- [ ] **Step 1:** Write the full overlay module:

```rust
//! Native GTK recording overlay.
//!
//! Plain `gtk::Window` (no WebView), so the size is not clamped by
//! WebKit2GTK widget allocation. Cairo-painted waveform inside.

use std::cell::RefCell;
use std::sync::Arc;

use parking_lot::Mutex;
use tauri::{AppHandle, Manager, Runtime};

use crate::state::{AppState, RecordingState};

const W: i32 = 220;
const H: i32 = 32;
const BARS: usize = 28;
const BOTTOM_MARGIN: i32 = 80;
const RMS_TICK_MS: u32 = 33;

#[cfg(target_os = "linux")]
mod imp {
    use super::*;
    use gtk::cairo::Context;
    use gtk::gdk::WindowTypeHint;
    use gtk::glib;
    use gtk::prelude::*;

    struct Overlay {
        window: gtk::Window,
        history: Arc<Mutex<Vec<f32>>>,
        timer: RefCell<Option<glib::SourceId>>,
        recording: RefCell<bool>,
    }

    thread_local! {
        static OVERLAY: RefCell<Option<Overlay>> = const { RefCell::new(None) };
    }

    pub fn create(app: &AppHandle) -> tauri::Result<()> {
        let _ = app; // app handle reachable via run_on_main_thread later
        let window = gtk::Window::new(gtk::WindowType::Toplevel);
        window.set_title("VoxForge — Recording");
        window.set_decorated(false);
        window.set_resizable(false);
        window.set_skip_taskbar_hint(true);
        window.set_skip_pager_hint(true);
        window.set_keep_above(true);
        window.set_accept_focus(false);
        window.set_type_hint(WindowTypeHint::Utility);
        window.set_app_paintable(true);
        if let Some(screen) = window.screen() {
            if let Some(visual) = screen.rgba_visual() {
                window.set_visual(Some(&visual));
            }
        }
        window.set_default_size(W, H);
        window.set_size_request(W, H);

        // Position bottom-center on the primary monitor (best effort).
        if let Some(display) = gtk::gdk::Display::default() {
            if let Some(monitor) = display.primary_monitor() {
                let geo = monitor.geometry();
                let x = geo.x() + (geo.width() - W) / 2;
                let y = geo.y() + geo.height() - H - BOTTOM_MARGIN;
                window.move_(x, y);
            }
        }

        let hbox = gtk::Box::new(gtk::Orientation::Horizontal, 6);
        hbox.set_margin_start(8);
        hbox.set_margin_end(8);
        hbox.set_margin_top(4);
        hbox.set_margin_bottom(4);

        let orb = gtk::Button::with_label("🎙");
        orb.set_relief(gtk::ReliefStyle::None);
        orb.set_size_request(20, 20);
        let toggle_app = app.clone();
        orb.connect_clicked(move |_| {
            request_toggle(&toggle_app);
        });
        hbox.pack_start(&orb, false, false, 0);

        let history = Arc::new(Mutex::new(vec![0.0f32; BARS]));
        let drawing = gtk::DrawingArea::new();
        drawing.set_hexpand(true);
        drawing.set_vexpand(true);
        let history_for_draw = history.clone();
        drawing.connect_draw(move |widget, cr| {
            paint_waveform(widget, cr, &history_for_draw);
            glib::Propagation::Proceed
        });
        hbox.pack_start(&drawing, true, true, 0);

        window.add(&hbox);

        OVERLAY.with(|cell| {
            *cell.borrow_mut() = Some(Overlay {
                window: window.clone(),
                history: history.clone(),
                timer: RefCell::new(None),
                recording: RefCell::new(false),
            });
        });

        Ok(())
    }

    pub fn set_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
        let app_for_main = app.clone();
        app.run_on_main_thread(move || {
            OVERLAY.with(|cell| {
                let Some(ov) = cell.borrow().as_ref().map(clone_handles) else {
                    return;
                };
                if visible {
                    ov.window.show_all();
                    start_polling(&app_for_main);
                } else {
                    ov.window.hide();
                    stop_polling();
                }
            });
        })
        .map_err(|e| e.to_string())
    }

    fn clone_handles(o: &Overlay) -> Overlay {
        Overlay {
            window: o.window.clone(),
            history: o.history.clone(),
            timer: RefCell::new(None),
            recording: RefCell::new(*o.recording.borrow()),
        }
    }

    fn start_polling(app: &AppHandle) {
        let app_for_tick = app.clone();
        OVERLAY.with(|cell| {
            let Some(ov) = cell.borrow().as_ref() else { return };
            // Cancel any existing timer first.
            if let Some(id) = ov.timer.borrow_mut().take() {
                id.remove();
            }
            let history = ov.history.clone();
            let id = glib::timeout_add_local(
                std::time::Duration::from_millis(RMS_TICK_MS as u64),
                move || {
                    let rms = read_rms(&app_for_tick);
                    {
                        let mut h = history.lock();
                        h.rotate_left(1);
                        let n = h.len();
                        h[n - 1] = rms;
                    }
                    OVERLAY.with(|cell| {
                        if let Some(ov) = cell.borrow().as_ref() {
                            ov.window.queue_draw();
                        }
                    });
                    glib::ControlFlow::Continue
                },
            );
            *ov.timer.borrow_mut() = Some(id);
        });
    }

    fn stop_polling() {
        OVERLAY.with(|cell| {
            if let Some(ov) = cell.borrow().as_ref() {
                if let Some(id) = ov.timer.borrow_mut().take() {
                    id.remove();
                }
                let mut h = ov.history.lock();
                for v in h.iter_mut() {
                    *v = 0.0;
                }
            }
        });
    }

    fn read_rms(app: &AppHandle) -> f32 {
        let state: tauri::State<'_, AppState> = app.state();
        let recorder = state.recorder.lock();
        recorder.get_rms_level()
    }

    fn request_toggle(app: &AppHandle) {
        let state: tauri::State<'_, AppState> = app.state();
        match state.get_state() {
            RecordingState::Idle => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.hide();
                }
                let _ = tauri::Emitter::emit(app, "hotkey:start", ());
            }
            RecordingState::Recording => {
                let _ = tauri::Emitter::emit(app, "hotkey:stop", ());
            }
            RecordingState::Processing => {}
        }
    }

    fn paint_waveform(
        widget: &gtk::DrawingArea,
        cr: &Context,
        history: &Arc<Mutex<Vec<f32>>>,
    ) {
        let alloc = widget.allocation();
        let w = alloc.width() as f64;
        let h = alloc.height() as f64;

        // Background pill — translucent dark.
        cr.set_source_rgba(0.13, 0.16, 0.20, 0.92);
        rounded_rect(cr, 0.0, 0.0, w, h, 6.0);
        let _ = cr.fill();

        let snap: Vec<f32> = history.lock().clone();
        let n = snap.len() as f64;
        if n < 1.0 {
            return;
        }
        let bar_w = (w / n).max(1.0) - 1.0;
        for (i, v) in snap.iter().enumerate() {
            let pct = ((*v as f64) * 2.2).clamp(0.04, 1.0);
            let bar_h = pct * h * 0.85;
            let x = i as f64 * (bar_w + 1.0);
            let y = (h - bar_h) / 2.0;
            let fade = 0.25 + 0.75 * (i as f64 / (n - 1.0));
            cr.set_source_rgba(0.38, 0.69, 0.94, fade);
            cr.rectangle(x, y, bar_w, bar_h);
            let _ = cr.fill();
        }
    }

    fn rounded_rect(cr: &Context, x: f64, y: f64, w: f64, h: f64, r: f64) {
        let r = r.min(w / 2.0).min(h / 2.0);
        cr.new_sub_path();
        cr.arc(x + w - r, y + r, r, -std::f64::consts::FRAC_PI_2, 0.0);
        cr.arc(x + w - r, y + h - r, r, 0.0, std::f64::consts::FRAC_PI_2);
        cr.arc(x + r, y + h - r, r, std::f64::consts::FRAC_PI_2, std::f64::consts::PI);
        cr.arc(x + r, y + r, r, std::f64::consts::PI, 1.5 * std::f64::consts::PI);
        cr.close_path();
    }
}

#[cfg(target_os = "linux")]
pub fn create<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<()> {
    let app = manager.app_handle().clone();
    imp::create(&app)
}

#[cfg(target_os = "linux")]
pub fn set_overlay_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    imp::set_visible(app, visible)
}

#[cfg(not(target_os = "linux"))]
pub fn create<R: Runtime, M: Manager<R>>(_manager: &M) -> tauri::Result<()> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn set_overlay_visible(_app: &AppHandle, _visible: bool) -> Result<(), String> {
    Ok(())
}
```

- [ ] **Step 2:** Build and fix any compiler errors.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -25
```

Expected: clean build. Common issues to fix: import paths for `gtk::cairo::Context`, gtk-rs API differences in 0.18 (e.g. `glib::ControlFlow::Continue` vs `glib::Continue(true)` — gtk 0.18 uses `glib::ControlFlow`).

- [ ] **Step 3:** Commit checkpoint.

```bash
git add src-tauri/src/overlay.rs
git commit -m "feat: native GTK overlay with cairo waveform"
```

---

## Task 4: Wire commands and main.rs to the new overlay

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/commands.rs`

- [ ] **Step 1:** In `src-tauri/src/main.rs`, ensure the `setup` body calls `voxforge::overlay::create(app)?;` (already true after Task 2 if you replaced the line) and contains no temp debug spawn. Read main.rs and verify.

- [ ] **Step 2:** In `src-tauri/src/commands.rs`, the existing `set_overlay_visible` already delegates to `crate::overlay::set_overlay_visible`. Verify the import path still compiles. No changes expected.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
```

Expected: clean build.

---

## Task 5: Strip overlay from frontend

**Files:**
- Delete: `src/components/Overlay.tsx`
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1:** Delete the Overlay React component.

```bash
rm src/components/Overlay.tsx
```

- [ ] **Step 2:** Replace `src/main.tsx` with the un-routed version:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3:** In `src/App.tsx`, delete the `emit("recording:state", recordingState)` call from the `useEffect` that drives the overlay. Also drop the `import { emit } from "@tauri-apps/api/event";` if it's no longer used elsewhere. Keep the `invoke("set_overlay_visible", { visible: recordingState !== "idle" })` call — that still drives the native overlay.

- [ ] **Step 4:** In `src/index.css`, delete everything from the comment line `/* Floating recording overlay window */` (line ~632) through the `.overlay-wave-bar { ... }` block (~line 729). The native overlay does its own painting, no CSS involved.

- [ ] **Step 5:** In `src-tauri/capabilities/default.json`, remove `"overlay"` from the `windows` array (so the entry becomes `"windows": ["main"]`). Also drop the `"core:window:allow-set-size"` permission — it was only added for the overlay.

- [ ] **Step 6:** Rebuild frontend and Rust together to catch any leftover overlay refs.

```bash
npx vite build 2>&1 | tail -3
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -3
```

Both should finish clean.

- [ ] **Step 7:** Commit.

```bash
git add src/main.tsx src/App.tsx src/index.css src-tauri/capabilities/default.json
git commit -m "refactor: drop frontend overlay window — native GTK takes over"
```

---

## Task 6: Smoke test the new overlay

**Files:** none — runtime verification.

- [ ] **Step 1:** Run the binary and trigger an overlay show/hide cycle via the IPC socket helper. (No need to actually record; the recording start path is what reveals/hides the overlay.)

```bash
pkill voxforge 2>/dev/null; sleep 1
RUST_LOG=voxforge=info src-tauri/target/debug/voxforge > /tmp/voxforge-overlay-smoke.log 2>&1 &
APP_PID=$!
sleep 3
src-tauri/target/debug/voxforge-ctl start
sleep 2
src-tauri/target/debug/voxforge-ctl stop
sleep 2
kill $APP_PID 2>/dev/null
wait $APP_PID 2>/dev/null
tail -30 /tmp/voxforge-overlay-smoke.log
```

- [ ] **Step 2:** Visually confirm during the 2-second window after `start`:
  - A small (~220×32) pill-shaped overlay appears bottom-center of the primary monitor.
  - The waveform bars animate live.
  - After `stop`, the overlay disappears.
  - No giant 132×170 box.

- [ ] **Step 3:** If size is wrong, dump it explicitly. From inside the running app, check size via the `xdotool getwindowgeometry` of the matching window name:

```bash
xdotool search --name "VoxForge — Recording" getwindowgeometry
# Expect: Geometry: 220x32 (or whatever W×H constants we set)
```

---

## Task 7: Final commit and cleanup

**Files:** none — git only.

- [ ] **Step 1:** Confirm there are no stray references to `Overlay.tsx`, `?overlay=1`, `overlay-root`, or `webkit2gtk` left in the repo.

```bash
grep -rn "Overlay\b\|overlay-root\|?overlay=1\|webkit2gtk" src src-tauri/src src-tauri/Cargo.toml src/index.css
# Expect: no matches (or only in our own new overlay.rs comments).
```

- [ ] **Step 2:** Confirm full debug build succeeds and no warnings introduced.

```bash
cargo build --manifest-path src-tauri/Cargo.toml --bin voxforge 2>&1 | tail -10
```

- [ ] **Step 3:** If the smoke test in Task 6 passed visually and the size is right, the work is done. Anything left from the original webview-overlay debug session (the stash from Task 1) can be inspected but should be discarded — its sole purpose was diagnosis.

```bash
git stash list
# Optional: drop the stash if you don't want to keep it
# git stash drop stash@{0}
```
