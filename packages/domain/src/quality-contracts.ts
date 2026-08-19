import { z } from "zod";
import { coolingSiteSchema, type CoolingSite } from "./schemas.js";

export const reasonCodes = [
  "ZERO_ROWS",
  "INVALID_SCHEMA",
  "MISSING_NAME",
  "MISSING_ADDRESS",
  "MISSING_EVIDENCE_URL",
  "NON_HTTPS_URL",
  "OFF_ORIGIN_URL",
  "DUPLICATE_IDENTITY",
  "INVALID_DATE_ORDER",
  "COLLECTOR_IDENTITY_CHANGED",
  "SCHEMA_IDENTITY_CHANGED",
  "HTML_CONTAMINATION",
  "MAJOR_YIELD_DROP",
  "OPTIONAL_FIELD_LOSS",
  "SUSPICIOUS_CONTENT_CHANGE",
  "IDENTITY_REPLACEMENT",
  "UNEXPECTED_EXTRA_RECORDS",
  "TRANSPORT_FORBIDDEN",
  "TRANSPORT_RATE_LIMITED",
  "TRANSPORT_TIMEOUT",
  "TRANSPORT_DNS_FAILURE",
  "PROVIDER_TEMPORARY_FAILURE"
] as const;

export const reasonCodeSchema = z.enum(reasonCodes);
export const qualityDispositionSchema = z.enum([
  "publishable",
  "review_required",
  "quarantined",
  "inconclusive"
]);

export type ReasonCode = (typeof reasonCodes)[number];
export type QualityDisposition = z.infer<typeof qualityDispositionSchema>;

export interface CandidateMetadata {
  collectorId: string;
  collectorVersion: string;
  schemaVersion: string;
}

export interface BaselineMetadata extends CandidateMetadata {
  sites: CoolingSite[];
  contentHash: string;
}

export interface CandidateCoverageInput {
  providerRecordsReceived: number;
  normalizedRecordsAccepted: number;
  recordsFilteredNotLocations: number;
  exactDuplicatesRemoved: number;
  recordsRejectedBySourceValidation: number;
}

export interface SourceCoverageMetrics {
  providerRecordsReceived: number;
  normalizedRecordsAccepted: number;
  recordsFilteredNotLocations: number;
  exactDuplicatesRemoved: number;
  recordsRejectedByValidation: number;
  recordsQuarantined: number;
}

export const sourceCoverageMetricsSchema = z.object({
  providerRecordsReceived: z.number().int().nonnegative(),
  normalizedRecordsAccepted: z.number().int().nonnegative(),
  recordsFilteredNotLocations: z.number().int().nonnegative(),
  exactDuplicatesRemoved: z.number().int().nonnegative(),
  recordsRejectedByValidation: z.number().int().nonnegative(),
  recordsQuarantined: z.number().int().nonnegative()
});

export interface ValidationSummary {
  disposition: QualityDisposition;
  hardFailures: ReasonCode[];
  softAnomalies: ReasonCode[];
  recordCount: number;
  requiredFieldCompleteness: number;
  optionalClaimCoverage: number;
  contentHash: string;
  coverage?: SourceCoverageMetrics | undefined;
  sites: CoolingSite[];
}

export interface EvaluatedValidationSummary extends ValidationSummary {
  coverage: SourceCoverageMetrics;
}

export const validationSummarySchema = z.object({
  disposition: qualityDispositionSchema,
  hardFailures: z.array(reasonCodeSchema),
  softAnomalies: z.array(reasonCodeSchema),
  recordCount: z.number().int().nonnegative(),
  requiredFieldCompleteness: z.number().min(0).max(1),
  optionalClaimCoverage: z.number().min(0).max(1),
  contentHash: z.string(),
  coverage: sourceCoverageMetricsSchema.optional(),
  sites: z.array(coolingSiteSchema)
});

export const storedValidationSummarySchema = validationSummarySchema.omit({ sites: true });
