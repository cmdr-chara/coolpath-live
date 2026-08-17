import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  CollectorRunInput,
  CollectorRunResult,
  CollectorStatus,
  HealDecision,
  HealRequest,
  HealResult,
  ScraperStudioClient
} from "./types.js";

const jobEnvelopeSchema = z.object({
  id: z.string().optional(),
  job_id: z.string().optional(),
  status: z.string().optional(),
  response_id: z.string().optional()
});

const collectionEnvelopeSchema = z.object({ collection_id: z.string().min(1) });

function parseDatasetRecords(body: string): unknown[] | undefined {
  try {
    const payload: unknown = JSON.parse(body);
    return Array.isArray(payload) ? payload : undefined;
  } catch {
    const lines = body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return undefined;
    try {
      return lines.map((line) => JSON.parse(line) as unknown);
    } catch {
      throw new Error("Bright Data dataset response was neither JSON nor JSON Lines");
    }
  }
}

export interface BrightDataClientOptions {
  apiToken: string;
  apiBaseUrl?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fetchImplementation?: typeof fetch;
}

export class BrightDataHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string
  ) {
    super(`Bright Data request failed with status ${status}`);
    this.name = "BrightDataHttpError";
  }
}

export class BrightDataScraperStudioClient implements ScraperStudioClient {
  private readonly apiBaseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly request: typeof fetch;

  constructor(private readonly options: BrightDataClientOptions) {
    if (!options.apiToken.trim()) throw new Error("BRIGHT_DATA_API_TOKEN is required in real mode");
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.brightdata.com";
    if (new URL(this.apiBaseUrl).protocol !== "https:") {
      throw new Error("Bright Data API base URL must use HTTPS");
    }
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 120_000;
    this.request = options.fetchImplementation ?? fetch;
  }

  async runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    const triggerUrl = new URL("/dca/trigger", this.apiBaseUrl);
    triggerUrl.searchParams.set("collector", input.collectorId);
    triggerUrl.searchParams.set("queue_next", "1");
    const response = await this.call(triggerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ url: input.canonicalUrl }])
    });
    const { collection_id: collectionId } = collectionEnvelopeSchema.parse(await response.json());
    const records = await this.pollCollection(collectionId);
    const raw = JSON.stringify(records);
    return {
      collectorId: input.collectorId,
      collectorVersion: response.headers.get("x-collector-version") ?? "unknown",
      schemaVersion: "1",
      fetchedAt: new Date().toISOString(),
      records,
      rawSha256: createHash("sha256").update(raw).digest("hex"),
      mode: "real"
    };
  }

  async getCollectorStatus(collectorId: string): Promise<CollectorStatus> {
    const response = await this.call(`/dca/collectors/${encodeURIComponent(collectorId)}`);
    const payload = jobEnvelopeSchema.passthrough().parse(await response.json());
    const rawStatus = payload.status ?? "ready";
    const status: CollectorStatus["status"] = rawStatus.includes("fail") ? "failed" : "ready";
    return { collectorId, status, version: "unknown" };
  }

  async requestHeal(input: HealRequest): Promise<HealResult> {
    const response = await this.call(
      `/dca/collectors/${encodeURIComponent(input.collectorId)}/refactor_template`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: input.prompt, custom_input: [{ url: input.canonicalUrl }] })
      }
    );
    const started = jobEnvelopeSchema.parse(await response.json());
    const jobId =
      started.job_id ?? started.id ?? started.response_id ?? `heal:${input.collectorId}`;

    const preview = await this.pollHealProgress(input.collectorId);
    return {
      collectorId: input.collectorId,
      jobId,
      status: "review_pending",
      diff: this.extractDiff(preview),
      mode: "real"
    };
  }

  async decideHeal(input: HealDecision): Promise<CollectorStatus> {
    await this.call(
      `/dca/collectors/${encodeURIComponent(input.collectorId)}/resume_automation_job`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input.approve, auto_save: input.approve })
      }
    );
    return {
      collectorId: input.collectorId,
      status: input.approve ? "ready" : "failed",
      version: "unknown"
    };
  }

  private async call(path: string | URL, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.pollTimeoutMs);
    try {
      const response = await this.request(
        typeof path === "string" ? new URL(path, this.apiBaseUrl) : path,
        {
          ...init,
          redirect: "error",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${this.options.apiToken}`,
            accept: "application/json",
            ...init.headers
          }
        }
      );
      if (!response.ok) {
        throw new BrightDataHttpError(response.status, response.statusText);
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async pollHealProgress(collectorId: string): Promise<unknown> {
    const deadline = Date.now() + this.pollTimeoutMs;
    while (Date.now() < deadline) {
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`
      );
      if (response.status === 202) {
        await response.text();
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        continue;
      }
      const payload: unknown = await response.json();
      const status = jobEnvelopeSchema.passthrough().parse(payload).status;
      if (status === "pending_answer" || status === "review_pending" || status === "done")
        return payload;
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new Error("Timed out waiting for Bright Data self-healing preview");
  }

  private async pollCollection(collectionId: string): Promise<unknown[]> {
    const deadline = Date.now() + this.pollTimeoutMs;
    while (Date.now() < deadline) {
      const datasetUrl = new URL("/dca/dataset", this.apiBaseUrl);
      datasetUrl.searchParams.set("id", collectionId);
      const response = await this.call(datasetUrl);
      const body = await response.text();
      if (response.status === 202 || body.trim() === "") {
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
        continue;
      }
      const records = parseDatasetRecords(body);
      if (response.status === 200 && records) {
        return records;
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new Error("Timed out waiting for Bright Data collection data");
  }

  private extractDiff(payload: unknown): HealResult["diff"] {
    if (typeof payload !== "object" || payload === null) return [];
    const candidate = (payload as Record<string, unknown>).diff;
    if (!Array.isArray(candidate)) return [];
    return candidate.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const value = entry as Record<string, unknown>;
      return typeof value.field === "string" &&
        typeof value.before === "string" &&
        typeof value.after === "string"
        ? [{ field: value.field, before: value.before, after: value.after }]
        : [];
    });
  }
}
