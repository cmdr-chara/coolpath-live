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

function abortReason(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new BrightDataTimeoutError("Bright Data operation was aborted");
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortReason(signal);
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
      const records = await this.pollCollection(collectionId, signal);
      const raw = JSON.stringify(records);
      return {
        collectorId: input.collectorId,
        collectorVersion: response.headers.get("x-collector-version") ?? "unknown",
        schemaVersion: "1",
        fetchedAt: this.now().toISOString(),
        records,
        rawSha256: createHash("sha256").update(raw).digest("hex"),
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
      const rawStatus = parsed.status ?? "ready";
      const status: CollectorStatus["status"] = rawStatus.includes("fail") ? "failed" : "ready";
      return { collectorId, status, version: "unknown" };
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
      const jobId =
        started.job_id ?? started.id ?? started.response_id ?? `heal:${input.collectorId}`;

      const preview = await this.pollHealProgress(input.collectorId, signal);
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
      return {
        collectorId: input.collectorId,
        status: input.approve ? "ready" : "failed",
        version: "unknown"
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
    throwIfAborted(signal);
    const response = await this.request(
      typeof path === "string" ? new URL(path, this.apiBaseUrl) : path,
      {
        ...init,
        redirect: "error",
        signal,
        headers: {
          authorization: `Bearer ${this.options.apiToken}`,
          accept: "application/json",
          ...init.headers
        }
      }
    );
    throwIfAborted(signal);
    if (!response.ok) {
      throw new BrightDataHttpError(response.status, response.statusText);
    }
    return response;
  }

  private async pollHealProgress(collectorId: string, signal: AbortSignal): Promise<unknown> {
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
      const status = jobEnvelopeSchema.passthrough().parse(payload).status;
      if (status === "pending_answer" || status === "review_pending" || status === "done") {
        return payload;
      }
      await this.sleep(signal);
    }
  }

  private async pollCollection(collectionId: string, signal: AbortSignal): Promise<unknown[]> {
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
      if (response.status === 200 && records) return records;
      await this.sleep(signal);
    }
  }

  private sleep(signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      throwIfAborted(signal);
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, this.pollIntervalMs);
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
