CREATE UNIQUE INDEX IF NOT EXISTS idx_incidents_one_open_per_source
ON incidents(source_id)
WHERE resolved_at IS NULL;
