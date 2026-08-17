import { createHash } from "node:crypto";
import { coolingSiteSchema, type CoolingSite } from "@coolpath/domain";
import { z } from "zod";

export const PA211_CANONICAL_URL =
  "https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10";

const pa211CollectorRowSchema = z.object({
  facility_name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(500),
  service_text: z.string().trim().min(1).max(1_000),
  evidence_url: z.string().trim().min(1).max(1_000)
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
  return `pa211:${readable}:${suffix}`;
}

export function normalizePa211Rows(
  records: unknown[],
  observedAt = new Date().toISOString()
): CoolingSite[] {
  const seenIdentities = new Set<string>();
  return records.flatMap((record) => {
    const row = pa211CollectorRowSchema.parse(record);
    if (!/cooling center/i.test(row.service_text)) {
      return [];
    }

    const evidenceUrl = new URL(row.evidence_url, PA211_CANONICAL_URL);
    if (evidenceUrl.protocol !== "https:" || evidenceUrl.hostname !== "search.pa211.org") {
      throw new Error("PA 211 evidence URL is outside the approved HTTPS origin");
    }

    const id = stableIdentity(row.facility_name, row.address);
    if (seenIdentities.has(id)) return [];
    seenIdentities.add(id);

    return [
      coolingSiteSchema.parse({
        id,
        cityId: "philadelphia",
        sourceKey: "pa211-philadelphia-cooling",
        name: row.facility_name,
        addressText: row.address,
        evidenceUrl: evidenceUrl.href,
        temporalClaim: { kind: "source_text", text: row.service_text },
        explicitClaims: [],
        observedAt
      })
    ];
  });
}
