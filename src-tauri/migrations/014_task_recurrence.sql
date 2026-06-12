-- Recurring tasks: 'daily' | 'weekdays' | 'weekly' on the template row.
-- Materialized occurrences point back via recurrence_parent_id.
ALTER TABLE tasks ADD COLUMN recurrence TEXT;
ALTER TABLE tasks ADD COLUMN recurrence_parent_id TEXT;
