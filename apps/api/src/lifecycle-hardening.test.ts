import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CoolPathRepository } from "@coolpath/db";
import {
  MockScraperStudioClient,
  type CollectorRunInput,
  type CollectorRunResult,
  type CollectorStatus
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

class DelayedSecondRunClient extends MockScraperStudioClient {
  calls = 0;
  readonly secondRun = deferred<CollectorRunResult>();

  constructor(private readonly now: () => Date) {
    super();
  }

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    if (this.calls === 1) return Promise.resolve(healthyResult(input, this.now().toISOString()));
    if (this.calls === 2) return this.secondRun.promise;
    return Promise.resolve(healthyResult(input, this.now().toISOString()));
  }
}

class MultiApprovalClient extends MockScraperStudioClient {
  runs = 0;

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.runs += 1;
    return super.runCollector(input);
  }

  override decideHeal(
    input: Parameters<MockScraperStudioClient["decideHeal"]>[0]
  ): Promise<CollectorStatus> {
    return Promise.resolve({
      collectorId: input.collectorId,
      status: "review_pending",
      version: "2-draft",
      diff: [{ field: "addressText", before: ".old", after: ".new" }]
    });
  }
}

describe("lifecycle hardening", () => {
  let repository: CoolPathRepository;

  beforeEach(() => {
    repository = new CoolPathRepository(":memory:");
    seedSourceConfiguration(repository);
  });

  afterEach(() => repository.close());

  it("does not let freshness reconciliation overwrite an active source operation", async () => {
    let clock = new Date("2026-08-17T12:00:00.000Z");
    const client = new DelayedSecondRunClient(() => clock);
    const service = new IngestionService(repository, client, undefined, { now: () => clock });
    await service.runSource(DEMO_SOURCE_ID);

    clock = new Date("2026-08-25T12:00:00.000Z");
    const second = service.runSource(DEMO_SOURCE_ID);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("CHECKING");
    expect(service.reconcileFreshness(DEMO_SOURCE_ID)).toBe(false);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("CHECKING");

    client.secondRun.resolve(
      healthyResult(
        {
          collectorId: DEMO_COLLECTOR_ID,
          sourceId: DEMO_SOURCE_ID,
          canonicalUrl: DEMO_EVIDENCE_URL
        },
        clock.toISOString()
      )
    );
    await second;
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("HEALTHY");
  });

  it("recovers a persisted interrupted check without replacing the trusted snapshot", async () => {
    const service = new IngestionService(repository, new MockScraperStudioClient(), undefined, {
      now: () => new Date("2026-08-17T12:30:00.000Z")
    });
    await service.runSource(DEMO_SOURCE_ID);
    const trusted = repository.getPublishedSnapshot(DEMO_SOURCE_ID);
    if (!trusted) throw new Error("Expected a trusted snapshot");
    repository.setSourceState(DEMO_SOURCE_ID, "CHECKING");

    expect(service.recoverInterruptedOperation(DEMO_SOURCE_ID)).toBe(true);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.id).toBe(trusted.id);
    expect(
      repository.listTimeline(DEMO_SOURCE_ID).some((event) => event.kind === "operation_interrupted")
    ).toBe(true);
  });

  it("recovers a persisted interrupted healing request and leaves the incident open", async () => {
    const client = new MockScraperStudioClient();
    const service = new IngestionService(repository, client, undefined, {
      now: () => new Date("2026-08-17T12:30:00.000Z")
    });
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    const incident = repository.getCurrentIncident(DEMO_SOURCE_ID);
    if (!incident) throw new Error("Expected an active incident");
    repository.updateIncidentHeal({ incidentId: incident.id, healState: "running" });
    repository.setSourceState(DEMO_SOURCE_ID, "HEALING");

    expect(service.recoverInterruptedOperation(DEMO_SOURCE_ID)).toBe(true);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.healState).toBe("failed");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
  });

  it("does not rerun the collector when Bright Data asks for another approval", async () => {
    const client = new MultiApprovalClient();
    const service = new IngestionService(repository, client);
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    await service.requestHeal(DEMO_SOURCE_ID);

    const incident = await service.decideHeal(DEMO_SOURCE_ID, true);

    expect(client.runs).toBe(2);
    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("REVIEW_PENDING");
    expect(incident?.healState).toBe("review_pending");
    expect(incident?.healDiff).toEqual([{ field: "addressText", before: ".old", after: ".new" }]);
  });

  it("restores degraded trusted-data semantics when a repair is rejected", async () => {
    const client = new MockScraperStudioClient();
    const service = new IngestionService(repository, client);
    await service.runSource(DEMO_SOURCE_ID);
    client.setLayout("v2");
    await service.runSource(DEMO_SOURCE_ID);
    await service.requestHeal(DEMO_SOURCE_ID);

    await service.decideHeal(DEMO_SOURCE_ID, false);

    expect(repository.getSource(DEMO_SOURCE_ID)?.currentState).toBe("DEGRADED");
    expect(repository.getCurrentIncident(DEMO_SOURCE_ID)?.healState).toBe("rejected");
    expect(repository.getPublishedSnapshot(DEMO_SOURCE_ID)?.sites).toHaveLength(3);
  });
});
