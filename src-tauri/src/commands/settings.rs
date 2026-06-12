use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub autostart: bool,
    pub open_on_secondary_monitor: bool,
    pub theme: String,
    pub shortcuts: String,
    pub mic_device_id: String,
    pub deepgram_api_key: String,
    pub groq_api_key: String,
    pub groq_model: String,
    pub pomodoro_work: i64,
    pub pomodoro_break: i64,
    pub pomodoro_long_break: i64,
    pub pomodoro_long_break_interval: i64,
    pub schedule_start_hour: i64,
    pub schedule_end_hour:   i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    pub autostart: Option<bool>,
    pub open_on_secondary_monitor: Option<bool>,
    pub theme: Option<String>,
    pub shortcuts: Option<String>,
    pub mic_device_id: Option<String>,
    pub deepgram_api_key: Option<String>,
    pub groq_api_key: Option<String>,
    pub groq_model: Option<String>,
    pub pomodoro_work: Option<i64>,
    pub pomodoro_break: Option<i64>,
    pub pomodoro_long_break: Option<i64>,
    pub pomodoro_long_break_interval: Option<i64>,
    pub schedule_start_hour: Option<i64>,
    pub schedule_end_hour:   Option<i64>,
}

fn row_to_settings(row: &rusqlite::Row) -> rusqlite::Result<Settings> {
    Ok(Settings {
        autostart: row.get::<_, i64>(0)? != 0,
        open_on_secondary_monitor: row.get::<_, i64>(1)? != 0,
        theme: row.get(2)?,
        shortcuts: row.get(3)?,
        mic_device_id:    row.get(4).unwrap_or_default(),
        deepgram_api_key: row.get(5).unwrap_or_default(),
        groq_api_key:     row.get(6).unwrap_or_default(),
        groq_model:       row.get(7).unwrap_or_else(|_| "llama-3.3-70b-versatile".to_string()),
        pomodoro_work:                  row.get(8).unwrap_or(25),
        pomodoro_break:                 row.get(9).unwrap_or(5),
        pomodoro_long_break:            row.get(10).unwrap_or(15),
        pomodoro_long_break_interval:   row.get(11).unwrap_or(4),
        schedule_start_hour:            row.get(12).unwrap_or(7),
        schedule_end_hour:              row.get(13).unwrap_or(22),
    })
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, AppState>) -> Result<Settings, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT autostart, open_on_secondary_monitor, theme, shortcuts, \
                    mic_device_id, deepgram_api_key, groq_api_key, groq_model, \
                    pomodoro_work, pomodoro_break, pomodoro_long_break, pomodoro_long_break_interval, \
                    schedule_start_hour, schedule_end_hour \
             FROM settings WHERE id = 1",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row(params![], row_to_settings)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    patch: UpdateSettingsInput,
) -> Result<Settings, String> {
    let current = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(
                "SELECT autostart, open_on_secondary_monitor, theme, shortcuts, \
                        mic_device_id, deepgram_api_key, groq_api_key, groq_model, \
                        pomodoro_work, pomodoro_break, pomodoro_long_break, pomodoro_long_break_interval, \
                        schedule_start_hour, schedule_end_hour \
                 FROM settings WHERE id = 1",
            )
            .map_err(|e| e.to_string())?;
        stmt.query_row(params![], row_to_settings)
            .map_err(|e| e.to_string())?
    };

    let updated = Settings {
        autostart: patch.autostart.unwrap_or(current.autostart),
        open_on_secondary_monitor: patch
            .open_on_secondary_monitor
            .unwrap_or(current.open_on_secondary_monitor),
        theme: patch.theme.unwrap_or(current.theme),
        shortcuts: patch.shortcuts.unwrap_or(current.shortcuts),
        mic_device_id:    patch.mic_device_id.unwrap_or(current.mic_device_id),
        deepgram_api_key: patch.deepgram_api_key.unwrap_or(current.deepgram_api_key),
        groq_api_key:     patch.groq_api_key.unwrap_or(current.groq_api_key),
        groq_model:       patch.groq_model.unwrap_or(current.groq_model),
        pomodoro_work:                patch.pomodoro_work.unwrap_or(current.pomodoro_work),
        pomodoro_break:               patch.pomodoro_break.unwrap_or(current.pomodoro_break),
        pomodoro_long_break:          patch.pomodoro_long_break.unwrap_or(current.pomodoro_long_break),
        pomodoro_long_break_interval: patch.pomodoro_long_break_interval.unwrap_or(current.pomodoro_long_break_interval),
        schedule_start_hour:          patch.schedule_start_hour.unwrap_or(current.schedule_start_hour),
        schedule_end_hour:            patch.schedule_end_hour.unwrap_or(current.schedule_end_hour),
    };

    // Sync system autostart when the flag changes.
    if updated.autostart != current.autostart {
        use tauri_plugin_autostart::ManagerExt;
        if updated.autostart {
            app.autolaunch().enable().map_err(|e| e.to_string())?;
        } else {
            app.autolaunch().disable().map_err(|e| e.to_string())?;
        }
    }

    {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.execute(
            "UPDATE settings \
             SET autostart=?1, open_on_secondary_monitor=?2, theme=?3, shortcuts=?4, \
                 mic_device_id=?5, deepgram_api_key=?6, \
                 groq_api_key=?7, groq_model=?8, \
                 pomodoro_work=?9, pomodoro_break=?10, pomodoro_long_break=?11, \
                 pomodoro_long_break_interval=?12, \
                 schedule_start_hour=?13, schedule_end_hour=?14 \
             WHERE id=1",
            params![
                updated.autostart as i64,
                updated.open_on_secondary_monitor as i64,
                updated.theme,
                updated.shortcuts,
                updated.mic_device_id,
                updated.deepgram_api_key,
                updated.groq_api_key,
                updated.groq_model,
                updated.pomodoro_work,
                updated.pomodoro_break,
                updated.pomodoro_long_break,
                updated.pomodoro_long_break_interval,
                updated.schedule_start_hour,
                updated.schedule_end_hour,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    let _ = app.emit("settings-changed", &updated);

    Ok(updated)
}
