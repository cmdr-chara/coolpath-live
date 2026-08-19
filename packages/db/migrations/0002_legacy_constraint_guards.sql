-- Databases created before versioned migrations already contain these tables,
-- so 0000's CREATE TABLE IF NOT EXISTS statements cannot add its CHECK clauses.
-- These triggers provide equivalent enforcement without rebuilding tables or
-- risking the existing foreign-key graph. New databases keep both the native
-- CHECK clauses and these defensive guards.

CREATE TRIGGER IF NOT EXISTS guard_sources_constraints_insert
BEFORE INSERT ON sources
WHEN NEW.freshness_ttl_minutes <= 0
  OR NEW.enabled NOT IN (0, 1)
  OR NEW.current_state NOT IN (
    'UNINITIALIZED', 'CHECKING', 'HEALTHY', 'DEGRADED', 'STALE', 'BROKEN',
    'HEALING', 'REVIEW_PENDING', 'RECOVERED'
  )
  OR NEW.mode NOT IN ('real', 'mock')
BEGIN
  SELECT RAISE(ABORT, 'sources constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_sources_constraints_update
BEFORE UPDATE ON sources
WHEN NEW.freshness_ttl_minutes <= 0
  OR NEW.enabled NOT IN (0, 1)
  OR NEW.current_state NOT IN (
    'UNINITIALIZED', 'CHECKING', 'HEALTHY', 'DEGRADED', 'STALE', 'BROKEN',
    'HEALING', 'REVIEW_PENDING', 'RECOVERED'
  )
  OR NEW.mode NOT IN ('real', 'mock')
BEGIN
  SELECT RAISE(ABORT, 'sources constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_ingest_runs_constraints_insert
BEFORE INSERT ON ingest_runs
WHEN NEW.outcome NOT IN ('publishable', 'review_required', 'quarantined', 'inconclusive')
  OR NEW.record_count < 0
BEGIN
  SELECT RAISE(ABORT, 'ingest_runs constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_ingest_runs_constraints_update
BEFORE UPDATE ON ingest_runs
WHEN NEW.outcome NOT IN ('publishable', 'review_required', 'quarantined', 'inconclusive')
  OR NEW.record_count < 0
BEGIN
  SELECT RAISE(ABORT, 'ingest_runs constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_incidents_constraints_insert
BEFORE INSERT ON incidents
WHEN NEW.severity NOT IN ('warning', 'critical')
  OR NEW.heal_state NOT IN (
    'not_requested', 'running', 'review_pending', 'approved', 'rejected', 'failed'
  )
BEGIN
  SELECT RAISE(ABORT, 'incidents constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_incidents_constraints_update
BEFORE UPDATE ON incidents
WHEN NEW.severity NOT IN ('warning', 'critical')
  OR NEW.heal_state NOT IN (
    'not_requested', 'running', 'review_pending', 'approved', 'rejected', 'failed'
  )
BEGIN
  SELECT RAISE(ABORT, 'incidents constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_timeline_events_constraints_insert
BEFORE INSERT ON timeline_events
WHEN NEW.tone NOT IN ('neutral', 'positive', 'warning', 'critical')
BEGIN
  SELECT RAISE(ABORT, 'timeline_events constraint violation');
END;

CREATE TRIGGER IF NOT EXISTS guard_timeline_events_constraints_update
BEFORE UPDATE ON timeline_events
WHEN NEW.tone NOT IN ('neutral', 'positive', 'warning', 'critical')
BEGIN
  SELECT RAISE(ABORT, 'timeline_events constraint violation');
END;
