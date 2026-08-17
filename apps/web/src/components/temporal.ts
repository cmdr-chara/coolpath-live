import type { CoolingSite } from "../types";

export function formatTemporalClaim(claim: CoolingSite["temporalClaim"]): string {
  switch (claim.kind) {
    case "weekly_windows":
      return claim.evidenceText;
    case "activation_range":
      return claim.evidenceText;
    case "source_text":
      return claim.text;
    case "not_provided":
      return "Not stated by the source";
  }
}

export function formatTemporalClaimLabel(claim: CoolingSite["temporalClaim"]): string {
  switch (claim.kind) {
    case "weekly_windows":
      return "Source-published hours";
    case "activation_range":
      return "Source-published period";
    case "source_text":
      return "Source-published statement";
    case "not_provided":
      return "Source-published timing";
  }
}
