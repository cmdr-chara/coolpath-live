import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CoolingSite, ValidationSummary } from "@coolpath/domain";
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
  sites: [site]
};

describe("snapshot publication", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
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
  });

  afterEach(() => repository.close());

  it("publishes candidates transactionally and supersedes the prior snapshot", () => {
    for (const runId of ["run-1", "run-2"]) {
      repository.recordRun({
        id: runId,
        sourceId: "test-source",
        startedAt: site.observedAt,
        fetchedAt: site.observedAt,
        completedAt: site.observedAt,
        outcome: "publishable",
        collectorId: "c_test",
        collectorVersion: "1",
        schemaVersion: "1",
        recordCount: 1,
        rawSha256: "raw",
        reasonCodes: [],
        validationSummary: summary
      });
      const snapshot = repository.createSnapshot({
        sourceId: "test-source",
        runId,
        observedAt: site.observedAt,
        contentHash: `${runId}-hash`,
        status: "candidate",
        sites: [site]
      });
      repository.promoteSnapshot("test-source", snapshot.id, site.observedAt);
    }

    const current = repository.getPublishedSnapshot("test-source");
    expect(current?.runId).toBe("run-2");
    expect(current?.status).toBe("published");
  });

  it("does not expose quarantined candidates as published", () => {
    repository.recordRun({
      id: "broken-run",
      sourceId: "test-source",
      startedAt: site.observedAt,
      fetchedAt: site.observedAt,
      completedAt: site.observedAt,
      outcome: "quarantined",
      collectorId: "c_test",
      collectorVersion: "1",
      schemaVersion: "1",
      recordCount: 0,
      rawSha256: "raw",
      reasonCodes: ["ZERO_ROWS"],
      validationSummary: { ...summary, disposition: "quarantined", recordCount: 0, sites: [] }
    });
    repository.createSnapshot({
      sourceId: "test-source",
      runId: "broken-run",
      observedAt: site.observedAt,
      contentHash: "broken",
      status: "quarantined",
      sites: []
    });
    expect(repository.getPublishedSnapshot("test-source")).toBeNull();
  });

  it("preserves the current pointer when an invalid promotion is rejected", () => {
    repository.recordRun({
      id: "trusted-run",
      sourceId: "test-source",
      startedAt: site.observedAt,
      fetchedAt: site.observedAt,
      completedAt: site.observedAt,
      outcome: "publishable",
      collectorId: "c_test",
      collectorVersion: "1",
      schemaVersion: "1",
      recordCount: 1,
      rawSha256: "trusted-raw",
      reasonCodes: [],
      validationSummary: summary
    });
    const trusted = repository.createSnapshot({
      sourceId: "test-source",
      runId: "trusted-run",
      observedAt: site.observedAt,
      contentHash: "trusted",
      status: "candidate",
      sites: [site]
    });
    repository.promoteSnapshot("test-source", trusted.id, site.observedAt);

    repository.recordRun({
      id: "quarantined-run",
      sourceId: "test-source",
      startedAt: site.observedAt,
      fetchedAt: site.observedAt,
      completedAt: site.observedAt,
      outcome: "quarantined",
      collectorId: "c_test",
      collectorVersion: "1",
      schemaVersion: "1",
      recordCount: 0,
      rawSha256: "broken-raw",
      reasonCodes: ["ZERO_ROWS"],
      validationSummary: { ...summary, disposition: "quarantined", recordCount: 0, sites: [] }
    });
    const quarantined = repository.createSnapshot({
      sourceId: "test-source",
      runId: "quarantined-run",
      observedAt: site.observedAt,
      contentHash: "broken",
      status: "quarantined",
      sites: []
    });

    expect(() =>
      repository.promoteSnapshot("test-source", quarantined.id, site.observedAt)
    ).toThrow("Only a candidate snapshot");
    expect(repository.getPublishedSnapshot("test-source")?.id).toBe(trusted.id);
    expect(repository.getSnapshot(trusted.id)?.status).toBe("published");
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
});
