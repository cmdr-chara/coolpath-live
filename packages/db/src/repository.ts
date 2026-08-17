import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  City,
  CoolingSite,
  Source,
  SourceState,
  ValidationSummary
} from "@coolpath/domain";
import Database from "better-sqlite3";
import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { runMigrations } from "./migrator.js";
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

export type StoredValidationSummary = Omit<ValidationSummary, "sites">;

export interface StoredIngestRun {
  id: string;
  sourceId: string;
  startedAt: string;
  fetchedAt: string | null;
  completedAt: string | null;
  outcome: string;
  collectorId: string;
  collectorVersion: string;
  schemaVersion: string;
  recordCount: number;
  rawSha256: string;
  reasonCodes: string[];
  validationSummary: StoredValidationSummary;
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

export interface PublicationResult {
  incidentResolved: boolean;
  sourceState: "HEALTHY" | "RECOVERED";
}

export class CoolPathRepository {
  private readonly sqlite: Database.Database;
  private readonly db;
  private closed = false;

  constructor(databaseUrl: string) {
    if (databaseUrl !== ":memory:") mkdirSync(dirname(databaseUrl), { recursive: true });
    this.sqlite = new Database(databaseUrl);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    runMigrations(this.sqlite);
    this.db = drizzle(this.sqlite);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.sqlite.close();
  }

  checkHealth(): boolean {
    if (this.closed) return false;
    try {
      return this.sqlite.prepare("SELECT 1 AS ok").get() !== undefined;
    } catch {
      return false;
    }
  }

  getAppliedMigrations(): string[] {
    return this.sqlite
      .prepare("SELECT version FROM _coolpath_migrations ORDER BY version")
      .pluck()
      .all() as string[];
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

  markSourceStale(input: {
    sourceId: string;
    occurredAt: string;
    observedAt: string;
  }): boolean {
    return this.db.transaction((transaction) => {
      const source = transaction.select().from(sources).where(eq(sources.id, input.sourceId)).get();
      if (!source || source.currentState === "STALE") return false;
      transaction
        .update(sources)
        .set({ currentState: "STALE" })
        .where(eq(sources.id, input.sourceId))
        .run();
      transaction
        .insert(timelineEvents)
        .values({
          id: randomUUID(),
          sourceId: input.sourceId,
          occurredAt: input.occurredAt,
          kind: "freshness_expired",
          title: "Trusted snapshot is now historical",
          detail: `The published snapshot observed at ${input.observedAt} exceeded its freshness TTL. It remains preserved as historical evidence.`,
          tone: "warning"
        })
        .run();
      return true;
    });
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
        id: input.id,
        sourceId: input.sourceId,
        startedAt: input.startedAt,
        fetchedAt: input.fetchedAt,
        completedAt: input.completedAt,
        outcome: input.outcome,
        collectorId: input.collectorId,
        collectorVersion: input.collectorVersion,
        schemaVersion: input.schemaVersion,
        recordCount: input.recordCount,
        rawSha256: input.rawSha256,
        reasonCodesJson: JSON.stringify(input.reasonCodes),
        validationSummaryJson: JSON.stringify({
          disposition: input.validationSummary.disposition,
          hardFailures: input.validationSummary.hardFailures,
          softAnomalies: input.validationSummary.softAnomalies,
          recordCount: input.validationSummary.recordCount,
          requiredFieldCompleteness: input.validationSummary.requiredFieldCompleteness,
          optionalClaimCoverage: input.validationSummary.optionalClaimCoverage,
          contentHash: input.validationSummary.contentHash,
          coverage: input.validationSummary.coverage
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

  publishSnapshot(input: {
    sourceId: string;
    snapshotId: string;
    runId: string;
    promotedAt: string;
    recoveredByHealing: boolean;
    recordCount: number;
  }): PublicationResult {
    return this.db.transaction((transaction) => {
      const candidate = transaction
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.sourceId, input.sourceId)))
        .get();
      if (!candidate || candidate.runId !== input.runId) {
        throw new Error("Published snapshot must belong to the proving run");
      }
      const source = transaction
        .select()
        .from(sources)
        .where(eq(sources.id, input.sourceId))
        .get();
      if (!source || candidate.status !== "candidate") {
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
        .set({ status: "published", promotedAt: input.promotedAt })
        .where(eq(snapshots.id, input.snapshotId))
        .run();
      transaction
        .update(sources)
        .set({ publishedSnapshotId: input.snapshotId })
        .where(eq(sources.id, input.sourceId))
        .run();

      const currentIncident = transaction
        .select()
        .from(incidents)
        .where(and(eq(incidents.sourceId, input.sourceId), isNull(incidents.resolvedAt)))
        .orderBy(desc(incidents.openedAt))
        .get();
      const sourceState = input.recoveredByHealing ? "RECOVERED" : "HEALTHY";
      transaction
        .update(sources)
        .set({ currentState: sourceState })
        .where(eq(sources.id, input.sourceId))
        .run();

      if (currentIncident) {
        transaction
          .update(incidents)
          .set({
            ...(input.recoveredByHealing ? { healState: "approved" as const } : {}),
            resolvedByRunId: input.runId,
            resolvedAt: input.promotedAt
          })
          .where(eq(incidents.id, currentIncident.id))
          .run();
      }

      const ordinaryRecovery = currentIncident !== undefined && !input.recoveredByHealing;
      transaction
        .insert(timelineEvents)
        .values({
          id: randomUUID(),
          sourceId: input.sourceId,
          occurredAt: input.promotedAt,
          kind: input.recoveredByHealing
            ? "recovered"
            : ordinaryRecovery
              ? "recovered_check"
              : "published",
          title: input.recoveredByHealing
            ? "Recovered snapshot published"
            : ordinaryRecovery
              ? "Source recovered through ordinary check"
              : "Trusted snapshot published",
          detail: input.recoveredByHealing
            ? `${input.recordCount} records passed after the approved healing rerun. The incident was resolved by run ${input.runId}.`
            : ordinaryRecovery
              ? `${input.recordCount} records passed a normal source check. The incident was resolved by run ${input.runId} without applying a healing preview.`
              : `${input.recordCount} records passed the complete contract suite.`,
          tone: "positive"
        })
        .run();

      return { incidentResolved: currentIncident !== undefined, sourceState };
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

  getLatestRun(sourceId: string): StoredIngestRun | null {
    const row = this.db
      .select()
      .from(ingestRuns)
      .where(eq(ingestRuns.sourceId, sourceId))
      .orderBy(desc(ingestRuns.startedAt))
      .get();
    return row ? this.mapRun(row) : null;
  }

  getRun(runId: string): StoredIngestRun | null {
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

  getIncident(incidentId: string): StoredIncident | null {
    const row = this.db.select().from(incidents).where(eq(incidents.id, incidentId)).get();
    return row ? this.mapIncident(row) : null;
  }

  updateIncidentHeal(input: {
    incidentId: string;
    healState: StoredIncident["healState"];
    jobId?: string;
    prompt?: string;
    diff?: StoredIncident["healDiff"];
  }): void {
    const changes: {
      healState: StoredIncident["healState"];
      healJobId?: string;
      healPrompt?: string;
      healDiffJson?: string;
    } = { healState: input.healState };
    if (input.jobId !== undefined) changes.healJobId = input.jobId;
    if (input.prompt !== undefined) changes.healPrompt = input.prompt;
    if (input.diff !== undefined) changes.healDiffJson = JSON.stringify(input.diff);
    this.db.update(incidents).set(changes).where(eq(incidents.id, input.incidentId)).run();
  }

  resolveIncident(
    sourceId: string,
    runId: string,
    resolvedAt: string,
    approvedHealing = false
  ): void {
    const current = this.getCurrentIncident(sourceId);
    if (!current) return;
    this.db
      .update(incidents)
      .set({
        ...(approvedHealing ? { healState: "approved" as const } : {}),
        resolvedByRunId: runId,
        resolvedAt
      })
      .where(eq(incidents.id, current.id))
      .run();
  }

  addTimelineEvent(event: Omit<TimelineEvent, "id">): void {
    this.db
      .insert(timelineEvents)
      .values({ ...event, id: randomUUID() })
      .run();
  }

  listTimeline(sourceId: string, limit = 50): TimelineEvent[] {
    const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
    return this.db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.sourceId, sourceId))
      .orderBy(desc(timelineEvents.occurredAt))
      .limit(safeLimit)
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

  private mapRun(row: typeof ingestRuns.$inferSelect): StoredIngestRun {
    return {
      id: row.id,
      sourceId: row.sourceId,
      startedAt: row.startedAt,
      fetchedAt: row.fetchedAt,
      completedAt: row.completedAt,
      outcome: row.outcome,
      collectorId: row.collectorId,
      collectorVersion: row.collectorVersion,
      schemaVersion: row.schemaVersion,
      recordCount: row.recordCount,
      rawSha256: row.rawSha256,
      reasonCodes: JSON.parse(row.reasonCodesJson) as string[],
      validationSummary: JSON.parse(row.validationSummaryJson) as StoredValidationSummary
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
