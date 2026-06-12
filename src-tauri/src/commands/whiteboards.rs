use chrono::Utc;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Whiteboard {
    pub id: String,
    pub name: String,
    pub data: String,
    pub thumbnail: Option<String>,
    pub task_id: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWhiteboardInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWhiteboardInput {
    pub name: Option<String>,
    pub data: Option<String>,
    pub thumbnail: Option<String>,
}

const COLS: &str = "id, name, data, thumbnail, task_id, updated_at";

fn row_to_wb(row: &rusqlite::Row) -> rusqlite::Result<Whiteboard> {
    Ok(Whiteboard {
        id:         row.get(0)?,
        name:       row.get(1)?,
        data:       row.get(2)?,
        thumbnail:  row.get(3)?,
        task_id:    row.get(4)?,
        updated_at: row.get(5)?,
    })
}

#[tauri::command]
pub fn get_whiteboards(state: tauri::State<'_, AppState>) -> Result<Vec<Whiteboard>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {COLS} FROM whiteboards ORDER BY updated_at DESC");
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let wbs: Vec<Whiteboard> = stmt
        .query_map(params![], row_to_wb)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(wbs)
}

#[tauri::command]
pub fn get_whiteboard(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<Option<Whiteboard>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {COLS} FROM whiteboards WHERE id = ?1");

    let result = db.query_row(&sql, params![id], row_to_wb);

    match result {
        Ok(wb)                                    => Ok(Some(wb)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e)                                    => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn create_whiteboard(
    state: tauri::State<'_, AppState>,
    input: CreateWhiteboardInput,
) -> Result<Whiteboard, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO whiteboards (id, name, data, thumbnail, task_id, updated_at) \
         VALUES (?1,?2,'{}',NULL,NULL,?3)",
        params![id, input.name, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Whiteboard {
        id,
        name: input.name,
        data: "{}".into(),
        thumbnail: None,
        task_id: None,
        updated_at: now,
    })
}

#[tauri::command]
pub fn update_whiteboard(
    state: tauri::State<'_, AppState>,
    id: String,
    patch: UpdateWhiteboardInput,
) -> Result<Whiteboard, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let sql = format!("SELECT {COLS} FROM whiteboards WHERE id = ?1");

    let current = db.query_row(&sql, params![id], row_to_wb)
        .map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    let updated = Whiteboard {
        id:         current.id,
        name:       patch.name.unwrap_or(current.name),
        data:       patch.data.unwrap_or(current.data),
        thumbnail:  patch.thumbnail.or(current.thumbnail),
        task_id:    current.task_id,
        updated_at: now,
    };

    db.execute(
        "UPDATE whiteboards SET name=?1, data=?2, thumbnail=?3, updated_at=?4 WHERE id=?5",
        params![updated.name, updated.data, updated.thumbnail, updated.updated_at, updated.id],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn set_whiteboard_task(
    state: tauri::State<'_, AppState>,
    id: String,
    task_id: Option<String>,
) -> Result<Whiteboard, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();

    db.execute(
        "UPDATE whiteboards SET task_id=?1, updated_at=?2 WHERE id=?3",
        params![task_id, now, id],
    )
    .map_err(|e| e.to_string())?;

    let sql = format!("SELECT {COLS} FROM whiteboards WHERE id = ?1");
    db.query_row(&sql, params![id], row_to_wb)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_whiteboard(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM whiteboards WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
