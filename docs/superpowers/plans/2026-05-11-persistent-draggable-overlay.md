# План реалізації: постійний перетягуваний overlay

> **Для агентів-виконавців:** ОБОВ'ЯЗКОВА ПІД-СКІЛ: використовуй superpowers:subagent-driven-development (рекомендовано) або superpowers:executing-plans, щоб виконувати цей план задача за задачею. Кроки позначені чекбоксами (`- [ ]`) для відстеження.

**Мета:** Перетворити overlay запису на постійний, завжди-поверх, перетягуваний віджет, який надійно показує стани «транскрипція» і «результат» та не зникає одразу після запису.

**Архітектура:** Rust стає єдиним джерелом істини для стану overlay (React більше не керує видимістю). Додається видимий стан `Idle`; після стану `Done` overlay повертається в `Idle`, а не ховається. Drag реалізується через GTK `begin_move_drag`; клік без руху — як зараз (toggle запису). Позиція зберігається в `config.json` із дебаунсом.

**Стек:** Rust + GTK3 (gtk-rs) + Tauri 2 + React/TypeScript. Серіалізація — serde/serde_json. Тести — `cargo test` (Rust unit), `npm run lint` / `npm run format` (фронт).

---

## Структура файлів

| Файл | Дія | Відповідальність |
|---|---|---|
| `src-tauri/src/config.rs` | Змінити | Додати поля `overlay_x: Option<i32>`, `overlay_y: Option<i32>` + unit-тести парсингу |
| `src-tauri/src/overlay.rs` | Змінити | Стан `Idle`; чиста функція `default_overlay_pos` + тест; `build_idle_row`; drag + click; збереження позиції через `configure-event`; переписаний `set_state` з гейтом по `show_overlay` і повторним `set_keep_above`; `set_overlay_visible` → `Idle`; перейменування константи на `DONE_LINGER_MS` (3000 мс); виклик `set_state(Idle)` в кінці `create` |
| `src-tauri/src/main.rs` | Без змін | (overlay показує idle сам, із `create`) |
| `src-tauri/src/commands.rs` | Без змін | (`set_state` гейтиться сам по конфігу) |
| `src/types/api.ts` | Змінити | Додати `overlay_x: number \| null`, `overlay_y: number \| null` у `Config` |
| `src/App.tsx` | Змінити | Видалити `useEffect([recordingState])`, що кликав `set_overlay_visible` |
| `src/components/tabs/SettingsTab.tsx` | Змінити | Після `save_config` кликати `set_overlay_visible`, якщо в патчі є `show_overlay`; оновити підказку тогла |

---

## Задача 1: Поля позиції overlay у `Config`

**Файли:**
- Змінити: `src-tauri/src/config.rs`
- Тест: `src-tauri/src/config.rs` (новий `#[cfg(test)] mod tests`)

- [ ] **Крок 1: Написати падаючі тести**

Додати в кінець `src-tauri/src/config.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL_JSON: &str = r#"{
        "openai_api_key":"","hotkey_start":"","hotkey_stop":"","hotkey_history":"",
        "language":"","model":"","ui_language":"","openai_api_base":"","output_mode":"inject"
    }"#;

    #[test]
    fn config_without_overlay_pos_defaults_to_none() {
        let cfg: Config = serde_json::from_str(MINIMAL_JSON).unwrap();
        assert_eq!(cfg.overlay_x, None);
        assert_eq!(cfg.overlay_y, None);
    }

    #[test]
    fn config_with_overlay_pos_parses() {
        let json = r#"{
            "openai_api_key":"","hotkey_start":"","hotkey_stop":"","hotkey_history":"",
            "language":"","model":"","ui_language":"","openai_api_base":"","output_mode":"inject",
            "overlay_x":120,"overlay_y":640
        }"#;
        let cfg: Config = serde_json::from_str(json).unwrap();
        assert_eq!(cfg.overlay_x, Some(120));
        assert_eq!(cfg.overlay_y, Some(640));
    }
}
```

- [ ] **Крок 2: Запустити тести — мають впасти на компіляції**

Виконати: `cargo test --manifest-path src-tauri/Cargo.toml --lib config::tests`
Очікувано: помилка компіляції — `no field overlay_x on type Config`.

- [ ] **Крок 3: Додати поля в `Config`**

У `src-tauri/src/config.rs` у `struct Config`, після `pub punctuation: bool,`:

```rust
    #[serde(default)]
    pub overlay_x: Option<i32>,
    #[serde(default)]
    pub overlay_y: Option<i32>,
```

У `impl Default for Config`, після `punctuation: true,`:

```rust
            overlay_x: None,
            overlay_y: None,
```

- [ ] **Крок 4: Запустити тести — мають пройти**

Виконати: `cargo test --manifest-path src-tauri/Cargo.toml --lib config::tests`
Очікувано: `test result: ok. 2 passed`.

- [ ] **Крок 5: Коміт**

```bash
git add src-tauri/src/config.rs
git commit -m "feat(config): persist overlay window position"
```

---

## Задача 2: Чиста функція дефолтної позиції overlay

**Файли:**
- Змінити: `src-tauri/src/overlay.rs` (рівень модуля, поза `mod imp`)
- Тест: `src-tauri/src/overlay.rs` (новий `#[cfg(test)] mod tests` на рівні модуля)

- [ ] **Крок 1: Написати падаючий тест**

Додати в кінець `src-tauri/src/overlay.rs` (на рівні модуля, не в `mod imp`):

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_pos_centers_horizontally_and_sits_above_bottom() {
        // монітор 1920x1080 з origin (0,0)
        let (x, y) = default_overlay_pos(0, 0, 1920, 1080);
        assert_eq!(x, (1920 - W) / 2);
        assert_eq!(y, 1080 - H - 80); // BOTTOM_MARGIN = 80
    }

    #[test]
    fn default_pos_respects_monitor_origin() {
        // другий монітор зі зсувом origin (1920, 0)
        let (x, y) = default_overlay_pos(1920, 0, 1280, 720);
        assert_eq!(x, 1920 + (1280 - W) / 2);
        assert_eq!(y, 720 - H - 80);
    }
}
```

- [ ] **Крок 2: Запустити тест — має впасти на компіляції**

Виконати: `cargo test --manifest-path src-tauri/Cargo.toml --lib overlay::tests`
Очікувано: помилка компіляції — `cannot find function default_overlay_pos`.

- [ ] **Крок 3: Реалізувати функцію**

У `src-tauri/src/overlay.rs`, одразу після рядка `const DONE_AUTOHIDE_MS: u64 = 2200;` (рівень модуля), додати:

```rust
/// Default overlay position: horizontally centered, `BOTTOM_MARGIN` px above
/// the bottom of the given monitor geometry.
fn default_overlay_pos(geo_x: i32, geo_y: i32, geo_w: i32, geo_h: i32) -> (i32, i32) {
    let x = geo_x + (geo_w - W) / 2;
    let y = geo_y + geo_h - H - BOTTOM_MARGIN;
    (x, y)
}
```

- [ ] **Крок 4: Запустити тест — має пройти**

Виконати: `cargo test --manifest-path src-tauri/Cargo.toml --lib overlay::tests`
Очікувано: `test result: ok. 2 passed`.

- [ ] **Крок 5: Коміт**

```bash
git add src-tauri/src/overlay.rs
git commit -m "refactor(overlay): extract default position into testable fn"
```

---

## Задача 3: Видимий стан `Idle` + переписаний `set_state`

Це найбільша задача. Тестується компіляцією (`cargo build`); поведінка GTK перевіряється вручну в Задачі 8.

**Файли:**
- Змінити: `src-tauri/src/overlay.rs`

- [ ] **Крок 1: Додати варіант `Idle` в enum**

У `src-tauri/src/overlay.rs` змінити `OverlayState`:

```rust
#[derive(Clone, Debug)]
pub enum OverlayState {
    Hidden,
    Idle,
    Recording,
    Transcribing,
    Done(String),
}
```

- [ ] **Крок 2: Перейменувати константу `DONE_AUTOHIDE_MS` → `DONE_LINGER_MS` і збільшити до 3000**

У `src-tauri/src/overlay.rs` (рівень модуля):

```rust
const DONE_LINGER_MS: u64 = 3000;
```

(Видалити старий рядок `const DONE_AUTOHIDE_MS: u64 = 2200;`. Єдине використання — у `imp::set_state`, оновимо в Кроці 6.)

- [ ] **Крок 3: Додати конструктор рядка `idle`**

У `mod imp`, поруч з іншими `build_*_row` функціями, додати:

```rust
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
```

- [ ] **Крок 4: Зареєструвати рядок `idle` у стеку всередині `create`**

У `imp::create`, у блоці, де додаються named-діти стека, **перед** `let (rec_row, rec_dur_label) = ...`, додати:

```rust
        stack.add_named(&build_idle_row(), "idle");
```

- [ ] **Крок 5: У `create` читати збережену позицію і використовувати `default_overlay_pos`**

У `imp::create` **замінити** поточний блок позиціонування:

```rust
        if let Some(display) = gtk::gdk::Display::default() {
            if let Some(monitor) = display.primary_monitor() {
                let geo = monitor.geometry();
                let x = geo.x() + (geo.width() - W) / 2;
                let y = geo.y() + geo.height() - H - BOTTOM_MARGIN;
                window.move_(x, y);
            }
        }
```

на:

```rust
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
                        let (x, y) = default_overlay_pos(
                            geo.x(),
                            geo.y(),
                            geo.width(),
                            geo.height(),
                        );
                        window.move_(x, y);
                    }
                }
            }
        }
```

(`app.state::<AppState>()` потребує трейт `tauri::Manager` — він вже в скоупі через `use super::*` і `use tauri::{Manager, Runtime};` на рівні модуля. `AppState` вже імпортовано в `mod imp` рядком `use crate::state::{AppState, RecordingState};`.)

- [ ] **Крок 6: Переписати `imp::set_state` — гейт по `show_overlay`, arm `Idle`, повторний `set_keep_above`, лінгер `Done` → `Idle`**

Замінити тіло `imp::set_state` цілком на:

```rust
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
                let show_overlay = {
                    let st: tauri::State<'_, AppState> = app_for_main.state();
                    st.config.lock().show_overlay
                };
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
```

- [ ] **Крок 7: Показувати idle в кінці `create`**

У `imp::create`, **в самому кінці**, після блоку `OVERLAY.with(|cell| { *cell.borrow_mut() = Some(Overlay { ... }); });` і **перед** `Ok(())`, додати:

```rust
        // Show the calm idle pill now (no-op if the user disabled the overlay —
        // set_state() gates on config.show_overlay).
        let _ = set_state(app, OverlayState::Idle);
```

- [ ] **Крок 8: Зібрати**

Виконати: `cargo build --manifest-path src-tauri/Cargo.toml`
Очікувано: збірка успішна (попередження clippy допустимі на цьому кроці).

- [ ] **Крок 9: Коміт**

```bash
git add src-tauri/src/overlay.rs
git commit -m "feat(overlay): persistent visible Idle state; Rust owns overlay state"
```

---

## Задача 4: Перетягування мишею + клік-без-руху = toggle

**Файли:**
- Змінити: `src-tauri/src/overlay.rs` (`mod imp` — імпорти + `create`)

- [ ] **Крок 1: Додати імпорти в `mod imp`**

У `mod imp`, у блоці `use`:
- до рядка `use gtk::gdk::WindowTypeHint;` додати `EventMask`, тобто зробити `use gtk::gdk::{EventMask, WindowTypeHint};`
- додати `use std::rc::Rc;`

- [ ] **Крок 2: Замінити обробник кліку на drag + click**

У `imp::create` **замінити** поточний блок:

```rust
        // Click-anywhere toggle while recording — the app's main click target.
        let evt = gtk::EventBox::new();
        evt.set_above_child(false);
        evt.set_visible_window(false);
        let toggle_app = app.clone();
        evt.connect_button_press_event(move |_, _| {
            request_toggle(&toggle_app);
            glib::Propagation::Stop
        });
```

на:

```rust
        // Whole pill is the input target: press+drag moves the window, a plain
        // click (press+release without movement) toggles recording.
        let evt = gtk::EventBox::new();
        evt.set_above_child(false);
        evt.set_visible_window(false);
        // POINTER_MOTION lets us detect a drag; the toplevel's GdkWindow is the
        // one that actually carries the mask, so add it on the window too.
        window.add_events(EventMask::POINTER_MOTION_MASK | EventMask::BUTTON1_MOTION_MASK);

        #[derive(Default)]
        struct DragTrack {
            press: Option<(f64, f64)>, // root coords at button-press
            dragged: bool,
        }
        let drag: Rc<RefCell<DragTrack>> = Rc::new(RefCell::new(DragTrack::default()));

        let drag_press = drag.clone();
        evt.connect_button_press_event(move |_w, ev| {
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
        let win_for_drag = window.clone();
        evt.connect_motion_notify_event(move |_w, ev| {
            let mut d = drag_move.borrow_mut();
            if let Some((px, py)) = d.press {
                if !d.dragged {
                    let (x, y) = ev.root();
                    if (x - px).abs() > 4.0 || (y - py).abs() > 4.0 {
                        d.dragged = true;
                        win_for_drag.begin_move_drag(1, x as i32, y as i32, ev.time());
                    }
                }
            }
            glib::Propagation::Proceed
        });

        let drag_release = drag.clone();
        let toggle_app = app.clone();
        evt.connect_button_release_event(move |_w, ev| {
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
```

(`begin_move_drag` — це `GtkWindowExt::begin_move_drag(&self, button: i32, root_x: i32, root_y: i32, timestamp: u32)`, доступний через `gtk::prelude::*`. `ev.button() -> u32`, `ev.root() -> (f64, f64)`, `ev.time() -> u32` для `EventButton`/`EventMotion`.)

- [ ] **Крок 3: Зібрати**

Виконати: `cargo build --manifest-path src-tauri/Cargo.toml`
Очікувано: збірка успішна.

- [ ] **Крок 4: Коміт**

```bash
git add src-tauri/src/overlay.rs
git commit -m "feat(overlay): drag to move, plain click still toggles"
```

---

## Задача 5: Збереження позиції через `configure-event` із дебаунсом

**Файли:**
- Змінити: `src-tauri/src/overlay.rs` (`imp::create`)

- [ ] **Крок 1: Підключити `configure-event` з дебаунс-таймером**

У `imp::create`, **після** блоку позиціонування (де викликається `window.move_`) і **до** створення `EventBox`/drag-логіки, додати:

```rust
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
            let id = glib::timeout_add_local_once(
                std::time::Duration::from_millis(600),
                move || {
                    *timer_slot.borrow_mut() = None;
                    let (x, y) = w2.position();
                    let st: tauri::State<'_, AppState> = app2.state();
                    let mut cfg = st.config.lock();
                    cfg.overlay_x = Some(x);
                    cfg.overlay_y = Some(y);
                    let _ = cfg.save();
                },
            );
            *save_timer.borrow_mut() = Some(id);
            glib::Propagation::Proceed
        });
```

(Примітка: `connect_configure_event` повертає `glib::Propagation` — як і `connect_draw` у цьому файлі. Якщо компілятор очікує інший тип, привести до конвенції файлу. `w` у замиканні — це `&gtk::Window`; `.position()` і `.clone()` доступні через `gtk::prelude::*`. Один зайвий запис файлу при старті — коли `window.move_` сам тригерить `configure-event` — допустимий.)

- [ ] **Крок 2: Зібрати**

Виконати: `cargo build --manifest-path src-tauri/Cargo.toml`
Очікувано: збірка успішна.

- [ ] **Крок 3: Перевірити clippy**

Виконати: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`
Очікувано: без помилок.

- [ ] **Крок 4: Коміт**

```bash
git add src-tauri/src/overlay.rs
git commit -m "feat(overlay): persist position on drag-end (debounced)"
```

---

## Задача 6: `set_overlay_visible` → `Idle`

**Файли:**
- Змінити: `src-tauri/src/overlay.rs` (linux-версія `set_overlay_visible`)

- [ ] **Крок 1: Замінити `Recording` на `Idle`**

У `src-tauri/src/overlay.rs` у `#[cfg(target_os = "linux")] pub fn set_overlay_visible` замінити:

```rust
    if visible {
        imp::set_state(app, OverlayState::Recording)
    } else {
        imp::set_state(app, OverlayState::Hidden)
    }
```

на:

```rust
    if visible {
        imp::set_state(app, OverlayState::Idle)
    } else {
        imp::set_state(app, OverlayState::Hidden)
    }
```

- [ ] **Крок 2: Зібрати + повний тест**

Виконати: `cargo test --manifest-path src-tauri/Cargo.toml --lib`
Очікувано: усі тести проходять (включно з `config::tests`, `overlay::tests`, `transcribe::tests`).

- [ ] **Крок 3: Коміт**

```bash
git add src-tauri/src/overlay.rs
git commit -m "feat(overlay): set_overlay_visible(true) shows Idle, not Recording"
```

---

## Задача 7: Фронтенд — прибрати конфліктний ефект, оновити Settings і типи

**Файли:**
- Змінити: `src/types/api.ts`
- Змінити: `src/App.tsx`
- Змінити: `src/components/tabs/SettingsTab.tsx`

- [ ] **Крок 1: Додати поля позиції в тип `Config`**

У `src/types/api.ts` в `interface Config`, після `punctuation: boolean;`, додати:

```ts
  overlay_x: number | null;
  overlay_y: number | null;
```

- [ ] **Крок 2: Видалити ефект, що клобберить стан overlay**

У `src/App.tsx` **видалити повністю** цей блок:

```tsx
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
```

(Це рядки приблизно 86–96. Більше нічого в `App.tsx` не чіпати. `invoke` залишається імпортованим — він використовується далі.)

- [ ] **Крок 3: У SettingsTab синхронізувати overlay з тоглом**

У `src/components/tabs/SettingsTab.tsx` у функції `update` замінити:

```tsx
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
```

на:

```tsx
  const update = async (patch: Partial<Config>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    onConfigChange(next);
    try {
      await invoke("save_config", { config: next });
      if ("show_overlay" in patch) {
        await invoke("set_overlay_visible", { visible: next.show_overlay });
      }
    } catch (e) {
      console.error("save_config failed", e);
    }
  };
```

Також оновити підказку тогла — рядок:

```tsx
          hint="Floating recorder pill while recording"
```

на:

```tsx
          hint="Always-on-top floating pill — drag to move"
```

- [ ] **Крок 4: Перевірити лінт/формат/типи**

Виконати: `npm run lint && npm run format`
Очікувано: без помилок. (Якщо `npm run format` змінює файли — це нормально, включити зміни в коміт.)

- [ ] **Крок 5: Коміт**

```bash
git add src/types/api.ts src/App.tsx src/components/tabs/SettingsTab.tsx
git commit -m "fix(overlay): stop frontend from clobbering overlay state; sync settings toggle"
```

---

## Задача 8: Ручна перевірка в `cargo tauri dev`

GTK-поведінку не покрити юніт-тестами — перевіряємо вручну.

- [ ] **Крок 1: Запустити dev-білд**

Виконати: `cd src-tauri && cargo tauri dev`

- [ ] **Крок 2: Перевірити чек-лист**

- [ ] При старті overlay видно внизу-по-центру в стані Idle (крапка + «VoxForge»), поверх інших вікон.
- [ ] Натиснути гарячу клавішу (Ctrl+Shift+Space, утримати) → overlay перемикається на хвилю + лічильник; відпустити → з'являється спінер «Transcribing»; після відповіді API → галочка + прев'ю тексту; через ~3 c → назад в Idle. Overlay **не зникає** ні на якому етапі.
- [ ] Якщо транскрипція впала (наприклад, прибрати API-ключ) → показує «Failed: …» ~3 c → Idle.
- [ ] Затиснути ЛКМ на overlay і потягнути → вікно рухається за курсором; відпустити → залишається на новому місці. Клік без руху → стартує/зупиняє запис (як раніше).
- [ ] Перезапустити застосунок → overlay з'являється на збереженій позиції; перевірити, що `~/.config/voxforge/config.json` містить `overlay_x`/`overlay_y`.
- [ ] Перемкнути overlay на іншу робочу область / поверх повноекранного вікна — лишається поверх; перевірити Alt+Tab — overlay у списку **немає**.
- [ ] Settings → вимкнути «Show overlay» → overlay зникає; почати запис → не з'являється; увімкнути назад → з'являється Idle.

- [ ] **Крок 3 (за потреби): Фінальний коміт виправлень**

Якщо ручна перевірка виявила баги — виправити, повторити чек-лист, закомітити окремо.

---

## Поза скоупом

- Реальний переклад тексту (фічі перекладу зараз немає).
- Підключення інших невикористаних прапорців конфігу (`auto_paste`, `punctuation`).
- Динамічна зміна розміру overlay у idle (за рішенням — лишаємо 280×36 завжди).
