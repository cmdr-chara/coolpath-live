import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoolPathRepository } from "@coolpath/db";
import {
  BrightDataHttpError,
  BrightDataTimeoutError,
  MockScraperStudioClient,
  type CollectorRunInput,
  type CollectorRunResult,
  type CollectorStatus,
  type HealRequest,
  type HealResult
} from "@coolpath/source-adapters";
import {
  DEMO_COLLECTOR_ID,
  DEMO_EVIDENCE_URL,
  DEMO_SOURCE_ID,
  healthyCollectorResult
} from "@coolpath/test-fixtures";
import { IngestionService } from "./ingestion-service.js";
import { seedSourceConfiguration } from "./seed.js";

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) throw new Error("Deferred promise was not initialized");
      resolvePromise(value);
    }
  };
}

function healthyResult(input: CollectorRunInput, observedAt: string): CollectorRunResult {
  const records = healthyCollectorResult.map((site) => ({
    ...structuredClone(site),
    sourceKey: input.sourceId,
    observedAt
  }));
  return {
    collectorId: input.collectorId,
    collectorVersion: "1",
    schemaVersion: "1",
    fetchedAt: observedAt,
    records,
    rawSha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    mode: "mock"
  };
}

class FailingClient extends MockScraperStudioClient {
  constructor(private readonly failure: Error) {
    super();
  }

  override runCollector(): Promise<CollectorRunResult> {
    return Promise.reject(this.failure);
  }
}

class ClockedHealthyClient extends MockScraperStudioClient {
  calls = 0;

  constructor(private readonly now: () => Date) {
    super();
  }

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    return Promise.resolve(healthyResult(input, this.now().toISOString()));
  }
}

class QueueClient extends MockScraperStudioClient {
  calls = 0;
  private readonly queue: Array<(input: CollectorRunInput) => Promise<CollectorRunResult>> = [];

  enqueue(operation: (input: CollectorRunInput) => Promise<CollectorRunResult>): void {
    this.queue.push(operation);
  }

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    const operation = this.queue.shift();
    if (!operation) throw new Error("No queued collector result");
    return operation(input);
  }
}

class FailOnceRepository extends CoolPathRepository {
  private shouldFail = true;

  override recordRun(input: Parameters<CoolPathRepository["recordRun"]>[0]): void {
    if (this.shouldFail) {
      this.shouldFail = false;
      throw new Error("simulated persistence failure");
    }
    super.recordRun(input);
  }
}

describe("truthful freshness reconciliation", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
  });

  afterEach(() => repository.close());

  it("keeps fresh data healthy, marks expired data stale once, performs no provider request and recovers", async () => {
    let clock = new Date("2026-08-17T12:00:00.000Z");
    const client = new ClockedHealthyClient(() => clock);
    const service = new IngestionService(repository, client, undefined, { now: () => clock });
    await service.runSource(DEMO_SOURCE_ID);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("HEALTHY");

    clock = new Date("2026-08-24T11:59:59.000Z");
    const timelineBeforeExpiry = repository.listTimeline(DEMO_SOURCE_ID, 100).length;
    expect(service.reconcileFreshness(DEMO_SOURCE_ID)).toBe(false);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("HEALTHY");
    expect(client.calls).toBe(1);

    clock = new Date("2026-08-24T12:00:00.001Z");
    expect(service.reconcileFreshness(DEMO_SOURCE_ID)).toBe(true);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("STALE");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
    expect(client.calls).toBe(1);
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)).toHaveLength(timelineBeforeExpiry + 1);

    expect(service.reconcileFreshness(DEMO_SOURCE_ID)).toBe(false);
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)).toHaveLength(timelineBeforeExpiry + 1);
    expect(client.calls).toBe(1);

    clock = new Date("2026-08-24T12:05:00.000Z");
    await service.runSource(DEMO_SOURCE_ID);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("HEALTHY");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.observedAt).toBe(clock.toISOString());
    expect(client.calls).toBe(2);
  });
});

describe("per-source operation coordination", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
  });

  afterEach(() => repository.close());

  it("launches only one provider request and returns a sanitized conflict", async () => {
    const pending = deferred<CollectorRunResult>();
    const client = new QueueClient();
    client.enqueue(() => pending.promise);
    const service = new IngestionService(repository, client);

    const first = service.runSource(DEMO_SOURCE_ID);
    await expect(service.runSource(DEMO_SOURCE_ID)).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT"
    });
    expect(client.calls).toBe(1);

    pending.resolve(
      healthyResult(
        {
          collectorId: DEMO_COLLECTOR_ID,
          sourceId: DEMO_SOURCE_ID,
          canonicalUrl: DEMO_EVIDENCE_URL
        },
        "2026-08-17T12:00:00.000Z"
      )
    );
    await first;
  });

  it("keeps operations for different allowlisted sources independent", async () => {
    const secondarySourceId = "demo-secondary-cooling";
    const source = repository.getSource(DEMO_SOURCE_ID);
    if (!source) throw new Error("Expected seeded source");
    repository.upsertSource({
      ...source,
      id: secondarySourceId,
      collectorId: "secondary-collector",
      publishedSnapshotId: null,
      currentState: "UNINITIALIZED"
    });
    const pending = deferred<CollectorRunResult>();
    const client = new QueueClient();
    client.enqueue(() => pending.promise);
    client.enqueue((input) =>
      Promise.resolve(healthyResult(input, "2026-08-17T12:01:00.000Z"))
    );
    const service = new IngestionService(repository, client);

    const first = service.runSource(DEMO_SOURCE_ID);
    await expect(service.runSource(secondarySourceId)).resolves.toMatchObject({
      validation: { disposition: "publishable" }
    });
    expect(client.calls).toBe(2);

    pending.resolve(
      healthyResult(
        {
          collectorId: DEMO_COLLECTOR_ID,
          sourceId: DEMO_SOURCE_ID,
          canonicalUrl: DEMO_EVIDENCE_URL
        },
        "2026-08-17T12:00:00.000Z"
      )
    );
    await first;
  });

  it("releases the lock after provider failure so a later check can succeed", async () => {
    const failure = new TypeError("fetch failed");
    const client = new QueueClient();
    client.enqueue(() => Promise.reject(failure));
    client.enqueue((input) =>
      Promise.resolve(healthyResult(input, "2026-08-17T12:05:00.000Z"))
    );
    const service = new IngestionService(repository, client);

    await expect(service.runSource(DEMO_SOURCE_ID)).rejects.toBe(failure);
    await expect(service.runSource(DEMO_SOURCE_ID)).resolves.toMatchObject({
      validation: { disposition: "publishable" }
    });
    expect(client.calls).toBe(2);
  });

  it("releases the lock after a persistence exception", async () => {
    repository.close();
    const failOnce = new FailOnceRepository(":memory:");
    repository = failOnce;
    seedSourceConfiguration(repository);
    const client = new ClockedHealthyClient(() => new Date("2026-08-17T12:00:00.000Z"));
    const service = new IngestionService(repository, client);

    await expect(service.runSource(DEMO_SOURCE_ID)).rejects.toThrow("simulated persistence failure");
    await expect(service.runSource(DEMO_SOURCE_ID)).resolves.toMatchObject({
      validation: { disposition: "publishable" }
    });
    expect(client.calls).toBe(2);
  });

  it("does not overlap a source check with a healing mutation", async () => {
    const baselineClient = new MockScraperStudioClient();
    const baselineService = new IngestionService(repository, baselineClient);
    await baselineService.runSource(DEMO_SOURCE_ID);
    baselineClient.setLayout("v2");
    await baselineService.runSource(DEMO_SOURCE_ID);

    const pendingHeal = deferred<HealResult>();
    class DelayedHealClient extends MockScraperStudioClient {
      override requestHeal(_input: HealRequest): Promise<HealResult> {
        return pendingHeal.promise;
      }
    }
    const client = new DelayedHealClient();
    const service = new IngestionService(repository, client);
    const healing = service.requestHeal(DEMO_SOURCE_ID);

    await expect(service.runSource(DEMO_SOURCE_ID)).rejects.toMatchObject({ statusCode: 409 });
    pendingHeal.resolve({
      collectorId: DEMO_COLLECTOR_ID,
      jobId: "heal-job",
      status: "review_pending",
      diff: [],
      mode: "mock"
    });
    await healing;
  });
});

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
    [new BrightDataTimeoutError(), "TRANSPORT_TIMEOUT"],
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

describe("incident lifecycle correctness", () => {
  let repository: CoolPathRepository;
  let client: MockScraperStudioClient;
  let service: IngestionService;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
    client = new MockScraperStudioClient();
    let tick = 0;
    service = new IngestionService(repository, client, undefined, {
      now: () => new Date(Date.parse("2026-08-17T12:30:00.000Z") + tick++ * 1_000)
    });
  });

  afterEach(() => repository.close());

  it("resolves an active incident after an ordinary passing check and returns to HEALTHY", async () => {
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    const incident = repository.getCurrentIncident(DEMO_SOURCE_ID);
    expect(incident).not.toBeNull();
    if (!incident) throw new Error("Expected active incident");

    client.setLayout("v1");
    const recovery = await service.runSource(DEMO_SOURCE_ID);

    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)).toBeNull();
    expect(repository.getIncident(incident.id)).toMatchObject({
      resolvedByRunId: recovery.runId,
      healState: "not_requested"
    });
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("HEALTHY");
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)[0]).toMatchObject({
      kind: "recovered_check"
    });
    const resolved = repository.getRun(recovery.runId);
    expect(resolved?.outcome).toBe("publishable");
  });

  it("keeps the incident open after another quarantined run", async () => {
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    const incidentId = repository.getCurrentIncident(DEMO_SOURCE_ID)?.id;

    await service.runSource(DEMO_SOURCE_ID);

    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.id).toBe(incidentId);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
  });

  it("keeps the incident open after an inconclusive transport failure", async () => {
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    const incidentId = repository.getCurrentIncident(DEMO_SOURCE_ID)?.id;
    const failure = new BrightDataHttpError(503, "Unavailable");
    const failingService = new IngestionService(repository, new FailingClient(failure));

    await expect(failingService.runSource(DEMO_SOURCE_ID)).rejects.toBe(failure);

    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.id).toBe(incidentId);
  });

  it("resolves approved healing through the proving rerun as RECOVERED", async () => {
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    await service.requestHeal(DEMO_SOURCE_ID);
    const incident = repository.getCurrentIncident(DEMO_SOURCE_ID);
    if (!incident) throw new Error("Expected active incident");

    const current = await service.decideHeal(DEMO_SOURCE_ID, true);

    expect(current).toBeNull();
    expect(repository.getIncident(incident.id)).toMatchObject({
      healState: "approved",
      resolvedByRunId: expect.any(String)
    });
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("RECOVERED");
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)[0]).toMatchObject({ kind: "recovered" });
  });

  it("marks a failed provider decision and releases coordination for a later check", async () => {
    const failure = new BrightDataHttpError(503, "Unavailable");
    class FailedDecisionClient extends MockScraperStudioClient {
      override decideHeal(): Promise<CollectorStatus> {
        return Promise.reject(failure);
      }
    }
    const failedClient = new FailedDecisionClient();
    const failedService = new IngestionService(repository, failedClient);
    await failedService.runSource(DEMO_SOURCE_ID);
    failedClient.setLayout("v2");
    await failedService.runSource(DEMO_SOURCE_ID);
    await failedService.requestHeal(DEMO_SOURCE_ID);

    await expect(failedService.decideHeal(DEMO_SOURCE_ID, true)).rejects.toBe(failure);
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.healState).toBe("failed");

    failedClient.setLayout("v1");
    await expect(failedService.runSource(DEMO_SOURCE_ID)).resolves.toMatchObject({
      validation: { disposition: "publishable" }
    });
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)).toBeNull();
  });

  it("marks an ineffective approved repair failed without resolving the incident", async () => {
    class IneffectiveRepairClient extends MockScraperStudioClient {
      override decideHeal(): Promise<CollectorStatus> {
        return Promise.resolve({ collectorId: "unchanged", status: "ready", version: "1" });
      }
    }
    const ineffective = new IneffectiveRepairClient();
    const ineffectiveService = new IngestionService(repository, ineffective);
    await ineffectiveService.runSource(DEMO_SOURCE_ID);
    ineffective.setLayout("v2");
    await ineffectiveService.runSource(DEMO_SOURCE_ID);
    await ineffectiveService.requestHeal(DEMO_SOURCE_ID);

    const incident = await ineffectiveService.decideHeal(DEMO_SOURCE_ID, true);

    expect(incident?.healState).toBe("failed");
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)).not.toBeNull();
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
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

describe("published identity and normalization evidence", () => {
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
    const source = repository.getSource(DEMO_SOURCE_ID);
    if (!source) throw new Error("Expected seeded source");
    repository.upsertSource({ ...source, collectorId: "replacement-collector" });

    const result = await service.runSource(DEMO_SOURCE_ID);

    expect(result.validation.hardFailures).toContain("COLLECTOR_IDENTITY_CHANGED");
    expect(result.validation.disposition).toBe("quarantined");
  });

  it("quarantines a thrown normalizer and records aggregate rejection without raw data", async () => {
    const client = new ClockedHealthyClient(() => new Date("2026-08-17T12:00:00.000Z"));
    const service = new IngestionService(repository, client, () => {
      throw new Error("source row rejected: private raw record");
    });

    const result = await service.runSource(DEMO_SOURCE_ID);

    expect(result.validation.disposition).toBe("quarantined");
    expect(result.validation.hardFailures).toContain("INVALID_SCHEMA");
    expect(result.validation.coverage).toMatchObject({
      providerRecordsReceived: 3,
      normalizedRecordsAccepted: 0,
      recordsRejectedByValidation: 3
    });
    expect(JSON.stringify(repository.getLatestRun(DEMO_SOURCE_ID))).not.toContain(
      "private raw record"
    );
  });
});
