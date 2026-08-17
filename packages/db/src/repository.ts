import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { City, CoolingSite, Source, SourceState, ValidationSummary } from "@coolpath/domain";
import Database from "better-sqlite3";
import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { cities, incidents, ingestRuns, snapshots, sources, timelineEvents } from "./schema.js";

export interface StoredSnapshot {
  id: string;
  sourceId: string;
  runId: string;
  observedAt: string;
  sourceReportedUpdatedAt: string | null;
  contentHash: string;
  status: "candidate" | "quarantined" | "published" | "superseded";
  promotedAt: string | null;
  sites: CoolingSite[];
}

export interface StoredSource extends Source {
  currentState: SourceState;
  mode: "real" | "mock";
}

export interface StoredIncident {
  id: string;
  sourceId: string;
  runId: string;
  severity: "warning" | "critical";
  reasonCodes: string[];
  openedAt: string;
  healState: "not_requested" | "running" | "review_pending" | "approved" | "rejected" | "failed";
  healJobId: string | null;
  healPrompt: string | null;
  healDiff: Array<{ field: string; before: string; after: string }>;
  resolvedByRunId: string | null;
  resolvedAt: string | null;
}

export interface TimelineEvent {
  id: string;
  sourceId: string;
  occurredAt: string;
  kind: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

const migration = `
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
  freshness_ttl_minutes INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  published_snapshot_id TEXT,
  current_state TEXT NOT NULL,
  mode TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ingest_runs (
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
CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  tone TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_snapshots_source_status ON snapshots(source_id, status);
CREATE INDEX IF NOT EXISTS idx_runs_source_started ON ingest_runs(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_source_open ON incidents(source_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_timeline_source_time ON timeline_events(source_id, occurred_at DESC);
`;

export class CoolPathRepository {
  private readonly sqlite: Database.Database;
  private readonly db;

  constructor(databaseUrl: string) {
    if (databaseUrl !== ":memory:") mkdirSync(dirname(databaseUrl), { recursive: true });
    this.sqlite = new Database(databaseUrl);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    this.sqlite.exec(migration);
    this.db = drizzle(this.sqlite);
  }

  close(): void {
    this.sqlite.close();
  }

  reset(): void {
    this.sqlite.exec(
      "DELETE FROM timeline_events; DELETE FROM incidents; DELETE FROM snapshots; DELETE FROM ingest_runs; DELETE FROM sources; DELETE FROM cities;"
    );
  }

  upsertCity(city: City): void {
    this.db
      .insert(cities)
      .values(city)
      .onConflictDoUpdate({
        target: cities.id,
        set: {
          slug: city.slug,
          displayName: city.displayName,
          region: city.region,
          timezone: city.timezone
        }
      })
      .run();
  }

  upsertSource(
    source: Omit<StoredSource, "publishedSnapshotId"> & { publishedSnapshotId?: string | null }
  ): void {
    const values = {
      id: source.id,
      cityId: source.cityId,
      agencyName: source.agencyName,
      canonicalUrl: source.canonicalUrl,
      allowedOriginsJson: JSON.stringify(source.allowedOrigins),
      collectorId: source.collectorId,
      freshnessTtlMinutes: source.freshnessTtlMinutes,
      policyVersion: source.policyVersion,
      enabled: source.enabled,
      publishedSnapshotId: source.publishedSnapshotId ?? null,
      currentState: source.currentState,
      mode: source.mode
    };
    this.db
      .insert(sources)
      .values(values)
      .onConflictDoUpdate({
        target: sources.id,
        set: {
          agencyName: values.agencyName,
          canonicalUrl: values.canonicalUrl,
          allowedOriginsJson: values.allowedOriginsJson,
          collectorId: values.collectorId,
          freshnessTtlMinutes: values.freshnessTtlMinutes,
          policyVersion: values.policyVersion,
          enabled: values.enabled,
          mode: values.mode
        }
      })
      .run();
  }

  getSource(sourceId: string): StoredSource | null {
    const row = this.db.select().from(sources).where(eq(sources.id, sourceId)).get();
    return row ? this.mapSource(row) : null;
  }

  listCities(): Array<City & { source: StoredSource; publishedSnapshot: StoredSnapshot | null }> {
    return this.db
      .select()
      .from(cities)
      .all()
      .flatMap((city) => {
        const sourceRow = this.db.select().from(sources).where(eq(sources.cityId, city.id)).get();
        if (!sourceRow || !sourceRow.enabled) return [];
        const source = this.mapSource(sourceRow);
        return [{ ...city, source, publishedSnapshot: this.getPublishedSnapshot(source.id) }];
      });
  }

  getCityBySlug(
    slug: string
  ): (City & { source: StoredSource; publishedSnapshot: StoredSnapshot | null }) | null {
    const city = this.db.select().from(cities).where(eq(cities.slug, slug)).get();
    if (!city) return null;
    const sourceRow = this.db.select().from(sources).where(eq(sources.cityId, city.id)).get();
    if (!sourceRow || !sourceRow.enabled) return null;
    const source = this.mapSource(sourceRow);
    return { ...city, source, publishedSnapshot: this.getPublishedSnapshot(source.id) };
  }

  setSourceState(sourceId: string, state: SourceState): void {
    this.db.update(sources).set({ currentState: state }).where(eq(sources.id, sourceId)).run();
  }

  recordRun(input: {
    id: string;
    sourceId: string;
    startedAt: string;
    fetchedAt: string;
    completedAt: string;
    outcome: string;
    collectorId: string;
    collectorVersion: string;
    schemaVersion: string;
    recordCount: number;
    rawSha256: string;
    reasonCodes: string[];
    validationSummary: ValidationSummary;
  }): void {
    this.db
      .insert(ingestRuns)
      .values({
        ...input,
        reasonCodesJson: JSON.stringify(input.reasonCodes),
        validationSummaryJson: JSON.stringify({
          disposition: input.validationSummary.disposition,
          hardFailures: input.validationSummary.hardFailures,
          softAnomalies: input.validationSummary.softAnomalies,
          recordCount: input.validationSummary.recordCount,
          requiredFieldCompleteness: input.validationSummary.requiredFieldCompleteness,
          optionalClaimCoverage: input.validationSummary.optionalClaimCoverage,
          contentHash: input.validationSummary.contentHash
        })
      })
      .run();
  }

  createSnapshot(input: {
    sourceId: string;
    runId: string;
    observedAt: string;
    sourceReportedUpdatedAt?: string;
    contentHash: string;
    status: "candidate" | "quarantined";
    sites: CoolingSite[];
  }): StoredSnapshot {
    const run = this.db.select().from(ingestRuns).where(eq(ingestRuns.id, input.runId)).get();
    if (!run || run.sourceId !== input.sourceId) {
      throw new Error("Snapshot run must belong to the same source");
    }
    const id = randomUUID();
    this.db
      .insert(snapshots)
      .values({
        id,
        sourceId: input.sourceId,
        runId: input.runId,
        observedAt: input.observedAt,
        sourceReportedUpdatedAt: input.sourceReportedUpdatedAt ?? null,
        contentHash: input.contentHash,
        status: input.status,
        promotedAt: null,
        sitesJson: JSON.stringify(input.sites)
      })
      .run();
    return this.getSnapshot(id) as StoredSnapshot;
  }

  promoteSnapshot(sourceId: string, snapshotId: string, promotedAt: string): void {
    this.db.transaction((transaction) => {
      const source = transaction.select().from(sources).where(eq(sources.id, sourceId)).get();
      const candidate = transaction
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.id, snapshotId), eq(snapshots.sourceId, sourceId)))
        .get();
      if (!source || !candidate || candidate.status !== "candidate") {
        throw new Error("Only a candidate snapshot belonging to the source can be promoted");
      }
      if (source.publishedSnapshotId) {
        transaction
          .update(snapshots)
          .set({ status: "superseded" })
          .where(eq(snapshots.id, source.publishedSnapshotId))
          .run();
      }
      transaction
        .update(snapshots)
        .set({ status: "published", promotedAt })
        .where(eq(snapshots.id, snapshotId))
        .run();
      transaction
        .update(sources)
        .set({ publishedSnapshotId: snapshotId })
        .where(eq(sources.id, sourceId))
        .run();
    });
  }

  getSnapshot(snapshotId: string): StoredSnapshot | null {
    const row = this.db.select().from(snapshots).where(eq(snapshots.id, snapshotId)).get();
    return row ? this.mapSnapshot(row) : null;
  }

  getPublishedSnapshot(sourceId: string): StoredSnapshot | null {
    const source = this.db.select().from(sources).where(eq(sources.id, sourceId)).get();
    const snapshot = source?.publishedSnapshotId
      ? this.getSnapshot(source.publishedSnapshotId)
      : null;
    return snapshot?.status === "published" ? snapshot : null;
  }

  getLatestRun(sourceId: string): Record<string, unknown> | null {
    const row = this.db
      .select()
      .from(ingestRuns)
      .where(eq(ingestRuns.sourceId, sourceId))
      .orderBy(desc(ingestRuns.startedAt))
      .get();
    return row ? this.mapRun(row) : null;
  }

  getRun(runId: string): Record<string, unknown> | null {
    const row = this.db.select().from(ingestRuns).where(eq(ingestRuns.id, runId)).get();
    return row ? this.mapRun(row) : null;
  }

  openIncident(input: {
    sourceId: string;
    runId: string;
    severity: "warning" | "critical";
    reasonCodes: string[];
    openedAt: string;
  }): StoredIncident {
    const existing = this.getCurrentIncident(input.sourceId);
    if (existing) {
      this.db
        .update(incidents)
        .set({
          severity:
            existing.severity === "critical" || input.severity === "critical"
              ? "critical"
              : "warning",
          reasonCodesJson: JSON.stringify([
            ...new Set([...existing.reasonCodes, ...input.reasonCodes])
          ])
        })
        .where(eq(incidents.id, existing.id))
        .run();
      return this.getCurrentIncident(input.sourceId) as StoredIncident;
    }
    const id = randomUUID();
    this.db
      .insert(incidents)
      .values({
        id,
        sourceId: input.sourceId,
        runId: input.runId,
        severity: input.severity,
        reasonCodesJson: JSON.stringify(input.reasonCodes),
        openedAt: input.openedAt,
        healState: "not_requested",
        healJobId: null,
        healPrompt: null,
        healDiffJson: "[]",
        resolvedByRunId: null,
        resolvedAt: null
      })
      .run();
    return this.getCurrentIncident(input.sourceId) as StoredIncident;
  }

  getCurrentIncident(sourceId: string): StoredIncident | null {
    const row = this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.sourceId, sourceId), isNull(incidents.resolvedAt)))
      .orderBy(desc(incidents.openedAt))
      .get();
    return row ? this.mapIncident(row) : null;
  }

  updateIncidentHeal(input: {
    incidentId: string;
    healState: StoredIncident["healState"];
    jobId?: string;
    prompt?: string;
    diff?: StoredIncident["healDiff"];
  }): void {
    this.db
      .update(incidents)
      .set({
        healState: input.healState,
        healJobId: input.jobId,
        healPrompt: input.prompt,
        healDiffJson: input.diff ? JSON.stringify(input.diff) : undefined
      })
      .where(eq(incidents.id, input.incidentId))
      .run();
  }

  resolveIncident(sourceId: string, runId: string, resolvedAt: string): void {
    const current = this.getCurrentIncident(sourceId);
    if (!current) return;
    this.db
      .update(incidents)
      .set({ healState: "approved", resolvedByRunId: runId, resolvedAt })
      .where(eq(incidents.id, current.id))
      .run();
  }

  addTimelineEvent(event: Omit<TimelineEvent, "id">): void {
    this.db
      .insert(timelineEvents)
      .values({ ...event, id: randomUUID() })
      .run();
  }

  listTimeline(sourceId: string): TimelineEvent[] {
    return this.db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.sourceId, sourceId))
      .orderBy(desc(timelineEvents.occurredAt))
      .all() as TimelineEvent[];
  }

  private mapSource(row: typeof sources.$inferSelect): StoredSource {
    return {
      id: row.id,
      cityId: row.cityId,
      agencyName: row.agencyName,
      canonicalUrl: row.canonicalUrl,
      allowedOrigins: JSON.parse(row.allowedOriginsJson) as string[],
      collectorId: row.collectorId,
      freshnessTtlMinutes: row.freshnessTtlMinutes,
      policyVersion: row.policyVersion,
      enabled: row.enabled,
      publishedSnapshotId: row.publishedSnapshotId,
      currentState: row.currentState as SourceState,
      mode: row.mode as "real" | "mock"
    };
  }

  private mapRun(row: typeof ingestRuns.$inferSelect): Record<string, unknown> {
    return {
      ...row,
      reasonCodes: JSON.parse(row.reasonCodesJson) as string[],
      validationSummary: JSON.parse(row.validationSummaryJson) as Record<string, unknown>,
      reasonCodesJson: undefined,
      validationSummaryJson: undefined
    };
  }

  private mapSnapshot(row: typeof snapshots.$inferSelect): StoredSnapshot {
    return {
      id: row.id,
      sourceId: row.sourceId,
      runId: row.runId,
      observedAt: row.observedAt,
      sourceReportedUpdatedAt: row.sourceReportedUpdatedAt,
      contentHash: row.contentHash,
      status: row.status as StoredSnapshot["status"],
      promotedAt: row.promotedAt,
      sites: JSON.parse(row.sitesJson) as CoolingSite[]
    };
  }

  private mapIncident(row: typeof incidents.$inferSelect): StoredIncident {
    return {
      id: row.id,
      sourceId: row.sourceId,
      runId: row.runId,
      severity: row.severity as StoredIncident["severity"],
      reasonCodes: JSON.parse(row.reasonCodesJson) as string[],
      openedAt: row.openedAt,
      healState: row.healState as StoredIncident["healState"],
      healJobId: row.healJobId,
      healPrompt: row.healPrompt,
      healDiff: JSON.parse(row.healDiffJson ?? "[]") as StoredIncident["healDiff"],
      resolvedByRunId: row.resolvedByRunId,
      resolvedAt: row.resolvedAt
    };
  }
}
