import { describe, expect, it } from "vitest";
import { normalizePa211Rows } from "./pa211-normalizer.js";

describe("Pennsylvania 211 source normalizer", () => {
  it("resolves detail links and preserves the published service statement", () => {
    const [site] = normalizePa211Rows(
      [
        {
          facility_name: "Broad Street Ministry - Cooling Center",
          address: "315 South Broad Street, Philadelphia, PA 19107",
          service_text: "Serves as a cooling center during extreme heat emergencies (code reds).",
          evidence_url: "/search/82ea1f2e-cea1-568f-a6ae-70a841dbcf13"
        }
      ],
      "2026-08-17T12:00:00.000Z"
    );

    expect(site).toMatchObject({
      cityId: "philadelphia",
      sourceKey: "pa211-philadelphia-cooling",
      evidenceUrl: "https://search.pa211.org/search/82ea1f2e-cea1-568f-a6ae-70a841dbcf13",
      observedAt: "2026-08-17T12:00:00.000Z",
      temporalClaim: {
        kind: "source_text",
        text: "Serves as a cooling center during extreme heat emergencies (code reds)."
      }
    });
  });

  it("drops non-location results and rejects off-origin evidence", () => {
    expect(
      normalizePa211Rows([
        {
          facility_name: "Project HOME - Homeless Outreach Hotline",
          address: "1515 Fairmount Avenue, Philadelphia, PA 19130",
          service_text: "Provides a 24/7 general crisis hotline.",
          evidence_url: "/search/example"
        }
      ])
    ).toEqual([]);

    expect(() =>
      normalizePa211Rows([
        {
          facility_name: "Copied listing",
          address: "315 South Broad Street, Philadelphia, PA 19107",
          service_text: "Serves as a cooling center.",
          evidence_url: "https://example.com/copied"
        }
      ])
    ).toThrow(/approved HTTPS origin/);
  });

  it("deduplicates identical source identities", () => {
    const record = {
      facility_name: "Philadelphia Recreation Centers - Cooling Center",
      address: "2101 Cecil B. Moore Avenue, Philadelphia, PA 19121",
      service_text: "Serves as a cooling center during extreme heat emergencies (code reds).",
      evidence_url: "/search/first"
    };

    expect(
      normalizePa211Rows([record, { ...record, evidence_url: "/search/duplicate" }])
    ).toHaveLength(1);
  });
});
