import type { ReasonCode } from "@coolpath/domain";

const fieldByReason: Partial<Record<ReasonCode, string>> = {
  MISSING_NAME: "name",
  MISSING_ADDRESS: "addressText",
  MISSING_EVIDENCE_URL: "evidenceUrl",
  HTML_CONTAMINATION: "normalized text fields",
  OPTIONAL_FIELD_LOSS: "temporalClaim and explicitClaims",
  MAJOR_YIELD_DROP: "record list selector"
};

export function buildFieldSpecificHealPrompt(reasonCodes: ReasonCode[]): string {
  const fields = [...new Set(reasonCodes.flatMap((reason) => fieldByReason[reason] ?? []))];
  const target =
    fields.length > 0 ? fields.join(", ") : "the fields that violate the output contract";
  return [
    `Repair ${target} after a municipal page layout change.`,
    "Keep the existing Collector ID and schema identity.",
    "Preserve stable facility identities and extract only text visibly present on the official page.",
    "Do not infer hours, accessibility, amenities, availability, or medical suitability.",
    "Return a preview for manual review before applying any change."
  ].join(" ");
}
