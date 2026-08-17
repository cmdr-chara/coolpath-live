import { describe, expect, it } from "vitest";
import {
  classifyTransportFailure,
  coolingSiteSchema,
  evaluateCandidate,
  formatInstantInTimeZone,
  isWithinTtl,
  stableContentHash,
  transitionSourceState,
  type CoolingSite
} from "./index.js";

const observedAt = "2026-08-17T12:00:00.000Z";
const baseSite: CoolingSite = {
  id: "rome:library-1",
  cityId: "rome",
  sourceKey: "rome-cooling",
  name: "Central Library",
  addressText: "1 Civic Square, Rome",
  evidenceUrl: "https://example.gov/cooling",
  temporalClaim: { kind: "source_text", text: "Open weekdays 09:00-18:00" },
  explicitClaims: [],
  observedAt
};

describe("canonical data contract", () => {
  it("accepts explicit source text without guessing structured hours", () => {
    expect(coolingSiteSchema.parse(baseSite).temporalClaim.kind).toBe("source_text");
  });

  it("rejects a reversed activation range", () => {
    const result = coolingSiteSchema.safeParse({
      ...baseSite,
      temporalClaim: {
        kind: "activation_range",
        startsOn: "2026-09-01",
        endsOn: "2026-08-01",
        evidenceText: "August 1 through September 1"
      }
    });
    expect(result.success).toBe(false);
  });
});

describe("quality gate", () => {
  const candidate = {
    collectorId: "c_demo",
    collectorVersion: "1",
    schemaVersion: "1"
  };

  it("quarantines zero rows", () => {
    const result = evaluateCandidate({
      records: [],
      allowedOrigins: ["https://example.gov"],
      candidate
    });
    expect(result.disposition).toBe("quarantined");
    expect(result.hardFailures).toContain("ZERO_ROWS");
  });

  it("detects duplicate stable identities and hostile HTML", () => {
    const hostile = { ...baseSite, name: "<script>alert(1)</script>Central Library" };
    const result = evaluateCandidate({
      records: [hostile, hostile],
      allowedOrigins: ["https://example.gov"],
      candidate
    });
    expect(result.hardFailures).toEqual(
      expect.arrayContaining(["DUPLICATE_IDENTITY", "HTML_CONTAMINATION"])
    );
  });

  it("rejects off-origin evidence URLs", () => {
    const result = evaluateCandidate({
      records: [{ ...baseSite, evidenceUrl: "https://attacker.example/evidence" }],
      allowedOrigins: ["https://example.gov"],
      candidate
    });
    expect(result.hardFailures).toContain("OFF_ORIGIN_URL");
  });

  it("requires review for a major yield drop while preserving the baseline", () => {
    const baselineSites = Array.from({ length: 5 }, (_, index) => ({
      ...baseSite,
      id: `rome:site-${index}`
    }));
    const result = evaluateCandidate({
      records: baselineSites.slice(0, 2),
      allowedOrigins: ["https://example.gov"],
      candidate,
      baseline: {
        ...candidate,
        sites: baselineSites,
        contentHash: stableContentHash(baselineSites)
      }
    });
    expect(result.disposition).toBe("review_required");
    expect(result.softAnomalies).toContain("MAJOR_YIELD_DROP");
  });

  it.each([
    [{ kind: "http", status: 403 } as const, "TRANSPORT_FORBIDDEN"],
    [{ kind: "http", status: 429 } as const, "TRANSPORT_RATE_LIMITED"],
    [{ kind: "timeout" } as const, "TRANSPORT_TIMEOUT"],
    [{ kind: "dns" } as const, "TRANSPORT_DNS_FAILURE"]
  ])("classifies %o as inconclusive transport evidence", (failure, expected) => {
    expect(classifyTransportFailure(failure)).toBe(expected);
  });
});

describe("state and freshness", () => {
  it("keeps a trusted snapshot visible in degraded mode", () => {
    expect(
      transitionSourceState("CHECKING", {
        type: "RUN_FAILED",
        hasTrustedSnapshot: true,
        withinTtl: true,
        inconclusive: false
      })
    ).toBe("DEGRADED");
  });

  it("marks data stale exactly after the TTL boundary", () => {
    const now = new Date("2026-08-17T14:00:00.001Z");
    expect(isWithinTtl(observedAt, 120, now)).toBe(false);
    expect(
      transitionSourceState("DEGRADED", { type: "TTL_EXPIRED", hasTrustedSnapshot: true })
    ).toBe("STALE");
  });

  it("supports the healing review and recovered path", () => {
    const healing = transitionSourceState("BROKEN", { type: "HEAL_REQUESTED" });
    const review = transitionSourceState(healing, { type: "HEAL_PREVIEW_READY" });
    const recovered = transitionSourceState(review, { type: "RUN_PASSED", recovered: true });
    expect([healing, review, recovered]).toEqual(["HEALING", "REVIEW_PENDING", "RECOVERED"]);
  });
});

describe("city-local timestamps", () => {
  it("represents the spring DST jump without inventing a local 02:00 hour", () => {
    expect(formatInstantInTimeZone("2026-03-29T00:30:00.000Z", "Europe/Rome")).toMatchObject({
      localIso: "2026-03-29T01:30:00+01:00",
      utcOffset: "+01:00"
    });
    expect(formatInstantInTimeZone("2026-03-29T01:30:00.000Z", "Europe/Rome")).toMatchObject({
      localIso: "2026-03-29T03:30:00+02:00",
      utcOffset: "+02:00"
    });
  });

  it("disambiguates repeated autumn local time with its UTC offset", () => {
    expect(formatInstantInTimeZone("2026-10-25T00:30:00.000Z", "Europe/Rome").localIso).toBe(
      "2026-10-25T02:30:00+02:00"
    );
    expect(formatInstantInTimeZone("2026-10-25T01:30:00.000Z", "Europe/Rome").localIso).toBe(
      "2026-10-25T02:30:00+01:00"
    );
  });

  it("rejects invalid instants and timezone identifiers", () => {
    expect(() => formatInstantInTimeZone("not-a-date", "Europe/Rome")).toThrow("Invalid timestamp");
    expect(() => formatInstantInTimeZone(observedAt, "Mars/Olympus_Mons")).toThrow(RangeError);
  });
});
