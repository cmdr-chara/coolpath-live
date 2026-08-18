# CoolPath Live — frontend clean-code preservation pass

Date: 2026-08-18

This pass cleaned the approved **Civic Clarity / Concept 1** frontend without intentionally changing its product behavior, visual hierarchy, backend publication semantics, or mock/real boundary.

## Data flow

- `GET /api/cities/:slug` is now the single page read model for city/source/snapshot/latest-run/incident/timeline data.
- The redundant initial `GET /api/incidents/:sourceId/current` request was removed from the web client because the city payload already includes the current incident.
- Demo mutations still invalidate and reload the city read model from the backend rather than fabricating state in React.
- Real mode and mock mode continue to use the same frontend/backend contract; deterministic presenter controls remain mock-only.

## Type boundary

The web package now depends on `@coolpath/domain` and reuses the existing domain types for:

- `CoolingSite`;
- `ExplicitClaim`;
- `TemporalClaim`;
- `SourceState`;
- `SnapshotStatus`;
- `QualityDisposition`;
- `ReasonCode`.

Frontend API DTOs are named read models (`CityIdentity`, `SourceReadModel`, `PublishedSnapshot`, `LatestRun`, `RunValidationSummary`, and related types) instead of one large anonymous object graph. Stringly typed run/snapshot state fields were replaced with the existing domain unions where the backend contract supports them.

## Component responsibilities

The former monolithic `TechnicalView.tsx` is now a composition root over three responsibility-based units:

- `TechnicalOverview` — source identity, publication metrics, pipeline, and quarantine branch;
- `TechnicalIncident` — incident details and selector repair review;
- `TechnicalEvidence` — verification facts, activity, published snapshot, and provenance/trust evidence.

`StatusBanner.tsx`, which was no longer referenced by the current UI, was removed.

## Stylesheet cleanup

The iterative design work had accumulated cascade debt. The cleanup:

- consolidated the final Concept/refinement/distill layers into the semantic `civic.css` stylesheet;
- reduced the entrypoint from eight stylesheet imports to six: `base`, `technical`, `support`, `responsive`, `interaction`, and `civic`;
- removed obsolete selectors from the pre-Civic directory/technical implementations, including the old status banner, integrity header/state/identity, operations/register/timeline groups, and obsolete directory-intro shell;
- removed 22 unused legacy custom-property aliases from the earlier migration layer;
- removed empty media/support blocks left after dead-selector deletion;
- ran Prettier over the resulting CSS instead of leaving cleanup-generated formatting artifacts.

The final stylesheet split is based on responsibility rather than chronological patches.

## Dependencies and motion

- Removed the unused Newsreader font dependency; Geist remains the only loaded UI font package.
- `useEntranceMotion` now queries motion targets explicitly below its supplied React scope instead of relying on selector context implicitly.
- GSAP behavior and `prefers-reduced-motion` support remain unchanged in intent.

## Visual regression evidence

After the cleanup, Chromium rendered the same deterministic mock states used by the accepted pre-cleanup distill pass:

- Public desktop — 1440 px;
- Public mobile — 390 × 844;
- Technical healthy desktop — 1440 px;
- Technical healthy mobile — 390 × 844;
- Technical drift/quarantine desktop — 1440 px.

All five post-cleanup captures have the same dimensions as their pre-cleanup baselines. Side-by-side review found no structural layout shift, missing content, changed hierarchy, or container regression. The visible differences in the technical captures are expected dynamic mock values such as run timestamps and generated IDs, not presentation changes.

The temporary visual-regression workflow uploaded the evidence artifact and removed itself from the branch. Normal CI/Playwright remains the final merge gate.

## Preserved boundaries

- No backend, database, ingestion, Bright Data collector, publication-gate, or source-normalization behavior was changed by this pass.
- No real Bright Data collection was triggered.
- Public search still filters only the already-published trusted snapshot.
- Drift/heal/recovery remains deterministic mock/demo behavior in the frontend controls.
- The separate post-refactor real Bright Data verification is still pending and is not implied by this cleanup.
