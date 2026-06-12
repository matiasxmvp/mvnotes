ALTER TABLE settings ADD COLUMN pomodoro_work              INTEGER NOT NULL DEFAULT 25;
ALTER TABLE settings ADD COLUMN pomodoro_break             INTEGER NOT NULL DEFAULT 5;
ALTER TABLE settings ADD COLUMN pomodoro_long_break        INTEGER NOT NULL DEFAULT 15;
ALTER TABLE settings ADD COLUMN pomodoro_long_break_interval INTEGER NOT NULL DEFAULT 4;
