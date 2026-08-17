export interface CollectorRunInput {
  collectorId: string;
  sourceId: string;
  canonicalUrl: string;
}

export interface CollectorRunResult {
  collectorId: string;
  collectorVersion: string;
  schemaVersion: string;
  fetchedAt: string;
  records: unknown[];
  rawSha256: string;
  mode: "real" | "mock";
}

export interface CollectorStatus {
  collectorId: string;
  status: "ready" | "running" | "healing" | "review_pending" | "failed";
  version: string;
}

export interface HealRequest {
  collectorId: string;
  sourceId: string;
  canonicalUrl: string;
  prompt: string;
}

export interface HealDiff {
  field: string;
  before: string;
  after: string;
}

export interface HealResult {
  collectorId: string;
  jobId: string;
  status: "review_pending";
  diff: HealDiff[];
  mode: "real" | "mock";
}

export interface HealDecision {
  collectorId: string;
  jobId: string;
  approve: boolean;
  canonicalUrl: string;
}

export interface ScraperStudioClient {
  runCollector(input: CollectorRunInput): Promise<CollectorRunResult>;
  getCollectorStatus(collectorId: string): Promise<CollectorStatus>;
  requestHeal(input: HealRequest): Promise<HealResult>;
  decideHeal(input: HealDecision): Promise<CollectorStatus>;
}
