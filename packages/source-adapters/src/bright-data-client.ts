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
  id: z.string().min(1).optional(),
  job_id: z.string().min(1).optional(),
  status: z.string().optional(),
  response_id: z.string().min(1).optional(),
  version: z.union([z.string(), z.number()]).optional()
});

const healDiffEntrySchema = z.object({
  field: z.string().min(1),
  before: z.string(),
  after: z.string()
});

const healProgressSchema = jobEnvelopeSchema
  .extend({ diff: z.array(healDiffEntrySchema).optional() })
  .passthrough();

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
      throw new BrightDataProtocolError(
        "Bright Data dataset response was neither JSON nor JSON Lines"
      );
    }
  }
}

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new BrightDataTimeoutError("Bright Data operation was aborted");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
}

function normalizedStatus(status: string | undefined): string {
  return (status ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function isReviewStatus(status: string): boolean {
  return ["pending_answer", "review_pending", "awaiting_approval"].includes(status);
}

function isSuccessfulHealStatus(status: string): boolean {
  return ["done", "completed", "ready", "success", "succeeded"].includes(status);
}

function isFailedHealStatus(status: string): boolean {
  return ["failed", "error", "cancelled", "canceled", "rejected"].includes(status);
}

function isRetryableReadStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function collectorStatusFor(status: string): CollectorStatus["status"] {
  if (isReviewStatus(status)) return "review_pending";
  if (status.includes("heal") || status.includes("refactor")) return "healing";
  if (
    status.includes("run") ||
    status.includes("queue") ||
    status.includes("process") ||
    status.includes("build")
  ) {
    return "running";
  }
  if (isFailedHealStatus(status)) return "failed";
  return "ready";
}

export interface BrightDataClientOptions {
  apiToken: string;
  apiBaseUrl?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
  fetchImplementation?: typeof fetch;
  now?: () => Date;
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

export class BrightDataTimeoutError extends Error {
  constructor(message = "Timed out waiting for Bright Data") {
    super(message);
    this.name = "AbortError";
  }
}

export class BrightDataProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrightDataProtocolError";
  }
}

export class BrightDataScraperStudioClient implements ScraperStudioClient {
  private readonly apiBaseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly request: typeof fetch;
  private readonly now: () => Date;
  private readonly activeControllers = new Set<AbortController>();

  constructor(private readonly options: BrightDataClientOptions) {
    if (!options.apiToken.trim()) throw new Error("BRIGHT_DATA_API_TOKEN is required in real mode");
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.brightdata.com";
    if (new URL(this.apiBaseUrl).protocol !== "https:") {
      throw new Error("Bright Data API base URL must use HTTPS");
    }
    this.pollIntervalMs = options.pollIntervalMs ?? 2_000;
    this.pollTimeoutMs = options.pollTimeoutMs ?? 120_000;
    this.request = options.fetchImplementation ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    return this.withOperationTimeout(async (signal) => {
      const triggerUrl = new URL("/dca/trigger", this.apiBaseUrl);
      triggerUrl.searchParams.set("collector", input.collectorId);
      triggerUrl.searchParams.set("queue_next", "1");
      const response = await this.call(
        triggerUrl,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify([{ url: input.canonicalUrl }])
        },
        signal
      );
      const triggerBody: unknown = await response.json();
      throwIfAborted(signal);
      const { collection_id: collectionId } = collectionEnvelopeSchema.parse(triggerBody);
      const dataset = await this.pollCollection(collectionId, signal);
      return {
        collectorId: input.collectorId,
        collectorVersion: response.headers.get("x-collector-version") ?? "unknown",
        schemaVersion: "1",
        fetchedAt: this.now().toISOString(),
        records: dataset.records,
        rawSha256: createHash("sha256").update(dataset.rawBody).digest("hex"),
        mode: "real"
      };
    });
  }

  getCollectorStatus(collectorId: string): Promise<CollectorStatus> {
    return this.withOperationTimeout(async (signal) => {
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(collectorId)}`,
        {},
        signal
      );
      const payload: unknown = await response.json();
      throwIfAborted(signal);
      const parsed = jobEnvelopeSchema.passthrough().parse(payload);
      return {
        collectorId,
        status: collectorStatusFor(normalizedStatus(parsed.status)),
        version: parsed.version === undefined ? "unknown" : String(parsed.version)
      };
    });
  }

  requestHeal(input: HealRequest): Promise<HealResult> {
    return this.withOperationTimeout(async (signal) => {
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(input.collectorId)}/refactor_template`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: input.prompt,
            custom_input: [{ url: input.canonicalUrl }]
          })
        },
        signal
      );
      const startedBody: unknown = await response.json();
      throwIfAborted(signal);
      const started = jobEnvelopeSchema.parse(startedBody);
      const jobId = started.job_id ?? started.id ?? started.response_id;
      if (!jobId) {
        throw new BrightDataProtocolError("Bright Data healing did not return a job identity");
      }

      const preview = await this.pollHealReview(input.collectorId, signal);
      return {
        collectorId: input.collectorId,
        jobId,
        status: "review_pending",
        diff: this.extractDiff(preview),
        mode: "real"
      };
    });
  }

  decideHeal(input: HealDecision): Promise<CollectorStatus> {
    return this.withOperationTimeout(async (signal) => {
      if (!input.jobId.trim()) {
        throw new BrightDataProtocolError("A healing decision requires the reviewed job identity");
      }
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(input.collectorId)}/resume_automation_job`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: input.approve, auto_save: input.approve })
        },
        signal
      );
      await response.text();
      throwIfAborted(signal);

      if (!input.approve) {
        return {
          collectorId: input.collectorId,
          status: "failed",
          version: "unknown",
          diff: []
        };
      }

      const completion = await this.pollHealCompletion(input.collectorId, signal);
      const completionStatus = normalizedStatus(completion.status);
      if (isReviewStatus(completionStatus)) {
        return {
          collectorId: input.collectorId,
          status: "review_pending",
          version: completion.version === undefined ? "unknown" : String(completion.version),
          diff: this.extractDiff(completion)
        };
      }
      return {
        collectorId: input.collectorId,
        status: "ready",
        version: completion.version === undefined ? "unknown" : String(completion.version),
        diff: []
      };
    });
  }

  close(): void {
    const reason = new BrightDataTimeoutError("Bright Data operation stopped during shutdown");
    for (const controller of this.activeControllers) controller.abort(reason);
  }

  private async call(
    path: string | URL,
    init: RequestInit,
    signal: AbortSignal
  ): Promise<Response> {
    const url = typeof path === "string" ? new URL(path, this.apiBaseUrl) : path;
    const method = (init.method ?? "GET").toUpperCase();
    const maxAttempts = method === "GET" ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      throwIfAborted(signal);
      const response = await this.request(url, {
        ...init,
        redirect: "error",
        signal,
        headers: {
          authorization: `Bearer ${this.options.apiToken}`,
          accept: "application/json",
          ...init.headers
        }
      });
      throwIfAborted(signal);
      if (response.ok) return response;

      if (method === "GET" && attempt < maxAttempts && isRetryableReadStatus(response.status)) {
        await response.text();
        throwIfAborted(signal);
        await this.sleep(signal, Math.min(this.pollIntervalMs * 2 ** (attempt - 1), 5_000));
        continue;
      }
      throw new BrightDataHttpError(response.status, response.statusText);
    }

    throw new BrightDataProtocolError("Bright Data request exhausted its retry policy");
  }

  private async pollHealReview(
    collectorId: string,
    signal: AbortSignal
  ): Promise<z.infer<typeof healProgressSchema>> {
    while (true) {
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`,
        {},
        signal
      );
      if (response.status === 202) {
        await response.text();
        throwIfAborted(signal);
        await this.sleep(signal);
        continue;
      }
      const payload: unknown = await response.json();
      throwIfAborted(signal);
      const parsed = healProgressSchema.parse(payload);
      const status = normalizedStatus(parsed.status);
      if (isReviewStatus(status)) return parsed;
      if (isSuccessfulHealStatus(status)) {
        throw new BrightDataProtocolError(
          "Bright Data self-healing completed without the required human review gate"
        );
      }
      if (isFailedHealStatus(status)) {
        throw new BrightDataProtocolError(`Bright Data self-healing failed with status ${status}`);
      }
      await this.sleep(signal);
    }
  }

  private async pollHealCompletion(
    collectorId: string,
    signal: AbortSignal
  ): Promise<z.infer<typeof healProgressSchema>> {
    while (true) {
      const response = await this.call(
        `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`,
        {},
        signal
      );
      if (response.status === 202) {
        await response.text();
        throwIfAborted(signal);
        await this.sleep(signal);
        continue;
      }
      const payload: unknown = await response.json();
      throwIfAborted(signal);
      const parsed = healProgressSchema.parse(payload);
      const status = normalizedStatus(parsed.status);
      if (isReviewStatus(status) || isSuccessfulHealStatus(status)) return parsed;
      if (isFailedHealStatus(status)) {
        throw new BrightDataProtocolError(`Bright Data self-healing failed with status ${status}`);
      }
      await this.sleep(signal);
    }
  }

  private async pollCollection(
    collectionId: string,
    signal: AbortSignal
  ): Promise<{ records: unknown[]; rawBody: string }> {
    while (true) {
      const datasetUrl = new URL("/dca/dataset", this.apiBaseUrl);
      datasetUrl.searchParams.set("id", collectionId);
      const response = await this.call(datasetUrl, {}, signal);
      const body = await response.text();
      throwIfAborted(signal);
      if (response.status === 202 || body.trim() === "") {
        await this.sleep(signal);
        continue;
      }
      const records = parseDatasetRecords(body);
      if (response.status === 200 && records) return { records, rawBody: body };
      await this.sleep(signal);
    }
  }

  private sleep(signal: AbortSignal, delayMs = this.pollIntervalMs): Promise<void> {
    return new Promise((resolve, reject) => {
      throwIfAborted(signal);
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
      const onAbort = () => {
        clearTimeout(timer);
        reject(abortReason(signal));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  private withOperationTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    this.activeControllers.add(controller);
    const timeout = setTimeout(() => {
      controller.abort(new BrightDataTimeoutError());
    }, this.pollTimeoutMs);
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener("abort", () => reject(abortReason(controller.signal)), {
        once: true
      });
    });

    return Promise.race([operation(controller.signal), aborted]).finally(() => {
      clearTimeout(timeout);
      this.activeControllers.delete(controller);
    });
  }

  private extractDiff(payload: unknown): HealResult["diff"] {
    const parsed = healProgressSchema.parse(payload);
    return parsed.diff ? parsed.diff.map((entry) => ({ ...entry })) : [];
  }
}
