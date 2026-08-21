import { mkdtemp, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoolPathRepository } from "../packages/db/src/index.js";
import {
  apiCityResponseEnvelopeSchema,
  apiCitySummaryListEnvelopeSchema
} from "../packages/domain/src/api-contracts.js";
import { buildApp } from "../apps/api/src/app.js";
import { getConfig } from "../apps/api/src/config.js";
import { PRIMARY_SOURCE_ID } from "../apps/api/src/seed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseArgument = readArgument("--database");
if (!databaseArgument) {
  throw new Error("Usage: pnpm deploy:export -- --database <trusted-snapshot.db>");
}

const sourceDatabase = path.resolve(root, databaseArgument);
const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "coolpath-pages-export-"));
const copiedDatabase = path.join(temporaryDirectory, "snapshot.db");
await copyFile(sourceDatabase, copiedDatabase);

const repository = new CoolPathRepository(copiedDatabase);
const config = getConfig({
  NODE_ENV: "test",
  PORT: 8787,
  HOST: "127.0.0.1",
  DATABASE_URL: copiedDatabase,
  COOLPATH_MODE: "real",
  AUTO_START_REAL_CHECK: false,
  BRIGHT_DATA_API_TOKEN: "static-export-does-not-use-provider",
  OPERATOR_API_TOKEN: "static-export-does-not-expose-operator-token",
  PRIMARY_COLLECTOR_ID: "c_msxe8lsm2630ya30wu",
  WEB_ORIGIN: "https://cmdr-chara.github.io"
});
let providerCalls = 0;
const app = await buildApp({
  config,
  repository,
  scraperClient: {
    runCollector() {
      providerCalls += 1;
      return Promise.reject(new Error("Static export must never call Bright Data"));
    }
  }
});

try {
  repository.setSourceState(PRIMARY_SOURCE_ID, "STALE");
  const citiesResponse = await app.inject({ method: "GET", url: "/api/cities" });
  const cityResponse = await app.inject({ method: "GET", url: "/api/cities/philadelphia" });
  if (citiesResponse.statusCode !== 200 || cityResponse.statusCode !== 200) {
    throw new Error(
      `Static export failed: cities=${citiesResponse.statusCode}, city=${cityResponse.statusCode}`
    );
  }

  const citiesEnvelope = apiCitySummaryListEnvelopeSchema.parse(citiesResponse.json());
  const cityEnvelope = apiCityResponseEnvelopeSchema.parse(cityResponse.json());
  if (cityEnvelope.data.source.status !== "STALE") {
    throw new Error("The public Pages export must be labelled as a historical snapshot");
  }
  if (cityEnvelope.data.snapshot?.sites.length !== 23) {
    throw new Error("The public Pages export must contain the 23 validated locations");
  }
  if (providerCalls !== 0) {
    throw new Error("The static export unexpectedly called the provider");
  }

  const evidenceDirectory = path.join(root, "docs", "evidence");
  await writeJson(path.join(evidenceDirectory, "deployed-city-list.example.json"), citiesEnvelope);
  await writeJson(
    path.join(evidenceDirectory, "deployed-public-read-model.example.json"),
    cityEnvelope
  );
  console.log(
    `Exported ${cityEnvelope.data.snapshot.sites.length} historical public records with zero provider calls.`
  );
} finally {
  await app.close();
  repository.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function writeJson(target, value) {
  const previous = await readFile(target, "utf8").catch(() => "");
  const next = `${JSON.stringify(value, null, 2)}\n`;
  if (previous !== next) await writeFile(target, next, "utf8");
}
