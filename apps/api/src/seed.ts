import type { CoolPathRepository } from "@coolpath/db";
import {
  DEMO_CITY_ID,
  DEMO_COLLECTOR_ID,
  DEMO_EVIDENCE_URL,
  DEMO_SOURCE_ID
} from "@coolpath/test-fixtures";

export const PRIMARY_CITY_ID = "philadelphia";
export const PRIMARY_SOURCE_ID = "pa211-philadelphia-cooling";
export const PRIMARY_CANONICAL_URL =
  "https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10";

export function seedSourceConfiguration(repository: CoolPathRepository): void {
  repository.upsertCity({
    id: DEMO_CITY_ID,
    slug: "demo-city",
    displayName: "Demo City",
    region: "Deterministic civic fixture",
    timezone: "Europe/Rome"
  });
  repository.upsertSource({
    id: DEMO_SOURCE_ID,
    cityId: DEMO_CITY_ID,
    agencyName: "Demo City Public Services (synthetic fixture)",
    canonicalUrl: DEMO_EVIDENCE_URL,
    allowedOrigins: [new URL(DEMO_EVIDENCE_URL).origin],
    collectorId: DEMO_COLLECTOR_ID,
    freshnessTtlMinutes: 10_080,
    policyVersion: "demo-v1",
    enabled: true,
    currentState: repository.getSource(DEMO_SOURCE_ID)?.currentState ?? "UNINITIALIZED",
    mode: "mock"
  });
}

export function seedPrimarySourceConfiguration(
  repository: CoolPathRepository,
  collectorId: string
): void {
  repository.upsertCity({
    id: PRIMARY_CITY_ID,
    slug: "philadelphia",
    displayName: "Philadelphia",
    region: "Pennsylvania",
    timezone: "America/New_York"
  });
  repository.upsertSource({
    id: PRIMARY_SOURCE_ID,
    cityId: PRIMARY_CITY_ID,
    agencyName: "Pennsylvania 211",
    canonicalUrl: PRIMARY_CANONICAL_URL,
    allowedOrigins: ["https://search.pa211.org"],
    collectorId,
    freshnessTtlMinutes: 720,
    policyVersion: "2026-08-17-pa211",
    enabled: true,
    currentState: repository.getSource(PRIMARY_SOURCE_ID)?.currentState ?? "UNINITIALIZED",
    mode: "real"
  });
}
