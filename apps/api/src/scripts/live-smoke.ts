import { evaluateCandidate } from "@coolpath/domain";
import {
  BrightDataScraperStudioClient,
  normalizePa211RowsWithMetrics,
  PA211_SOURCE
} from "@coolpath/source-adapters";
import { getConfig } from "../config.js";

const config = getConfig({ COOLPATH_MODE: "real" });
if (!config.BRIGHT_DATA_API_TOKEN || !config.PRIMARY_COLLECTOR_ID) {
  throw new Error(
    "BRIGHT_DATA_API_TOKEN and PRIMARY_COLLECTOR_ID are required for the live smoke test"
  );
}

const client = new BrightDataScraperStudioClient({
  apiToken: config.BRIGHT_DATA_API_TOKEN,
  apiBaseUrl: config.BRIGHT_DATA_API_BASE_URL,
  pollIntervalMs: config.BRIGHT_DATA_POLL_INTERVAL_MS,
  pollTimeoutMs: config.BRIGHT_DATA_POLL_TIMEOUT_MS
});
const result = await client.runCollector({
  collectorId: config.PRIMARY_COLLECTOR_ID,
  sourceId: PA211_SOURCE.sourceId,
  canonicalUrl: PA211_SOURCE.canonicalUrl
});
const normalization = normalizePa211RowsWithMetrics(result.records, result.fetchedAt);
const validation = evaluateCandidate({
  records: normalization.records,
  allowedOrigins: [...PA211_SOURCE.allowedOrigins],
  coverage: normalization.coverage,
  candidate: {
    collectorId: result.collectorId,
    collectorVersion: result.collectorVersion,
    schemaVersion: result.schemaVersion
  }
});
process.stdout.write(
  `${JSON.stringify(
    {
      collectorId: result.collectorId,
      mode: result.mode,
      providerRecordsReceived: validation.coverage.providerRecordsReceived,
      normalizedRecordsAccepted: validation.coverage.normalizedRecordsAccepted,
      recordsFilteredNotLocations: validation.coverage.recordsFilteredNotLocations,
      exactDuplicatesRemoved: validation.coverage.exactDuplicatesRemoved,
      recordsRejectedByValidation: validation.coverage.recordsRejectedByValidation,
      disposition: validation.disposition,
      reasonCodes: [...validation.hardFailures, ...validation.softAnomalies],
      rawSha256: result.rawSha256
    },
    null,
    2
  )}\n`
);
if (validation.disposition !== "publishable") process.exitCode = 1;
