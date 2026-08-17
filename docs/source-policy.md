# Source policy and acceptance checklist

Policy review date: 2026-08-17. Recommendations here are engineering policy, not guarantees made by the source authorities.

## Acceptance gate

| Requirement                                              | Pennsylvania 211               | Fresno                                                          | Long Beach                           | St. Louis                |
| -------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------ | ------------------------ |
| Official municipal/public authority                      | Exception: nonprofit           | Pass                                                            | Pass                                 | Pass                     |
| Public HTML, HTTPS, no login/CAPTCHA                     | Pass                           | Pass                                                            | Pass                                 | Pass                     |
| Canonical stable URL                                     | Pass                           | Pass                                                            | Pass                                 | Pass                     |
| Low or bounded record count                              | Bounded, 25 of 32              | Pass, 3                                                         | Pass, 9                              | Conditional, 22          |
| Explicit facility name and public address                | Pass                           | Pass                                                            | Conditional, one row missing address | Pass                     |
| Source-published hours or activation data                | Conditional, service statement | Pass                                                            | Pass                                 | Pass, sometimes indirect |
| No personal or sensitive data needed                     | Pass                           | Pass                                                            | Pass                                 | Pass                     |
| Feasible low-rate requests                               | Pass conservatively            | Pass with 10-second crawl delay                                 | Pass conservatively                  | Pass conservatively      |
| Predictable allowed origin                               | Pass, 1 origin                 | Pass, 2 exact origins                                           | Pass, 1 origin                       | Pass, 1 origin           |
| No obvious stable API/RSS that makes scraping gratuitous | Pass                           | Conditional iframe/WordPress surface; HTML still product source | Pass                                 | Pass                     |

The original product brief preferred official municipal sources. Bright Data blocks the selected government domains for this individual hackathon account unless business verification is completed, and it also rejected the Arizona Faith Network URL during AI collector generation. The production adapter therefore makes one explicit, documented exception: it uses a public nonprofit 211 directory that Bright Data accepted, while preserving the same evidence, allowlist, freshness and quality requirements. Blocked candidates are not silently routed around the provider policy.

## Primary source: Pennsylvania 211

- **Area:** Philadelphia, Pennsylvania
- **Authority:** Pennsylvania 211, a public nonprofit service directory
- **Canonical URL:** <https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10>
- **Allowed origin:** `https://search.pa211.org`
- **Expected cadence:** continuously maintained public directory
- **Freshness TTL:** 720 minutes before stale wording
- **Fields:** facility name, public address, source service statement and stable public detail URL
- **Robots/terms:** the public HTML directory requires no login. Use the HTML search/detail pages only, collect conservatively and retain attribution because no open-data licence is stated
- **Limitations:** nonprofit rather than municipal authority; the bounded first page exposes 25 of 32 matches; the collector intentionally excludes hotlines, map-only listings and pagination; detailed hours are not present on every search card
- **Policy version:** `2026-08-17-pa211`

The collector reads only the visible first page, keeps records explicitly described as cooling centers and excludes phone numbers, hotlines, map-only listings, directions links and duplicates. Evidence links are resolved against and restricted to the PA 211 HTTPS origin. Observation time is assigned server-side.

## Read-only candidate: Arizona Faith Network

- **Authority:** Arizona Faith Network
- **Canonical URL:** <https://www.arizonafaithnetwork.org/heatrelief>
- **Fields:** facility name, public address, season, hours and closure exceptions
- **Limitation:** Bright Data rejected this URL during AI collector generation with a compliance restriction, so it is not used by the real adapter

## Read-only candidate: Fresno

- **City:** Fresno, California
- **Authority:** City of Fresno
- **Canonical URL:** <https://www.fresno.gov/citymanager/cooling-and-warming-centers/>
- **Allowed origins:** `https://www.fresno.gov`, `https://appdev.fresno.gov`
- **Expected cadence:** daily around noon America/Los_Angeles during heat events
- **Freshness TTL:** 720 minutes active season; 1440 minutes off-season before stale wording
- **Fields:** facility name, public address, daily status, activation threshold and activation hours
- **Robots/terms:** [robots.txt](https://www.fresno.gov/robots.txt) permits general crawling and specifies `Crawl-delay: 10`; the [internet policy](https://www.fresno.gov/internet-policy/) says data is generally available to copy or distribute unless stated otherwise
- **Limitations:** current information is embedded from `appdev.fresno.gov`; a public WordPress endpoint exists; accessibility and amenities are not stated
- **Policy version:** `2026-08-17`

Fresno is not the active real adapter because Bright Data requires special permission/business verification for the government domain on this account. If access is granted later, a collector must target the rendered municipal page or its approved embedded public HTML surface and must not ingest transportation phone numbers, staff details or non-required contact fields.

## Read-only candidate: Long Beach

- **Authority:** City of Long Beach Parks, Recreation & Marine
- **Canonical URL:** <https://www.longbeach.gov/park/business-operations/about/cooling-center-locations/>
- **Allowed origin:** `https://www.longbeach.gov`
- **Expected cadence:** event-driven during heat periods
- **Freshness TTL:** 720 minutes active season; 1440 minutes off-season before stale wording
- **Fields:** facility name, public address, weekday hours and explicit closure status
- **Robots/terms:** `robots.txt` returned 404 during review, which is not an allow signal; use conservative low-rate requests. The [privacy statement](https://www.longbeach.gov/privacy/) disclaims accuracy and timeliness
- **Limitations:** one current row omits an address; seasonal status is not always timestamped
- **Policy version:** `2026-08-17`

Preserve explicit wording such as `CURRENTLY CLOSED`. If an address or hour is absent, emit `Not stated`; do not infer it from another page.

## Read-only candidate: St. Louis

- **Authority:** City of St. Louis
- **Canonical URL:** <https://www.stlouis-mo.gov/live-work/summer/cooling-centers.cfm>
- **Allowed origin:** `https://www.stlouis-mo.gov`
- **Expected cadence:** event-driven during heat periods
- **Freshness TTL:** 720 minutes active season; 1440 minutes off-season before stale wording
- **Fields:** facility name, public address and some source-published hours
- **Robots/terms:** [robots.txt](https://www.stlouis-mo.gov/robots.txt) does not disallow this HTML path but restricts JSON, PDFs and administration areas; the [privacy policy](https://www.stlouis-mo.gov/government/departments/information-technology/web-development/privacy.cfm) contains no apparent redistribution ban
- **Limitations:** 22 records; the list is supplied by United Way; some hours live only on linked library pages; no page update timestamp
- **Policy version:** `2026-08-17`

Do not crawl maps, tiles, PDFs, JSON downloads or external partner pages. A transport timeout is inconclusive.

## Rejected without permission

[City of Lakewood cooling centres](https://www.lakewoodca.gov/Residents/Senior-services/Cooling-Centers) has a useful three-row HTML table, but its [terms](https://www.lakewoodca.gov/About/About-Lakewood/Terms-and-Conditions-of-Use) prohibit copying, distribution, modification or retransmission without written permission. It is not an accepted production source.

## Revalidation procedure

Re-review a source before changing its `sourcePolicyVersion`:

1. Confirm authority, canonical URL, HTTPS and public access.
2. Recheck robots and terms from the same origin.
3. Confirm the HTML fields and any embedded origin.
4. Confirm there is no stable official API/RSS that is a better product input.
5. Run one low-rate manual collector smoke test.
6. Inspect evidence URLs and sanitized fixtures.
7. Update known limitations and TTL.
8. Never turn a network failure into a layout-drift conclusion.
