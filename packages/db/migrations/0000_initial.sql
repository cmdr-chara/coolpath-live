PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  region TEXT NOT NULL,
  timezone TEXT NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id),
  agency_name TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  allowed_origins_json TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  freshness_ttl_minutes INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  published_snapshot_id TEXT,
  current_state TEXT NOT NULL,
  mode TEXT NOT NULL
);

CREATE TABLE ingest_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  started_at TEXT NOT NULL,
  fetched_at TEXT,
  completed_at TEXT,
  outcome TEXT NOT NULL,
  collector_id TEXT NOT NULL,
  collector_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  record_count INTEGER NOT NULL,
  raw_sha256 TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  validation_summary_json TEXT NOT NULL
);

CREATE TABLE snapshots (
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

CREATE TABLE incidents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  run_id TEXT NOT NULL REFERENCES ingest_runs(id),
  severity TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  heal_state TEXT NOT NULL,
  heal_job_id TEXT,
  heal_prompt TEXT,
  heal_diff_json TEXT,
  resolved_by_run_id TEXT,
  resolved_at TEXT
);

CREATE TABLE timeline_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL
);
