//! Native GTK recording overlay with three states (Recording, Transcribing,
//! Done). Plain `gtk::Window` + cairo, because the WebKit2GTK widget enforces
//! an internal min size of ~132x170 px on this stack.

use tauri::{Manager, Runtime};

pub const W: i32 = 280;
pub const H: i32 = 36;
const BARS: usize = 28;
const BOTTOM_MARGIN: i32 = 80;
const RMS_TICK_MS: u64 = 33;
const DONE_LINGER_MS: u64 = 3000;

/// Default overlay position: horizontally centered, `BOTTOM_MARGIN` px above
/// the bottom of the given monitor geometry.
fn default_overlay_pos(geo_x: i32, geo_y: i32, geo_w: i32, geo_h: i32) -> (i32, i32) {
    let x = geo_x + (geo_w - W) / 2;
    let y = geo_y + geo_h - H - BOTTOM_MARGIN;
    (x, y)
}

#[derive(Clone, Debug)]
pub enum OverlayState {
    Hidden,
    Idle,
    Recording,
    Transcribing,
    Done(String),
}

#[cfg(target_os = "linux")]
mod imp {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;
    use std::sync::Arc;
    use std::time::Instant;

    use gtk::cairo::Context;
    use gtk::gdk::{EventMask, WindowTypeHint};
    use gtk::glib;
    use gtk::prelude::*;
    use parking_lot::Mutex;

    use crate::state::{AppState, RecordingState};

    struct Overlay {
        window: gtk::Window,
        stack: gtk::Stack,
        history: Arc<Mutex<Vec<f32>>>,
        timer: RefCell<Option<glib::SourceId>>,
        auto_hide: RefCell<Option<glib::SourceId>>,
        elapsed_start: RefCell<Option<Instant>>,
        rec_dur_label: gtk::Label,
        trans_dur_label: gtk::Label,
        done_label: gtk::Label,
        spinner: gtk::Spinner,
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
        // The pill has no decorations and should stay put: refuse WM close
        // requests so it can only be turned off via Settings.
        window.connect_delete_event(|_w, _ev| glib::Propagation::Stop);

        let (saved_x, saved_y) = {
            let st: tauri::State<'_, AppState> = app.state();
            let cfg = st.config.lock();
            (cfg.overlay_x, cfg.overlay_y)
        };
        match (saved_x, saved_y) {
            (Some(x), Some(y)) => window.move_(x, y),
            _ => {
                if let Some(display) = gtk::gdk::Display::default() {
                    if let Some(monitor) = display.primary_monitor() {
                        let geo = monitor.geometry();
                        let (x, y) = default_overlay_pos(geo.x(), geo.y(), geo.width(), geo.height());
                        window.move_(x, y);
                    }
                }
            }
        }

        // Persist the window position after the user stops dragging. configure
        // fires per pixel during a move, so debounce ~600 ms before writing.
        let save_timer: Rc<RefCell<Option<glib::SourceId>>> = Rc::new(RefCell::new(None));
        let save_app = app.clone();
        window.connect_configure_event(move |w, _ev| {
            if let Some(id) = save_timer.borrow_mut().take() {
                id.remove();
            }
            let w2 = w.clone();
            let app2 = save_app.clone();
            let timer_slot = save_timer.clone();
            let id = glib::timeout_add_local_once(std::time::Duration::from_millis(600), move || {
                *timer_slot.borrow_mut() = None;
                let (x, y) = w2.position();
                let st: tauri::State<'_, AppState> = app2.state();
                let mut cfg = st.config.lock();
                cfg.overlay_x = Some(x);
                cfg.overlay_y = Some(y);
                let _ = cfg.save();
            });
            *save_timer.borrow_mut() = Some(id);
            false // not handled — let GTK keep processing the configure event
        });

        // The whole pill is the input target: press+drag moves the window, a
        // plain click (press+release without movement) toggles recording. The
        // handlers live on the toplevel GdkWindow — unhandled button/motion
        // events from the no-window children propagate up to it, and it carries
        // the masks reliably (a no-window EventBox depends on its parent for
        // event delivery, which proved flaky here).
        window.add_events(
            EventMask::BUTTON_PRESS_MASK
                | EventMask::BUTTON_RELEASE_MASK
                | EventMask::POINTER_MOTION_MASK
                | EventMask::BUTTON1_MOTION_MASK,
        );

        #[derive(Default)]
        struct DragTrack {
            press: Option<(f64, f64)>, // root coords at button-press
            dragged: bool,
        }
        let drag: Rc<RefCell<DragTrack>> = Rc::new(RefCell::new(DragTrack::default()));

        let drag_press = drag.clone();
        window.connect_button_press_event(move |_w, ev| {
            if ev.button() == 1 {
                let (x, y) = ev.root();
                *drag_press.borrow_mut() = DragTrack {
                    press: Some((x, y)),
                    dragged: false,
                };
            }
            glib::Propagation::Proceed
        });

        let drag_move = drag.clone();
        window.connect_motion_notify_event(move |w, ev| {
            let mut d = drag_move.borrow_mut();
            if let Some((px, py)) = d.press {
                if !d.dragged {
                    let (x, y) = ev.root();
                    if (x - px).abs() > 4.0 || (y - py).abs() > 4.0 {
                        d.dragged = true;
                        w.begin_move_drag(1, x as i32, y as i32, ev.time());
                    }
                }
            }
            glib::Propagation::Proceed
        });

        let drag_release = drag.clone();
        let toggle_app = app.clone();
        window.connect_button_release_event(move |_w, ev| {
            if ev.button() == 1 {
                let was_drag = {
                    let mut d = drag_release.borrow_mut();
                    let was = d.dragged;
                    d.press = None;
                    d.dragged = false;
                    was
                };
                if !was_drag {
                    request_toggle(&toggle_app);
                }
            }
            glib::Propagation::Proceed
        });

        let stack_overlay = gtk::Overlay::new();

        // Base layer — pill background + accent border.
        let bg = gtk::DrawingArea::new();
        bg.connect_draw(|widget, cr| {
            paint_pill_bg(widget, cr);
            glib::Propagation::Proceed
        });
        stack_overlay.add(&bg);

        // Foreground — gtk::Stack with three named children, one per state.
        let stack = gtk::Stack::new();
        stack.set_transition_type(gtk::StackTransitionType::Crossfade);
        stack.set_transition_duration(160);
        stack.set_valign(gtk::Align::Center);
        stack.set_halign(gtk::Align::Fill);

        let history: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(vec![0.0; BARS]));

        stack.add_named(&build_idle_row(), "idle");

        let (rec_row, rec_dur_label) = build_recording_row(history.clone());
        stack.add_named(&rec_row, "recording");

        let (trans_row, trans_dur_label, spinner) = build_transcribing_row();
        stack.add_named(&trans_row, "transcribing");

        let (done_row, done_label) = build_done_row();
        stack.add_named(&done_row, "done");

        stack_overlay.add_overlay(&stack);

        window.add(&stack_overlay);

        // Realize children so first show_all() doesn't flicker.
        stack_overlay.show_all();

        OVERLAY.with(|cell| {
            *cell.borrow_mut() = Some(Overlay {
                window,
                stack,
                history,
                timer: RefCell::new(None),
                auto_hide: RefCell::new(None),
                elapsed_start: RefCell::new(None),
                rec_dur_label,
                trans_dur_label,
                done_label,
                spinner,
            });
        });

        // Show the calm idle pill now (no-op if the user disabled the overlay —
        // set_state() gates on config.show_overlay).
        let _ = set_state(app, OverlayState::Idle);

        Ok(())
    }

    pub fn set_state<R: Runtime>(
        app: &tauri::AppHandle<R>,
        state: OverlayState,
    ) -> Result<(), String> {
        let app_for_main = app.clone();
        let state_for_main = state.clone();
        app.run_on_main_thread(move || {
            OVERLAY.with(|cell| {
                let cell_ref = cell.borrow();
                let Some(ov) = cell_ref.as_ref() else {
                    log::warn!("overlay: set_state called before create()");
                    return;
                };

                // Cancel any pending done-linger timer whenever state changes.
                if let Some(id) = ov.auto_hide.borrow_mut().take() {
                    id.remove();
                }

                // Respect the user's "show overlay" preference: when off, the
                // window stays hidden regardless of the requested state.
                let show_overlay = app_for_main
                    .state::<AppState>()
                    .config
                    .lock()
                    .show_overlay;
                if !show_overlay {
                    ov.window.hide();
                    stop_polling_inner(ov);
                    ov.spinner.stop();
                    *ov.elapsed_start.borrow_mut() = None;
                    return;
                }

                log::info!("overlay: state={:?}", state_for_main);
                match &state_for_main {
                    OverlayState::Hidden => {
                        ov.window.hide();
                        stop_polling_inner(ov);
                        ov.spinner.stop();
                        *ov.elapsed_start.borrow_mut() = None;
                        clear_history(ov);
                    }
                    OverlayState::Idle => {
                        ov.stack.set_visible_child_name("idle");
                        ov.spinner.stop();
                        stop_polling_inner(ov);
                        *ov.elapsed_start.borrow_mut() = None;
                        clear_history(ov);
                        ov.window.show_all();
                        ov.window.set_keep_above(true);
                    }
                    OverlayState::Recording => {
                        *ov.elapsed_start.borrow_mut() = Some(Instant::now());
                        ov.stack.set_visible_child_name("recording");
                        ov.spinner.stop();
                        ov.window.show_all();
                        ov.window.set_keep_above(true);
                        start_polling_inner(&app_for_main, ov);
                    }
                    OverlayState::Transcribing => {
                        ov.stack.set_visible_child_name("transcribing");
                        ov.spinner.start();
                        // Update transcribing-row duration to whatever recording
                        // duration ended at; keep elapsed_start so the label
                        // ticks over while we wait, if we ever wire that.
                        update_duration_labels(ov);
                        stop_polling_inner(ov);
                        ov.window.show_all();
                        ov.window.set_keep_above(true);
                    }
                    OverlayState::Done(text) => {
                        ov.done_label.set_text(text);
                        ov.stack.set_visible_child_name("done");
                        ov.spinner.stop();
                        stop_polling_inner(ov);
                        ov.window.show_all();
                        ov.window.set_keep_above(true);

                        let app_after = app_for_main.clone();
                        let id = glib::timeout_add_local_once(
                            std::time::Duration::from_millis(DONE_LINGER_MS),
                            move || {
                                let _ = set_state(&app_after, OverlayState::Idle);
                            },
                        );
                        *ov.auto_hide.borrow_mut() = Some(id);
                    }
                }
            });
        })
        .map_err(|e| e.to_string())
    }

    fn build_idle_row() -> gtk::Box {
        let row = gtk::Box::new(gtk::Orientation::Horizontal, 8);
        row.set_margin_start(16);
        row.set_margin_end(16);
        row.set_valign(gtk::Align::Center);
        row.set_halign(gtk::Align::Center);

        // Muted dot.
        let dot = gtk::DrawingArea::new();
        dot.set_size_request(8, 8);
        dot.set_valign(gtk::Align::Center);
        dot.connect_draw(|w, cr| {
            let sz = w.allocated_width().min(w.allocated_height()) as f64;
            let r = sz / 2.0;
            cr.set_source_rgba(154.0 / 255.0, 166.0 / 255.0, 184.0 / 255.0, 0.65);
            cr.arc(r, r, r, 0.0, std::f64::consts::TAU);
            let _ = cr.fill();
            glib::Propagation::Proceed
        });
        row.pack_start(&dot, false, false, 0);

        let lbl = gtk::Label::new(None);
        lbl.set_markup("<span size='11000' foreground='#8b96a8' weight='500'>VoxForge</span>");
        lbl.set_valign(gtk::Align::Center);
        row.pack_start(&lbl, false, false, 0);

        row
    }

    fn build_recording_row(history: Arc<Mutex<Vec<f32>>>) -> (gtk::Box, gtk::Label) {
        let row = gtk::Box::new(gtk::Orientation::Horizontal, 12);
        row.set_margin_start(16);
        row.set_margin_end(16);
        row.set_valign(gtk::Align::Center);

        // Pulsing rec dot.
        let dot = gtk::DrawingArea::new();
        dot.set_size_request(10, 10);
        dot.set_valign(gtk::Align::Center);
        dot.connect_draw(|w, cr| {
            let sz = w.allocated_width().min(w.allocated_height()) as f64;
            let r = sz / 2.0;
            cr.set_source_rgb(247.0 / 255.0, 118.0 / 255.0, 142.0 / 255.0);
            cr.arc(r, r, r * 0.85, 0.0, std::f64::consts::TAU);
            let _ = cr.fill();
            glib::Propagation::Proceed
        });
        row.pack_start(&dot, false, false, 0);

        // Waveform.
        let wave = gtk::DrawingArea::new();
        wave.set_hexpand(true);
        wave.set_size_request(-1, 22);
        wave.set_valign(gtk::Align::Center);
        wave.connect_draw(move |w, cr| {
            paint_waveform_bars(w, cr, &history);
            glib::Propagation::Proceed
        });
        row.pack_start(&wave, true, true, 0);

        // Duration.
        let dur = gtk::Label::new(None);
        dur.set_markup(
            "<span font_family='monospace' size='11000' foreground='#9aa6b8'>0:00</span>",
        );
        dur.set_valign(gtk::Align::Center);
        row.pack_start(&dur, false, false, 0);

        (row, dur)
    }

    fn build_transcribing_row() -> (gtk::Box, gtk::Label, gtk::Spinner) {
        let row = gtk::Box::new(gtk::Orientation::Horizontal, 10);
        row.set_margin_start(16);
        row.set_margin_end(16);
        row.set_valign(gtk::Align::Center);

        let sp = gtk::Spinner::new();
        sp.set_size_request(14, 14);
        sp.set_valign(gtk::Align::Center);
        row.pack_start(&sp, false, false, 0);

        let lbl = gtk::Label::new(None);
        lbl.set_markup("<span size='11500' foreground='#9aa6b8' weight='500'>Transcribing</span>");
        lbl.set_valign(gtk::Align::Center);
        row.pack_start(&lbl, false, false, 0);

        let dots = gtk::Label::new(None);
        dots.set_markup("<span foreground='#9aa6b8'>…</span>");
        dots.set_valign(gtk::Align::Center);
        row.pack_start(&dots, false, false, 0);

        let spacer = gtk::Box::new(gtk::Orientation::Horizontal, 0);
        spacer.set_hexpand(true);
        row.pack_start(&spacer, true, true, 0);

        let dur = gtk::Label::new(None);
        dur.set_markup(
            "<span font_family='monospace' size='11000' foreground='#9aa6b8'>0:00</span>",
        );
        dur.set_valign(gtk::Align::Center);
        row.pack_start(&dur, false, false, 0);

        (row, dur, sp)
    }

    fn build_done_row() -> (gtk::Box, gtk::Label) {
        let row = gtk::Box::new(gtk::Orientation::Horizontal, 10);
        row.set_margin_start(16);
        row.set_margin_end(16);
        row.set_valign(gtk::Align::Center);

        let check = gtk::DrawingArea::new();
        check.set_size_request(18, 18);
        check.set_valign(gtk::Align::Center);
        check.connect_draw(|w, cr| {
            let sz = w.allocated_width() as f64;
            let r = sz / 2.0;
            // Tinted background circle.
            cr.set_source_rgba(125.0 / 255.0, 211.0 / 255.0, 160.0 / 255.0, 0.18);
            cr.arc(r, r, r, 0.0, std::f64::consts::TAU);
            let _ = cr.fill();
            // Check mark.
            cr.set_source_rgb(125.0 / 255.0, 211.0 / 255.0, 160.0 / 255.0);
            cr.set_line_width(1.6);
            cr.set_line_cap(gtk::cairo::LineCap::Round);
            cr.set_line_join(gtk::cairo::LineJoin::Round);
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
        lbl.set_valign(gtk::Align::Center);
        row.pack_start(&lbl, true, true, 0);

        (row, lbl)
    }

    fn start_polling_inner<R: Runtime>(app: &tauri::AppHandle<R>, ov: &Overlay) {
        if let Some(id) = ov.timer.borrow_mut().take() {
            id.remove();
        }
        let app_for_tick = app.clone();
        let history = ov.history.clone();
        let id =
            glib::timeout_add_local(std::time::Duration::from_millis(RMS_TICK_MS), move || {
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
                        update_duration_labels(ov);
                    }
                });
                glib::ControlFlow::Continue
            });
        *ov.timer.borrow_mut() = Some(id);
    }

    fn stop_polling_inner(ov: &Overlay) {
        if let Some(id) = ov.timer.borrow_mut().take() {
            id.remove();
        }
    }

    fn clear_history(ov: &Overlay) {
        let mut h = ov.history.lock();
        for v in h.iter_mut() {
            *v = 0.0;
        }
    }

    fn update_duration_labels(ov: &Overlay) {
        let elapsed_secs = ov
            .elapsed_start
            .borrow()
            .map(|t| t.elapsed().as_secs())
            .unwrap_or(0);
        let m = elapsed_secs / 60;
        let s = elapsed_secs % 60;
        let txt = format!(
            "<span font_family='monospace' size='11000' foreground='#9aa6b8'>{}:{:02}</span>",
            m, s
        );
        ov.rec_dur_label.set_markup(&txt);
        ov.trans_dur_label.set_markup(&txt);
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

    fn paint_pill_bg(widget: &gtk::DrawingArea, cr: &Context) {
        let alloc = widget.allocation();
        let w = alloc.width() as f64;
        let h = alloc.height() as f64;
        if w <= 0.0 || h <= 0.0 {
            return;
        }
        // Solid pill — `--overlayBg` 0.92 alpha, painted over the transparent
        // window so the pill floats with no surrounding rectangle.
        cr.set_source_rgba(20.0 / 255.0, 25.0 / 255.0, 33.0 / 255.0, 0.96);
        rounded_rect(cr, 0.0, 0.0, w, h, h / 2.0);
        let _ = cr.fill();

        // Hairline border, soft.
        cr.set_source_rgba(1.0, 1.0, 1.0, 0.08);
        cr.set_line_width(1.0);
        rounded_rect(cr, 0.5, 0.5, w - 1.0, h - 1.0, (h - 1.0) / 2.0);
        let _ = cr.stroke();
    }

    fn paint_waveform_bars(
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
        let snap: Vec<f32> = history.lock().clone();
        let n = snap.len() as f64;
        if n < 1.0 {
            return;
        }
        let bar_w = (w / n).max(1.0) - 1.0;
        for (i, v) in snap.iter().enumerate() {
            let pct = ((*v as f64) * 2.2).clamp(0.06, 1.0);
            let bar_h = pct * h * 0.9;
            let x = i as f64 * (bar_w + 1.0);
            let y = (h - bar_h) / 2.0;
            let fade = 0.4 + 0.6 * (i as f64 / (n - 1.0));
            cr.set_source_rgba(0.48, 0.64, 0.97, fade); // --accent #7aa2f7
            cr.rectangle(x, y, bar_w, bar_h);
            let _ = cr.fill();
        }
    }

    fn rounded_rect(cr: &Context, x: f64, y: f64, w: f64, h: f64, r: f64) {
        let r = r.min(w / 2.0).min(h / 2.0);
        cr.new_sub_path();
        cr.arc(x + w - r, y + r, r, -std::f64::consts::FRAC_PI_2, 0.0);
        cr.arc(x + w - r, y + h - r, r, 0.0, std::f64::consts::FRAC_PI_2);
        cr.arc(
            x + r,
            y + h - r,
            r,
            std::f64::consts::FRAC_PI_2,
            std::f64::consts::PI,
        );
        cr.arc(
            x + r,
            y + r,
            r,
            std::f64::consts::PI,
            1.5 * std::f64::consts::PI,
        );
        cr.close_path();
    }
}

#[cfg(target_os = "linux")]
pub fn create<R: Runtime, M: Manager<R>>(manager: &M) -> tauri::Result<()> {
    let app = manager.app_handle().clone();
    imp::create(&app)
}

#[cfg(target_os = "linux")]
pub fn set_state<R: Runtime>(app: &tauri::AppHandle<R>, state: OverlayState) -> Result<(), String> {
    imp::set_state(app, state)
}

#[cfg(target_os = "linux")]
pub fn set_overlay_visible<R: Runtime>(
    app: &tauri::AppHandle<R>,
    visible: bool,
) -> Result<(), String> {
    if visible {
        imp::set_state(app, OverlayState::Idle)
    } else {
        imp::set_state(app, OverlayState::Hidden)
    }
}

#[cfg(not(target_os = "linux"))]
pub fn create<R: Runtime, M: Manager<R>>(_manager: &M) -> tauri::Result<()> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn set_state<R: Runtime>(
    _app: &tauri::AppHandle<R>,
    _state: OverlayState,
) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "linux"))]
pub fn set_overlay_visible<R: Runtime>(
    _app: &tauri::AppHandle<R>,
    _visible: bool,
) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_pos_centers_horizontally_and_sits_above_bottom() {
        let (x, y) = default_overlay_pos(0, 0, 1920, 1080);
        assert_eq!(x, (1920 - W) / 2);
        assert_eq!(y, 1080 - H - 80); // BOTTOM_MARGIN = 80
    }

    #[test]
    fn default_pos_respects_monitor_origin() {
        let (x, y) = default_overlay_pos(1920, 0, 1280, 720);
        assert_eq!(x, 1920 + (1280 - W) / 2);
        assert_eq!(y, 720 - H - 80);
    }
}
