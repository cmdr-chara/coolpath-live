# CoolPath Live submission copy

Prepared: 2026-08-20

The copy below distinguishes verified provider evidence, deterministic fixture behavior, and the one remaining exact-final-commit live gate. Replace only the bracketed repository and video placeholders before submission.

## 50-word pitch

CoolPath Live turns Bright Data Scraper Studio output into a fail-closed cooling-location evidence ledger. Every Pennsylvania 211 collection is normalized, typed, validated, and either published transactionally or quarantined. When extraction drifts, the last trusted snapshot stays public while a human reviews healing and the same Collector ID is re-run safely.

## 150-word description

CoolPath Live is an evidence-first cooling-location directory powered by a custom Bright Data Scraper Studio collector for Pennsylvania 211. The collector returns structured facility names, addresses, service statements, and evidence URLs. CoolPath normalizes those rows into strict TypeScript and Zod contracts, records aggregate lineage, and creates a candidate snapshot. Only a publishable candidate can update the transactional publishedSnapshotId pointer used by the public API and React directory. Suspicious or malformed candidates are quarantined, incidents remain visible, and the last trusted snapshot stays available within its freshness policy. A deterministic fixture demonstrates controlled drift, manual repair review, rejection, approval, and validated recovery without pretending a real website changed on command. Separate sanitized evidence records a real Scraper Studio healing operation on August 20, 2026, with the same Collector ID before and after. Mock startup, tests, public reads, liveness, and readiness never trigger paid Bright Data collection or expose raw rejected rows.

## Long-form description

Cooling-location information can matter during extreme heat, but the pages that publish it can change independently of the systems that reuse it. A scraper can still return HTTP 200 while silently losing rows, returning malformed fields, switching language, or extracting unrelated content. CoolPath Live treats that as a trust-boundary problem rather than a scraping-only problem.

The real ingestion path begins with a custom Bright Data Scraper Studio collector for the public Pennsylvania 211 Philadelphia cooling-center search. The collector identity is stable: `c_msxe8lsm2630ya30wu`. Its structured rows contain `facility_name`, `address`, `service_text`, and `evidence_url`. The PA211 adapter validates the row shape, filters non-location results, removes exact duplicates, restricts evidence to the approved HTTPS origin, and converts accepted rows into canonical `CoolingSite` records.

Those records then pass strict domain validation and quality checks. CoolPath records provider rows received, normalized rows accepted, non-locations filtered, duplicates removed, validation rejections, quarantined records, and trusted published records. A passing candidate is transactionally promoted through `source.publishedSnapshotId` in SQLite. The public Fastify API and React directory read only through that pointer. A failed candidate is quarantined and cannot replace the last trusted snapshot.

The recovery path remains human-gated. CoolPath records an incident, requests a bounded field-specific repair, displays the proposed selector changes, and allows explicit approval or rejection. Approval is not treated as proof. The application waits for Bright Data Self-Healing to complete, re-runs the same Collector ID, and sends the fresh output through the complete normalizer, domain, and publication contract again.

The repository contains two deliberately separate forms of evidence:

- Live captured and sanitized Bright Data evidence from August 20, 2026, including a real Self-Healing flow. The first preview was rejected because it moved results to the Spanish path; the corrected preview was approved, completed on the same Collector ID, and produced a publishable 24-provider-row to 23-location result.
- A deterministic controlled-drift fixture used by tests and the presenter UI. It makes quarantine, rejection, approval, and recovery repeatable without claiming a real website changed on command or spending provider credits.

The remaining external gate is one deliberate integrated API publication run against the exact final submission commit. The repository records the prior real API rehearsal as `exactFinalCommit: false` rather than presenting it as stronger evidence than it is.

## Best Use of Bright Data

Bright Data Scraper Studio is the real production ingestion boundary, not decorative metadata.

- The custom collector targets a long-tail public nonprofit directory rather than a pre-built marketplace target.
- The terminal/coding-agent workflow uses the existing stable `c_*` collector through the official Bright Data CLI.
- The Collector ID is the downstream integration boundary and remains unchanged across runs and healing.
- Real structured output powers normalization, validation, candidate snapshots, transactional publication, SQLite persistence, the public directory, evidence inspection, lineage metrics, incidents, and recovery.
- A genuine Self-Healing operation was reviewed manually on August 20, 2026. One unsafe preview was rejected; a corrected preview was approved; the same Collector ID was re-run; and the result remained publishable.
- The deterministic presenter is clearly labelled as controlled simulation and never substitutes for real provider evidence.

## Best Clean Code

The repository encodes trust boundaries in module boundaries:

- `packages/source-adapters`: Bright Data protocol, PA211 source policy, normalization, deterministic fake.
- `packages/domain`: canonical schemas, quality policy, state machine, API contracts, time handling.
- `packages/db`: versioned SQLite migrations, immutable snapshots, atomic publication, incidents, timeline.
- `apps/api`: orchestration, source coordination, operator authentication, probes, sanitized HTTP errors.
- `apps/web`: trusted public directory, evidence drawer, technical lineage, controlled presenter.

Strict TypeScript and Zod protect untrusted boundaries. Provider reads are bounded by complete-operation timeouts. Safe polling reads use bounded retry while mutating provider requests are not blindly repeated. Source operations are single-flight per source. Public errors are sanitized. Tests use deterministic clients and never call Bright Data. `CONTRIBUTING.md`, `CODEX.md`, the architecture documentation, reproduction guide, judging matrix, and evidence verifier give a new maintainer explicit ownership and invariants.

## Architecture summary

```text
Pennsylvania 211 public HTML
  -> Bright Data Scraper Studio collector
  -> structured dataset rows
  -> PA211 normalizer and origin policy
  -> canonical CoolingSite contract
  -> quality and freshness gates
  -> candidate snapshot
  -> publish or quarantine
  -> SQLite publishedSnapshotId
  -> Fastify public API
  -> React directory and evidence UI
```

Failure and recovery:

```text
invalid or suspicious candidate
  -> quarantine
  -> incident
  -> healing preview
  -> human approve or reject
  -> provider completion
  -> same-collector rerun
  -> full validation
  -> recovered publication or continued quarantine
```

## Impact statement

CoolPath demonstrates a reusable safety pattern for operational web data: provenance before convenience, validation before publication, uncertainty made visible, and continuity without silently trusting the newest scrape. Cooling locations are the concrete use case, but the same approach applies to shelters, food assistance, public service directories, and other bounded evidence-backed resources.

## Source and coverage disclaimer

The Bright Data target is Pennsylvania 211, a nonprofit public service directory. It is not a city agency, municipal source, or official government website. CoolPath does not scrape `phila.gov`, `fresno.gov`, or another government domain for this event.

The collector reads a bounded first page. Historical verified runs observed 24 or 25 provider rows and 23 accepted cooling locations, depending on collector state. These numbers describe those runs only. CoolPath does not claim complete coverage of all Pennsylvania 211 matches, infer missing pages, or infer real-time facility availability. Users must confirm current opening and safety information with the source before travelling.

## Technology

- Bright Data Scraper Studio and Self-Healing
- Bright Data CLI and Scraper Studio API
- TypeScript 5, Node.js 22, pnpm workspaces
- Fastify, Zod, Drizzle ORM, SQLite WAL
- React, Vite, TanStack Query, Radix Dialog, GSAP
- Vitest, Playwright, ESLint, Prettier, GitHub Actions

## Submission links

- Repository: https://github.com/cmdr-chara/coolpath-live
- Demo video: https://streamable.com/9suxbq
- Structured output: `docs/evidence/scraper-studio-output.example.json`
- Real healing evidence: `docs/evidence/healing-recovery.example.json`
- Integrated publication evidence: `docs/evidence/live-api-publication.example.json`
- Reproduction guide: `docs/bright-data-reproduction.md`
- Judging matrix: `docs/judging-matrix.md`
- Video runbook: `docs/video-runbook.md`

## AI-assistance disclosure

OpenAI ChatGPT and Codex were used for research, repository inspection, implementation support, review, test design, debugging, visual QA, documentation, and submission preparation. The project owner remains responsible for source selection, external collector configuration, approval decisions, architecture, security boundaries, verification, and every final claim. See `AI_USAGE.md` for the full disclosure.
