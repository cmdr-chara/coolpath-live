import { z } from "zod";
import {
  qualityDispositionSchema,
  reasonCodeSchema,
  sourceCoverageMetricsSchema
} from "./quality.js";
import { coolingSiteSchema, snapshotStatusSchema } from "./schemas.js";
import { sourceStateSchema } from "./state-machine.js";

const isoDateTime = z.iso.datetime({ offset: true });

export const sourceModeSchema = z.enum(["real", "mock"]);

export const apiCityIdentitySchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName: z.string().min(1),
  region: z.string().min(1),
  timezone: z.string().min(1)
});

export const apiTimelineEventSchema = z.object({
  id: z.string().min(1),
  occurredAt: isoDateTime,
  kind: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1),
  tone: z.enum(["neutral", "positive", "warning", "critical"])
});

export const apiCitySummarySchema = apiCityIdentitySchema.extend({
  sourceStatus: sourceStateSchema,
  lastVerified: isoDateTime.nullable(),
  lastVerifiedLocal: z.string().nullable(),
  siteCount: z.number().int().nonnegative(),
  mode: sourceModeSchema
});

export const apiSourceReadModelSchema = z.object({
  id: z.string().min(1),
  agencyName: z.string().min(1),
  canonicalUrl: z.url(),
  collectorId: z.string().min(1),
  freshnessTtlMinutes: z.number().int().positive(),
  policyVersion: z.string().min(1),
  status: sourceStateSchema,
  mode: sourceModeSchema
});

export const apiPublishedSnapshotSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  runId: z.string().min(1),
  observedAt: isoDateTime,
  observedAtLocal: z.string().optional(),
  sourceReportedUpdatedAt: isoDateTime.nullable(),
  contentHash: z.string(),
  status: snapshotStatusSchema,
  promotedAt: isoDateTime.nullable(),
  sites: z.array(coolingSiteSchema)
});

export const apiRunValidationSummarySchema = z.object({
  disposition: qualityDispositionSchema,
  hardFailures: z.array(reasonCodeSchema),
  softAnomalies: z.array(reasonCodeSchema),
  recordCount: z.number().int().nonnegative(),
  requiredFieldCompleteness: z.number().min(0).max(1),
  optionalClaimCoverage: z.number().min(0).max(1),
  contentHash: z.string(),
  coverage: sourceCoverageMetricsSchema.optional()
});

export const apiLatestRunSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  startedAt: isoDateTime,
  fetchedAt: isoDateTime.nullable(),
  completedAt: isoDateTime.nullable(),
  outcome: qualityDispositionSchema,
  collectorId: z.string().min(1),
  collectorVersion: z.string().min(1),
  schemaVersion: z.string().min(1),
  recordCount: z.number().int().nonnegative(),
  rawSha256: z.string(),
  reasonCodes: z.array(reasonCodeSchema),
  validationSummary: apiRunValidationSummarySchema
});

export const healStateSchema = z.enum([
  "not_requested",
  "running",
  "review_pending",
  "approved",
  "rejected",
  "failed"
]);

export const healDiffEntrySchema = z.object({
  field: z.string(),
  before: z.string(),
  after: z.string()
});

export const apiIncidentReadModelSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  runId: z.string().min(1),
  severity: z.enum(["warning", "critical"]),
  reasonCodes: z.array(reasonCodeSchema),
  openedAt: isoDateTime,
  healState: healStateSchema,
  healJobId: z.string().nullable(),
  healPrompt: z.string().nullable(),
  healDiff: z.array(healDiffEntrySchema),
  resolvedByRunId: z.string().nullable(),
  resolvedAt: isoDateTime.nullable()
});

export const apiCityResponseSchema = z.object({
  city: apiCityIdentitySchema,
  source: apiSourceReadModelSchema,
  snapshot: apiPublishedSnapshotSchema.nullable(),
  latestRun: apiLatestRunSchema.nullable(),
  incident: apiIncidentReadModelSchema.nullable(),
  timeline: z.array(apiTimelineEventSchema)
});

export function apiEnvelopeSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z.object({ generatedAt: isoDateTime })
  });
}

export const apiCitySummaryListEnvelopeSchema = apiEnvelopeSchema(z.array(apiCitySummarySchema));
export const apiCityResponseEnvelopeSchema = apiEnvelopeSchema(apiCityResponseSchema);
export const apiIncidentEnvelopeSchema = apiEnvelopeSchema(apiIncidentReadModelSchema.nullable());
export const apiUnknownEnvelopeSchema = apiEnvelopeSchema(z.unknown());

export type SourceMode = z.infer<typeof sourceModeSchema>;
export type ApiCityIdentity = z.infer<typeof apiCityIdentitySchema>;
export type ApiTimelineEvent = z.infer<typeof apiTimelineEventSchema>;
export type ApiCitySummary = z.infer<typeof apiCitySummarySchema>;
export type ApiSourceReadModel = z.infer<typeof apiSourceReadModelSchema>;
export type ApiPublishedSnapshot = z.infer<typeof apiPublishedSnapshotSchema>;
export type ApiRunValidationSummary = z.infer<typeof apiRunValidationSummarySchema>;
export type ApiLatestRun = z.infer<typeof apiLatestRunSchema>;
export type HealState = z.infer<typeof healStateSchema>;
export type HealDiffEntry = z.infer<typeof healDiffEntrySchema>;
export type ApiIncidentReadModel = z.infer<typeof apiIncidentReadModelSchema>;
export type ApiCityResponse = z.infer<typeof apiCityResponseSchema>;
