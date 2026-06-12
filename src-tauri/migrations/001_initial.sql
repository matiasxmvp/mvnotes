-- ============================================================
-- Pizarra Dev — initial schema
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------
-- Tasks
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT    PRIMARY KEY,
    title       TEXT    NOT NULL,
    description TEXT,
    status      TEXT    NOT NULL CHECK(status IN ('obligatorio','importante','prescindible')),
    scope       TEXT    NOT NULL CHECK(scope   IN ('day','week','month','year')),
    date        TEXT    NOT NULL,   -- ISO-8601 YYYY-MM-DD
    start_time  TEXT,               -- HH:MM  (nullable)
    end_time    TEXT,               -- HH:MM  (nullable)
    completed   INTEGER NOT NULL DEFAULT 0,
    tags        TEXT,               -- JSON array e.g. '["trabajo","personal"]'
    created_at  TEXT    NOT NULL,   -- RFC-3339
    updated_at  TEXT    NOT NULL    -- RFC-3339
);

CREATE INDEX IF NOT EXISTS idx_tasks_date   ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scope  ON tasks(scope);

-- ------------------------------------------------------------
-- Daily notes (one per day)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
    id         TEXT PRIMARY KEY,
    content    TEXT NOT NULL DEFAULT '',
    date       TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);

-- ------------------------------------------------------------
-- Whiteboards (tldraw documents)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whiteboards (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL DEFAULT '{}',  -- tldraw serialised JSON
    thumbnail  TEXT,                         -- base64 PNG (nullable)
    updated_at TEXT NOT NULL
);

-- ------------------------------------------------------------
-- Settings (singleton row, id always = 1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    id                         INTEGER PRIMARY KEY CHECK(id = 1),
    autostart                  INTEGER NOT NULL DEFAULT 0,
    open_on_secondary_monitor  INTEGER NOT NULL DEFAULT 1,
    theme                      TEXT    NOT NULL DEFAULT 'dark',  -- 'light'|'dark'|'auto'
    shortcuts                  TEXT    NOT NULL DEFAULT '{"newTask":"Ctrl+N"}'
);

INSERT OR IGNORE INTO settings
    (id, autostart, open_on_secondary_monitor, theme, shortcuts)
VALUES
    (1, 0, 1, 'dark', '{"newTask":"Ctrl+N"}');
