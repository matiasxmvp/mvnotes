CREATE TABLE IF NOT EXISTS study_notes (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  task_id    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_notes_task_id    ON study_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_updated_at ON study_notes(updated_at DESC);
