import { PA211_SOURCE } from "./pa211-source.js";

export interface SourceManifestEntry {
  city: string;
  authority: string;
  canonicalUrl: string;
  allowedOrigins: string[];
  expectedUpdateCadence: string;
  freshnessTtlMinutes: number;
  termsAndRobotsNotes: string;
  dataFieldsAvailable: string[];
  knownLimitations: string[];
  sourcePolicyVersion: string;
  implementationStatus: "primary_configurable" | "read_only_candidate";
}

export const sourceManifest: SourceManifestEntry[] = [
  {
    city: PA211_SOURCE.city.displayName,
    authority: PA211_SOURCE.agencyName,
    canonicalUrl: PA211_SOURCE.canonicalUrl,
    allowedOrigins: [...PA211_SOURCE.allowedOrigins],
    expectedUpdateCadence: "Continuously maintained public service directory",
    freshnessTtlMinutes: PA211_SOURCE.freshnessTtlMinutes,
    termsAndRobotsNotes:
      "The public HTML directory requires no login. Use only the HTML search and detail pages, retain attribution and collect conservatively because no open-data licence is stated.",
    dataFieldsAvailable: [
      "facility name",
      "public address",
      "service description",
      "stable public detail URL"
    ],
    knownLimitations: [
      "The source is a nonprofit service directory rather than a municipal authority.",
      "The bounded search returns up to 25 visible results from 32 matches.",
      "The current collector deliberately excludes hotlines, map-only results, phone numbers and pagination."
    ],
    sourcePolicyVersion: PA211_SOURCE.policyVersion,
    implementationStatus: "primary_configurable"
  },
  {
    city: "Phoenix Metro",
    authority: "Arizona Faith Network",
    canonicalUrl: "https://www.arizonafaithnetwork.org/heatrelief",
    allowedOrigins: ["https://www.arizonafaithnetwork.org"],
    expectedUpdateCadence: "Seasonal and event-driven during the 2026 heat-relief season",
    freshnessTtlMinutes: 720,
    termsAndRobotsNotes:
      "The public HTML page requires no login. robots.txt does not disallow /heatrelief; retain attribution and use low-rate collection because no open-data license is stated.",
    dataFieldsAvailable: [
      "facility name",
      "public address",
      "source-published season",
      "source-published hours",
      "closure exceptions"
    ],
    knownLimitations: [
      "The source is a nonprofit network rather than a municipal authority.",
      "Some facilities omit a season window or publish exceptional schedules as free text.",
      "The page groups sites by area and service type without stable machine identifiers."
    ],
    sourcePolicyVersion: "2026-08-17-afn",
    implementationStatus: "read_only_candidate"
  },
  {
    city: "Fresno",
    authority: "City of Fresno",
    canonicalUrl: "https://www.fresno.gov/citymanager/cooling-and-warming-centers/",
    allowedOrigins: ["https://www.fresno.gov", "https://appdev.fresno.gov"],
    expectedUpdateCadence: "Daily around noon America/Los_Angeles during heat events",
    freshnessTtlMinutes: 720,
    termsAndRobotsNotes:
      "General crawling is permitted by robots.txt with Crawl-delay: 10. The City internet policy generally allows copying and distribution unless otherwise stated.",
    dataFieldsAvailable: [
      "facility name",
      "public address",
      "daily status",
      "activation threshold",
      "activation hours"
    ],
    knownLimitations: [
      "Operational status is embedded from appdev.fresno.gov.",
      "Accessibility and amenities are not stated.",
      "Phone and transportation copy are deliberately excluded."
    ],
    sourcePolicyVersion: "2026-08-17",
    implementationStatus: "read_only_candidate"
  },
  {
    city: "Long Beach",
    authority: "City of Long Beach Parks, Recreation & Marine",
    canonicalUrl:
      "https://www.longbeach.gov/park/business-operations/about/cooling-center-locations/",
    allowedOrigins: ["https://www.longbeach.gov"],
    expectedUpdateCadence: "Event-driven during active heat periods",
    freshnessTtlMinutes: 720,
    termsAndRobotsNotes:
      "robots.txt returned 404 during review, which is not an allow signal. Use conservative low-rate requests and retain attribution.",
    dataFieldsAvailable: [
      "facility name",
      "public address",
      "weekday hours",
      "explicit closure status"
    ],
    knownLimitations: [
      "Some rows omit an address.",
      "Seasonal status is not always timestamped.",
      "The City privacy statement disclaims accuracy and timeliness."
    ],
    sourcePolicyVersion: "2026-08-17",
    implementationStatus: "read_only_candidate"
  },
  {
    city: "St. Louis",
    authority: "City of St. Louis",
    canonicalUrl: "https://www.stlouis-mo.gov/live-work/summer/cooling-centers.cfm",
    allowedOrigins: ["https://www.stlouis-mo.gov"],
    expectedUpdateCadence: "Event-driven during active heat periods",
    freshnessTtlMinutes: 720,
    termsAndRobotsNotes:
      "robots.txt does not disallow the HTML page but does restrict JSON downloads, PDFs and administrative areas.",
    dataFieldsAvailable: ["facility name", "public address", "some source-published hours"],
    knownLimitations: [
      "The list is supplied by United Way.",
      "Some hours are only available through linked library pages.",
      "The source exposes no update timestamp."
    ],
    sourcePolicyVersion: "2026-08-17",
    implementationStatus: "read_only_candidate"
  }
];
