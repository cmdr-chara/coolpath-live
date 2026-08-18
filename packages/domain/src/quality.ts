import { createHash } from "node:crypto";
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

export type ReasonCode = (typeof reasonCodes)[number];
export type QualityDisposition = "publishable" | "review_required" | "quarantined" | "inconclusive";

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

export interface QualityInput {
  records: unknown[];
  allowedOrigins: string[];
  candidate: CandidateMetadata;
  baseline?: BaselineMetadata;
  coverage?: CandidateCoverageInput;
}

export interface ValidationSummary {
  disposition: QualityDisposition;
  hardFailures: ReasonCode[];
  softAnomalies: ReasonCode[];
  recordCount: number;
  requiredFieldCompleteness: number;
  optionalClaimCoverage: number;
  contentHash: string;
  coverage?: SourceCoverageMetrics;
  sites: CoolingSite[];
}

export interface EvaluatedValidationSummary extends ValidationSummary {
  coverage: SourceCoverageMetrics;
}

const htmlPattern = /<\/?(?:script|style|iframe|object|embed|[a-z][a-z0-9-]*)(?:\s[^>]*)?>/i;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizedCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function coverageFor(input: QualityInput): CandidateCoverageInput {
  if (input.coverage) {
    return {
      providerRecordsReceived: normalizedCount(input.coverage.providerRecordsReceived),
      normalizedRecordsAccepted: normalizedCount(input.coverage.normalizedRecordsAccepted),
      recordsFilteredNotLocations: normalizedCount(input.coverage.recordsFilteredNotLocations),
      exactDuplicatesRemoved: normalizedCount(input.coverage.exactDuplicatesRemoved),
      recordsRejectedBySourceValidation: normalizedCount(
        input.coverage.recordsRejectedBySourceValidation
      )
    };
  }
  return {
    providerRecordsReceived: input.records.length,
    normalizedRecordsAccepted: input.records.length,
    recordsFilteredNotLocations: 0,
    exactDuplicatesRemoved: 0,
    recordsRejectedBySourceValidation: 0
  };
}

export function stableContentHash(sites: CoolingSite[]): string {
  const stable = sites
    .map((site) => ({
      id: site.id,
      name: site.name,
      addressText: site.addressText,
      evidenceUrl: site.evidenceUrl,
      temporalClaim: site.temporalClaim,
      explicitClaims: site.explicitClaims
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function hasHtmlContamination(site: CoolingSite): boolean {
  const values = [
    site.name,
    site.addressText,
    ...site.explicitClaims.flatMap((claim) => [claim.label, claim.evidenceText])
  ];
  if (site.temporalClaim.kind === "source_text") values.push(site.temporalClaim.text);
  if ("evidenceText" in site.temporalClaim) values.push(site.temporalClaim.evidenceText);
  return values.some((value) => htmlPattern.test(value));
}

function optionalCoverage(sites: CoolingSite[]): number {
  if (sites.length === 0) return 0;
  const withOptional = sites.filter(
    (site) => site.explicitClaims.length > 0 || site.temporalClaim.kind !== "not_provided"
  ).length;
  return withOptional / sites.length;
}

export function evaluateCandidate(input: QualityInput): EvaluatedValidationSummary {
  const hardFailures: ReasonCode[] = [];
  const softAnomalies: ReasonCode[] = [];
  const sites: CoolingSite[] = [];

  if (input.records.length === 0) hardFailures.push("ZERO_ROWS");

  for (const record of input.records) {
    const parsed = coolingSiteSchema.safeParse(record);
    if (!parsed.success) {
      hardFailures.push("INVALID_SCHEMA");
      const paths = parsed.error.issues.map((issue) => issue.path.join("."));
      if (paths.includes("name")) hardFailures.push("MISSING_NAME");
      if (paths.includes("addressText")) hardFailures.push("MISSING_ADDRESS");
      if (paths.includes("evidenceUrl")) hardFailures.push("MISSING_EVIDENCE_URL");
      if (parsed.error.issues.some((issue) => issue.message.includes("HTTPS"))) {
        hardFailures.push("NON_HTTPS_URL");
      }
      if (parsed.error.issues.some((issue) => issue.message.includes("Activation start"))) {
        hardFailures.push("INVALID_DATE_ORDER");
      }
      continue;
    }

    const site = parsed.data;
    const origin = new URL(site.evidenceUrl).origin;
    if (!input.allowedOrigins.includes(origin)) hardFailures.push("OFF_ORIGIN_URL");
    if (
      site.explicitClaims.some(
        (claim) => !input.allowedOrigins.includes(new URL(claim.sourceUrl).origin)
      )
    ) {
      hardFailures.push("OFF_ORIGIN_URL");
    }
    if (hasHtmlContamination(site)) hardFailures.push("HTML_CONTAMINATION");
    sites.push(site);
  }

  if (new Set(sites.map((site) => site.id)).size !== sites.length) {
    hardFailures.push("DUPLICATE_IDENTITY");
  }

  if (input.baseline) {
    if (input.candidate.collectorId !== input.baseline.collectorId) {
      hardFailures.push("COLLECTOR_IDENTITY_CHANGED");
    }
    if (input.candidate.schemaVersion !== input.baseline.schemaVersion) {
      hardFailures.push("SCHEMA_IDENTITY_CHANGED");
    }

    const baselineCount = input.baseline.sites.length;
    if (baselineCount > 0 && sites.length / baselineCount < 0.6) {
      softAnomalies.push("MAJOR_YIELD_DROP");
    }
    if (baselineCount > 0 && sites.length / baselineCount > 1.5) {
      softAnomalies.push("UNEXPECTED_EXTRA_RECORDS");
    }

    const baselineCoverage = optionalCoverage(input.baseline.sites);
    if (baselineCoverage - optionalCoverage(sites) >= 0.4) {
      softAnomalies.push("OPTIONAL_FIELD_LOSS");
    }

    const baselineIds = new Set(input.baseline.sites.map((site) => site.id));
    const retained = sites.filter((site) => baselineIds.has(site.id)).length;
    if (baselineCount > 0 && retained / baselineCount < 0.6) {
      softAnomalies.push("IDENTITY_REPLACEMENT");
    }
  }

  const contentHash = stableContentHash(sites);
  if (
    input.baseline &&
    input.baseline.sites.length === sites.length &&
    input.baseline.contentHash !== contentHash &&
    sites.every((site) => input.baseline?.sites.some((baselineSite) => baselineSite.id === site.id))
  ) {
    const changed = sites.filter((site) => {
      const previous = input.baseline?.sites.find((candidate) => candidate.id === site.id);
      return previous ? stableContentHash([previous]) !== stableContentHash([site]) : false;
    }).length;
    if (sites.length > 0 && changed / sites.length > 0.75) {
      softAnomalies.push("SUSPICIOUS_CONTENT_CHANGE");
    }
  }

  const hard = unique(hardFailures);
  const soft = unique(softAnomalies);
  const disposition: QualityDisposition =
    hard.length > 0 ? "quarantined" : soft.length > 0 ? "review_required" : "publishable";
  const sourceCoverage = coverageFor(input);
  const contractRejected = Math.max(0, input.records.length - sites.length);

  return {
    disposition,
    hardFailures: hard,
    softAnomalies: soft,
    recordCount: input.records.length,
    requiredFieldCompleteness:
      input.records.length === 0 ? 0 : Math.min(1, sites.length / input.records.length),
    optionalClaimCoverage: optionalCoverage(sites),
    contentHash,
    coverage: {
      providerRecordsReceived: sourceCoverage.providerRecordsReceived,
      normalizedRecordsAccepted: sourceCoverage.normalizedRecordsAccepted,
      recordsFilteredNotLocations: sourceCoverage.recordsFilteredNotLocations,
      exactDuplicatesRemoved: sourceCoverage.exactDuplicatesRemoved,
      recordsRejectedByValidation:
        sourceCoverage.recordsRejectedBySourceValidation + contractRejected,
      recordsQuarantined: disposition === "publishable" ? 0 : sites.length
    },
    sites
  };
}

export type TransportFailure =
  | { kind: "http"; status: number }
  | { kind: "timeout" }
  | { kind: "dns" }
  | { kind: "provider_temporary" };

export function classifyTransportFailure(failure: TransportFailure): ReasonCode {
  if (failure.kind === "timeout") return "TRANSPORT_TIMEOUT";
  if (failure.kind === "dns") return "TRANSPORT_DNS_FAILURE";
  if (failure.kind === "provider_temporary") return "PROVIDER_TEMPORARY_FAILURE";
  if (failure.status === 403) return "TRANSPORT_FORBIDDEN";
  if (failure.status === 429) return "TRANSPORT_RATE_LIMITED";
  return "PROVIDER_TEMPORARY_FAILURE";
}
