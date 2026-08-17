import { createHash } from "node:crypto";
import { coolingSiteSchema, type CoolingSite } from "@coolpath/domain";
import { z } from "zod";

export const AFN_CANONICAL_URL = "https://www.arizonafaithnetwork.org/heatrelief";

const optionalSourceText = z
  .string()
  .trim()
  .max(1_000)
  .nullish()
  .transform((value) => value || undefined);

const afnCollectorRowSchema = z.object({
  facility_name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(500),
  hours_text: optionalSourceText,
  season_text: optionalSourceText,
  exceptions_text: optionalSourceText
});

function stableIdentity(name: string, address: string): string {
  const readable = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  const suffix = createHash("sha256").update(`${name}\n${address}`).digest("hex").slice(0, 10);
  return `afn:${readable}:${suffix}`;
}

export function normalizeAfnRows(
  records: unknown[],
  observedAt = new Date().toISOString()
): CoolingSite[] {
  return records.map((record) => {
    const row = afnCollectorRowSchema.parse(record);
    const temporalText = [row.season_text, row.hours_text, row.exceptions_text]
      .filter((value): value is string => Boolean(value))
      .join(" ");

    return coolingSiteSchema.parse({
      id: stableIdentity(row.facility_name, row.address),
      cityId: "phoenix-metro",
      sourceKey: "afn-heat-relief",
      name: row.facility_name,
      addressText: row.address,
      evidenceUrl: AFN_CANONICAL_URL,
      temporalClaim: temporalText
        ? { kind: "source_text", text: temporalText }
        : { kind: "not_provided" },
      explicitClaims: [],
      observedAt
    });
  });
}
