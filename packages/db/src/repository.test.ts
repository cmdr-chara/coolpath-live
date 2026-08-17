import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CoolingSite, ValidationSummary } from "@coolpath/domain";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoolPathRepository } from "./repository.js";

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
  status: "candidate" | "quarantined" = "candidate"
) {
  const validation = status === "candidate" ? summary : { ...summary, disposition: "quarantined" as const };
  repository.recordRun({
    id: runId,
    sourceId: "test-source",
    startedAt: site.observedAt,
    fetchedAt: site.observedAt,
    completedAt: site.observedAt,
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
    observedAt: site.observedAt,
    contentHash: `${runId}-hash`,
    status,
    sites: [site]
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
    for (const runId of ["run-1", "run-2"]) {
      const snapshot = recordCandidate(repository, runId);
      repository.promoteSnapshot("test-source", snapshot.id, site.observedAt);
    }

    const current = repository.getPublishedSnapshot("test-source");
    expect(current?.runId).toBe("run-2");
    expect(current?.status).toBe("published");
  });

  it("does not expose quarantined candidates as published", () => {
    recordCandidate(repository, "broken-run", "quarantined");
    expect(repository.getPublishedSnapshot("test-source")).toBeNull();
  });

  it("preserves the current pointer when an invalid promotion is rejected", () => {
    const trusted = recordCandidate(repository, "trusted-run");
    repository.promoteSnapshot("test-source", trusted.id, site.observedAt);
    const quarantined = recordCandidate(repository, "quarantined-run", "quarantined");

    expect(() =>
      repository.promoteSnapshot("test-source", quarantined.id, site.observedAt)
    ).toThrow("Only a candidate snapshot");
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(trusted.id);
    expect(repository.getSnapshot(trusted.id)?.status).toBe("published");
  });

  it("publishes, restores source health, resolves the incident and records proof atomically", () => {
    const baseline = recordCandidate(repository, "baseline-run");
    repository.publishSnapshot({
      sourceId: "test-source",
      snapshotId: baseline.id,
      runId: "baseline-run",
      promotedAt: "2026-08-17T12:00:00.000Z",
      recoveredByHealing: false,
      recordCount: 1
    });
    recordCandidate(repository, "drift-run", "quarantined");
    repository.openIncident({
      sourceId: "test-source",
      runId: "drift-run",
      severity: "critical",
      reasonCodes: ["INVALID_SCHEMA"],
      openedAt: "2026-08-17T12:05:00.000Z"
    });
    repository.setSourceState("test-source", "DEGRADED");
    const recovered = recordCandidate(repository, "ordinary-recovery-run");

    const result = repository.publishSnapshot({
      sourceId: "test-source",
      snapshotId: recovered.id,
      runId: "ordinary-recovery-run",
      promotedAt: "2026-08-17T12:10:00.000Z",
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

  it("preserves state on reseed and hides disabled sources", () => {
    repository.setSourceState("test-source", "HEALTHY");
    repository.upsertSource({
      ...repository.getSource("test-source")!,
      agencyName: "Updated Authority"
    });
    expect(repository.getSource("test-source")?.currentState).toBe("HEALTHY");

    repository.upsertSource({ ...repository.getSource("test-source")!, enabled: false });
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

describe("migration discipline", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it("initializes the same empty database twice without failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "coolpath-migration-"));
    directories.push(directory);
    const databasePath = join(directory, "coolpath.db");

    const first = new CoolPathRepository(databasePath);
    expect(first.getAppliedMigrations()).toEqual(["0000_initial.sql"]);
    first.close();
    const second = new CoolPathRepository(databasePath);
    expect(second.getAppliedMigrations()).toEqual(["0000_initial.sql"]);
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
    expect(repository.getAppliedMigrations()).toEqual(["0000_initial.sql"]);
    repository.close();
  });
});
