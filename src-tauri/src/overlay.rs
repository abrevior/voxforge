//! Native GTK recording overlay.
//!
//! Plain `gtk::Window` (not a Tauri WebviewWindow), because the WebKit2GTK
//! widget enforces an internal min size of ~132x170 px on this stack, and no
//! amount of `set_size`, `min_inner_size`, geometry hints or widget
//! `set_size_request(0,0)` overrides it. With native GTK the size is whatever
//! we ask for.
//!
//! Lifecycle:
//!   - `create()` runs once in `setup()`, on the GTK main thread, and stashes
//!     the window in a thread-local.
//!   - `set_overlay_visible()` may be called from any thread; it dispatches
//!     onto the GTK main thread via `AppHandle::run_on_main_thread` so it
//!     can reach the thread-local.

use tauri::{Manager, Runtime};

pub const W: i32 = 220;
pub const H: i32 = 32;
const BARS: usize = 28;
const BOTTOM_MARGIN: i32 = 80;
const RMS_TICK_MS: u64 = 33;

#[cfg(target_os = "linux")]
mod imp {
    use super::*;
    use std::cell::RefCell;
    use std::sync::Arc;

    use gtk::cairo::Context;
    use gtk::gdk::WindowTypeHint;
    use gtk::glib;
    use gtk::prelude::*;
    use parking_lot::Mutex;

    use crate::state::{AppState, RecordingState};

    struct Overlay {
        window: gtk::Window,
        history: Arc<Mutex<Vec<f32>>>,
        timer: RefCell<Option<glib::SourceId>>,
    }

    thread_local! {
        static OVERLAY: RefCell<Option<Overlay>> = const { RefCell::new(None) };
    }

    pub fn create<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
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
        if let Some(screen) = GtkWindowExt::screen(&window) {
            if let Some(visual) = screen.rgba_visual() {
                window.set_visual(Some(&visual));
            }
        }
        window.set_default_size(W, H);
        window.set_size_request(W, H);

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

        let history: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(vec![0.0; BARS]));
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
        // Pre-realize the children so the first show_all() doesn't flicker.
        hbox.show_all();

        OVERLAY.with(|cell| {
            *cell.borrow_mut() = Some(Overlay {
                window,
                history,
                timer: RefCell::new(None),
            });
        });

        Ok(())
    }

    pub fn set_visible<R: Runtime>(app: &tauri::AppHandle<R>, visible: bool) -> Result<(), String> {
        let app_for_main = app.clone();
        app.run_on_main_thread(move || {
            OVERLAY.with(|cell| {
                let Some(ov) = cell.borrow().as_ref().map(|o| (o.window.clone(), o.history.clone())) else {
                    log::warn!("overlay: set_visible called before create()");
                    return;
                };
                let (window, history) = ov;
                if visible {
                    window.show_all();
                    let alloc = window.allocation();
                    log::info!(
                        "overlay: shown, allocated={}x{}",
                        alloc.width(),
                        alloc.height(),
                    );
                    start_polling(&app_for_main, history);
                } else {
                    window.hide();
                    log::info!("overlay: hidden");
                    stop_polling();
                    // Reset history so next show starts clean.
                    let cur = OVERLAY.with(|c| c.borrow().as_ref().map(|o| o.history.clone()));
                    if let Some(h) = cur {
                        let mut g = h.lock();
                        for v in g.iter_mut() { *v = 0.0; }
                    }
                }
            });
        })
        .map_err(|e| e.to_string())
    }

    fn start_polling<R: Runtime>(app: &tauri::AppHandle<R>, history: Arc<Mutex<Vec<f32>>>) {
        OVERLAY.with(|cell| {
            if let Some(ov) = cell.borrow().as_ref() {
                if let Some(id) = ov.timer.borrow_mut().take() {
                    id.remove();
                }
            }
        });

        let app_for_tick = app.clone();
        let id = glib::timeout_add_local(
            std::time::Duration::from_millis(RMS_TICK_MS),
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

        OVERLAY.with(|cell| {
            if let Some(ov) = cell.borrow().as_ref() {
                *ov.timer.borrow_mut() = Some(id);
            }
        });
    }

    fn stop_polling() {
        OVERLAY.with(|cell| {
            if let Some(ov) = cell.borrow().as_ref() {
                if let Some(id) = ov.timer.borrow_mut().take() {
                    id.remove();
                }
            }
        });
    }

    fn read_rms<R: Runtime>(app: &tauri::AppHandle<R>) -> f32 {
        let state: tauri::State<'_, AppState> = app.state();
        let recorder = state.recorder.lock();
        recorder.get_rms_level()
    }

    fn request_toggle<R: Runtime>(app: &tauri::AppHandle<R>) {
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
        if w <= 0.0 || h <= 0.0 {
            return;
        }

        // Translucent dark pill background.
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
pub fn set_overlay_visible<R: Runtime>(
    app: &tauri::AppHandle<R>,
    visible: bool,
) -> Result<(), String> {
    imp::set_visible(app, visible)
}

#[cfg(not(target_os = "linux"))]
pub fn create<R: Runtime, M: Manager<R>>(_manager: &M) -> tauri::Result<()> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn set_overlay_visible<R: Runtime>(
    _app: &tauri::AppHandle<R>,
    _visible: bool,
) -> Result<(), String> {
    Ok(())
}
