import { createHash } from "node:crypto";
import { coolingSiteSchema, type CoolingSite } from "@coolpath/domain";
import { z } from "zod";
import { PA211_SOURCE } from "./pa211-source.js";
import type { NormalizationResult } from "./types.js";

export const PA211_CANONICAL_URL = PA211_SOURCE.canonicalUrl;

const pa211CollectorRowSchema = z.object({
  facility_name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(500),
  service_text: z.string().trim().min(1).max(1_000),
  evidence_url: z.string().trim().min(1).max(1_000)
});

export interface Pa211NormalizationResult extends NormalizationResult {
  records: CoolingSite[];
}

function stableIdentity(name: string, address: string): string {
  const readable = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const suffix = createHash("sha256").update(`${name}\n${address}`).digest("hex").slice(0, 10);
  return `pa211:${readable}:${suffix}`;
}

function normalize(
  records: unknown[],
  observedAt: string,
  rejectInvalidRows: boolean
): Pa211NormalizationResult {
  const seenIdentities = new Set<string>();
  const normalized: CoolingSite[] = [];
  let recordsFilteredNotLocations = 0;
  let exactDuplicatesRemoved = 0;
  let recordsRejectedBySourceValidation = 0;

  for (const record of records) {
    const parsed = pa211CollectorRowSchema.safeParse(record);
    if (!parsed.success) {
      if (rejectInvalidRows) throw parsed.error;
      recordsRejectedBySourceValidation += 1;
      continue;
    }
    const row = parsed.data;
    if (!/cooling center/i.test(row.service_text)) {
      recordsFilteredNotLocations += 1;
      continue;
    }

    let evidenceUrl: URL;
    try {
      evidenceUrl = new URL(row.evidence_url, PA211_SOURCE.canonicalUrl);
      const originAllowed = PA211_SOURCE.allowedOrigins.some(
        (allowedOrigin) => allowedOrigin === evidenceUrl.origin
      );
      if (evidenceUrl.protocol !== "https:" || !originAllowed) {
        throw new Error("PA 211 evidence URL is outside the approved HTTPS origin");
      }
    } catch (error) {
      if (rejectInvalidRows) throw error;
      recordsRejectedBySourceValidation += 1;
      continue;
    }

    const id = stableIdentity(row.facility_name, row.address);
    if (seenIdentities.has(id)) {
      exactDuplicatesRemoved += 1;
      continue;
    }

    const site = coolingSiteSchema.safeParse({
      id,
      cityId: PA211_SOURCE.city.id,
      sourceKey: PA211_SOURCE.sourceId,
      name: row.facility_name,
      addressText: row.address,
      evidenceUrl: evidenceUrl.href,
      temporalClaim: { kind: "source_text", text: row.service_text },
      explicitClaims: [],
      observedAt
    });
    if (!site.success) {
      if (rejectInvalidRows) throw site.error;
      recordsRejectedBySourceValidation += 1;
      continue;
    }

    seenIdentities.add(id);
    normalized.push(site.data);
  }

  return {
    records: normalized,
    coverage: {
      providerRecordsReceived: records.length,
      normalizedRecordsAccepted: normalized.length,
      recordsFilteredNotLocations,
      exactDuplicatesRemoved,
      recordsRejectedBySourceValidation
    }
  };
}

export function normalizePa211Rows(
  records: unknown[],
  observedAt = new Date().toISOString()
): CoolingSite[] {
  return normalize(records, observedAt, true).records;
}

export function normalizePa211RowsWithMetrics(
  records: unknown[],
  observedAt = new Date().toISOString()
): Pa211NormalizationResult {
  return normalize(records, observedAt, false);
}
