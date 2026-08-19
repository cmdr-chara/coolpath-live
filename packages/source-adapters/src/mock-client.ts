import { createHash, randomUUID } from "node:crypto";
import {
  driftedCollectorResult,
  expectedHealDiff,
  healedCollectorResult,
  healthyCollectorResult
} from "@coolpath/test-fixtures";
import type {
  CollectorRunInput,
  CollectorRunResult,
  CollectorStatus,
  HealDecision,
  HealRequest,
  HealResult,
  ScraperStudioClient
} from "./types.js";

export type MockLayout = "v1" | "v2";

export class MockScraperStudioClient implements ScraperStudioClient {
  private layout: MockLayout = "v1";
  private approved = false;
  private pendingJobId: string | undefined;

  setLayout(layout: MockLayout): void {
    this.layout = layout;
    if (layout === "v1") this.approved = false;
  }

  reset(): void {
    this.layout = "v1";
    this.approved = false;
    this.pendingJobId = undefined;
  }

  async runCollector(input: CollectorRunInput): Promise<CollectorRunResult> {
    const records =
      this.layout === "v1"
        ? healthyCollectorResult
        : this.approved
          ? healedCollectorResult
          : driftedCollectorResult;
    const raw = JSON.stringify(records);
    return Promise.resolve({
      collectorId: input.collectorId,
      collectorVersion: this.approved ? "2" : "1",
      schemaVersion: "1",
      fetchedAt: new Date().toISOString(),
      records: structuredClone(records),
      rawSha256: createHash("sha256").update(raw).digest("hex"),
      mode: "mock"
    });
  }

  async getCollectorStatus(collectorId: string): Promise<CollectorStatus> {
    return Promise.resolve({
      collectorId,
      status: this.pendingJobId ? "review_pending" : "ready",
      version: this.approved ? "2" : "1"
    });
  }

  async requestHeal(input: HealRequest): Promise<HealResult> {
    this.pendingJobId = randomUUID();
    return Promise.resolve({
      collectorId: input.collectorId,
      jobId: this.pendingJobId,
      status: "review_pending",
      diff: expectedHealDiff.map((entry) => ({ ...entry })),
      mode: "mock"
    });
  }

  async decideHeal(input: HealDecision): Promise<CollectorStatus> {
    if (!this.pendingJobId || input.jobId !== this.pendingJobId) {
      throw new Error("No matching heal job is pending");
    }
    this.approved = input.approve;
    this.pendingJobId = undefined;
    return Promise.resolve({
      collectorId: input.collectorId,
      status: input.approve ? "ready" : "failed",
      version: input.approve ? "2" : "1",
      diff: []
    });
  }

  close(): void {
    this.reset();
  }
}
