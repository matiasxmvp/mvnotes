ALTER TABLE whiteboards ADD COLUMN task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whiteboards_task_id ON whiteboards(task_id);
