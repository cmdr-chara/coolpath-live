import type {
  ApiCityIdentity,
  ApiCityResponse,
  ApiCitySummary,
  ApiIncidentReadModel,
  ApiLatestRun,
  ApiPublishedSnapshot,
  ApiRunValidationSummary,
  ApiSourceReadModel,
  ApiTimelineEvent,
  HealState as DomainHealState,
  SourceCoverageMetrics,
  SourceMode as DomainSourceMode
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

export type SourceMode = DomainSourceMode;
export type CityIdentity = ApiCityIdentity;
export type TimelineEvent = ApiTimelineEvent;
export type CitySummary = ApiCitySummary;
export type SourceReadModel = ApiSourceReadModel;
export type PublishedSnapshot = ApiPublishedSnapshot;
export type SourceCoverage = SourceCoverageMetrics;
export type RunValidationSummary = ApiRunValidationSummary;
export type LatestRun = ApiLatestRun;
export type CityResponse = ApiCityResponse;
export type HealState = DomainHealState;
export type Incident = ApiIncidentReadModel;

export interface ApiEnvelope<T> {
  data: T;
  meta: { generatedAt: string };
}
