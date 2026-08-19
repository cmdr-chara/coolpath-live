import { describe, expect, it } from "vitest";
import {
  apiCityResponseEnvelopeSchema,
  apiCitySummaryListEnvelopeSchema,
  reasonCodeSchema,
  sourceStateSchema
} from "./index.js";

const generatedAt = "2026-08-19T12:00:00.000Z";

const city = {
  id: "philadelphia",
  slug: "philadelphia",
  displayName: "Philadelphia",
  region: "Pennsylvania",
  timezone: "America/New_York"
};

describe("shared API contracts", () => {
  it("accepts the public city summary envelope", () => {
    const result = apiCitySummaryListEnvelopeSchema.parse({
      data: [
        {
          ...city,
          sourceStatus: "HEALTHY",
          lastVerified: generatedAt,
          lastVerifiedLocal: "Aug 19, 2026, 8:00 AM",
          siteCount: 12,
          mode: "real"
        }
      ],
      meta: { generatedAt }
    });

    expect(result.data[0]?.sourceStatus).toBe("HEALTHY");
  });

  it("accepts a minimal city detail read model", () => {
    const result = apiCityResponseEnvelopeSchema.parse({
      data: {
        city,
        source: {
          id: "pa211-philadelphia-cooling",
          agencyName: "Pennsylvania 211",
          canonicalUrl: "https://search.pa211.org/search",
          collectorId: "collector-1",
          freshnessTtlMinutes: 720,
          policyVersion: "2026-08-17-pa211",
          status: "UNINITIALIZED",
          mode: "real"
        },
        snapshot: null,
        latestRun: null,
        incident: null,
        timeline: []
      },
      meta: { generatedAt }
    });

    expect(result.data.city.slug).toBe("philadelphia");
  });

  it("rejects stringly-typed states and reason codes outside the domain vocabulary", () => {
    expect(() => sourceStateSchema.parse("healthy")).toThrow();
    expect(() => reasonCodeSchema.parse("UNKNOWN_FAILURE")).toThrow();
  });
});
