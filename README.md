# CoolPath Live

**An evidence-first cooling-location directory powered by Bright Data Scraper Studio.**

CoolPath Live turns public Pennsylvania 211 cooling-location pages into a trusted evidence ledger. Bright Data returns structured rows, but CoolPath never publishes them merely because collection succeeded. Every run is normalized, typed, validated, and recorded as a candidate. Only a publishable candidate can atomically replace `publishedSnapshotId`; invalid or suspicious candidates are quarantined while the last trusted snapshot remains public.

When extraction needs repair, CoolPath preserves the same Scraper Studio Collector ID, opens an incident, prepares a field-specific healing preview, requires human approval or rejection, waits for provider completion, re-runs the collector, and performs the complete validation path again. Approval alone never publishes data.

The structured output powers the real product chain:

```text
Pennsylvania 211
  -> Bright Data Scraper Studio
  -> structured dataset rows
  -> PA211 normalization and source policy
  -> typed CoolingSite contract
  -> validation and drift detection
  -> candidate snapshot
  -> publish or quarantine
  -> SQLite publishedSnapshotId
  -> public directory, evidence drawer, technical lineage, incidents, recovery
```

## Run the demo

**Watch the final demo:** [CoolPath Live — Evidence Before Availability](https://streamable.com/9suxbq)

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`.

Mock mode is the default. It needs no Bright Data credentials, makes no provider calls, and gives a repeatable sequence:

1. healthy trusted baseline;
2. controlled drift simulation;
3. invalid candidate quarantine;
4. last-trusted public snapshot retention;
5. healing preview;
6. explicit rejection or approval;
7. proving rerun and recovered publication.

For the full recording sequence, use [`docs/video-runbook.md`](docs/video-runbook.md).

## Why Bright Data is central

The production integration is a custom Bright Data Scraper Studio collector for the public Pennsylvania 211 Philadelphia cooling-center search.

- Collector ID: `c_msxe8lsm2630ya30wu`
- Source ID: `pa211-philadelphia-cooling`
- Target organization: Pennsylvania 211
- Target origin: `https://search.pa211.org`
- Structured fields: `facility_name`, `address`, `service_text`, `evidence_url`

Pennsylvania 211 is a nonprofit public service directory. It is not a city agency, municipal source, or official government source. CoolPath does not scrape a government website for this event.

Sanitized real evidence from August 20, 2026 records:

- a real Scraper Studio healing operation;
- rejection of an unsafe first preview that changed the language path;
- approval of a corrected preview;
- the same Collector ID before and after healing;
- a publishable post-heal rerun with 24 provider rows and 23 accepted locations;
- one integrated real-mode API publication rehearsal.

On August 21, 2026, one bounded real operator check ran from clean candidate `bfbf77df80c5c68cedfe4c206e4714d2381562df`, tagged `submission-live-verified-2026-08-21`. The same Collector ID returned 24 provider rows; CoolPath accepted and published 23 locations, filtered one non-location, reached `HEALTHY`, and had no active incident. The canonical artifact records `workingTreeClean: true` and `exactFinalCommit: true`; the later evidence-only commit does not change the verified application tree.

Evidence index: [`docs/evidence/bright-data.md`](docs/evidence/bright-data.md).

## Product views

### Public directory

The public view exposes only the trusted published snapshot. It includes:

- source-backed location records;
- search across the complete published snapshot;
- six records per page with numbered pagination;
- repeated source claims summarized once;
- an accessible evidence drawer;
- freshness and source attribution;
- explicit language that CoolPath does not infer live availability.

### Technical view

The technical view makes the trust boundary legible at recording resolution:

```text
SOURCE -> SCRAPER STUDIO -> NORMALIZATION + VALIDATION -> PUBLISHED SNAPSHOT
                               |
                               -> QUARANTINED CANDIDATE -> INCIDENT -> REVIEW -> RERUN
```

It distinguishes:

- provider rows received;
- normalized rows accepted;
- non-location rows filtered;
- exact duplicates removed;
- validation rejections;
- quarantined records;
- trusted published records;
- Collector ID and mode;
- latest run disposition and reason codes;
- trusted snapshot ID and timeline.

The deterministic presenter is available only in mock mode and is labelled as controlled simulation. Real mode never exposes public demo controls.

## Architecture

CoolPath is a strict TypeScript pnpm monorepo.

```text
apps/
  api/                 Fastify routes, orchestration, probes, operator boundary
  web/                 React public and technical interfaces
packages/
  domain/              Zod contracts, quality policy, state machine, API schemas
  source-adapters/     Bright Data client, PA211 source policy and normalizer, mock client
  db/                  Drizzle models, SQLite migrations, repositories and transactions
  test-fixtures/       Deterministic healthy, drifted and healed data
scripts/
  verify-submission-evidence.mjs
```

The boundaries are deliberate:

- provider protocol does not leak into React;
- PA211 parsing and origin policy stay in the source adapter;
- domain validation is independent of HTTP and persistence;
- routes do not own database publication logic;
- public reads never query the newest candidate directly;
- operator mutations require bearer authentication and allowlisted source IDs;
- tests inject deterministic clients and never call Bright Data.

See [`docs/architecture.md`](docs/architecture.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Trust and publication model

A provider result begins as untrusted input.

```text
provider rows
  -> source-row Zod validation
  -> cooling-location filtering
  -> exact deduplication
  -> approved HTTPS evidence-origin enforcement
  -> canonical CoolingSite validation
  -> completeness, yield, identity and content checks
  -> immutable candidate snapshot
```

A publishable candidate and all accepted sites are stored in one SQLite transaction, then `source.publishedSnapshotId` is updated. A quarantined or review-required candidate is retained for audit but cannot update that pointer.

The source state machine distinguishes:

- `UNINITIALIZED`
- `HEALTHY`
- `STALE`
- `DEGRADED`
- `BROKEN`
- `HEALING`
- `REVIEW_PENDING`
- `RECOVERED`

Freshness reconciliation is local and safe. It can mark an expired trusted snapshot stale without making a provider request.

## Bright Data API behavior

The real client follows the current Scraper Studio API quickstart:

1. `POST /dca/trigger` queues the stable `c_*` collector and returns `collection_id`.
2. CoolPath uses that execution ID to poll `GET /dca/dataset?id=<snapshot_id>`.
3. Building responses continue within a complete-operation timeout.
4. A ready JSON array becomes untrusted provider rows.
5. Safe GET polling uses bounded retry for rate limits and temporary provider failures.
6. Mutating trigger, healing, and approval requests are not blindly repeated.
7. `401`, `403`, `404`, `422`, `429`, timeout, DNS, and provider `5xx` failures are classified separately.
8. Credentials remain server-side.

Collector ID, collection or snapshot ID, and dataset are distinct terms. See [`docs/bright-data-reproduction.md`](docs/bright-data-reproduction.md).

## Mock mode

No credentials are required.

```bash
pnpm dev
```

Useful commands:

```bash
pnpm demo
pnpm demo:reset
pnpm test
pnpm test:e2e
```

Mock evidence is deterministic fixture behavior, not live provider evidence and not a real website change.

## Real mode

Copy `.env.example` to a local untracked environment file and provide values without committing or printing them.

Real startup must not collect automatically:

```bash
COOLPATH_MODE=real \
AUTO_START_REAL_CHECK=false \
DATABASE_URL=':memory:' \
pnpm --filter @coolpath/api dev
```

Expected startup behavior:

- `/healthz` reports process liveness without querying the database;
- `/readyz` checks database usability, source initialization, and trusted-snapshot availability, and may return `503 not_ready` before a trusted snapshot exists;
- no provider call occurs on startup;
- public GET routes never consume Bright Data credits;
- one authenticated operator check deliberately triggers collection.

The canonical CLI and operator workflow is documented in [`docs/bright-data-reproduction.md`](docs/bright-data-reproduction.md).

## Verification

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm verify
pnpm audit --prod --audit-level high
pnpm verify:evidence
git diff --check
```

`pnpm verify:evidence` checks the committed submission package for:

- evidence classification;
- pinned collector and source identity;
- four-field Scraper Studio schema;
- PA211 HTTPS evidence origin;
- provider-row accounting;
- same-collector healing continuity;
- explicit preview rejection and approval;
- deterministic/live truth boundaries;
- absence of literal credentials in evidence;
- current CLI workflow and retrieval date.

The GitHub Actions workflow runs install, production dependency audit, lint, format, typecheck, tests, build, and Chromium E2E. Automated tests never call Bright Data.

## Evidence package

| Artifact                                                                                 | Classification              | Purpose                                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------- |
| [`scraper-studio-output.example.json`](docs/evidence/scraper-studio-output.example.json) | Live captured and sanitized | Real representative structured rows and aggregate coverage                        |
| [`healing-recovery.example.json`](docs/evidence/healing-recovery.example.json)           | Live captured and sanitized | Real preview rejection, approval, same Collector ID, post-heal rerun              |
| [`live-api-publication.example.json`](docs/evidence/live-api-publication.example.json)   | Live captured and sanitized | Real-mode trigger, validation, transactional publication and readiness transition |
| [`drift-quarantine.example.json`](docs/evidence/drift-quarantine.example.json)           | Deterministic fixture       | Repeatable drift, quarantine, rejection, approval and recovery                    |

Every example excludes credentials, authorization headers, cookies, unnecessary raw responses, personal contact fields, and raw rejected records.

## Source and coverage limitations

The PA211 query is bounded to a first page. Historical verified runs observed 24 or 25 provider rows and 23 accepted cooling locations. Those numbers describe the captured runs, not complete Pennsylvania 211 coverage.

CoolPath does not:

- infer missing pages;
- claim every cooling location in Philadelphia;
- infer current opening or capacity;
- scrape login-protected, private, paywalled, restricted, or personal information;
- accept arbitrary public target URLs or collector IDs;
- use a government target for this event.

Confirm current opening and safety information with the source before travelling.

## Submission package

- [`docs/judging-matrix.md`](docs/judging-matrix.md)
- [`docs/bright-data-reproduction.md`](docs/bright-data-reproduction.md)
- [`docs/video-runbook.md`](docs/video-runbook.md)
- [`docs/submission-copy.md`](docs/submission-copy.md)
- [`docs/evidence/bright-data.md`](docs/evidence/bright-data.md)
- [`docs/submission-checklist.md`](docs/submission-checklist.md)

Official event and Bright Data requirements summarized in the new submission documents were retrieved on August 20, 2026.

## AI use

OpenAI ChatGPT and Codex assisted with research, implementation, review, testing, visual QA, and documentation. The project owner remains responsible for source selection, external collector configuration, provider approvals, security boundaries, verification, and final claims. See [`AI_USAGE.md`](AI_USAGE.md).

## License

MIT. See [`LICENSE`](LICENSE).
