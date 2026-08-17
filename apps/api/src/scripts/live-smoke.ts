import { evaluateCandidate } from "@coolpath/domain";
import {
  BrightDataScraperStudioClient,
  normalizePa211Rows,
  PA211_CANONICAL_URL
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
  sourceId: "pa211-philadelphia-cooling",
  canonicalUrl: PA211_CANONICAL_URL
});
const sites = normalizePa211Rows(result.records, result.fetchedAt);
const validation = evaluateCandidate({
  records: sites,
  allowedOrigins: ["https://search.pa211.org"],
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
      recordCount: validation.recordCount,
      disposition: validation.disposition,
      reasonCodes: [...validation.hardFailures, ...validation.softAnomalies],
      rawSha256: result.rawSha256
    },
    null,
    2
  )}\n`
);
if (validation.disposition !== "publishable") process.exitCode = 1;
