import { describe, expect, it } from "vitest";
import type { LatestRun } from "../types";
import { lineageMetrics } from "./lineage-metrics";

function runWithCoverage(): LatestRun {
  return {
    id: "run-1",
    sourceId: "source-1",
    startedAt: "2026-08-20T12:00:00.000Z",
    fetchedAt: "2026-08-20T12:00:01.000Z",
    completedAt: "2026-08-20T12:00:02.000Z",
    outcome: "publishable",
    collectorId: "c_example",
    collectorVersion: "1",
    schemaVersion: "1",
    recordCount: 23,
    rawSha256: "hash",
    reasonCodes: [],
    validationSummary: {
      disposition: "publishable",
      hardFailures: [],
      softAnomalies: [],
      recordCount: 23,
      requiredFieldCompleteness: 1,
      optionalClaimCoverage: 1,
      contentHash: "content-hash",
      coverage: {
        providerRecordsReceived: 25,
        normalizedRecordsAccepted: 23,
        recordsFilteredNotLocations: 1,
        exactDuplicatesRemoved: 1,
        recordsRejectedByValidation: 0,
        recordsQuarantined: 0
      }
    }
  };
}

describe("lineageMetrics", () => {
  it("keeps provider, normalization, validation and publication counts distinct", () => {
    expect(lineageMetrics(runWithCoverage(), 23)).toEqual({
      providerRecordsReceived: 25,
      normalizedRecordsAccepted: 23,
      recordsFilteredNotLocations: 1,
      exactDuplicatesRemoved: 1,
      recordsRejectedByValidation: 0,
      recordsQuarantined: 0,
      publishedRecords: 23
    });
  });

  it("falls back safely for stored runs created before coverage accounting", () => {
    const run = runWithCoverage();
    run.validationSummary.coverage = undefined;

    expect(lineageMetrics(run, 3)).toEqual({
      providerRecordsReceived: 23,
      normalizedRecordsAccepted: 23,
      recordsFilteredNotLocations: 0,
      exactDuplicatesRemoved: 0,
      recordsRejectedByValidation: 0,
      recordsQuarantined: 0,
      publishedRecords: 3
    });
  });

  it("returns an empty lineage when no run or snapshot exists", () => {
    expect(lineageMetrics(null, 0)).toEqual({
      providerRecordsReceived: 0,
      normalizedRecordsAccepted: 0,
      recordsFilteredNotLocations: 0,
      exactDuplicatesRemoved: 0,
      recordsRejectedByValidation: 0,
      recordsQuarantined: 0,
      publishedRecords: 0
    });
  });
});
