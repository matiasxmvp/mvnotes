use chrono::{Datelike, Duration, NaiveDate, Utc, Weekday};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use uuid::Uuid;

use crate::AppState;

// ---- Types ---------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub scope: String,
    pub date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub completed: bool,
    pub tags: Option<String>,
    pub recurrence: Option<String>,
    pub recurrence_parent_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub scope: String,
    pub date: String,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub tags: Option<String>,
    pub recurrence: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub scope: Option<String>,
    pub date: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub completed: Option<bool>,
    pub tags: Option<String>,
    pub recurrence: Option<String>,
}

// ---- Helpers -------------------------------------------------------------

fn row_to_task(row: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id:          row.get(0)?,
        title:       row.get(1)?,
        description: row.get(2)?,
        status:      row.get(3)?,
        scope:       row.get(4)?,
        date:        row.get(5)?,
        start_time:  row.get(6)?,
        end_time:    row.get(7)?,
        completed:   row.get::<_, i64>(8)? != 0,
        tags:        row.get(9)?,
        recurrence:           row.get(10)?,
        recurrence_parent_id: row.get(11)?,
        created_at:  row.get(12)?,
        updated_at:  row.get(13)?,
    })
}

const COLS: &str =
    "id, title, description, status, scope, date, \
     start_time, end_time, completed, tags, recurrence, recurrence_parent_id, \
     created_at, updated_at";

const STATUS_ORDER: &str =
    "CASE status WHEN 'obligatorio' THEN 0 WHEN 'importante' THEN 1 ELSE 2 END";

// Collect tasks from a prepared statement — helper to keep lifetime clear.
fn collect_tasks(conn: &Connection, sql: &str, params: &[&dyn rusqlite::types::ToSql]) -> Result<Vec<Task>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows: Vec<Task> = stmt
        .query_map(params, row_to_task)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

// ---- Recurrence ------------------------------------------------------------
//
// A task with `recurrence` set is a template; its own row is the first
// occurrence. When a date/range is queried we materialize missing occurrences
// as plain task rows linked via `recurrence_parent_id`, so each day can be
// completed/edited independently.

const MAX_MATERIALIZE_DAYS: i64 = 92;

fn recurrence_matches(rule: &str, day: NaiveDate, template_date: NaiveDate) -> bool {
    match rule {
        "daily" => true,
        "weekdays" => !matches!(day.weekday(), Weekday::Sat | Weekday::Sun),
        "weekly" => day.weekday() == template_date.weekday(),
        _ => false,
    }
}

fn materialize_recurring(db: &Connection, start: &str, end: &str) -> Result<(), String> {
    let (Ok(start_d), Ok(end_d)) = (
        NaiveDate::parse_from_str(start, "%Y-%m-%d"),
        NaiveDate::parse_from_str(end, "%Y-%m-%d"),
    ) else {
        return Ok(()); // malformed range — nothing to materialize
    };
    if end_d < start_d || (end_d - start_d).num_days() > MAX_MATERIALIZE_DAYS {
        return Ok(());
    }

    let sql = format!(
        "SELECT {COLS} FROM tasks \
         WHERE recurrence IS NOT NULL AND recurrence_parent_id IS NULL AND date <= ?1"
    );
    let templates = collect_tasks(db, &sql, &[&end])?;
    let now = Utc::now().to_rfc3339();

    for t in templates {
        let Ok(t_date) = NaiveDate::parse_from_str(&t.date, "%Y-%m-%d") else { continue };
        let rule = t.recurrence.as_deref().unwrap_or("");

        let mut day = start_d.max(t_date + Duration::days(1));
        while day <= end_d {
            if recurrence_matches(rule, day, t_date) {
                let d = day.format("%Y-%m-%d").to_string();
                let exists: bool = db
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM tasks \
                         WHERE recurrence_parent_id = ?1 AND date = ?2)",
                        params![t.id, d],
                        |row| row.get::<_, i64>(0),
                    )
                    .map(|v| v != 0)
                    .map_err(|e| e.to_string())?;

                if !exists {
                    db.execute(
                        "INSERT INTO tasks \
                         (id, title, description, status, scope, date, start_time, end_time, \
                          completed, tags, recurrence, recurrence_parent_id, created_at, updated_at) \
                         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,?9,NULL,?10,?11,?11)",
                        params![
                            Uuid::new_v4().to_string(), t.title, t.description, t.status,
                            t.scope, d, t.start_time, t.end_time, t.tags, t.id, now,
                        ],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
            day += Duration::days(1);
        }
    }
    Ok(())
}

// ---- Commands ------------------------------------------------------------

#[tauri::command]
pub fn get_tasks(
    state: tauri::State<'_, AppState>,
    date: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Task>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    if let Some(d) = date {
        materialize_recurring(&db, &d, &d)?;
        let sql = format!(
            "SELECT {COLS} FROM tasks WHERE date = ?1 ORDER BY {STATUS_ORDER}, created_at"
        );
        collect_tasks(&db, &sql, &[&d])
    } else if let (Some(start), Some(end)) = (start_date, end_date) {
        materialize_recurring(&db, &start, &end)?;
        let sql = format!(
            "SELECT {COLS} FROM tasks WHERE date >= ?1 AND date <= ?2 ORDER BY date, {STATUS_ORDER}"
        );
        collect_tasks(&db, &sql, &[&start, &end])
    } else {
        let sql = format!(
            "SELECT {COLS} FROM tasks ORDER BY date, {STATUS_ORDER}, created_at"
        );
        collect_tasks(&db, &sql, &[])
    }
}

#[tauri::command]
pub fn create_task(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    task: CreateTaskInput,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    db.execute(
        "INSERT INTO tasks \
         (id, title, description, status, scope, date, \
          start_time, end_time, completed, tags, recurrence, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,0,?9,?10,?11,?11)",
        params![
            id, task.title, task.description, task.status, task.scope,
            task.date, task.start_time, task.end_time, task.tags,
            task.recurrence, now,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Lets other windows (main ↔ quick-capture) refresh their task lists.
    let _ = app.emit("tasks-changed", ());

    Ok(Task {
        id,
        title:       task.title,
        description: task.description,
        status:      task.status,
        scope:       task.scope,
        date:        task.date,
        start_time:  task.start_time,
        end_time:    task.end_time,
        completed:   false,
        tags:        task.tags,
        recurrence:           task.recurrence,
        recurrence_parent_id: None,
        created_at:  now.clone(),
        updated_at:  now,
    })
}

#[tauri::command]
pub fn update_task(
    state: tauri::State<'_, AppState>,
    id: String,
    patch: UpdateTaskInput,
) -> Result<Task, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let current = db.query_row(
        &format!("SELECT {COLS} FROM tasks WHERE id = ?1"),
        params![id],
        row_to_task,
    )
    .map_err(|e| e.to_string())?;

    let now = Utc::now().to_rfc3339();
    // "none"/"" clears the recurrence (Option<Option<_>> is not expressible in the patch).
    let recurrence = match patch.recurrence {
        Some(r) if r.is_empty() || r == "none" => None,
        Some(r) => Some(r),
        None => current.recurrence,
    };
    let updated = Task {
        id:          current.id,
        title:       patch.title.unwrap_or(current.title),
        description: patch.description.or(current.description),
        status:      patch.status.unwrap_or(current.status),
        scope:       patch.scope.unwrap_or(current.scope),
        date:        patch.date.unwrap_or(current.date),
        start_time:  patch.start_time.or(current.start_time),
        end_time:    patch.end_time.or(current.end_time),
        completed:   patch.completed.unwrap_or(current.completed),
        tags:        patch.tags.or(current.tags),
        recurrence,
        recurrence_parent_id: current.recurrence_parent_id,
        created_at:  current.created_at,
        updated_at:  now,
    };

    db.execute(
        "UPDATE tasks SET title=?1, description=?2, status=?3, scope=?4, date=?5, \
         start_time=?6, end_time=?7, completed=?8, tags=?9, recurrence=?10, updated_at=?11 \
         WHERE id=?12",
        params![
            updated.title, updated.description, updated.status, updated.scope,
            updated.date, updated.start_time, updated.end_time,
            updated.completed as i64, updated.tags, updated.recurrence,
            updated.updated_at, updated.id,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(updated)
}

#[tauri::command]
pub fn delete_task(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
