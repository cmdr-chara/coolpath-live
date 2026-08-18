# Contributing to CoolPath Live

CoolPath is a small system with a strict trust boundary: untrusted source output may become public only after normalization, validation and transactional publication. Preserve that boundary when making changes.

## Ten-minute setup

Requirements: Node.js 22 or newer and pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://127.0.0.1:8787` by default. Mock mode is the default and needs no credentials or network access.

Before opening a change, run:

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

## Read the repository in this order

1. [`README.md`](README.md) — product purpose, local workflow and public contracts.
2. [`docs/architecture.md`](docs/architecture.md) — trust boundaries, state machine and publication flow.
3. [`docs/source-policy.md`](docs/source-policy.md) — source acceptance and counting semantics.
4. [`apps/api/src/app.ts`](apps/api/src/app.ts) — application composition and owned-resource lifecycle.
5. [`packages/domain/src`](packages/domain/src) — canonical contracts, quality gates and source transitions.
6. [`packages/db/src/repository.ts`](packages/db/src/repository.ts) — persistence operations and atomic publication.

## Module boundaries

| Area                       | Owns                                                                    | Does not own                                            |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/web`                 | rendering, interaction, query invalidation and accessible presentation  | source validation, credentials or publication decisions |
| `apps/api`                 | HTTP composition, authentication, probes, orchestration and safe errors | canonical data rules or raw SQL schema history          |
| `packages/domain`          | schemas, quality policy, freshness and state transitions                | HTTP, persistence or provider transport                 |
| `packages/source-adapters` | provider transport and source-specific normalization                    | publication or public response shaping                  |
| `packages/db`              | migrations, persisted evidence and transactional publication            | provider calls or UI behavior                           |
| `packages/test-fixtures`   | deterministic synthetic evidence used by tests and demo mode            | production source records                               |

Within the API, `app.ts` assembles dependencies. HTTP response helpers, error mapping and route groups live in focused modules. Business lifecycle logic belongs in `IngestionService`; persistence invariants belong in `CoolPathRepository`.

### Dependency direction

Applications may depend on workspace packages; workspace packages never depend on applications. The domain package has no HTTP, database or provider dependencies. Infrastructure packages consume domain contracts through their public entrypoints rather than reaching into another package's private files.

Within `apps/api`, route modules translate HTTP input into service calls. They do not perform provider requests or persistence mutations directly. `app.ts` wires concrete dependencies and owns only resources it creates.

## Edge-first rules

Handle uncertain input once, at the boundary where it enters:

- Parse environment variables in `config.ts`.
- Parse route params and request bodies with Zod in route modules.
- Parse provider envelopes and enforce complete-operation timeouts in source adapters.
- Normalize source-specific rows before passing them to domain validation.
- Convert internal failures to stable public errors in `error-handler.ts`.
- Keep raw rejected records, tokens, prompts and provider payloads out of public responses and logs.

Do not accept arbitrary source URLs or collector IDs from public callers. Public reads must follow `publishedSnapshotId`; candidate and quarantined snapshots are never public.

## Invariants that must remain true

1. A candidate is normalized and validated before publication.
2. `review_required`, quarantined and inconclusive runs never replace the trusted snapshot.
3. Publication, source-state mutation and incident resolution stay atomic.
4. Transport failures are inconclusive evidence, not proof of layout drift.
5. Expired snapshots become historical without being deleted or silently refreshed.
6. Public `GET` requests never launch paid Bright Data work.
7. Healing requires manual approval and a fresh validated proving run.
8. Tests and CI never contact Bright Data.
9. Credentials remain server-side and redacted.
10. Real and mock modes remain explicit in behavior and presentation.

## Common change recipes

### Add a public response field

1. Add the field from trusted persisted data only.
2. Update the matching frontend type.
3. Confirm the semantic ETag changes when the field changes.
4. Add an API contract test and, when visible, an E2E assertion.

### Add or change a source adapter

1. Document the source and its bounded coverage in `docs/source-policy.md`.
2. Add a source-specific schema and normalizer.
3. Restrict evidence to approved HTTPS origins.
4. Add deterministic fixtures for accepted, filtered, duplicate and rejected rows.
5. Keep publication decisions in the domain/service layers.

### Change persistence

1. Add a new numbered SQL migration; never rewrite an applied migration.
2. Keep repository methods transactional when multiple facts must change together.
3. Test an empty database, repeated initialization and a representative existing database.
4. Preserve existing rows and the `publishedSnapshotId` trust boundary.

### Change ingestion or healing

Model the full lifecycle in a regression test: baseline, operation, candidate disposition, persisted evidence, source state, incident state and public snapshot. Include the failure path that must preserve the previous trusted snapshot.

## Test organization

Tests are colocated with the boundary they prove:

- domain tests prove pure policy and state transitions;
- source-adapter tests prove parsing, normalization, timeout and abort behavior;
- repository tests prove migrations, ordering and atomic persistence;
- API tests prove routing, auth, caching, readiness and lifecycle orchestration;
- Playwright tests prove the integrated browser experience.

Prefer injectable clocks, controlled promises and deterministic fake clients. Avoid sleeps, wall-clock assumptions and live network requests.

## Pull-request checklist

- The change has one clear responsibility.
- New uncertainty is handled at an existing edge or a deliberately named new edge.
- Public contracts and security boundaries are preserved or explicitly documented.
- Failure behavior has regression evidence.
- Documentation matches runtime behavior.
- No secret, database file, coverage output or Playwright artifact is included.
- The full verification suite passes.
