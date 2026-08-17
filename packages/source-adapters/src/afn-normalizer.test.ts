import { describe, expect, it } from "vitest";
import { AFN_CANONICAL_URL, normalizeAfnRows } from "./afn-normalizer.js";

describe("Arizona Faith Network source normalizer", () => {
  it("preserves published schedules and exceptions as source text", () => {
    const [site] = normalizeAfnRows(
      [
        {
          facility_name: "Glendale Mission and Ministry Center",
          address: "6242 N 59th Ave, Glendale, AZ 85301",
          season_text: "Open May 1-September 30",
          hours_text: "12-8pm Mon-Sat",
          exceptions_text: "Closed: May 25, June 1-6, June 22-27, September 7"
        }
      ],
      "2026-08-17T12:00:00.000Z"
    );

    expect(site).toMatchObject({
      cityId: "phoenix-metro",
      sourceKey: "afn-heat-relief",
      evidenceUrl: AFN_CANONICAL_URL,
      observedAt: "2026-08-17T12:00:00.000Z",
      temporalClaim: {
        kind: "source_text",
        text: "Open May 1-September 30 12-8pm Mon-Sat Closed: May 25, June 1-6, June 22-27, September 7"
      }
    });
    expect(site?.explicitClaims).toEqual([]);
  });

  it("uses a server observation time instead of trusting collector timestamps", () => {
    const [site] = normalizeAfnRows(
      [
        {
          facility_name: "First Church UCC",
          address: "1407 N 2nd St, Phoenix, AZ 85004",
          hours_text: "9am-5pm Mon & Wed"
        }
      ],
      "2026-08-17T13:00:00.000Z"
    );

    expect(site?.observedAt).toBe("2026-08-17T13:00:00.000Z");
    expect(site?.temporalClaim).toEqual({ kind: "source_text", text: "9am-5pm Mon & Wed" });
  });

  it("rejects records without a physical address", () => {
    expect(() =>
      normalizeAfnRows([
        {
          facility_name: "Heat resource map",
          address: "",
          hours_text: "Not a physical center"
        }
      ])
    ).toThrow();
  });
});
