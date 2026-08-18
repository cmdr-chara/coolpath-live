import { createHash } from "node:crypto";
import { CoolPathRepository } from "@coolpath/db";
import {
  MockScraperStudioClient,
  type CollectorRunInput,
  type CollectorRunResult
} from "@coolpath/source-adapters";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { getConfig } from "./config.js";
import { PRIMARY_SOURCE_ID } from "./seed.js";

function pa211Result(input: CollectorRunInput): CollectorRunResult {
  const records = [
    {
      facility_name: "Broad Street Ministry - Cooling Center",
      address: "315 South Broad Street, Philadelphia, PA 19107",
      service_text: "Serves as a cooling center during extreme heat emergencies (code reds).",
      evidence_url: "/search/82ea1f2e-cea1-568f-a6ae-70a841dbcf13"
    }
  ];
  return {
    collectorId: input.collectorId,
    collectorVersion: "1",
    schemaVersion: "1",
    fetchedAt: "2026-08-17T12:01:00.000Z",
    records,
    rawSha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    mode: "real"
  };
}

class ControlledPa211Client extends MockScraperStudioClient {
  calls = 0;
  closeCalls = 0;
  private pendingInput: CollectorRunInput | undefined;
  private resolvePending: ((value: CollectorRunResult) => void) | undefined;
  private readonly pending = new Promise<CollectorRunResult>((resolve) => {
    this.resolvePending = resolve;
  });

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    this.pendingInput = input;
    return this.pending;
  }

  resolve(): void {
    if (!this.pendingInput || !this.resolvePending) {
      throw new Error("The controlled collector has not started");
    }
    this.resolvePending(pa211Result(this.pendingInput));
  }

  override close(): void {
    this.closeCalls += 1;
    super.close();
  }
}

async function waitForCollector(client: ControlledPa211Client): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (client.calls === 1) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Background collector call did not start");
}

describe("API shutdown", () => {
  let app: FastifyInstance | undefined;
  let repository: CoolPathRepository | undefined;

  afterEach(async () => {
    const currentApp = app;
    const currentRepository = repository;
    app = undefined;
    repository = undefined;
    await currentApp?.close();
    currentRepository?.close();
  });

  it("waits for injected background ingestion before shutdown", async () => {
    const client = new ControlledPa211Client();
    repository = new CoolPathRepository(":memory:");
    const activeRepository = repository;
    app = await buildApp({
      config: getConfig({
        NODE_ENV: "test",
        DATABASE_URL: ":memory:",
        COOLPATH_MODE: "real",
        AUTO_START_REAL_CHECK: true,
        BRIGHT_DATA_API_TOKEN: "test-token",
        PRIMARY_COLLECTOR_ID: "pa211-collector",
        OPERATOR_API_TOKEN: "operator-token-with-at-least-32-characters"
      }),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });
    await waitForCollector(client);

    let closeCompleted = false;
    const closePromise = app.close().then(() => {
      closeCompleted = true;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(closeCompleted).toBe(false);
    expect(activeRepository.checkHealth()).toBe(true);

    client.resolve();
    await closePromise;
    app = undefined;

    expect(closeCompleted).toBe(true);
    expect(client.closeCalls).toBe(0);
    expect(activeRepository.getPublishedSnapshot(PRIMARY_SOURCE_ID)).not.toBeNull();
    expect(activeRepository.checkHealth()).toBe(true);
  });
});
