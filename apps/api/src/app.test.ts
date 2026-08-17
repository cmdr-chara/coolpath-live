import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { CoolPathRepository } from "@coolpath/db";
import {
  MockScraperStudioClient,
  type CollectorRunInput,
  type CollectorRunResult
} from "@coolpath/source-adapters";
import { DEMO_SOURCE_ID } from "@coolpath/test-fixtures";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { getConfig } from "./config.js";

interface CityPayload {
  data: {
    source: { status: string };
    snapshot: { sites: unknown[] };
    latestRun: { outcome: string };
  };
}

interface IncidentPayload {
  data: { healState: string; healDiff: unknown[] };
}

describe("public API and recovery demo", () => {
  let app: FastifyInstance | undefined;
  let repository: CoolPathRepository | undefined;

  afterEach(async () => {
    await app?.close();
    repository?.close();
  });

  it("exposes published snapshots only and protects them during drift", async () => {
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient()
    });

    const healthy = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    expect(healthy.statusCode).toBe(200);
    expect(healthy.headers.etag).toBeTruthy();
    expect(healthy.json<CityPayload>().data.snapshot.sites).toHaveLength(3);

    await app.inject({ method: "POST", url: "/api/demo/drift" });
    const degraded = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const degradedPayload = degraded.json<CityPayload>();
    expect(degradedPayload.data.source.status).toBe("DEGRADED");
    expect(degradedPayload.data.snapshot.sites).toHaveLength(3);
    expect(degradedPayload.data.latestRun.outcome).toBe("quarantined");
  });

  it("requires approval and a second validated run before recovery publication", async () => {
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", COOLPATH_MODE: "mock" }),
      repository,
      scraperClient: new MockScraperStudioClient()
    });
    await app.inject({ method: "POST", url: "/api/demo/drift" });
    await app.inject({ method: "POST", url: "/api/demo/heal" });
    const review = await app.inject({
      method: "GET",
      url: `/api/incidents/${DEMO_SOURCE_ID}/current`
    });
    const reviewPayload = review.json<IncidentPayload>();
    expect(reviewPayload.data.healState).toBe("review_pending");
    expect(reviewPayload.data.healDiff).toHaveLength(3);

    const decision = await app.inject({
      method: "POST",
      url: "/api/demo/heal/decision",
      payload: { approve: true }
    });
    expect(decision.statusCode).toBe(200);
    const recovered = await app.inject({ method: "GET", url: "/api/cities/demo-city" });
    const recoveredPayload = recovered.json<CityPayload>();
    expect(recoveredPayload.data.source.status).toBe("RECOVERED");
    expect(recoveredPayload.data.snapshot.sites).toHaveLength(3);
    expect(recoveredPayload.data.latestRun.outcome).toBe("publishable");
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
      scraperClient: new MockScraperStudioClient()
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
    expect(response.body).not.toContain(secret);
    expect(response.body).not.toContain("Unexpected token");
  });

  it("normalizes the real Pennsylvania 211 source and does not register demo routes", async () => {
    class Pa211RawClient extends MockScraperStudioClient {
      override runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
        const records = [
          {
            facility_name: "Broad Street Ministry - Cooling Center",
            address: "315 South Broad Street, Philadelphia, PA 19107",
            service_text: "Serves as a cooling center during extreme heat emergencies (code reds).",
            evidence_url: "/search/82ea1f2e-cea1-568f-a6ae-70a841dbcf13"
          }
        ];
        return Promise.resolve({
          collectorId: input.collectorId,
          collectorVersion: "1",
          schemaVersion: "1",
          fetchedAt: "2026-08-17T12:00:00.000Z",
          records,
          rawSha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"),
          mode: "real"
        });
      }
    }
    repository = new CoolPathRepository(":memory:");
    const operatorToken = "operator-token-with-at-least-32-characters";
    app = await buildApp({
      config: getConfig({
        NODE_ENV: "test",
        DATABASE_URL: ":memory:",
        COOLPATH_MODE: "real",
        BRIGHT_DATA_API_TOKEN: "test-token",
        PRIMARY_COLLECTOR_ID: "pa211-collector",
        OPERATOR_API_TOKEN: operatorToken
      }),
      repository,
      scraperClient: new Pa211RawClient()
    });

    const response = await app.inject({ method: "POST", url: "/api/demo/reset" });
    expect(response.statusCode).toBe(404);
    const philadelphia = await app.inject({ method: "GET", url: "/api/cities/philadelphia" });
    expect(philadelphia.statusCode).toBe(200);
    expect(philadelphia.json<CityPayload>().data.snapshot.sites).toHaveLength(1);

    const unauthorized = await app.inject({
      method: "POST",
      url: "/api/operator/sources/pa211-philadelphia-cooling/check"
    });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body).not.toContain(operatorToken);

    const authorized = await app.inject({
      method: "POST",
      url: "/api/operator/sources/pa211-philadelphia-cooling/check",
      headers: { authorization: `Bearer ${operatorToken}` }
    });
    expect(authorized.statusCode).toBe(200);
    expect(authorized.json()).toMatchObject({
      data: { disposition: "publishable", recordCount: 1 }
    });
  });

  it("starts in a truthful broken state when the initial real check is unavailable", async () => {
    class UnavailableClient extends MockScraperStudioClient {
      override runCollector(): Promise<CollectorRunResult> {
        return Promise.reject(new TypeError("fetch failed"));
      }
    }
    repository = new CoolPathRepository(":memory:");
    app = await buildApp({
      config: getConfig({
        NODE_ENV: "test",
        DATABASE_URL: ":memory:",
        COOLPATH_MODE: "real",
        BRIGHT_DATA_API_TOKEN: "test-token",
        PRIMARY_COLLECTOR_ID: "pa211-collector",
        OPERATOR_API_TOKEN: "operator-token-with-at-least-32-characters"
      }),
      repository,
      scraperClient: new UnavailableClient()
    });

    const health = await app.inject({ method: "GET", url: "/healthz" });
    const philadelphia = await app.inject({ method: "GET", url: "/api/cities/philadelphia" });
    expect(health.statusCode).toBe(200);
    expect(philadelphia.json<CityPayload>().data.source.status).toBe("BROKEN");
  });
});
