import { describe, expect, it } from "vitest";
import { normalizeFresnoRows } from "./fresno-normalizer.js";

describe("Fresno source normalizer", () => {
  it("preserves ambiguous operational text as source text", () => {
    const [site] = normalizeFresnoRows([
      {
        facility_name: "Ted C. Wills Community Center",
        address: "770 N. San Pablo, Fresno, CA 93728",
        status_text: "Check back after 12 p.m.",
        activation_text: "Centers open at 105°F from 12 p.m.-8 p.m.",
        evidence_url: "https://www.fresno.gov/citymanager/cooling-and-warming-centers/",
        observed_at: "2026-08-17T12:00:00.000Z"
      }
    ]);
    expect(site?.temporalClaim.kind).toBe("source_text");
    expect(site?.explicitClaims).toEqual([]);
  });

  it("rejects an off-origin evidence URL", () => {
    expect(() =>
      normalizeFresnoRows([
        {
          facility_name: "Ted C. Wills Community Center",
          address: "770 N. San Pablo, Fresno, CA 93728",
          evidence_url: "https://example.com/copied-data",
          observed_at: "2026-08-17T12:00:00.000Z"
        }
      ])
    ).toThrow(/approved HTTPS origins/);
  });
});
