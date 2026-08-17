import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cities = sqliteTable("cities", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  region: text("region").notNull(),
  timezone: text("timezone").notNull()
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  cityId: text("city_id").notNull(),
  agencyName: text("agency_name").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  allowedOriginsJson: text("allowed_origins_json").notNull(),
  collectorId: text("collector_id").notNull(),
  freshnessTtlMinutes: integer("freshness_ttl_minutes").notNull(),
  policyVersion: text("policy_version").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  publishedSnapshotId: text("published_snapshot_id"),
  currentState: text("current_state").notNull(),
  mode: text("mode").notNull()
});

export const ingestRuns = sqliteTable("ingest_runs", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  startedAt: text("started_at").notNull(),
  fetchedAt: text("fetched_at"),
  completedAt: text("completed_at"),
  outcome: text("outcome").notNull(),
  collectorId: text("collector_id").notNull(),
  collectorVersion: text("collector_version").notNull(),
  schemaVersion: text("schema_version").notNull(),
  recordCount: integer("record_count").notNull(),
  rawSha256: text("raw_sha256").notNull(),
  reasonCodesJson: text("reason_codes_json").notNull(),
  validationSummaryJson: text("validation_summary_json").notNull()
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  runId: text("run_id").notNull(),
  observedAt: text("observed_at").notNull(),
  sourceReportedUpdatedAt: text("source_reported_updated_at"),
  contentHash: text("content_hash").notNull(),
  status: text("status").notNull(),
  promotedAt: text("promoted_at"),
  sitesJson: text("sites_json").notNull()
});

export const incidents = sqliteTable("incidents", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  runId: text("run_id").notNull(),
  severity: text("severity").notNull(),
  reasonCodesJson: text("reason_codes_json").notNull(),
  openedAt: text("opened_at").notNull(),
  healState: text("heal_state").notNull(),
  healJobId: text("heal_job_id"),
  healPrompt: text("heal_prompt"),
  healDiffJson: text("heal_diff_json"),
  resolvedByRunId: text("resolved_by_run_id"),
  resolvedAt: text("resolved_at")
});

export const timelineEvents = sqliteTable("timeline_events", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  occurredAt: text("occurred_at").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  tone: text("tone").notNull()
});
