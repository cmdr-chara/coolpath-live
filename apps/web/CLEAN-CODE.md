# CoolPath Live — jury-ready clean-code hardening

Date: 2026-08-19

This pass hardens CoolPath Live for **Best Clean Code** review without intentionally changing the product's public behavior, trusted-publication rules, source-normalization semantics, or deterministic demo flow. The work focuses on making architectural boundaries executable, removing duplicated policy, and turning previously compile-time-only assumptions into runtime contracts.

No real Bright Data collection was triggered during this hardening pass.

## Architecture boundaries

The domain package now separates two different concerns explicitly:

- `quality-contracts.ts` contains browser-safe quality vocabulary, DTO-facing types, and Zod schemas;
- `quality.ts` contains server-side quality policy and hashing, including the Node `crypto` dependency;
- `api-contracts.ts` defines the executable public API read-model contracts;
- `@coolpath/domain/api-contracts` exposes a browser-safe package subpath so the web application does not pull server-only dependencies into its bundle.

This makes the browser/server boundary visible in the module graph rather than relying on bundler behavior or developer convention.

## One executable contract across the network

Public read models are no longer trusted through TypeScript casts alone.

- The API validates city summaries, city detail payloads, and incident read models before they leave the server.
- The web client parses successful JSON responses as `unknown` and validates the same shared contract before using the payload.
- Frontend DTO types are inferred from those shared domain contracts instead of being maintained as a parallel hand-written object graph.
- Structured local timestamps use a shared `ZonedTimestamp` runtime schema, keeping timezone metadata and TypeScript types aligned with the actual payload.

The contract hardening exposed and fixed a pre-existing mismatch where local timestamp fields had been typed as strings even though the API returns structured timezone objects.

## Authoritative source-state policy

`transitionSourceState()` is now the policy authority for operational state changes.

The application and ingestion service derive state through domain events for:

- check start;
- successful publication and recovery;
- failed or inconclusive runs;
- freshness expiry;
- healing requests;
- healing preview readiness;
- healing rejection.

The repository persists the resulting state rather than independently deciding business-state transitions. This keeps transition policy in one domain function and makes the lifecycle easier to reason about and test.

## Transactional publication without duplicated mechanics

Snapshot publication still preserves the original atomic safety guarantees, but duplicated persistence mechanics were consolidated into one private publication primitive.

Both publication entry points now reuse the same transaction for:

- validating candidate ownership/status;
- superseding the previous trusted snapshot;
- promoting the candidate;
- advancing the trusted-snapshot pointer;
- applying the already-derived source state when appropriate;
- resolving the current incident;
- writing the recovery/publication timeline proof.

This removes the former duplication between ordinary snapshot promotion and the full publication workflow without weakening the trusted-publication boundary.

## Runtime validation at persistence boundaries

Structured JSON read from SQLite is no longer recovered primarily through unchecked `JSON.parse(...) as Type` assertions.

Repository mapping now validates key stored values with domain schemas, including:

- source allowed origins, mode, and state;
- run disposition, reason codes, and validation summary;
- snapshot status and cooling-site records;
- incident reason codes, healing state, and healing diff.

Corrupt or incompatible persisted representations therefore fail at the repository boundary rather than silently entering the application as trusted typed values.

## Explicit quality policy

Previously anonymous quality thresholds are now named policy constants:

- minimum retained yield ratio;
- maximum expected yield ratio;
- optional-coverage drop threshold;
- minimum retained identity ratio;
- suspicious-content-change ratio.

The numerical policy is unchanged; the intent is now readable directly from the implementation.

## Frontend preservation

The existing Civic Clarity frontend separation remains intact:

- `App.tsx` remains the composition/orchestration layer;
- public and technical views remain responsibility-based components;
- demo mutations continue to reload authoritative backend state rather than fabricate lifecycle state in React;
- deterministic presenter controls remain mock-only;
- public search continues to filter only the already-published trusted snapshot.

The new network contracts strengthen this boundary without changing the visible UI hierarchy.

## CI as one canonical verification gate

The verification workflow no longer runs lint, format, typecheck, tests, and build individually and then repeats them through `pnpm verify`.

The `verify` job now uses `pnpm verify` as the single canonical application gate, followed by repository diff checks. Playwright remains an independent end-to-end gate, and the aggregate commit status requires both jobs to succeed.

## Final verification evidence

The hardened code candidate at `f8712c9e9e185e9caecfb32eb2d8f8e02313f719` passed the complete pull-request verification suite against `main`:

- ESLint;
- Prettier;
- strict TypeScript/typecheck across the workspace;
- **80/80 unit and integration tests across 10 test files**;
- production builds, including the browser bundle;
- `git diff --check`;
- `git diff --check origin/main...HEAD`;
- **Playwright 10/10** across the configured end-to-end projects;
- aggregate `CoolPath / full verification` status successful.

The final documentation commit is also required to pass the same CI gate before the pull request is considered review-ready.

## Preserved safety and product boundaries

- No real Bright Data collection was triggered by this pass.
- No source collector configuration was mutated as part of this work.
- Quarantined candidates still cannot replace the last trusted published snapshot.
- Publication remains transactional.
- Healing still requires explicit review/approval before a repaired collector can prove itself through a fresh validated run.
- Freshness reconciliation retains historical evidence instead of presenting expired data as newly verified.
- The existing public, technical, mock, and real-mode product boundaries remain intact.

The result is intentionally not a maximal file-splitting exercise. The hardening concentrates decision-making at the correct boundaries while preserving the tested behavior of the working hackathon system.
