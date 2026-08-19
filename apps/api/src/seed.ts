import type { CoolPathRepository } from "@coolpath/db";
import { PA211_SOURCE } from "@coolpath/source-adapters";
import {
  DEMO_CITY_ID,
  DEMO_COLLECTOR_ID,
  DEMO_EVIDENCE_URL,
  DEMO_SOURCE_ID
} from "@coolpath/test-fixtures";

export const PRIMARY_CITY_ID = PA211_SOURCE.city.id;
export const PRIMARY_SOURCE_ID = PA211_SOURCE.sourceId;
export const PRIMARY_CANONICAL_URL = PA211_SOURCE.canonicalUrl;

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
  repository.upsertCity({ ...PA211_SOURCE.city });
  repository.upsertSource({
    id: PA211_SOURCE.sourceId,
    cityId: PA211_SOURCE.city.id,
    agencyName: PA211_SOURCE.agencyName,
    canonicalUrl: PA211_SOURCE.canonicalUrl,
    allowedOrigins: [...PA211_SOURCE.allowedOrigins],
    collectorId,
    freshnessTtlMinutes: PA211_SOURCE.freshnessTtlMinutes,
    policyVersion: PA211_SOURCE.policyVersion,
    enabled: true,
    currentState:
      repository.getSource(PA211_SOURCE.sourceId)?.currentState ?? "UNINITIALIZED",
    mode: "real"
  });
}
