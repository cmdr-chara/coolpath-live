# Submission copy — Into the Scrape-Verse

Prepared on 2026-08-18. This file contains form-ready project copy only; it does not plan the demo video.

## Project title

CoolPath Live

## One-line pitch

CoolPath Live turns Bright Data Scraper Studio output into a fail-closed civic-information pipeline that keeps the last trusted cooling-location snapshot public when a source changes or extraction becomes suspicious.

## Short description

CoolPath Live is an evidence-first cooling-centre directory powered by a custom Bright Data Scraper Studio collector for Pennsylvania 211. Every collection is normalized, validated and either transactionally published or quarantined, so the newest scrape never automatically becomes public truth.

## Full project description

Public cooling-centre pages can change without warning. A scraper may still return HTTP 200 while silently losing facilities, returning malformed fields or extracting stale operational text. For civic information, treating “newest” as “correct” is a dangerous default.

CoolPath Live puts Bright Data Scraper Studio at the beginning of a trust pipeline rather than at the end of a demo. The production collector `c_msxe8lsm2630ya30wu` collects the public Pennsylvania 211 Philadelphia cooling-centre directory. A source-specific adapter normalizes the provider output into strict TypeScript/Zod domain contracts. Hard failures and suspicious soft anomalies prevent publication. Valid candidates are promoted transactionally through a `publishedSnapshotId` boundary in SQLite; quarantined candidates cannot overwrite the last trusted snapshot.

The Fastify API exposes only trusted published data. The React interface provides a calm public directory plus a technical view that makes source state, provenance, quarantine and recovery visible. The backend separates liveness from readiness, uses bounded errors and source allowlists, prevents overlapping paid source operations with per-source single-flight coordination, reconciles freshness deterministically, supports semantic ETags, applies versioned database migrations and shuts down cleanly.

A deterministic mock source makes drift and recovery reproducible without spending provider credits or pretending a real website changed on command. The real Bright Data path remains separate and deliberately credit-safe.

## How Bright Data Scraper Studio is used

Bright Data Scraper Studio is the production ingestion boundary for the real source.

- Custom Collector ID: `c_msxe8lsm2630ya30wu`
- Source: Pennsylvania 211 public Philadelphia cooling-centre search
- Collector output fields: `facility_name`, `address`, `service_text`, `evidence_url`
- Downstream path: Scraper Studio → PA211 normalizer → canonical validation → SQLite publication/quarantine → Fastify API → React UI
- The Collector ID is pinned in `CODEX.md` and `.env.example` so the same production endpoint is reused instead of being rebuilt between sessions.
- Real-mode startup is credit-safe by default: `AUTO_START_REAL_CHECK=false` means the application never launches a provider run merely because the server started.
- Operator-triggered checks accept only the seeded source ID; callers cannot submit arbitrary URLs.

The verified historical real baseline, recorded before the major hardening/refactoring pass, returned 25 provider records with zero failed crawls. Source filtering and deduplication produced 23 accepted cooling locations; the candidate was `publishable` with no reason codes and the real API published a `HEALTHY` 23-location snapshot.

A final post-refactor live rerun of the same Collector ID is intentionally still pending. The submission must use the actual result of that rerun rather than copying the historical counts forward.

## Reliability and self-healing

CoolPath distinguishes three materially different outcomes:

1. A valid candidate can be published.
2. A suspicious or contract-breaking candidate is quarantined while the last trusted snapshot stays public.
3. Provider/network failures such as timeouts, DNS failures, 403 or 429 are inconclusive and are not falsely labelled as layout drift.

When repair is appropriate, the application prepares a bounded field-specific healing request, requires manual approval, reruns the same collector identity and sends the fresh result through the same normalization and quality gates before publication. A successful repair is therefore not trusted merely because extraction returned values again.

The bundled mock flow demonstrates drift → quarantine → protected trusted snapshot → repair review → approved rerun → validated recovery deterministically. It is clearly labelled synthetic. Genuine Bright Data healing evidence should be claimed only if a real `bdata scraper heal` operation was actually performed.

## Technical challenge

The hardest part was not scraping HTML; it was defining where untrusted provider output becomes public truth.

The implementation therefore treats external data as an adversarial boundary. Source-specific parsing is isolated from the canonical domain model. Evidence URLs are restricted to the approved HTTPS origin. Duplicate identities, missing required fields, unexpected yield shifts, suspicious content replacement and optional-field collapse are evaluated before publication. Persistence promotes a candidate and updates source state transactionally, so the public API never races against a half-published snapshot.

The hardening pass also addressed external-operation timeouts, cancellation cleanup, startup behavior, readiness semantics, cache invalidation, incident resolution, migration ownership and concurrent paid runs. The clean-code pass then separated API composition, public routes, probes, operator routes, demo routes, authentication, response semantics and error translation into explicit modules without changing frontend behavior.

## Why it matters

Cooling-centre information is a useful example of a broader problem: web data is often operationally important but published through pages whose structure can change independently of downstream consumers. CoolPath demonstrates a reusable pattern for consuming self-healing scrapers safely: preserve provenance, validate semantics, quarantine uncertainty and never equate freshness with truth.

## Track positioning

### Best Use of Bright Data

Scraper Studio is central to the real product path. The custom `c_*` collector is wired through validation, persistence, API and UI rather than used only to generate a one-off dataset.

### Best UI

The public interface prioritizes readable evidence and continuity. A separate technical view makes degradation and recovery understandable without leaking raw provider payloads or requiring users to understand the backend.

### Best Clean Code

The repository encodes trust boundaries in its module boundaries: environment parsing in config, HTTP input at routes, provider behavior in source adapters, business truth in the domain package, atomic publication in the database layer and presentation in the web app. `CONTRIBUTING.md` documents module ownership, invariants and change recipes for a new contributor.

## AI-assistance disclosure

OpenAI ChatGPT and Codex were used for repository inspection, implementation support, review, test design, debugging, documentation and submission preparation. Firecrawl-assisted research and additional agent/subagent assistance were used during source discovery and implementation review.

AI output was not treated as authoritative. The project owner remained responsible for source selection, architecture, Bright Data configuration, security boundaries, acceptance of changes and final claims. Suggested changes were reviewed and verified with strict TypeScript, ESLint, Prettier, unit/integration tests, Playwright E2E, builds and GitHub Actions. Full disclosure is in `AI_USAGE.md`.

## Links and final placeholders

- Repository: <https://github.com/cmdr-chara/coolpath-live>
- Bright Data evidence ledger: <https://github.com/cmdr-chara/coolpath-live/blob/main/docs/evidence/bright-data.md>
- AI disclosure: <https://github.com/cmdr-chara/coolpath-live/blob/main/AI_USAGE.md>
- Example structured output: **add after the final real rerun**
- Final post-refactor live result: **add actual values after the final real rerun**
- Demo video URL: **add on/after 2026-08-20**

Do not replace the pending fields with historical values unless they are explicitly labelled historical.
