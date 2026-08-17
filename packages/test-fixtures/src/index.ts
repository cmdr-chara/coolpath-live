import type { CoolingSite } from "@coolpath/domain";

export const DEMO_COLLECTOR_ID = "c_coolpath_demo_same_identity";
export const DEMO_SOURCE_ID = "demo-civic-cooling";
export const DEMO_CITY_ID = "demo-city";
export const DEMO_EVIDENCE_URL = "https://cooling.demo.invalid/locations";
export const FIXTURE_OBSERVED_AT = "2026-08-17T12:00:00.000Z";

const trustedSites: CoolingSite[] = [
  {
    id: "demo-city:harbour-library",
    cityId: DEMO_CITY_ID,
    sourceKey: DEMO_SOURCE_ID,
    name: "Harbour Library",
    addressText: "18 River Street, Demo City",
    evidenceUrl: DEMO_EVIDENCE_URL,
    temporalClaim: {
      kind: "weekly_windows",
      timezone: "Europe/Rome",
      windows: [
        {
          day: "monday",
          opensAt: "09:00",
          closesAt: "19:00",
          sourceText: "Monday 9:00 AM-7:00 PM"
        },
        {
          day: "tuesday",
          opensAt: "09:00",
          closesAt: "19:00",
          sourceText: "Tuesday 9:00 AM-7:00 PM"
        }
      ],
      evidenceText: "Monday-Tuesday, 9:00 AM-7:00 PM"
    },
    explicitClaims: [
      {
        kind: "accessibility",
        label: "Wheelchair accessible entrance",
        evidenceText: "Wheelchair accessible entrance",
        sourceUrl: DEMO_EVIDENCE_URL,
        evidenceLocator: "location[data-location-id='harbour-library'] .access"
      }
    ],
    observedAt: FIXTURE_OBSERVED_AT
  },
  {
    id: "demo-city:north-community-hall",
    cityId: DEMO_CITY_ID,
    sourceKey: DEMO_SOURCE_ID,
    name: "North Community Hall",
    addressText: "204 Cedar Avenue, Demo City",
    evidenceUrl: DEMO_EVIDENCE_URL,
    temporalClaim: {
      kind: "source_text",
      text: "Open during posted programme hours"
    },
    explicitClaims: [
      {
        kind: "amenity",
        label: "Drinking water",
        evidenceText: "Drinking water available",
        sourceUrl: DEMO_EVIDENCE_URL,
        evidenceLocator: "location[data-location-id='north-community-hall'] .amenity"
      }
    ],
    observedAt: FIXTURE_OBSERVED_AT
  },
  {
    id: "demo-city:market-civic-centre",
    cityId: DEMO_CITY_ID,
    sourceKey: DEMO_SOURCE_ID,
    name: "Market Civic Centre",
    addressText: "7 Market Lane, Demo City",
    evidenceUrl: DEMO_EVIDENCE_URL,
    temporalClaim: {
      kind: "activation_range",
      startsOn: "2026-08-15",
      endsOn: "2026-08-21",
      evidenceText: "Available as a cooling space from 15-21 August 2026"
    },
    explicitClaims: [],
    observedAt: FIXTURE_OBSERVED_AT
  }
];

export const healthyCollectorResult = structuredClone(trustedSites);

export const driftedCollectorResult: unknown[] = [
  {
    id: "demo-city:harbour-library",
    cityId: DEMO_CITY_ID,
    sourceKey: DEMO_SOURCE_ID,
    name: "",
    addressText: "<span>18 River Street, Demo City</span>",
    evidenceUrl: DEMO_EVIDENCE_URL,
    temporalClaim: { kind: "not_provided" },
    explicitClaims: [],
    observedAt: FIXTURE_OBSERVED_AT
  }
];

export const healedCollectorResult = trustedSites.map((site) => ({
  ...structuredClone(site),
  observedAt: "2026-08-17T12:08:00.000Z"
}));

export const layoutV1Html = `<!doctype html>
<html><body><main class="cooling-list">
  <article class="cooling-card" data-location-id="harbour-library">
    <h2 class="name">Harbour Library</h2>
    <p class="address">18 River Street, Demo City</p>
    <p class="hours">Monday-Tuesday, 9:00 AM-7:00 PM</p>
  </article>
</main></body></html>`;

export const layoutV2Html = `<!doctype html>
<html><body><section class="public-places">
  <div class="place" data-location-id="harbour-library">
    <header><span>Cooling location</span><h3>Harbour Library</h3></header>
    <address>18 River Street, Demo City</address>
    <dl><dt>Published hours</dt><dd>Monday-Tuesday, 9:00 AM-7:00 PM</dd></dl>
  </div>
</section></body></html>`;

export const expectedHealDiff = [
  { field: "name", before: ".cooling-card .name", after: ".place h3" },
  { field: "addressText", before: ".cooling-card .address", after: ".place address" },
  { field: "temporalClaim", before: ".cooling-card .hours", after: ".place dl dd" }
] as const;
