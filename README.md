# CoolPath Live

> Source-published cooling information that stays trustworthy when the web changes.

CoolPath Live is an evidence-first directory of publicly reported cooling centres and heat-relief locations, built for the WeMakeDevs x Bright Data [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon.

A scraper returning HTTP 200 is not enough. A page can still return zero facilities, malformed fields, stale operational copy or a subtly changed layout. CoolPath puts Bright Data Scraper Studio on the critical path, validates every collection against a typed contract and exposes only the last trusted snapshot to the public UI.

CoolPath is not emergency or medical guidance. It does not claim that a location is safe, nearest, open now, currently available, suitable for a medical condition or reachable by a safe route.

## Submission proof

- **Custom Scraper Studio collector:** `c_msxe8lsm2630ya30wu`
- **Production source:** [Pennsylvania 211 — Philadelphia cooling-centre search](https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10)
- **Downstream path:** Scraper Studio → PA211 normalizer → canonical validation → SQLite publication boundary → Fastify API → React UI
- **Verified pre-refactor real baseline:** 25 provider records, 0 failed crawls, 23 accepted locations, `publishable`, no reason codes, `HEALTHY`, 23-location published snapshot
- **Final post-refactor live verification:** intentionally pending one deliberate rerun of the same Collector ID; the repository does not claim that this rerun has already happened
- **Evidence ledger:** [docs/evidence/bright-data.md](docs/evidence/bright-data.md)
- **Collector operating notes:** [CODEX.md](CODEX.md)
- **AI-assistance disclosure:** [AI_USAGE.md](AI_USAGE.md)

The historical numbers above describe one verified real run only. They are not a claim that Pennsylvania 211 always contains exactly 25 provider rows or 23 accepted locations.

## What is implemented

- Strict TypeScript and Zod canonical contracts for sites, temporal claims and evidence.
- Deterministic hard and soft quality gates for schema, origin, HTTPS, identity, yield, content and optional-field coverage.
- SQLite WAL persistence with Drizzle schemas, versioned SQL migrations and a transactional `publishedSnapshotId` promotion boundary.
- Fastify API exposing only published snapshots, with semantic ETags, conditional requests, security headers, source allowlists and sanitized errors.
- Deterministic TTL reconciliation that marks expired trusted data historical without launching a provider request or deleting the snapshot.
- Per-source single-flight coordination that prevents overlapping checks and healing mutations while allowing independent sources to proceed.
- Separate liveness and readiness signals, non-blocking real-mode startup and graceful process shutdown.
- Real Bright Data Scraper Studio API client plus a deterministic mock client. Mock mode is always labelled.
- Manual healing review flow: detect drift, quarantine output, protect the baseline, prepare a field-specific repair, display the selector diff, approve, rerun the same collector and validate before publication.
- Responsive React civic-evidence interface with public and technical views, URL-backed navigation, source-state rendering, keyboard-visible focus and evidence drawers.
- Unit, integration and Playwright coverage with no live network calls in CI.
- A separate low-rate Pennsylvania 211 live smoke command for deliberate manual verification.

## Hackathon fit

CoolPath treats the three project tracks as one system:

- **Best Use of Bright Data:** Scraper Studio is the production ingestion boundary, not a side demo. The `c_*` collector feeds a real API/database/UI pipeline.
- **Best UI:** the public directory stays calm and useful during degradation while the technical view makes provenance, quarantine and recovery legible.
- **Best Clean Code:** domain, source-adapter, database, API and UI responsibilities are explicit, narrow and independently testable.

The event evaluates impact, creativity, technical excellence, Scraper Studio use, reliability/self-healing and presentation. The repository is structured so those claims can be inspected independently rather than inferred from the demo.

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

The newest candidate is never automatically the public truth. Public endpoints follow the source's `publishedSnapshotId` pointer, so malformed or suspicious fresh data cannot overwrite the last trusted snapshot.

See [docs/architecture.md](docs/architecture.md) for states, trust boundaries and recovery sequencing.

## Reliability model

A healthy collection is parsed, normalized and validated before it can be promoted. Hard contract failures quarantine immediately. Soft anomalies also block automatic publication pending review. Provider failures such as 403, 429, timeout or DNS errors are treated as inconclusive rather than mislabeled as layout drift.

When a collection is quarantined, the previous published snapshot remains available. A repair is not trusted merely because extraction starts returning values again: the same canonical validation and publication gates run after approval and rerun.

The deterministic mock flow exists to make this lifecycle reproducible without spending Bright Data credits or pretending that a real website changed on command.

## Source acceptance

Pennsylvania 211 is the active real source because Bright Data accepted its public Philadelphia directory for the hackathon account while the reviewed government-domain candidates required additional provider verification. The production adapter makes that exception explicit rather than bypassing Bright Data policy.

The bounded PA211 collector reads public facility information only, excludes non-location/hotline results and duplicates, restricts evidence links to the `search.pa211.org` HTTPS origin and assigns observation time server-side.

The full review of Pennsylvania 211, Arizona Faith Network, Fresno, Long Beach, St. Louis and the rejected Lakewood source is in [docs/source-policy.md](docs/source-policy.md).

## Run locally

Requirements: Node.js 22 or newer and pnpm 11. CI uses Node 24.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5173`. The API listens on `http://127.0.0.1:8787` by default.

Copy `.env.example` to `.env` to override ports or persistence. Mock mode is the default, needs no credentials and deterministically publishes its fixture when the database has no trusted snapshot.

Runtime probes:

```bash
curl --fail http://127.0.0.1:8787/healthz
curl --fail http://127.0.0.1:8787/readyz
```

`/healthz` proves that the process can answer HTTP. `/readyz` separately reports database usability, source initialization and trusted-snapshot availability. Temporary Bright Data unavailability does not make liveness fail.

## Reproduce drift safely

The UI exposes four deterministic controls in mock mode:

1. **Healthy baseline** resets and publishes fixture layout v1.
2. **Simulate drift** switches the same fixture URL to layout v2. Broken extraction is quarantined and the trusted baseline stays public.
3. **Prepare repair** creates a field-specific healing prompt and selector diff.
4. **Approve and re-run** applies the mock repair, reruns the same collector identity, validates the complete contract and publishes recovery.

For a terminal-only staged run:

```bash
pnpm demo
```

This flow is explicitly synthetic and never claims that Bright Data healing is instantaneous or fully autonomous.

## Configure real Bright Data

The production Scraper Studio collector used by CoolPath is:

```text
c_msxe8lsm2630ya30wu
```

It returns the source fields:

- `facility_name`
- `address`
- `service_text`
- `evidence_url`

The Collector ID is not a secret. API credentials and operator tokens are secrets.

Copy `.env.example` to `.env`, keep the pinned Collector ID and set:

```dotenv
COOLPATH_MODE=real
AUTO_START_REAL_CHECK=false
BRIGHT_DATA_API_TOKEN=<local secret>
OPERATOR_API_TOKEN=<random local secret, at least 32 characters>
```

Real-mode startup is credit-safe by default. With `AUTO_START_REAL_CHECK=false`, the API seeds the allowlisted source and starts without launching Bright Data. An operator can then intentionally perform one collection:

```bash
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${OPERATOR_API_TOKEN}" \
  http://127.0.0.1:8787/api/operator/sources/pa211-philadelphia-cooling/check
```

For an isolated final verification, use `DATABASE_URL=:memory:`. After that one provider run, inspect `/readyz` and `/api/cities/philadelphia` without triggering another collection.

A separate adapter-only smoke command also exists:

```bash
pnpm smoke:live
```

It runs the configured collector, normalizes the result and prints a bounded validation summary without publishing to the application database. When minimizing paid runs, choose either the end-to-end operator check or the smoke command rather than running both unnecessarily.

The client follows Bright Data's documented Scraper Studio API and healing flow. See [CODEX.md](CODEX.md) for the credit-safe operating rules.

## Public API

- `GET /api/cities`
- `GET /api/cities/:slug`
- `GET /api/incidents/:sourceId/current`
- `GET /healthz`
- `GET /readyz`

Public representation ETags cover meaningful city, source-state, trusted-snapshot, latest-run, active-incident and bounded-timeline data. The volatile response `generatedAt` value is excluded. Public reads use `Cache-Control: public, max-age=0, must-revalidate`; a matching `If-None-Match` receives `304`.

Mock-only operator endpoints live under `/api/demo/*`; they accept no URLs and are not registered in real mode. Real-mode check, healing and approval endpoints live under `/api/operator/sources/:sourceId/*`, accept only seeded allowlisted source IDs and require `Authorization: Bearer <OPERATOR_API_TOKEN>`.

## Quality gates

Hard contract failures quarantine immediately: zero rows, invalid schema, missing name/address/evidence URL, non-HTTPS or off-origin evidence, duplicate identity, reversed dates, collector/schema identity change and HTML contamination.

Soft anomalies also block automatic publication pending review: major yield drop, widespread optional-field loss, suspicious content replacement, stable-identity replacement and unexpected record growth.

A successful replacement publication resolves any active incident in the same persistence transaction. Ordinary passing checks return the source to `HEALTHY`; a validated run after an approved healing workflow records `RECOVERED`. Quarantined and inconclusive runs preserve the active incident and last trusted snapshot.

## Database and migrations

`packages/db/migrations/*.sql` is the authoritative schema history. `CoolPathRepository` enables foreign keys and WAL, creates `_coolpath_migrations` and applies unapplied numbered SQL files transactionally in lexical order.

There is no destructive reset or schema rewrite in normal startup. See [CONTRIBUTING.md](CONTRIBUTING.md) for migration and change recipes.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm test:e2e
pnpm verify
git diff --check
```

CI uses deterministic fixtures and never contacts Bright Data. That makes CI safe and repeatable, but it also means green CI is not a substitute for the deliberately separate final live-provider verification recorded in [docs/evidence/bright-data.md](docs/evidence/bright-data.md).

## Privacy and legal boundaries

CoolPath stores public facility information only. It has no accounts, geolocation, stored client IPs, analytics, notifications, crowdsourced reports or user-submitted URLs. It deliberately excludes staff names, phone numbers and email addresses.

Scraped content is treated as untrusted data, never rendered as HTML and never sent to an external model without explicit configuration. Source data remains attributed to its published source. Source terms and robots notes must be rechecked when `sourcePolicyVersion` changes.

## Repository map

```text
apps/web                 React, Vite and TanStack Query UI
apps/api                 Fastify API, ingestion and operator/demo routes
packages/domain          Canonical schemas, quality gates and state machine
packages/source-adapters Bright Data clients, normalizers and source manifest
packages/db              Drizzle schema, migrations and snapshot repository
packages/test-fixtures   Deterministic layout v1/v2 and golden records
docs                     Architecture, source policy, evidence and audit notes
```

For a stranger picking up the repository, start with [CONTRIBUTING.md](CONTRIBUTING.md). AI-assisted development is disclosed in [AI_USAGE.md](AI_USAGE.md).

MIT licensed. See [LICENSE](LICENSE).
