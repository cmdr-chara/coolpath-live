export type SourceState =
  | "UNINITIALIZED"
  | "CHECKING"
  | "HEALTHY"
  | "DEGRADED"
  | "STALE"
  | "BROKEN"
  | "HEALING"
  | "REVIEW_PENDING"
  | "RECOVERED";

export interface ExplicitClaim {
  kind: "accessibility" | "amenity" | "other";
  label: string;
  evidenceText: string;
  sourceUrl: string;
  evidenceLocator?: string;
}

export type TemporalClaim =
  | {
      kind: "weekly_windows";
      timezone: string;
      windows: Array<{ day: string; opensAt: string; closesAt: string; sourceText: string }>;
      evidenceText: string;
    }
  | {
      kind: "activation_range";
      startsOn: string;
      endsOn: string;
      evidenceText: string;
    }
  | { kind: "source_text"; text: string }
  | { kind: "not_provided" };

export interface CoolingSite {
  id: string;
  cityId: string;
  sourceKey: string;
  name: string;
  addressText: string;
  evidenceUrl: string;
  temporalClaim: TemporalClaim;
  explicitClaims: ExplicitClaim[];
  observedAt: string;
}

export interface TimelineEvent {
  id: string;
  occurredAt: string;
  kind: string;
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning" | "critical";
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
    observedAt: string;
    contentHash: string;
    status: string;
    sites: CoolingSite[];
  } | null;
  latestRun: {
    id: string;
    startedAt: string;
    completedAt: string;
    outcome: string;
    collectorVersion: string;
    recordCount: number;
    reasonCodes: string[];
    validationSummary: {
      requiredFieldCompleteness: number;
      optionalClaimCoverage: number;
    };
  } | null;
  timeline: TimelineEvent[];
}

export interface Incident {
  id: string;
  severity: "warning" | "critical";
  reasonCodes: string[];
  openedAt: string;
  healState: string;
  healPrompt: string | null;
  healDiff: Array<{ field: string; before: string; after: string }>;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: { generatedAt: string };
}
