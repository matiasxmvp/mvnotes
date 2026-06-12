use chrono::Utc;
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::AppState;

// ---- Types ---------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StudyNote {
    pub id:         String,
    pub title:      String,
    pub content:    String,
    pub tags:       Vec<String>,
    pub task_id:    Option<String>,
    pub task_title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStudyNoteInput {
    pub title:   String,
    pub content: String,
    pub task_id: Option<String>,
    pub tags:    Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStudyNoteInput {
    pub title:   Option<String>,
    pub content: Option<String>,
    // Option<Option<String>>: Some(None) = explicit unlink, None = not provided
    #[serde(default)]
    pub task_id: Option<Option<String>>,
    pub tags:    Option<Vec<String>>,
}

// ---- Helper --------------------------------------------------------------

fn row_to_note(row: &Row) -> rusqlite::Result<StudyNote> {
    let tags_str: String = row.get::<_, String>(3).unwrap_or_else(|_| "[]".to_string());
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(StudyNote {
        id:         row.get(0)?,
        title:      row.get(1)?,
        content:    row.get(2)?,
        tags,
        task_id:    row.get(4)?,
        task_title: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

const SELECT: &str =
    "SELECT sn.id, sn.title, sn.content, sn.tags, sn.task_id, t.title AS task_title, \
             sn.created_at, sn.updated_at \
     FROM study_notes sn \
     LEFT JOIN tasks t ON sn.task_id = t.id";

// ---- Helpers -------------------------------------------------------------

fn query_notes(conn: &rusqlite::Connection, sql: &str, search: &str) -> Result<Vec<StudyNote>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows: Vec<StudyNote> = stmt
        .query_map(params![search], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn fetch_one(conn: &rusqlite::Connection, id: &str) -> Result<StudyNote, String> {
    let sql = format!("{SELECT} WHERE sn.id = ?1");
    conn.query_row(&sql, params![id], row_to_note)
        .map_err(|e| e.to_string())
}

// ---- Commands ------------------------------------------------------------

#[tauri::command]
pub fn get_study_notes(
    state: tauri::State<'_, AppState>,
    search: Option<String>,
) -> Result<Vec<StudyNote>, String> {
    let db    = state.db.lock().map_err(|e| e.to_string())?;
    let query = search.unwrap_or_default();
    let sql   = format!(
        "{SELECT} \
         WHERE (sn.title LIKE '%' || ?1 || '%' OR sn.content LIKE '%' || ?1 || '%') \
         ORDER BY sn.updated_at DESC"
    );
    query_notes(&db, &sql, &query)
}

#[tauri::command]
pub fn create_study_note(
    state: tauri::State<'_, AppState>,
    input: CreateStudyNoteInput,
) -> Result<StudyNote, String> {
    let db       = state.db.lock().map_err(|e| e.to_string())?;
    let id       = Uuid::new_v4().to_string();
    let now      = Utc::now().to_rfc3339();
    let tags_str = serde_json::to_string(&input.tags.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());

    db.execute(
        "INSERT INTO study_notes (id, title, content, tags, task_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![id, input.title, input.content, tags_str, input.task_id, now],
    )
    .map_err(|e| e.to_string())?;

    fetch_one(&db, &id)
}

#[tauri::command]
pub fn update_study_note(
    state: tauri::State<'_, AppState>,
    id: String,
    patch: UpdateStudyNoteInput,
) -> Result<StudyNote, String> {
    let db      = state.db.lock().map_err(|e| e.to_string())?;
    let now     = Utc::now().to_rfc3339();
    let current = fetch_one(&db, &id)?;

    let new_title   = patch.title.unwrap_or(current.title);
    let new_content = patch.content.unwrap_or(current.content);
    // Some(None) = explicit unlink, Some(Some(id)) = relink, None = keep current
    let new_task_id = match patch.task_id {
        Some(v) => v,
        None    => current.task_id,
    };
    let new_tags = patch.tags.unwrap_or(current.tags);
    let tags_str = serde_json::to_string(&new_tags).unwrap_or_else(|_| "[]".to_string());

    db.execute(
        "UPDATE study_notes SET title=?1, content=?2, tags=?3, task_id=?4, updated_at=?5 WHERE id=?6",
        params![new_title, new_content, tags_str, new_task_id, now, id],
    )
    .map_err(|e| e.to_string())?;

    fetch_one(&db, &id)
}

#[tauri::command]
pub fn delete_study_note(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM study_notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
