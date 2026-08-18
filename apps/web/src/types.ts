import type {
  CoolingSite,
  QualityDisposition,
  ReasonCode,
  SnapshotStatus,
  SourceState
} from "@coolpath/domain";

export type {
  CoolingSite,
  ExplicitClaim,
  QualityDisposition,
  ReasonCode,
  SnapshotStatus,
  SourceState,
  TemporalClaim
} from "@coolpath/domain";

export interface TimelineEvent {
  id: string;
  occurredAt: string;
  kind: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
}

export interface CitySummary {
  id: string;
  slug: string;
  displayName: string;
  region: string;
  timezone: string;
  sourceStatus: SourceState;
  lastVerified: string | null;
  lastVerifiedLocal: string | null;
  siteCount: number;
  mode: "real" | "mock";
}

export interface CityResponse {
  city: {
    id: string;
    slug: string;
    displayName: string;
    region: string;
    timezone: string;
  };
  source: {
    id: string;
    agencyName: string;
    canonicalUrl: string;
    collectorId: string;
    freshnessTtlMinutes: number;
    policyVersion: string;
    status: SourceState;
    mode: "real" | "mock";
  };
  snapshot: {
    id: string;
    sourceId: string;
    runId: string;
    observedAt: string;
    observedAtLocal?: string;
    sourceReportedUpdatedAt: string | null;
    contentHash: string;
    status: SnapshotStatus;
    promotedAt: string | null;
    sites: CoolingSite[];
  } | null;
  latestRun: {
    id: string;
    sourceId: string;
    startedAt: string;
    fetchedAt: string | null;
    completedAt: string | null;
    outcome: QualityDisposition;
    collectorId: string;
    collectorVersion: string;
    schemaVersion: string;
    recordCount: number;
    rawSha256: string;
    reasonCodes: ReasonCode[];
    validationSummary: {
      disposition: QualityDisposition;
      hardFailures: ReasonCode[];
      softAnomalies: ReasonCode[];
      recordCount: number;
      requiredFieldCompleteness: number;
      optionalClaimCoverage: number;
      contentHash: string;
      coverage?: {
        providerRecordsReceived: number;
        normalizedRecordsAccepted: number;
        recordsFilteredNotLocations: number;
        exactDuplicatesRemoved: number;
        recordsRejectedByValidation: number;
        recordsQuarantined: number;
      };
    };
  } | null;
  incident: Incident | null;
  timeline: TimelineEvent[];
}

export type HealState =
  | "not_requested"
  | "running"
  | "review_pending"
  | "approved"
  | "rejected"
  | "failed";

export interface Incident {
  id: string;
  sourceId: string;
  runId: string;
  severity: "warning" | "critical";
  reasonCodes: ReasonCode[];
  openedAt: string;
  healState: HealState;
  healJobId: string | null;
  healPrompt: string | null;
  healDiff: Array<{ field: string; before: string; after: string }>;
  resolvedByRunId: string | null;
  resolvedAt: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: { generatedAt: string };
}
