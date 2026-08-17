import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoolPathRepository } from "@coolpath/db";
import {
  BrightDataHttpError,
  MockScraperStudioClient,
  type CollectorStatus,
  type CollectorRunResult
} from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import { IngestionService } from "./ingestion-service.js";
import { seedSourceConfiguration } from "./seed.js";

class FailingClient extends MockScraperStudioClient {
  constructor(private readonly failure: Error) {
    super();
  }

  override runCollector(): Promise<CollectorRunResult> {
    return Promise.reject(this.failure);
  }
}

describe("ingestion transport failures", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
  });

  afterEach(() => repository.close());

  it.each([
    [new BrightDataHttpError(403, "Forbidden"), "TRANSPORT_FORBIDDEN"],
    [new BrightDataHttpError(429, "Too Many Requests"), "TRANSPORT_RATE_LIMITED"],
    [new TypeError("fetch failed", { cause: { code: "ENOTFOUND" } }), "TRANSPORT_DNS_FAILURE"]
  ])("records %s as inconclusive evidence", async (failure, expectedReason) => {
    const service = new IngestionService(repository, new FailingClient(failure));

    await expect(service.runSource(DEMO_SOURCE_ID)).rejects.toBe(failure);

    expect(repository.getLatestRun(DEMO_SOURCE_ID)).toMatchObject({
      outcome: "inconclusive",
      reasonCodes: [expectedReason]
    });
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("BROKEN");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)).toBeNull();
  });
});

describe("healing failure safety", () => {
  let repository: CoolPathRepository;

  beforeEach(async () => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
    const client = new MockScraperStudioClient();
    const service = new IngestionService(repository, client);
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
  });

  afterEach(() => repository.close());

  it("leaves the collector unchanged and restores source state when repair creation fails", async () => {
    const failure = new BrightDataHttpError(503, "Unavailable");
    class FailedHealClient extends MockScraperStudioClient {
      override requestHeal(): Promise<never> {
        return Promise.reject(failure);
      }
    }
    const service = new IngestionService(repository, new FailedHealClient());

    await expect(service.requestHeal(DEMO_SOURCE_ID)).rejects.toBe(failure);

    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.healState).toBe("failed");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
    expect(repository.listTimeline(DEMO_SOURCE_ID)[0]?.kind).toBe("heal_failed");
  });
});

describe("published identity and repair validation", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
  });

  afterEach(() => repository.close());

  it("detects a collector ID change against the published run", async () => {
    const client = new MockScraperStudioClient();
    const service = new IngestionService(repository, client);
    await service.runSource(DEMO_SOURCE_ID);
    repository.upsertSource({
      ...repository.getSource(DEMO_SOURCE_ID)!,
      collectorId: "replacement-collector"
    });

    const result = await service.runSource(DEMO_SOURCE_ID);

    expect(result.validation.hardFailures).toContain("COLLECTOR_IDENTITY_CHANGED");
    expect(result.validation.disposition).toBe("quarantined");
  });

  it("marks an ineffective approved repair failed after quarantine", async () => {
    class IneffectiveRepairClient extends MockScraperStudioClient {
      override decideHeal(): Promise<CollectorStatus> {
        return Promise.resolve({ collectorId: "unchanged", status: "ready", version: "1" });
      }
    }
    const client = new IneffectiveRepairClient();
    const service = new IngestionService(repository, client);
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    await service.requestHeal(DEMO_SOURCE_ID);

    const incident = await service.decideHeal(DEMO_SOURCE_ID, true);

    expect(incident?.healState).toBe("failed");
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
  });
});
