export const PA211_SOURCE = {
  sourceId: "pa211-philadelphia-cooling",
  city: {
    id: "philadelphia",
    slug: "philadelphia",
    displayName: "Philadelphia",
    region: "Pennsylvania",
    timezone: "America/New_York"
  },
  agencyName: "Pennsylvania 211",
  canonicalUrl:
    "https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10",
  allowedOrigins: ["https://search.pa211.org"],
  freshnessTtlMinutes: 720,
  policyVersion: "2026-08-17-pa211"
} as const;
