# CoolPath Live — jury-ready clean-code hardening

Date: 2026-08-19

This pass hardens CoolPath Live for **Best Clean Code** review without intentionally changing the product's trusted-publication rule or mock/real boundary. It concentrates domain decisions at explicit runtime boundaries and makes the Scraper Studio failure/recovery path fail closed.

No real Bright Data collection was triggered during this hardening pass.

## Architecture boundaries

The domain package separates browser-safe contracts from server-side policy and hashing. Public API payloads are runtime-validated before leaving Fastify and again before the browser accepts them. The browser consumes the shared contract instead of maintaining a parallel hand-written DTO graph.

`IngestionService` owns collector/healing orchestration. Freshness, trusted-snapshot state semantics and restart recovery are delegated to `SourceLifecycleService`, so lifecycle persistence is no longer mixed into the collector workflow itself.

## Scraper Studio lifecycle hardening

The real Bright Data adapter models the provider workflow as asynchronous rather than treating an approval response as immediate collector readiness.

The implemented sequence is:

`trigger → poll structured dataset → normalize → validate → publish/quarantine`

and for healing:

`incident → field-specific prompt → repair preview → human approve/reject → provider completion → same-collector rerun → full validation → recovery publication`

Important guarantees:

- mutating/paid POST calls are not blindly retried;
- safe provider polling reads use bounded retry for transient HTTP failures;
- approval waits for the provider healing job to become ready before rerun;
- a second provider review gate remains `REVIEW_PENDING` instead of causing an automatic rerun;
- rejection applies no repair and restores trusted-data degradation/staleness semantics;
- authentication, forbidden access, missing collector, invalid provider input, rate-limit, timeout and DNS failures remain distinct evidence;
- source-row schema rejection is a hard publication failure rather than silent partial publication;
- the dataset evidence hash is derived from the actual returned dataset body.

## Canonical source policy

PA211 production identity and trust policy are defined once in `packages/source-adapters/src/pa211-source.ts` and reused by:

- API seed configuration;
- PA211 origin/source normalization;
- source-manifest metadata;
- the live smoke command.

That removes manual duplication of source ID, city identity, canonical URL, allowed origin, TTL and policy version across runtime boundaries.

## Source-state ownership

`transitionSourceState()` rejects illegal event/state combinations for normal operations, healing, review and publication. `CHECKING` accepts an idempotent `CHECK_STARTED` only to permit a new single-writer operation to recover from a persisted interrupted check; same-process overlap is rejected by `SourceOperationCoordinator` before the domain transition is reached.

Freshness reconciliation does not overwrite `CHECKING`, `HEALING` or `REVIEW_PENDING`, and startup explicitly reconciles interrupted persisted operations. Interrupted checks/healing cannot promote a candidate or replace the trusted pointer.

`SourceLifecycleService` owns freshness reconciliation, interrupted-operation recovery, trusted-snapshot context and healing-failure state calculation. `IngestionService` delegates those concerns instead of duplicating lifecycle persistence decisions.

## Runtime topology

The supported submission topology is explicit: one API writer process per SQLite database. The process-local source coordinator is not described as a distributed lock. See `docs/runtime-constraints.md`.

The publication transaction additionally uses a compare-and-set pointer update and monotonic run/observation checks. That means an accidentally delayed older proving run cannot replace a newer trusted publication even if execution escapes the normal process-local single-flight boundary.

## Transactional publication

`CoolPathRepository` keeps the final trust switch atomic. Candidate validation happens before publication; publication then verifies the proving run, rejects time-regressive publication, compare-and-sets the trusted pointer, supersedes the previous snapshot, promotes the candidate, publishes source state, resolves the active incident and records publication/recovery evidence in one SQLite transaction.

The repository no longer exposes the old `promoteSnapshot()` primitive that could move the pointer without the complete proving-run/state/evidence workflow.

Quarantined candidates remain outside the trusted pointer. A candidate whose run started before the currently trusted run, or whose observation timestamp would move public evidence backward, raises `PublicationConflictError` and leaves the trusted pointer unchanged.

## Persistence invariants

SQLite now enforces **at most one unresolved incident per source** with a partial unique index. `openIncident()` still merges evidence at the application boundary, but the invariant no longer depends solely on a prior read being race-free.

`reset()` is explicitly transactional: if any table deletion fails, the earlier deletions roll back instead of leaving a half-reset database.

Adversarial repository tests cover:

- older-run publication attempts;
- observation-time regression;
- unresolved-incident uniqueness at the SQLite boundary;
- rollback of a deliberately interrupted reset;
- corrupt persisted JSON failing closed.

## Runtime validation at persistence and network boundaries

Structured SQLite JSON is parsed as unknown and validated with domain schemas for source origins/state/mode, run disposition/reason codes/validation summaries, snapshot status/sites and incident healing data.

Persistence mapping also validates incident severity and timeline tone rather than asserting those strings into narrower TypeScript types.

The public API uses shared executable Zod read-model contracts, and the browser parses successful responses through those same contracts.

## Human-review evidence

The deterministic presenter exposes both decisions:

- **Approve and re-run** — apply the mock repair, rerun and require full validation before recovery;
- **Reject repair** — apply no selector change and keep the trusted snapshot protected.

The mock remains explicitly labelled as a deterministic fixture. It demonstrates CoolPath's publication boundary, not a fabricated live Bright Data repair.

## Coding-agent boundary

`CODEX.md` defines the safe operational contract for a coding agent working with the pinned Scraper Studio collector. `docs/evidence/coding-agent-scraper-studio.md` records concrete repository-side Scraper Studio workflow work while explicitly separating that evidence from a live provider run.

## CI

The canonical verification gate remains:

- ESLint;
- Prettier;
- strict TypeScript/typecheck;
- unit/integration tests;
- production builds, including the browser bundle;
- `git diff --check`;
- `git diff --check origin/main...HEAD`;
- independent Playwright desktop/mobile E2E;
- aggregate `CoolPath / full verification` status.

The final test count/status for the current HEAD must come from the final CI run; this document does not reuse an older green count as evidence for a newer commit.

## Preserved safety boundaries

- No real Bright Data credentials are committed or logged.
- No real provider call is made by deterministic CI.
- No source collector was recreated or replaced by this pass.
- Quarantined output cannot replace the trusted snapshot.
- A delayed older run cannot replace a newer trusted snapshot.
- Healing remains human-gated.
- Recovery publication requires a fresh proving run.
- The final real Bright Data verification remains a separate evidence gate and is not implied by green deterministic tests.
