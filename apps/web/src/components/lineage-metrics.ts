import type { LatestRun } from "../types";

export interface LineageMetrics {
  providerRecordsReceived: number;
  normalizedRecordsAccepted: number;
  recordsFilteredNotLocations: number;
  exactDuplicatesRemoved: number;
  recordsRejectedByValidation: number;
  recordsQuarantined: number;
  publishedRecords: number;
}

export function lineageMetrics(run: LatestRun | null, publishedRecords: number): LineageMetrics {
  const coverage = run?.validationSummary.coverage;
  const candidateRecords = run?.recordCount ?? 0;

  return {
    providerRecordsReceived: coverage?.providerRecordsReceived ?? candidateRecords,
    normalizedRecordsAccepted: coverage?.normalizedRecordsAccepted ?? candidateRecords,
    recordsFilteredNotLocations: coverage?.recordsFilteredNotLocations ?? 0,
    exactDuplicatesRemoved: coverage?.exactDuplicatesRemoved ?? 0,
    recordsRejectedByValidation: coverage?.recordsRejectedByValidation ?? 0,
    recordsQuarantined: coverage?.recordsQuarantined ?? 0,
    publishedRecords: Math.max(0, publishedRecords)
  };
}
