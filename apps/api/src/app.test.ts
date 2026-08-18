import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { CoolPathRepository } from "@coolpath/db";
import {
  MockScraperStudioClient,
  type CollectorRunInput,
  type CollectorRunResult
} from "@coolpath/source-adapters";
import {
  DEMO_SOURCE_ID,
  FIXTURE_OBSERVED_AT,
  healthyCollectorResult
} from "@coolpath/test-fixtures";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { type AppConfig, getConfig } from "./config.js";
import { PRIMARY_SOURCE_ID } from "./seed.js";

interface CityPayload {
  data: {
    source: { status: string };
    snapshot: { sites: unknown[] } | null;
    latestRun: { outcome: string } | null;
    incident: { healState: string; healDiff: unknown[] } | null;
    timeline: Array<{ kind: string }>;
  };
}

interface IncidentPayload {
  data: { healState: string; healDiff: unknown[] } | null;
}

interface ReadinessPayload {
  data: {
    status: "ready" | "not_ready";
    checks: {
      database: "usable" | "unavailable";
      source: "initialized" | "unavailable";
      trustedSnapshot: "available" | "unavailable";
    };
    sourceState: string | null;
  };
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  let rejectPromise: ((reason: unknown) => void) | undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) throw new Error("Deferred promise was not initialized");
      resolvePromise(value);
    },
    reject(reason: unknown): void {
      if (!rejectPromise) throw new Error("Deferred promise was not initialized");
      rejectPromise(reason);
    }
  };
}

async function waitForCondition(predicate: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(message);
}

function fixtureResult(input: CollectorRunInput, observedAt: string): CollectorRunResult {
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

function pa211Result(input: CollectorRunInput, observedAt: string): CollectorRunResult {
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
    fetchedAt: observedAt,
    records,
    rawSha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
    mode: "real"
  };
}

function realConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return getConfig({
    NODE_ENV: "test",
    DATABASE_URL: ":memory:",
    COOLPATH_MODE: "real",
    AUTO_START_REAL_CHECK: false,
    BRIGHT_DATA_API_TOKEN: "test-token",
    PRIMARY_COLLECTOR_ID: "pa211-collector",
    OPERATOR_API_TOKEN: "operator-token-with-at-least-32-characters",
    ...overrides
  });
}

class ClockedFixtureClient extends MockScraperStudioClient {
  calls = 0;

  constructor(private readonly now: () => Date) {
    super();
  }

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    return Promise.resolve(fixtureResult(input, this.now().toISOString()));
  }
}

class ImmediatePa211Client extends MockScraperStudioClient {
  calls = 0;

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    return Promise.resolve(pa211Result(input, `2026-08-17T12:0${this.calls}:00.000Z`));
  }
}

class ControlledPa211Client extends MockScraperStudioClient {
  calls = 0;
  private firstInput: CollectorRunInput | null = null;
  private readonly firstResult = deferred<CollectorRunResult>();

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    if (this.calls === 1) {
      this.firstInput = input;
      return this.firstResult.promise;
    }
    return Promise.resolve(pa211Result(input, `2026-08-17T12:0${this.calls}:00.000Z`));
  }

  resolveFirst(observedAt = "2026-08-17T12:01:00.000Z"): void {
    if (!this.firstInput) throw new Error("The first collector call has not started");
    this.firstResult.resolve(pa211Result(this.firstInput, observedAt));
  }
}

class RejectOncePa211Client extends MockScraperStudioClient {
  calls = 0;

  override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    this.calls += 1;
    if (this.calls === 1) return Promise.reject(new TypeError("fetch failed"));
    return Promise.resolve(pa211Result(input, "2026-08-17T12:05:00.000Z"));
  }
}

class UnexpectedCallClient extends MockScraperStudioClient {
  calls = 0;

  override runCollector(): Promise<CollectorRunResult> {
    this.calls += 1;
    return Promise.reject(new Error("The provider must not be called during default startup"));
  }
}

class CountingRepository extends CoolPathRepository {
  closeCalls = 0;

  override close(): void {
    this.closeCalls += 1;
    super.close();
  }
}

describe("public API and recovery demo", () => {
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

  it("exposes published snapshots only and protects them during drift", async () => {
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => new Date("2026-08-17T12:30:00.000Z")
    });

    const healthy = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    expect(healthy.statusCode).toBe(200);
    expect(healthy.headers.etag).toBeTruthy();
    expect(healthy.json<CityPayload>().data.snapshot?.sites).toHaveLength(3);

    await app.inject({ method: "POST", url: "/api/demo/drift" });
    const degraded = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const degradedPayload = degraded.json<CityPayload>();
    expect(degradedPayload.data.source.status).toBe("DEGRADED");
    expect(degradedPayload.data.snapshot?.sites).toHaveLength(3);
    expect(degradedPayload.data.latestRun?.outcome).toBe("quarantined");
    expect(degradedPayload.data.incident).not.toBeNull();
  });

  it("requires approval and a second validated run before recovery publication", async () => {
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => new Date("2026-08-17T12:30:00.000Z")
    });
    await app.inject({ method: "POST", url: "/api/demo/drift" });
    await app.inject({ method: "POST", url: "/api/demo/heal" });
    const review = await app.inject({
      method: "GET",
      url: `/api/incidents/${DEMO_SOURCE_ID}/current`
    });
    const reviewPayload = review.json<IncidentPayload>();
    expect(reviewPayload.data?.healState).toBe("review_pending");
    expect(reviewPayload.data?.healDiff).toHaveLength(3);

    const decision = await app.inject({
      method: "POST",
      url: "/api/demo/heal/decision",
      payload: { approve: true }
    });
    expect(decision.statusCode).toBe(200);
    const recovered = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const recoveredPayload = recovered.json<CityPayload>();
    expect(recoveredPayload.data.source.status).toBe("RECOVERED");
    expect(recoveredPayload.data.snapshot?.sites).toHaveLength(3);
    expect(recoveredPayload.data.latestRun?.outcome).toBe("publishable");
    expect(recoveredPayload.data.incident).toBeNull();
  });

  it("uses stable semantic ETags and invalidates them for incident lifecycle changes", async () => {
    repository = new CoolPathRepository(":memory:");
    let clock = new Date("2026-08-17T12:30:00.000Z");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => clock
    });

    const healthy = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const healthyTag = healthy.headers.etag;
    expect(healthy.headers["cache-control"]).toBe("public, max-age=0, must-revalidate");
    clock = new Date("2026-08-17T12:31:00.000Z");
    const unchanged = await app.inject({
      method: "GET",
      url: "/api/cities/demo-city",
      headers: { "if-none-match": healthyTag as string }
    });
    expect(unchanged.statusCode).toBe(304);

    await app.inject({ method: "POST", url: "/api/demo/drift" });
    const drifted = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const driftedTag = drifted.headers.etag;
    expect(driftedTag).not.toBe(healthyTag);

    await app.inject({ method: "POST", url: "/api/demo/heal" });
    const review = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const reviewTag = review.headers.etag;
    expect(reviewTag).not.toBe(driftedTag);

    await app.inject({
      method: "POST",
      url: "/api/demo/heal/decision",
      payload: { approve: true }
    });
    const recovered = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    expect(recovered.headers.etag).not.toBe(reviewTag);
    expect(recovered.json<CityPayload>().data.source.status).toBe("RECOVERED");
  });

  it("reconciles freshness without provider calls and remains idempotent", async () => {
    let clock = new Date(FIXTURE_OBSERVED_AT);
    const client = new ClockedFixtureClient(() => clock);
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: client,
      now: () => clock
    });

    const fresh = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const freshTag = fresh.headers.etag as string;
    const timelineBeforeExpiry = repository.listTimeline(DEMO_SOURCE_ID, 100).length;
    expect(fresh.json<CityPayload>().data.source.status).toBe("HEALTHY");
    expect(client.calls).toBe(1);

    clock = new Date(Date.parse(FIXTURE_OBSERVED_AT) + 10_080 * 60_000 - 1);
    const stillFresh = await app.inject({
      method: "GET",
      url: "/api/cities/demo-city",
      headers: { "if-none-match": freshTag }
    });
    expect(stillFresh.statusCode).toBe(304);
    expect(client.calls).toBe(1);

    clock = new Date(Date.parse(FIXTURE_OBSERVED_AT) + 10_080 * 60_000 + 1);
    const stale = await app.inject({
      method: "GET",
      url: "/api/cities/demo-city",
      headers: { "if-none-match": freshTag }
    });
    const staleTag = stale.headers.etag as string;
    expect(stale.statusCode).toBe(200);
    expect(staleTag).not.toBe(freshTag);
    expect(stale.json<CityPayload>().data.source.status).toBe("STALE");
    expect(client.calls).toBe(1);
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)).toHaveLength(timelineBeforeExpiry + 1);

    const repeated = await app.inject({
      method: "GET",
      url: "/api/cities/demo-city",
      headers: { "if-none-match": staleTag }
    });
    expect(repeated.statusCode).toBe(304);
    expect(repository.listTimeline(DEMO_SOURCE_ID, 100)).toHaveLength(timelineBeforeExpiry + 1);
    expect(client.calls).toBe(1);

    await app.inject({ method: "POST", url: "/api/demo/reset" });
    const recovered = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    expect(recovered.json<CityPayload>().data.source.status).toBe("HEALTHY");
    expect(client.calls).toBe(2);
  });

  it("keeps real startup credit-safe by default and reports readiness separately", async () => {
    const client = new UnexpectedCallClient();
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: realConfig(),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(health.statusCode).toBe(200);
    expect(readiness.statusCode).toBe(503);
    expect(readiness.json<ReadinessPayload>().data).toMatchObject({
      status: "not_ready",
      checks: {
        database: "usable",
        source: "initialized",
        trustedSnapshot: "unavailable"
      },
      sourceState: "UNINITIALIZED"
    });
    expect(client.calls).toBe(0);
  });

  it("serves liveness during a pending real startup check", async () => {
    const client = new ControlledPa211Client();
    repository = new CoolPathRepository(":memory:");
    const activeRepository = repository;
    app = await buildApp({
      config: realConfig({ AUTO_START_REAL_CHECK: true }),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });
    await waitForCondition(() => client.calls === 1, "Background collector call did not start");

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const pendingReadiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(health.statusCode).toBe(200);
    expect(pendingReadiness.statusCode).toBe(503);
    expect(activeRepository.getSource(PRIMARY_SOURCE_ID)?.currentState).toBe("CHECKING");

    client.resolveFirst();
    await waitForCondition(
      () => activeRepository.getPublishedSnapshot(PRIMARY_SOURCE_ID) !== null,
      "Background collector result was not published"
    );
    const ready = await app.inject({ method: "GET", url: "/readyz" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json<ReadinessPayload>().data.checks.trustedSnapshot).toBe("available");
  });

  it("catches background failure and permits a later recovery check", async () => {
    const client = new RejectOncePa211Client();
    repository = new CoolPathRepository(":memory:");
    const activeRepository = repository;
    const operatorToken = "operator-token-with-at-least-32-characters";
    app = await buildApp({
      config: realConfig({ AUTO_START_REAL_CHECK: true, OPERATOR_API_TOKEN: operatorToken }),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });
    await waitForCondition(
      () => activeRepository.getLatestRun(PRIMARY_SOURCE_ID) !== null,
      "Failed background run was not recorded"
    );

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const unavailable = await app.inject({ method: "GET", url: "/readyz" });
    expect(health.statusCode).toBe(200);
    expect(unavailable.statusCode).toBe(503);
    expect(activeRepository.getSource(PRIMARY_SOURCE_ID)?.currentState).toBe("BROKEN");
    expect(activeRepository.getLatestRun(PRIMARY_SOURCE_ID)?.outcome).toBe("inconclusive");

    const recovered = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`,
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    expect(recovered.statusCode).toBe(200);
    expect(client.calls).toBe(2);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(200);
  });

  it("returns 409 for concurrent source operations without leaking lock state", async () => {
    const client = new ControlledPa211Client();
    repository = new CoolPathRepository(":memory:");
    const operatorToken = "operator-token-with-at-least-32-characters";
    app = await buildApp({
      config: realConfig({ OPERATOR_API_TOKEN: operatorToken }),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });

    const unauthorizedBefore = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`
    });
    expect(unauthorizedBefore.statusCode).toBe(401);
    expect(client.calls).toBe(0);

    const first = app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`,
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    await waitForCondition(() => client.calls === 1, "First collector call did not start");

    const unauthorizedDuring = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`
    });
    expect(unauthorizedDuring.statusCode).toBe(401);
    expect(client.calls).toBe(1);

    const conflict = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`,
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      error: {
        code: "CONFLICT",
        message: "Another operation is already active for this source."
      }
    });
    expect(conflict.body).not.toContain("activeSources");
    expect(client.calls).toBe(1);

    client.resolveFirst();
    expect((await first).statusCode).toBe(200);
    const later = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`,
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    expect(later.statusCode).toBe(200);
    expect(client.calls).toBe(2);
  });

  it("normalizes PA 211 data only after an authenticated check", async () => {
    const client = new ImmediatePa211Client();
    repository = new CoolPathRepository(":memory:");
    const operatorToken = "operator-token-with-at-least-32-characters";
    app = await buildApp({
      config: realConfig({ OPERATOR_API_TOKEN: operatorToken }),
      repository,
      scraperClient: client,
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });

    expect(client.calls).toBe(0);
    expect((await app.inject({ method: "POST", url: "/api/demo/reset" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(503);

    const unauthorized = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body).not.toContain(operatorToken);
    expect(client.calls).toBe(0);

    const authorized = await app.inject({
      method: "POST",
      url: `/api/operator/sources/${PRIMARY_SOURCE_ID}/check`,
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toMatchObject({
      data: {
        disposition: "publishable",
        recordCount: 1,
        coverage: {
          providerRecordsReceived: 1,
          normalizedRecordsAccepted: 1,
          recordsFilteredNotLocations: 0,
          exactDuplicatesRemoved: 0,
          recordsRejectedByValidation: 0,
          recordsQuarantined: 0
        }
      }
    });
    expect(client.calls).toBe(1);

    const philadelphia = await app.inject({ method: "GET", url: "/api/cities/philadelphia" });
    expect(philadelphia.statusCode).toBe(200);
    expect(philadelphia.json<CityPayload>().data.snapshot?.sites).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/readyz" })).statusCode).toBe(200);
  });

  it("reports an unusable database without failing process liveness", async () => {
    repository = new CoolPathRepository(":memory:");
    const activeRepository = repository;
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });
    activeRepository.close();

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const readiness = await app.inject({ method: "GET", url: "/readyz" });
    expect(health.statusCode).toBe(200);
    expect(readiness.statusCode).toBe(503);
    expect(readiness.json<ReadinessPayload>().data).toEqual({
      status: "not_ready",
      checks: {
        database: "unavailable",
        source: "unavailable",
        trustedSnapshot: "unavailable"
      },
      sourceState: null,
      mode: "mock"
    });
  });

  it("returns sanitized client errors and never exposes configured secrets", async () => {
    repository = new CoolPathRepository(":memory:");
    const secret = "must-never-appear-in-responses";
    app = await buildApp({
      config: getConfig({
        NODE_ENV: "test",
        DATABASE_URL: ":memory:",
        COOLPATH_MODE: "mock",
        BRIGHT_DATA_API_TOKEN: secret
      }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/demo/heal/decision",
      headers: { "content-type": "application/json" },
      payload: "not-json"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: "INVALID_REQUEST", message: "The request is invalid." }
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).not.toContain(secret);
    expect(response.body).not.toContain("Unexpected token");
  });

  it("does not close an externally injected repository", async () => {
    const countingRepository = new CountingRepository(":memory:");
    repository = countingRepository;
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient(),
      now: () => new Date("2026-08-17T12:00:00.000Z")
    });

    await app.close();
    app = undefined;
    expect(countingRepository.closeCalls).toBe(0);
    expect(countingRepository.checkHealth()).toBe(true);

    countingRepository.close();
    repository = undefined;
    expect(countingRepository.closeCalls).toBe(1);
  });
});
