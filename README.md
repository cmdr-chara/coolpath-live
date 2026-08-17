# CoolPath Live

> Source-published cooling information that stays trustworthy when the web changes.

CoolPath Live is an evidence-first directory of publicly reported cooling centres and heat-relief locations. It was built for the WeMakeDevs x Bright Data [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon.

Municipal pages change without warning. An HTTP 200 response can still contain zero facilities, malformed fields or stale operational copy. CoolPath puts Bright Data Scraper Studio on the critical path, validates every collection against a typed contract and publishes only a trusted snapshot.

CoolPath is not emergency or medical guidance. It does not claim that a location is safe, nearest, open now, currently available, suitable for a medical condition or reachable by a safe route.

## What is implemented

- Strict TypeScript and Zod canonical contracts for sites, temporal claims and evidence.
- Deterministic hard and soft quality gates for schema, origin, HTTPS, identity, yield, content and optional-field coverage.
- SQLite WAL persistence with Drizzle schemas and a transactional `publishedSnapshotId` promotion boundary.
- Fastify API exposing only published snapshots, with ETags, security headers, source allowlists and sanitized errors.
- Real Bright Data Scraper Studio API client plus a deterministic mock client. Mock mode is always labelled.
- Manual self-healing review: detect drift, quarantine output, protect the baseline, prepare a field-specific prompt, display the selector diff, approve, re-run the same collector and validate before publishing.
- Responsive React interface with public and source-health views, full loading/error/empty states, keyboard-visible focus and evidence drawers.
- Unit, integration and Playwright coverage with no live network calls in CI.
- A separate low-rate Pennsylvania 211 live smoke command for manually configured Bright Data credentials.

## Hackathon fit

The official event page says every submission is considered for all three tracks. CoolPath treats them as one product:

- **Best Use of Bright Data:** Scraper Studio collection and self-healing are central to publication and recovery.
- **Best UI:** the public list remains calm and useful during degradation; the technical view makes failure and recovery legible.
- **Best Clean Code:** domain, source, database, API and UI responsibilities are narrow and independently testable.

The event currently lists six equally weighted judging criteria: impact, creativity, technical excellence, Scraper Studio use, reliability/self-healing and presentation. See [the demo script](docs/demo-script.md) for the intended judging narrative.

## Architecture

```text
allowlisted public HTML
  -> Bright Data Scraper Studio collector
  -> source-specific normalizer
  -> strict canonical contract
  -> quality and freshness gate
  -> candidate snapshot
  -> transactional promotion or quarantine
  -> publishedSnapshotId
  -> public API and UI
```

The newest candidate is never a public read. Public endpoints follow the source's `publishedSnapshotId` pointer. See [docs/architecture.md](docs/architecture.md) for states, trust boundaries and recovery sequencing.

## Source acceptance

Three municipal sources and one nonprofit source were reviewed on 2026-08-17 before adapter work:

1. [Pennsylvania 211](https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10) - primary configurable source.
2. [Arizona Faith Network](https://www.arizonafaithnetwork.org/heatrelief) - read-only candidate; blocked by Bright Data compliance during collector generation.
3. [City of Fresno](https://www.fresno.gov/citymanager/cooling-and-warming-centers/) - read-only candidate; Bright Data requires business verification for the government domain.
4. [City of Long Beach](https://www.longbeach.gov/park/business-operations/about/cooling-center-locations/) - read-only candidate.
5. [City of St. Louis](https://www.stlouis-mo.gov/live-work/summer/cooling-centers.cfm) - read-only candidate.

Pennsylvania 211 is the real collector because Bright Data accepted its public Philadelphia directory without business KYC. The bounded first page exposes named facilities, explicit public addresses, source descriptions and stable evidence links. The repository does not fabricate live records. The bundled Demo City records are synthetic, clearly labelled and used only to prove deterministic layout drift. Review the full [source policy and acceptance checklist](docs/source-policy.md).

## Run locally

Requirements: Node.js 22 or newer and pnpm 11. The verified development environment used Node 24.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`. The API listens on `http://127.0.0.1:8787` by default.

Copy `.env.example` to `.env` to override ports or persistence. Mock mode is the default and does not need credentials.

## Reproduce layout drift

The UI exposes four deterministic controls in mock mode:

1. **Healthy baseline** resets and publishes fixture layout v1.
2. **Simulate drift** switches the same URL to layout v2. Broken extraction is quarantined and the three-record baseline stays public.
3. **Prepare repair** creates a field-specific healing prompt and selector diff.
4. **Approve and re-run** applies the mock repair, re-runs the same collector identity, validates the complete contract and publishes recovery.

For a terminal-only staged run:

```bash
pnpm demo
```

This intentionally pauses at manual review. It never claims that Bright Data healing is instantaneous or fully autonomous.

## Configure real Bright Data

Create a Pennsylvania 211 collector in Scraper Studio that outputs:

- `facility_name`
- `address`
- `service_text`
- `evidence_url`

Set `COOLPATH_MODE=real`, `BRIGHT_DATA_API_TOKEN`, `PRIMARY_COLLECTOR_ID` and a random `OPERATOR_API_TOKEN` of at least 32 characters in `.env`. Credentials remain server-side and logs redact authorization fields. Observation timestamps are assigned server-side instead of trusting generated collector values; detail links are resolved and restricted to the `search.pa211.org` HTTPS origin.

The client follows Bright Data's documented API flow:

- [Scraper Studio AI flow overview](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/overview)
- [CLI build, heal and approve flow](https://docs.brightdata.com/datasets/scraper-studio/build-with-the-cli)
- [Self-healing job progress](https://docs.brightdata.com/api-reference/scraper-studio-api/ai-flow/self-healing-job-progress)

Run a single manual low-rate smoke check:

```bash
pnpm smoke:live
```

The smoke command does not publish or mutate the application database. It runs the configured collector, normalizes the result and prints a bounded validation summary without raw records or credentials.

## Public API

- `GET /api/cities`
- `GET /api/cities/:slug`
- `GET /api/incidents/:sourceId/current`
- `GET /healthz`

Mock-only operator endpoints live under `/api/demo/*`; they accept no URLs and are not registered in real mode. There is no generic proxy or arbitrary scraping endpoint.

Real-mode check, healing and approval endpoints live under `/api/operator/sources/:sourceId/*`. They accept only seeded allowlisted source IDs and require `Authorization: Bearer <OPERATOR_API_TOKEN>`. No URL can be supplied by the caller.

## Quality gates

Hard contract failures quarantine immediately: zero rows, invalid schema, missing name/address/evidence URL, non-HTTPS or off-origin evidence, duplicate identity, reversed dates, collector/schema identity change and HTML contamination.

Soft anomalies also block automatic publication pending review: major yield drop, widespread optional-field loss, suspicious content replacement, stable-identity replacement and unexpected record growth.

403, 429, timeout, DNS and temporary provider failures are inconclusive. They are never presented as proof of layout drift.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm test:e2e
```

Pull-request tests use sanitized deterministic fixtures and do not perform live HTTP requests.

## Privacy and legal boundaries

CoolPath stores public facility information only. It has no accounts, geolocation, stored client IPs, analytics, notifications, crowdsourced reports or user-submitted URLs. It deliberately excludes staff names, phone numbers and email addresses. Scraped content is untrusted data and is never rendered as HTML or sent to an external model without explicit configuration.

Source data remains attributed to the issuing public authority. Source terms and robots notes must be rechecked when `sourcePolicyVersion` changes.

## Repository map

```text
apps/web                 React, Vite and TanStack Query UI
apps/api                 Fastify API, ingestion and demo orchestration
packages/domain          Canonical schemas, quality gates and state machine
packages/source-adapters Bright Data clients, normalizers and source manifest
packages/db              Drizzle schema, migrations and snapshot repository
packages/test-fixtures   Deterministic layout v1/v2 and golden records
docs                     Architecture, source policy and demo script
```

MIT licensed. See [LICENSE](LICENSE).
