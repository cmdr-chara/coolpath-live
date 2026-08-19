import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CoolingSite, ValidationSummary } from "@coolpath/domain";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoolPathRepository, PublicationConflictError } from "./repository.js";

const site: CoolingSite = {
  id: "test:one",
  cityId: "test",
  sourceKey: "test-source",
  name: "Test Hall",
  addressText: "1 Test Street",
  evidenceUrl: "https://test.gov/cooling",
  temporalClaim: { kind: "not_provided" },
  explicitClaims: [],
  observedAt: "2026-08-17T12:00:00.000Z"
};

const summary: ValidationSummary = {
  disposition: "publishable",
  hardFailures: [],
  softAnomalies: [],
  recordCount: 1,
  requiredFieldCompleteness: 1,
  optionalClaimCoverage: 0,
  contentHash: "hash",
  coverage: {
    providerRecordsReceived: 1,
    normalizedRecordsAccepted: 1,
    recordsFilteredNotLocations: 0,
    exactDuplicatesRemoved: 0,
    recordsRejectedByValidation: 0,
    recordsQuarantined: 0
  },
  sites: [site]
};

function seed(repository: CoolPathRepository): void {
  repository.upsertCity({
    id: "test",
    slug: "test",
    displayName: "Test City",
    region: "Test Region",
    timezone: "UTC"
  });
  repository.upsertSource({
    id: "test-source",
    cityId: "test",
    agencyName: "Test Authority",
    canonicalUrl: "https://test.gov/cooling",
    allowedOrigins: ["https://test.gov"],
    collectorId: "c_test",
    freshnessTtlMinutes: 60,
    policyVersion: "1",
    enabled: true,
    currentState: "UNINITIALIZED",
    mode: "mock"
  });
}

function recordCandidate(
  repository: CoolPathRepository,
  runId: string,
  status: "candidate" | "quarantined" = "candidate",
  startedAt = site.observedAt,
  observedAt = startedAt
) {
  const validation =
    status === "candidate" ? summary : { ...summary, disposition: "quarantined" as const };
  repository.recordRun({
    id: runId,
    sourceId: "test-source",
    startedAt,
    fetchedAt: observedAt,
    completedAt: observedAt,
    outcome: validation.disposition,
    collectorId: "c_test",
    collectorVersion: "1",
    schemaVersion: "1",
    recordCount: 1,
    rawSha256: "raw",
    reasonCodes: validation.disposition === "publishable" ? [] : ["INVALID_SCHEMA"],
    validationSummary: validation
  });
  return repository.createSnapshot({
    sourceId: "test-source",
    runId,
    observedAt,
    contentHash: `${runId}-hash`,
    status,
    sites: [{ ...site, observedAt }]
  });
}

function publish(
  repository: CoolPathRepository,
  runId: string,
  snapshotId: string,
  promotedAt: string
) {
  return repository.publishSnapshot({
    sourceId: "test-source",
    snapshotId,
    runId,
    promotedAt,
    sourceState: "HEALTHY",
    recoveredByHealing: false,
    recordCount: 1
  });
}

describe("snapshot publication", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seed(repository);
  });

  afterEach(() => repository.close());

  it("publishes candidates transactionally and supersedes the prior snapshot", () => {
    const firstObservedAt = "2026-08-17T12:00:00.000Z";
    const secondObservedAt = "2026-08-17T12:01:00.000Z";
    const first = recordCandidate(repository, "run-1", "candidate", firstObservedAt);
    publish(repository, "run-1", first.id, firstObservedAt);
    const second = recordCandidate(repository, "run-2", "candidate", secondObservedAt);
    publish(repository, "run-2", second.id, secondObservedAt);

    const current = repository.getPublishedSnapshot("test-source");
    expect(current?.runId).toBe("run-2");
    expect(current?.status).toBe("published");
    expect(repository.getSnapshot(first.id)?.status).toBe("superseded");
  });

  it("does not expose quarantined candidates as published", () => {
    recordCandidate(repository, "broken-run", "quarantined");
    expect(repository.getPublishedSnapshot("test-source")).toBeNull();
  });

  it("preserves the current pointer when an invalid publication is rejected", () => {
    const trusted = recordCandidate(repository, "trusted-run");
    publish(repository, "trusted-run", trusted.id, site.observedAt);
    const quarantined = recordCandidate(repository, "quarantined-run", "quarantined");

    expect(() =>
      publish(repository, "quarantined-run", quarantined.id, "2026-08-17T12:01:00.000Z")
    ).toThrow("Only a candidate snapshot");
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(trusted.id);
    expect(repository.getSnapshot(trusted.id)?.status).toBe("published");
  });

  it("prevents an older run from replacing a newer trusted publication", () => {
    const older = recordCandidate(
      repository,
      "older-run",
      "candidate",
      "2026-08-17T12:00:00.000Z",
      "2026-08-17T12:02:00.000Z"
    );
    const newer = recordCandidate(
      repository,
      "newer-run",
      "candidate",
      "2026-08-17T12:05:00.000Z",
      "2026-08-17T12:06:00.000Z"
    );
    publish(repository, "newer-run", newer.id, "2026-08-17T12:07:00.000Z");

    expect(() =>
      publish(repository, "older-run", older.id, "2026-08-17T12:08:00.000Z")
    ).toThrow(PublicationConflictError);
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(newer.id);
    expect(repository.getSnapshot(newer.id)?.status).toBe("published");
    expect(repository.getSnapshot(older.id)?.status).toBe("candidate");
  });

  it("prevents a newer run from regressing the public observation timestamp", () => {
    const current = recordCandidate(
      repository,
      "current-run",
      "candidate",
      "2026-08-17T12:00:00.000Z",
      "2026-08-17T12:10:00.000Z"
    );
    publish(repository, "current-run", current.id, "2026-08-17T12:11:00.000Z");
    const regressive = recordCandidate(
      repository,
      "regressive-run",
      "candidate",
      "2026-08-17T12:12:00.000Z",
      "2026-08-17T12:09:00.000Z"
    );

    expect(() =>
      publish(repository, "regressive-run", regressive.id, "2026-08-17T12:13:00.000Z")
    ).toThrow(PublicationConflictError);
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(current.id);
  });

  it("publishes, restores source health, resolves the incident and records proof atomically", () => {
    const baseline = recordCandidate(repository, "baseline-run");
    repository.publishSnapshot({
      sourceId: "test-source",
      snapshotId: baseline.id,
      runId: "baseline-run",
      promotedAt: "2026-08-17T12:00:00.000Z",
      sourceState: "HEALTHY",
      recoveredByHealing: false,
      recordCount: 1
    });
    recordCandidate(
      repository,
      "drift-run",
      "quarantined",
      "2026-08-17T12:05:00.000Z",
      "2026-08-17T12:05:00.000Z"
    );
    repository.openIncident({
      sourceId: "test-source",
      runId: "drift-run",
      severity: "critical",
      reasonCodes: ["INVALID_SCHEMA"],
      openedAt: "2026-08-17T12:05:00.000Z"
    });
    repository.setSourceState("test-source", "DEGRADED");
    const recovered = recordCandidate(
      repository,
      "ordinary-recovery-run",
      "candidate",
      "2026-08-17T12:10:00.000Z",
      "2026-08-17T12:10:00.000Z"
    );

    const result = repository.publishSnapshot({
      sourceId: "test-source",
      snapshotId: recovered.id,
      runId: "ordinary-recovery-run",
      promotedAt: "2026-08-17T12:10:00.000Z",
      sourceState: "HEALTHY",
      recoveredByHealing: false,
      recordCount: 1
    });

    expect(result).toEqual({ incidentResolved: true, sourceState: "HEALTHY" });
    expect(repository.getSource("test-source")?.currentState).toBe("HEALTHY");
    expect(repository.getCurrentIncident("test-source")).toBeNull();
    expect(repository.getPublishedSnapshot("test-source")?.runId).toBe("ordinary-recovery-run");
    expect(repository.listTimeline("test-source")[0]).toMatchObject({
      kind: "recovered_check",
      tone: "positive"
    });
  });

  it("rejects snapshots whose run belongs to another source", () => {
    repository.upsertCity({
      id: "other",
      slug: "other",
      displayName: "Other City",
      region: "Other Region",
      timezone: "UTC"
    });
    repository.upsertSource({
      id: "other-source",
      cityId: "other",
      agencyName: "Other Authority",
      canonicalUrl: "https://other.gov/cooling",
      allowedOrigins: ["https://other.gov"],
      collectorId: "c_other",
      freshnessTtlMinutes: 60,
      policyVersion: "1",
      enabled: true,
      currentState: "UNINITIALIZED",
      mode: "mock"
    });
    repository.recordRun({
      id: "other-run",
      sourceId: "other-source",
      startedAt: site.observedAt,
      fetchedAt: site.observedAt,
      completedAt: site.observedAt,
      outcome: "publishable",
      collectorId: "c_other",
      collectorVersion: "1",
      schemaVersion: "1",
      recordCount: 1,
      rawSha256: "raw",
      reasonCodes: [],
      validationSummary: summary
    });

    expect(() =>
      repository.createSnapshot({
        sourceId: "test-source",
        runId: "other-run",
        observedAt: site.observedAt,
        contentHash: "cross-source",
        status: "candidate",
        sites: [site]
      })
    ).toThrow("Snapshot run must belong to the same source");
  });

  it("merges repeated incident evidence instead of creating a second open incident", () => {
    recordCandidate(repository, "failed-run", "quarantined");
    const first = repository.openIncident({
      sourceId: "test-source",
      runId: "failed-run",
      severity: "warning",
      reasonCodes: ["INVALID_SCHEMA"],
      openedAt: "2026-08-17T12:01:00.000Z"
    });
    const second = repository.openIncident({
      sourceId: "test-source",
      runId: "failed-run",
      severity: "critical",
      reasonCodes: ["ZERO_ROWS"],
      openedAt: "2026-08-17T12:02:00.000Z"
    });

    expect(second.id).toBe(first.id);
    expect(second.severity).toBe("critical");
    expect(second.reasonCodes).toEqual(expect.arrayContaining(["INVALID_SCHEMA", "ZERO_ROWS"]));
  });

  it("preserves state on reseed and hides disabled sources", () => {
    repository.setSourceState("test-source", "HEALTHY");
    const source = repository.getSource("test-source");
    if (!source) throw new Error("Expected seeded source");
    repository.upsertSource({ ...source, agencyName: "Updated Authority" });
    expect(repository.getSource("test-source")?.currentState).toBe("HEALTHY");

    const updatedSource = repository.getSource("test-source");
    if (!updatedSource) throw new Error("Expected updated source");
    repository.upsertSource({ ...updatedSource, enabled: false });
    expect(repository.listCities()).toHaveLength(0);
    expect(repository.getCityBySlug("test")).toBeNull();
  });

  it("bounds timeline reads even when storage contains more events", () => {
    for (let index = 0; index < 105; index += 1) {
      repository.addTimelineEvent({
        sourceId: "test-source",
        occurredAt: new Date(Date.UTC(2026, 7, 17, 12, index)).toISOString(),
        kind: "test",
        title: "Test event",
        detail: `Event ${index}`,
        tone: "neutral"
      });
    }

    expect(repository.listTimeline("test-source")).toHaveLength(50);
    expect(repository.listTimeline("test-source", 500)).toHaveLength(100);
  });
});

describe("persistence failure boundaries", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("rolls back the entire reset if one table deletion fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-reset-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");
    const repository = new CoolPathRepository(databasePath);
    seed(repository);
    const candidate = recordCandidate(repository, "reset-run");
    publish(repository, "reset-run", candidate.id, site.observedAt);
    repository.addTimelineEvent({
      sourceId: "test-source",
      occurredAt: site.observedAt,
      kind: "test",
      title: "Before reset",
      detail: "Must survive a failed reset transaction",
      tone: "neutral"
    });

    const raw = new Database(databasePath);
    raw.exec(`
      CREATE TRIGGER fail_reset_before_run_delete
      BEFORE DELETE ON ingest_runs
      BEGIN
        SELECT RAISE(ABORT, 'reset blocked for test');
      END;
    `);
    raw.close();

    expect(() => repository.reset()).toThrow("reset blocked for test");
    expect(repository.getSource("test-source")).not.toBeNull();
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(candidate.id);
    expect(repository.listTimeline("test-source")).toHaveLength(2);
    repository.close();
  });

  it("fails closed when persisted JSON is corrupt", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-corrupt-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");
    const repository = new CoolPathRepository(databasePath);
    seed(repository);

    const raw = new Database(databasePath);
    raw.prepare("UPDATE sources SET allowed_origins_json = ? WHERE id = ?").run(
      "not-json",
      "test-source"
    );
    raw.close();

    expect(() => repository.getSource("test-source")).toThrow();
    repository.close();
  });
});

describe("migration discipline", () => {
  const directories: string[] = [];
  const expectedMigrations = ["0000_initial.sql", "0001_open_incident_invariant.sql"];

  afterEach(() => {
    for (const directory of directories.splice(0))
      rmSync(directory, { recursive: true, force: true });
  });

  it("initializes the same empty database twice without failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-migration-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");

    const first = new CoolPathRepository(databasePath);
    expect(first.getAppliedMigrations()).toEqual(expectedMigrations);
    first.close();
    const second = new CoolPathRepository(databasePath);
    expect(second.getAppliedMigrations()).toEqual(expectedMigrations);
    expect(second.checkHealth()).toBe(true);
    second.close();
  });

  it("upgrades a legacy database in place and preserves existing rows", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-legacy-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");
    const legacy = new Database(databasePath);
    legacy.exec(`
      CREATE TABLE cities (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        region TEXT NOT NULL,
        timezone TEXT NOT NULL
      );
      INSERT INTO cities VALUES ('legacy', 'legacy-city', 'Legacy City', 'Legacy Region', 'UTC');
    `);
    legacy.close();

    const repository = new CoolPathRepository(databasePath);
    repository.upsertSource({
      id: "legacy-source",
      cityId: "legacy",
      agencyName: "Legacy Authority",
      canonicalUrl: "https://legacy.example/cooling",
      allowedOrigins: ["https://legacy.example"],
      collectorId: "legacy-collector",
      freshnessTtlMinutes: 60,
      policyVersion: "legacy-v1",
      enabled: true,
      currentState: "UNINITIALIZED",
      mode: "mock"
    });

    expect(repository.getCityBySlug("legacy-city")).toMatchObject({
      id: "legacy",
      displayName: "Legacy City"
    });
    expect(repository.getAppliedMigrations()).toEqual(expectedMigrations);
    repository.close();
  });

  it("enforces one unresolved incident per source at the SQLite boundary", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-incident-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");
    const repository = new CoolPathRepository(databasePath);
    seed(repository);
    recordCandidate(repository, "incident-run", "quarantined");
    repository.openIncident({
      sourceId: "test-source",
      runId: "incident-run",
      severity: "critical",
      reasonCodes: ["INVALID_SCHEMA"],
      openedAt: site.observedAt
    });
    repository.close();

    const raw = new Database(databasePath);
    expect(() =>
      raw
        .prepare(
          `INSERT INTO incidents (
            id, source_id, run_id, severity, reason_codes_json, opened_at, heal_state,
            heal_job_id, heal_prompt, heal_diff_json, resolved_by_run_id, resolved_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, '[]', NULL, NULL)`
        )
        .run(
          "second-open-incident",
          "test-source",
          "incident-run",
          "warning",
          "[]",
          "2026-08-17T12:01:00.000Z",
          "not_requested"
        )
    ).toThrow();
    raw.close();
  });
});
