use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub content: String,
    pub date: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn get_note(
    state: tauri::State<'_, AppState>,
    date: String,
) -> Result<Option<Note>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result = db.query_row(
        "SELECT id, content, date, updated_at FROM notes WHERE date = ?1",
        params![date],
        |row| {
            Ok(Note {
                id:         row.get(0)?,
                content:    row.get(1)?,
                date:       row.get(2)?,
                updated_at: row.get(3)?,
            })
        },
    );

    match result {
        Ok(note)                                   => Ok(Some(note)),
        Err(rusqlite::Error::QueryReturnedNoRows)  => Ok(None),
        Err(e)                                     => Err(e.to_string()),
    }
}

/// Returns every note ordered by date. Used by backup export.
#[tauri::command]
pub fn get_all_notes(state: tauri::State<'_, AppState>) -> Result<Vec<Note>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, content, date, updated_at FROM notes ORDER BY date")
        .map_err(|e| e.to_string())?;

    // Bind result explicitly before `stmt` and `db` go out of scope.
    let notes: Vec<Note> = stmt
        .query_map(params![], |row| {
            Ok(Note {
                id:         row.get(0)?,
                content:    row.get(1)?,
                date:       row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(notes)
}

/// Inserts or replaces the note for a given day (one note per day).
#[tauri::command]
pub fn upsert_note(
    state: tauri::State<'_, AppState>,
    date: String,
    content: String,
) -> Result<Note, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    let existing_id: Option<String> = {
        let result = db.query_row(
            "SELECT id FROM notes WHERE date = ?1",
            params![date],
            |row| row.get(0),
        );
        match result {
            Ok(id)                                    => Some(id),
            Err(rusqlite::Error::QueryReturnedNoRows) => None,
            Err(e)                                    => return Err(e.to_string()),
        }
    };

    let id = existing_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    db.execute(
        "INSERT INTO notes (id, content, date, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at",
        params![id, content, date, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Note { id, content, date, updated_at: now })
}
