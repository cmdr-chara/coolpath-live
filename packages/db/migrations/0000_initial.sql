CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  region TEXT NOT NULL,
  timezone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id),
  agency_name TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  allowed_origins_json TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  freshness_ttl_minutes INTEGER NOT NULL CHECK(freshness_ttl_minutes > 0),
  policy_version TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0, 1)),
  published_snapshot_id TEXT,
  current_state TEXT NOT NULL CHECK(current_state IN (
    'UNINITIALIZED', 'CHECKING', 'HEALTHY', 'DEGRADED', 'STALE', 'BROKEN',
    'HEALING', 'REVIEW_PENDING', 'RECOVERED'
  )),
  mode TEXT NOT NULL CHECK(mode IN ('real', 'mock'))
);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  started_at TEXT NOT NULL,
  fetched_at TEXT,
  completed_at TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN (
    'publishable', 'review_required', 'quarantined', 'inconclusive'
  )),
  collector_id TEXT NOT NULL,
  collector_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  record_count INTEGER NOT NULL CHECK(record_count >= 0),
  raw_sha256 TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  validation_summary_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  run_id TEXT NOT NULL REFERENCES ingest_runs(id),
  observed_at TEXT NOT NULL,
  source_reported_updated_at TEXT,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('candidate','quarantined','published','superseded')),
  promoted_at TEXT,
  sites_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  run_id TEXT NOT NULL REFERENCES ingest_runs(id),
  severity TEXT NOT NULL CHECK(severity IN ('warning', 'critical')),
  reason_codes_json TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  heal_state TEXT NOT NULL CHECK(heal_state IN (
    'not_requested', 'running', 'review_pending', 'approved', 'rejected', 'failed'
  )),
  heal_job_id TEXT,
  heal_prompt TEXT,
  heal_diff_json TEXT,
  resolved_by_run_id TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL CHECK(tone IN ('neutral', 'positive', 'warning', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_snapshots_source_status ON snapshots(source_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_source_started ON ingest_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_source_open ON incidents(source_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_timeline_source_time ON timeline_events(source_id, occurred_at DESC);
