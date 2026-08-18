import { afterEach, describe, expect, it, vi } from "vitest";
import { BrightDataScraperStudioClient } from "./bright-data-client.js";

interface CapturedRequest {
  url: URL;
  init: RequestInit;
}

function sequencedFetch(responses: Response[], captured: CapturedRequest[]): typeof fetch {
  return (input: string | URL | Request, init?: RequestInit) => {
    captured.push({
      url: new URL(input instanceof Request ? input.url : input.toString()),
      init: init ?? {}
    });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected fetch call");
    return Promise.resolve(response);
  };
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") throw new Error("Expected a JSON string request body");
  return JSON.parse(body) as unknown;
}

function stalledResponse(): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start: () => undefined
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

afterEach(() => vi.useRealTimers());

describe("Bright Data Scraper Studio client", () => {
  it("refuses to send credentials over a non-HTTPS base URL", () => {
    expect(
      () =>
        new BrightDataScraperStudioClient({
          apiToken: "test-token",
          apiBaseUrl: "http://api.brightdata.test"
        })
    ).toThrow("must use HTTPS");
  });

  it("triggers a batch collection and waits through intermediate responses", async () => {
    const captured: CapturedRequest[] = [];
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollIntervalMs: 1,
      pollTimeoutMs: 1_000,
      fetchImplementation: sequencedFetch(
        [
          new Response(JSON.stringify({ collection_id: "collection-1" }), {
            status: 200,
            headers: { "x-collector-version": "7" }
          }),
          new Response(null, { status: 202 }),
          new Response("", { status: 200 }),
          new Response(JSON.stringify({ status: "building" }), { status: 200 }),
          new Response(JSON.stringify([{ name: "Cooling Center" }]), { status: 200 })
        ],
        captured
      )
    });

    const result = await client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    expect(result.records).toEqual([{ name: "Cooling Center" }]);
    expect(result.collectorVersion).toBe("7");
    expect(captured).toHaveLength(5);
    expect(captured[0]?.url.pathname).toBe("/dca/trigger");
    expect(captured[0]?.url.searchParams.get("collector")).toBe("collector-1");
    expect(captured[0]?.url.searchParams.get("queue_next")).toBe("1");
    expect(parseJsonBody(captured[0]?.init.body)).toEqual([
      { url: "https://city.example/cooling" }
    ]);
    expect(captured[1]?.url.toString()).toBe(
      "https://api.brightdata.com/dca/dataset?id=collection-1"
    );
    expect(captured.every((request) => request.init.redirect === "error")).toBe(true);
  });

  it("accepts JSON Lines dataset responses", async () => {
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollIntervalMs: 1,
      pollTimeoutMs: 1_000,
      fetchImplementation: sequencedFetch(
        [
          new Response(JSON.stringify({ collection_id: "collection-jsonl" }), { status: 200 }),
          new Response('{"facility_name":"Center A"}\n{"facility_name":"Center B"}\n', {
            status: 200,
            headers: { "content-type": "application/x-ndjson" }
          })
        ],
        []
      )
    });

    const result = await client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    expect(result.records).toEqual([{ facility_name: "Center A" }, { facility_name: "Center B" }]);
  });

  it("preserves HTTP status without leaking the API token in the error", async () => {
    const captured: CapturedRequest[] = [];
    const client = new BrightDataScraperStudioClient({
      apiToken: "super-secret-token",
      fetchImplementation: sequencedFetch(
        [new Response(null, { status: 403, statusText: "Forbidden" })],
        captured
      )
    });

    const operation = client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    await expect(operation).rejects.toMatchObject({
      name: "BrightDataHttpError",
      status: 403
    });
    await expect(operation).rejects.not.toThrow(/super-secret-token/);
  });

  it("uses field-specific healing endpoints and an explicit approval decision", async () => {
    const captured: CapturedRequest[] = [];
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollIntervalMs: 1,
      pollTimeoutMs: 1_000,
      fetchImplementation: sequencedFetch(
        [
          new Response(JSON.stringify({ job_id: "heal-1" }), { status: 200 }),
          new Response(null, { status: 202 }),
          new Response(
            JSON.stringify({
              status: "pending_answer",
              diff: [{ field: "name", before: ".old", after: ".new" }]
            }),
            { status: 200 }
          ),
          new Response(null, { status: 200 })
        ],
        captured
      )
    });

    const result = await client.requestHeal({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling",
      prompt: "Repair only the name field."
    });
    await client.decideHeal({
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling",
      jobId: result.jobId,
      approve: true
    });

    expect(result.diff).toEqual([{ field: "name", before: ".old", after: ".new" }]);
    expect(captured[0]?.url.pathname).toBe("/dca/collectors/collector-1/refactor_template");
    expect(parseJsonBody(captured[0]?.init.body)).toEqual({
      prompt: "Repair only the name field.",
      custom_input: [{ url: "https://city.example/cooling" }]
    });
    expect(captured[3]?.url.pathname).toBe("/dca/collectors/collector-1/resume_automation_job");
    expect(parseJsonBody(captured[3]?.init.body)).toEqual({
      message: true,
      auto_save: true
    });
  });

  it("times out while the trigger response body is stalled", async () => {
    vi.useFakeTimers();
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollTimeoutMs: 20,
      fetchImplementation: sequencedFetch([stalledResponse()], [])
    });
    const operation = client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(operation).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out while the dataset response body is stalled", async () => {
    vi.useFakeTimers();
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollTimeoutMs: 20,
      fetchImplementation: sequencedFetch(
        [
          new Response(JSON.stringify({ collection_id: "collection-stalled" }), { status: 200 }),
          stalledResponse()
        ],
        []
      )
    });
    const operation = client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(operation).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("times out while the healing decision response body is stalled", async () => {
    vi.useFakeTimers();
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollTimeoutMs: 20,
      fetchImplementation: sequencedFetch([stalledResponse()], [])
    });
    const operation = client.decideHeal({
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling",
      jobId: "heal-1",
      approve: true
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(operation).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts an active provider operation during shutdown", async () => {
    vi.useFakeTimers();
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollTimeoutMs: 1_000,
      fetchImplementation: sequencedFetch([stalledResponse()], [])
    });
    const operation = client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });
    await vi.advanceTimersByTimeAsync(0);

    client.close();

    await expect(operation).rejects.toMatchObject({
      name: "AbortError",
      message: "Bright Data operation stopped during shutdown"
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the operation timer after a successful collection", async () => {
    vi.useFakeTimers();
    const client = new BrightDataScraperStudioClient({
      apiToken: "test-token",
      pollTimeoutMs: 1_000,
      fetchImplementation: sequencedFetch(
        [
          new Response(JSON.stringify({ collection_id: "collection-complete" }), { status: 200 }),
          new Response(JSON.stringify([{ name: "Cooling Center" }]), { status: 200 })
        ],
        []
      )
    });

    await client.runCollector({
      sourceId: "source-1",
      collectorId: "collector-1",
      canonicalUrl: "https://city.example/cooling"
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});
