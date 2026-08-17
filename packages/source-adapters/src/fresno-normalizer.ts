import { createHash } from "node:crypto";
import { coolingSiteSchema, type CoolingSite } from "@coolpath/domain";
import { z } from "zod";

const fresnoCollectorRowSchema = z.object({
  facility_name: z.string().trim().min(1).max(240),
  address: z.string().trim().min(1).max(500),
  status_text: z.string().trim().min(1).max(500).optional(),
  hours_text: z.string().trim().min(1).max(500).optional(),
  activation_text: z.string().trim().min(1).max(500).optional(),
  evidence_url: z.url(),
  observed_at: z.iso.datetime({ offset: true })
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
  return `fresno:${readable}:${suffix}`;
}

export function normalizeFresnoRows(records: unknown[]): CoolingSite[] {
  return records.map((record) => {
    const row = fresnoCollectorRowSchema.parse(record);
    const url = new URL(row.evidence_url);
    if (
      url.protocol !== "https:" ||
      !["www.fresno.gov", "appdev.fresno.gov"].includes(url.hostname)
    ) {
      throw new Error("Fresno evidence URL is outside the approved HTTPS origins");
    }
    const temporalText = [row.status_text, row.hours_text, row.activation_text]
      .filter((value): value is string => Boolean(value))
      .join(" ");
    return coolingSiteSchema.parse({
      id: stableIdentity(row.facility_name, row.address),
      cityId: "fresno",
      sourceKey: "fresno-cooling",
      name: row.facility_name,
      addressText: row.address,
      evidenceUrl: row.evidence_url,
      temporalClaim: temporalText
        ? { kind: "source_text", text: temporalText }
        : { kind: "not_provided" },
      explicitClaims: [],
      observedAt: row.observed_at
    });
  });
}
