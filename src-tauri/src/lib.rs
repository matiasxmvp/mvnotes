use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

mod commands;

pub struct AppState {
    pub db: Mutex<Connection>,
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "gemini_key",
            sql: include_str!("../migrations/002_gemini_key.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "ollama_model",
            sql: include_str!("../migrations/003_ollama_model.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "update_default_model",
            sql: include_str!("../migrations/004_update_default_model.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "mic_device",
            sql: include_str!("../migrations/005_mic_device.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "deepgram_key",
            sql: include_str!("../migrations/006_deepgram_key.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "groq_key",
            sql: include_str!("../migrations/007_groq_key.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "pomodoro_settings",
            sql: include_str!("../migrations/008_pomodoro_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "study_notes",
            sql: include_str!("../migrations/009_study_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "schedule_start_hour",
            sql: include_str!("../migrations/010_schedule_start_hour.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "schedule_end_hour",
            sql: include_str!("../migrations/011_schedule_end_hour.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "study_notes_tags",
            sql: include_str!("../migrations/012_study_notes_tags.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "whiteboard_task_link",
            sql: include_str!("../migrations/013_whiteboard_task_link.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "task_recurrence",
            sql: include_str!("../migrations/014_task_recurrence.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        // Runs migrations first — DB file is created before setup().
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:pizarra.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(handle_global_shortcut)
                .build(),
        )
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // quick-capture window manages its own visibility/position.
                .with_denylist(&["quick"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Open rusqlite connection to the same file tauri-plugin-sql created.
            // WAL mode is already set by the migration SQL.
            let db_path = app
                .path()
                .app_data_dir()
                .expect("cannot resolve app data dir")
                .join("pizarra.db");

            let conn = Connection::open(&db_path)
                .expect("cannot open sqlite database");

            app.manage(AppState { db: Mutex::new(conn) });

            // Re-sync the autostart registry entry with the stored setting on
            // every boot. The registry records the exe path at enable() time,
            // so app updates/renames silently break it unless re-registered.
            {
                use tauri_plugin_autostart::ManagerExt;
                let autostart_enabled = {
                    let state: tauri::State<AppState> = app.state();
                    let db = state.db.lock().expect("db lock poisoned");
                    db.query_row(
                        "SELECT autostart FROM settings WHERE id = 1",
                        [],
                        |row| row.get::<_, i64>(0),
                    )
                    .map(|v| v != 0)
                    .unwrap_or(false)
                };
                let autolaunch = app.autolaunch();
                if autostart_enabled {
                    if let Err(e) = autolaunch.enable() {
                        eprintln!("autostart enable failed: {e}");
                    }
                } else {
                    // Clean up stale entries left by old installs.
                    let _ = autolaunch.disable();
                }
            }

            // Register default global shortcuts.
            // Non-fatal: if another app holds them, we continue without them.
            use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
            let ctrl_n = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyN);
            if let Err(e) = app.global_shortcut().register(ctrl_n) {
                eprintln!("global shortcut Ctrl+N unavailable: {e}");
            }
            let ctrl_alt_n = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
            if let Err(e) = app.global_shortcut().register(ctrl_alt_n) {
                eprintln!("global shortcut Ctrl+Alt+N unavailable: {e}");
            }

            move_to_secondary_monitor(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::tasks::get_tasks,
            commands::tasks::create_task,
            commands::tasks::update_task,
            commands::tasks::delete_task,
            commands::notes::get_note,
            commands::notes::upsert_note,
            commands::whiteboards::get_whiteboards,
            commands::whiteboards::get_whiteboard,
            commands::whiteboards::create_whiteboard,
            commands::whiteboards::update_whiteboard,
            commands::whiteboards::set_whiteboard_task,
            commands::whiteboards::delete_whiteboard,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::notes::get_all_notes,
            commands::data::reset_data,
            commands::system::play_notification_sound,
            commands::study_notes::get_study_notes,
            commands::study_notes::create_study_note,
            commands::study_notes::update_study_note,
            commands::study_notes::delete_study_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_global_shortcut(
    app: &tauri::AppHandle,
    shortcut: &tauri_plugin_global_shortcut::Shortcut,
    event: tauri_plugin_global_shortcut::ShortcutEvent,
) {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
    if event.state() != ShortcutState::Pressed {
        return;
    }

    // Ctrl+Alt+N → toggle the quick-capture window from anywhere in the OS.
    let ctrl_alt_n = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyN);
    if *shortcut == ctrl_alt_n {
        if let Some(quick) = app.get_webview_window("quick") {
            if quick.is_visible().unwrap_or(false) {
                let _ = quick.hide();
            } else {
                let _ = quick.center();
                let _ = quick.show();
                let _ = quick.set_focus();
            }
        }
        return;
    }

    let _ = app.emit("global-shortcut", shortcut.to_string());
}

fn move_to_secondary_monitor(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let window = match app.get_webview_window("main") {
        Some(w) => w,
        None => return Ok(()),
    };

    let monitors = window.available_monitors()?;
    if monitors.len() < 2 {
        window.maximize()?;
        return Ok(());
    }

    let primary = window.primary_monitor()?;
    let secondary = monitors.iter().find(|m| {
        primary
            .as_ref()
            .map_or(true, |p| m.position() != p.position())
    });

    if let Some(monitor) = secondary {
        let pos = monitor.position();
        window.set_position(tauri::PhysicalPosition::new(pos.x, pos.y))?;
        window.maximize()?;
    }

    Ok(())
}
