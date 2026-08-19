import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  coolingSiteSchema,
  healDiffEntrySchema,
  healStateSchema,
  reasonCodeSchema,
  snapshotStatusSchema,
  sourceModeSchema,
  sourceSchema,
  sourceStateSchema,
  storedValidationSummarySchema,
  type City,
  type CoolingSite,
  type QualityDisposition,
  type ReasonCode,
  type Source,
  type SourceState,
  type ValidationSummary
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
  outcome: QualityDisposition;
  collectorId: string;
  collectorVersion: string;
  schemaVersion: string;
  recordCount: number;
  rawSha256: string;
  reasonCodes: ReasonCode[];
  validationSummary: StoredValidationSummary;
}

export interface StoredIncident {
  id: string;
  sourceId: string;
  runId: string;
  severity: "warning" | "critical";
  reasonCodes: ReasonCode[];
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

type PublishedSourceState = Extract<SourceState, "HEALTHY" | "RECOVERED">;

export interface PublicationResult {
  incidentResolved: boolean;
  sourceState: PublishedSourceState;
}

interface PublicationCommitInput {
  sourceId: string;
  snapshotId: string;
  promotedAt: string;
  expectedRunId: string;
  sourceState: PublishedSourceState;
  recoveredByHealing: boolean;
  recordCount: number;
}

export class PublicationConflictError extends Error {
  constructor(sourceId: string, candidateRunId: string, currentRunId: string) {
    super(
      `Candidate run ${candidateRunId} cannot replace newer published run ${currentRunId} for source ${sourceId}`
    );
    this.name = "PublicationConflictError";
  }
}

function parseJson(value: string): unknown {
  return JSON.parse(value) as unknown;
}

function migrationVersion(row: unknown): string {
  if (
    typeof row !== "object" ||
    row === null ||
    !("version" in row) ||
    typeof row.version !== "string"
  ) {
    throw new Error("Migration metadata contains an invalid version row");
  }
  return row.version;
}

function runIdFromRow(row: unknown): string | null {
  if (row === undefined) return null;
  if (typeof row !== "string") throw new Error("Run lookup returned an invalid identifier");
  return row;
}

function severityValue(value: string): StoredIncident["severity"] {
  if (value === "warning" || value === "critical") return value;
  throw new Error(`Persisted incident has invalid severity: ${value}`);
}

function timelineTone(value: string): TimelineEvent["tone"] {
  if (value === "neutral" || value === "positive" || value === "warning" || value === "critical") {
    return value;
  }
  throw new Error(`Persisted timeline event has invalid tone: ${value}`);
}

function instantMs(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid timestamp`);
  return parsed;
}

function sqliteErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
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
      .all()
      .map(migrationVersion);
  }

  reset(): void {
    this.sqlite.transaction(() => {
      this.sqlite.exec(
        "DELETE FROM timeline_events; DELETE FROM incidents; DELETE FROM snapshots; DELETE FROM ingest_runs; DELETE FROM sources; DELETE FROM cities;"
      );
    })();
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
    state: SourceState;
  }): boolean {
    return this.db.transaction((transaction) => {
      const source = transaction.select().from(sources).where(eq(sources.id, input.sourceId)).get();
      if (!source || source.currentState === input.state) return false;
      transaction
        .update(sources)
        .set({ currentState: input.state })
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
    outcome: QualityDisposition;
    collectorId: string;
    collectorVersion: string;
    schemaVersion: string;
    recordCount: number;
    rawSha256: string;
    reasonCodes: ReasonCode[];
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
    const snapshot = this.getSnapshot(id);
    if (!snapshot) throw new Error("Snapshot disappeared immediately after creation");
    return snapshot;
  }

  publishSnapshot(input: {
    sourceId: string;
    snapshotId: string;
    runId: string;
    promotedAt: string;
    sourceState: PublishedSourceState;
    recoveredByHealing: boolean;
    recordCount: number;
  }): PublicationResult {
    return this.commitPublication({
      sourceId: input.sourceId,
      snapshotId: input.snapshotId,
      promotedAt: input.promotedAt,
      expectedRunId: input.runId,
      sourceState: input.sourceState,
      recoveredByHealing: input.recoveredByHealing,
      recordCount: input.recordCount
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
    const runId = runIdFromRow(
      this.sqlite
        .prepare(
          "SELECT id FROM ingest_runs WHERE source_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1"
        )
        .pluck()
        .get(sourceId)
    );
    return runId ? this.getRun(runId) : null;
  }

  getRun(runId: string): StoredIngestRun | null {
    const row = this.db.select().from(ingestRuns).where(eq(ingestRuns.id, runId)).get();
    return row ? this.mapRun(row) : null;
  }

  openIncident(input: {
    sourceId: string;
    runId: string;
    severity: "warning" | "critical";
    reasonCodes: ReasonCode[];
    openedAt: string;
  }): StoredIncident {
    const existing = this.getCurrentIncident(input.sourceId);
    if (existing) return this.mergeIncident(existing, input);

    const id = randomUUID();
    try {
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
    } catch (error) {
      if (sqliteErrorCode(error) !== "SQLITE_CONSTRAINT_UNIQUE") throw error;
      const concurrent = this.getCurrentIncident(input.sourceId);
      if (!concurrent) throw error;
      return this.mergeIncident(concurrent, input);
    }

    const created = this.getCurrentIncident(input.sourceId);
    if (!created) throw new Error("Incident disappeared immediately after creation");
    return created;
  }

  getCurrentIncident(sourceId: string): StoredIncident | null {
    const row = this.db
      .select()
      .from(incidents)
      .where(and(eq(incidents.sourceId, sourceId), isNull(incidents.resolvedAt)))
      .orderBy(desc(incidents.openedAt), desc(incidents.id))
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
      .set(
        approvedHealing
          ? { healState: "approved", resolvedByRunId: runId, resolvedAt }
          : { resolvedByRunId: runId, resolvedAt }
      )
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
      .orderBy(desc(timelineEvents.occurredAt), desc(timelineEvents.id))
      .limit(safeLimit)
      .all()
      .map((row) => ({ ...row, tone: timelineTone(row.tone) }));
  }

  private mergeIncident(
    existing: StoredIncident,
    input: {
      severity: "warning" | "critical";
      reasonCodes: ReasonCode[];
    }
  ): StoredIncident {
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
    const merged = this.getIncident(existing.id);
    if (!merged) throw new Error("Incident disappeared while merging evidence");
    return merged;
  }

  private commitPublication(input: PublicationCommitInput): PublicationResult {
    return this.db.transaction((transaction) => {
      const candidate = transaction
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.id, input.snapshotId), eq(snapshots.sourceId, input.sourceId)))
        .get();
      if (!candidate || candidate.runId !== input.expectedRunId) {
        throw new Error("Published snapshot must belong to the proving run");
      }

      const source = transaction.select().from(sources).where(eq(sources.id, input.sourceId)).get();
      if (!source || candidate.status !== "candidate") {
        throw new Error("Only a candidate snapshot belonging to the source can be published");
      }

      const candidateRun = transaction
        .select()
        .from(ingestRuns)
        .where(eq(ingestRuns.id, candidate.runId))
        .get();
      if (!candidateRun || candidateRun.sourceId !== input.sourceId) {
        throw new Error("Published snapshot must have a proving run for the same source");
      }

      let currentSnapshot: typeof snapshots.$inferSelect | undefined;
      let currentRun: typeof ingestRuns.$inferSelect | undefined;
      if (source.publishedSnapshotId) {
        currentSnapshot = transaction
          .select()
          .from(snapshots)
          .where(eq(snapshots.id, source.publishedSnapshotId))
          .get();
        if (!currentSnapshot) throw new Error("Published snapshot pointer is dangling");
        currentRun = transaction
          .select()
          .from(ingestRuns)
          .where(eq(ingestRuns.id, currentSnapshot.runId))
          .get();
        if (!currentRun) throw new Error("Published snapshot proving run is missing");

        const candidateStartedAt = instantMs(candidateRun.startedAt, "Candidate run start");
        const currentStartedAt = instantMs(currentRun.startedAt, "Current run start");
        const candidateObservedAt = instantMs(candidate.observedAt, "Candidate observation");
        const currentObservedAt = instantMs(currentSnapshot.observedAt, "Current observation");
        if (candidateStartedAt < currentStartedAt || candidateObservedAt < currentObservedAt) {
          throw new PublicationConflictError(input.sourceId, candidateRun.id, currentRun.id);
        }
      }

      const pointerCondition = source.publishedSnapshotId
        ? eq(sources.publishedSnapshotId, source.publishedSnapshotId)
        : isNull(sources.publishedSnapshotId);
      const pointerUpdate = transaction
        .update(sources)
        .set({ publishedSnapshotId: input.snapshotId, currentState: input.sourceState })
        .where(and(eq(sources.id, input.sourceId), pointerCondition))
        .run();
      if (pointerUpdate.changes !== 1) {
        throw new PublicationConflictError(
          input.sourceId,
          candidateRun.id,
          currentRun?.id ?? "concurrent publication"
        );
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

      const currentIncident = transaction
        .select()
        .from(incidents)
        .where(and(eq(incidents.sourceId, input.sourceId), isNull(incidents.resolvedAt)))
        .orderBy(desc(incidents.openedAt), desc(incidents.id))
        .get();

      if (currentIncident) {
        transaction
          .update(incidents)
          .set({
            ...(input.recoveredByHealing ? { healState: "approved" as const } : {}),
            resolvedByRunId: input.expectedRunId,
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
            ? `${input.recordCount} records passed after the approved healing rerun. The incident was resolved by run ${input.expectedRunId}.`
            : ordinaryRecovery
              ? `${input.recordCount} records passed a normal source check. The incident was resolved by run ${input.expectedRunId} without applying a healing preview.`
              : `${input.recordCount} records passed the complete contract suite.`,
          tone: "positive"
        })
        .run();

      return { incidentResolved: currentIncident !== undefined, sourceState: input.sourceState };
    });
  }

  private mapSource(row: typeof sources.$inferSelect): StoredSource {
    return {
      id: row.id,
      cityId: row.cityId,
      agencyName: row.agencyName,
      canonicalUrl: row.canonicalUrl,
      allowedOrigins: sourceSchema.shape.allowedOrigins.parse(parseJson(row.allowedOriginsJson)),
      collectorId: row.collectorId,
      freshnessTtlMinutes: row.freshnessTtlMinutes,
      policyVersion: row.policyVersion,
      enabled: row.enabled,
      publishedSnapshotId: row.publishedSnapshotId,
      currentState: sourceStateSchema.parse(row.currentState),
      mode: sourceModeSchema.parse(row.mode)
    };
  }

  private mapRun(row: typeof ingestRuns.$inferSelect): StoredIngestRun {
    return {
      id: row.id,
      sourceId: row.sourceId,
      startedAt: row.startedAt,
      fetchedAt: row.fetchedAt,
      completedAt: row.completedAt,
      outcome: storedValidationSummarySchema.shape.disposition.parse(row.outcome),
      collectorId: row.collectorId,
      collectorVersion: row.collectorVersion,
      schemaVersion: row.schemaVersion,
      recordCount: row.recordCount,
      rawSha256: row.rawSha256,
      reasonCodes: reasonCodeSchema.array().parse(parseJson(row.reasonCodesJson)),
      validationSummary: storedValidationSummarySchema.parse(parseJson(row.validationSummaryJson))
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
      status: snapshotStatusSchema.parse(row.status),
      promotedAt: row.promotedAt,
      sites: coolingSiteSchema.array().parse(parseJson(row.sitesJson))
    };
  }

  private mapIncident(row: typeof incidents.$inferSelect): StoredIncident {
    return {
      id: row.id,
      sourceId: row.sourceId,
      runId: row.runId,
      severity: severityValue(row.severity),
      reasonCodes: reasonCodeSchema.array().parse(parseJson(row.reasonCodesJson)),
      openedAt: row.openedAt,
      healState: healStateSchema.parse(row.healState),
      healJobId: row.healJobId,
      healPrompt: row.healPrompt,
      healDiff: healDiffEntrySchema.array().parse(parseJson(row.healDiffJson ?? "[]")),
      resolvedByRunId: row.resolvedByRunId,
      resolvedAt: row.resolvedAt
    };
  }
}
