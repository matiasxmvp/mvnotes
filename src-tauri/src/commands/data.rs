use crate::AppState;

/// Wipes all user-generated data and resets settings to defaults.
/// Called from the Settings view after explicit user confirmation.
#[tauri::command]
pub fn reset_data(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute_batch(
        "DELETE FROM tasks;
         DELETE FROM notes;
         DELETE FROM whiteboards;
         UPDATE settings
         SET autostart = 0,
             open_on_secondary_monitor = 1,
             theme = 'dark',
             shortcuts = '{\"newTask\":\"Ctrl+N\"}'
         WHERE id = 1;",
    )
    .map_err(|e| e.to_string())
}
