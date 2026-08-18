# CoolPath Live — final frontend visual QA

Date: 2026-08-18

This review compares the implemented `frontend/reference-led-redesign` against the rendered baseline in `BASELINE-AUDIT.md` and the design contract in `DESIGN.md`.

The application was rendered with Chromium in GitHub Actions against the deterministic mock API. Screenshots were inspected for public/technical desktop and mobile states, search, evidence inspection, drift/quarantine, repair review, and recovery. The screenshot workflow was temporary and is removed after this review; normal CI remains the merge gate.

## Public directory

### 1440×1000 — pass

- The page begins with the actual civic task, not an editorial hero.
- `Demo City cooling locations`, verification state, update time, source link, and search are visible before the list.
- Location records begin materially higher than in the old baseline.
- Rows read as search/list results rather than cards or magazine entries.
- Ornamental numeric indices and serif display typography are gone.
- Evidence remains a secondary action rather than competing with facility identity.
- No row changes its horizontal padding on hover.

### 390×844 — pass

- Compact header and view switcher remain usable.
- Task title, source status, update/source link, and search fit before the records.
- The first real location record is fully visible in the initial viewport and the second record begins within it.
- Search input uses 16px mobile text and Evidence actions provide a 44px touch target.
- No horizontal page overflow was observed.

### Search — pass

- Search filters only the already-loaded trusted snapshot.
- Result count updates through an `aria-live` region.
- Name/address matching is case-insensitive.
- Empty search results are literal and do not invent alternative data.
- Clearing search restores the complete trusted list.
- Playwright now covers this behavior.

### Evidence inspector — pass

- Existing Radix Dialog focus semantics are preserved.
- Desktop inspector is a compact right-side sheet instead of an oversized editorial drawer.
- Source status, record identity, address, temporal claim, observation time, evidence host, and explicit claims remain readable.
- The underlying directory remains visually recognizable as context.
- Escape closes the sheet and focus returns to the triggering Evidence button; existing Playwright coverage remains green.

## Source integrity view

### 1440×1000 healthy — pass

The previous baseline placed the publication pipeline below a giant title, metadata grid, status band, and presenter console. The redesigned first viewport now contains:

1. source state and identity;
2. Collector ID, mode, and source host;
3. four high-level verification/publication metrics;
4. the complete Source → Scraper Studio → Validation → Published snapshot path;
5. the quarantine branch;
6. then the deterministic presenter controls.

Healthy state is intentionally quiet. `No unresolved incident` is a bounded supporting status rather than a permanent high-emphasis dashboard block.

The latest alignment cleanup makes two additional corrections:

- the deterministic presenter heading, explanatory copy, and four-step control surface share a centered desktop axis rather than splitting title left / explanatory copy right;
- the healthy incident surface no longer stretches to the height of the adjacent run-facts card. The grid aligns items to the start, gives the healthy state a smaller column, and renders the no-incident content as a compact status strip. The larger incident treatment is retained only when an incident actually exists.

### 390×844 healthy — pass

- Source state, Collector ID, mode/source, four metrics, and the beginning/full structure of the vertical publication path are visible before presenter controls dominate the experience.
- Long Collector IDs sit in a full-width metadata row instead of wrapping inside a narrow fixed tile.
- The pipeline becomes a real vertical stepper without horizontal scrolling.
- Presenter controls return to left-aligned scanning on mobile even though the desktop version is centered.

### Drift / quarantine — pass

Desktop visual QA confirms the intended semantic contrast:

- source status becomes warning-colored;
- latest run metrics expose the degraded candidate (`1` row, `0%` required fields, `5` reason codes in the deterministic fixture);
- only the Validation step becomes critical/red;
- Published snapshot remains separately green/trusted with the last trusted records;
- quarantine branch becomes explicit and critical;
- incident panel becomes visually dominant only while an incident exists;
- internal healing state is not used as the primary user-facing incident title; the UI says `Candidate quarantined` or `Repair review pending` as appropriate.

The mobile post-action viewport keeps the failed validation/quarantine path and presenter controls in context rather than forcing a return to an oversized top-of-page heading.

### Repair review — pass

- Status clearly says manual approval is required.
- Quarantine remains visible until recovery actually validates.
- Selector changes remain a true comparison table.
- The repair panel does not imply that preparing a selector diff has already published new data.

### Recovery — pass

- Source state returns to the positive recovered state.
- Validation and Published snapshot return to the passing path.
- Quarantine returns to clear.
- Incident panel collapses back to the quiet healthy/no-unresolved-incident treatment.

## Motion and micro-interaction pass

Amicro was reviewed as a useful catalogue of interaction patterns, but CoolPath does not add Motion/Framer because the repository already ships GSAP and `@gsap/react`.

The implemented motion pass uses the existing stack for:

- short entrance sequencing of top-level public/technical sections;
- smaller staggered reveals for location rows, metrics, and pipeline steps;
- bounded search focus feedback;
- small button/row/pipeline hover and press feedback;
- directional arrow movement on evidence/source actions;
- a one-shot source-status arrival pulse.

Motion is deliberately absent from correctness and navigation semantics. There is no scroll-jacking, parallax, looping decorative background, text scrambling, magnetic cursor, or long staged intro. `prefers-reduced-motion: reduce` disables the GSAP entrance sequence and decorative CSS transitions.

Wide-screen centering is selective rather than global: public task/header/search content uses a centered axis, while location records remain left-aligned for scanning. Technical metadata and pipeline data remain structured rather than turning into centered marketing copy. Mobile returns to left-aligned reading flow.

## Accessibility and interaction checks

Validated through existing/new Playwright flows and visual inspection:

- URL-backed Public / Technical navigation;
- browser history restoration;
- skip link retained;
- visible focus rules retained;
- Evidence dialog focus trap, Escape, and focus restoration;
- mobile first-location viewport requirement;
- client-side trusted-snapshot search;
- drift → quarantine → review → recovery behavior;
- no live Bright Data calls in E2E or visual QA.

## Final comparison with baseline acceptance criteria

1. Public 390×844 reaches the first real location row: **pass**.
2. Public desktop records begin materially higher: **pass**.
3. Display serif and ornamental row numbers removed: **pass**.
4. Technical desktop complete high-level pipeline in first viewport: **pass**.
5. Technical mobile state/metrics/pipeline precede controls: **pass**.
6. Collector IDs no longer wrap in narrow provenance tiles: **pass**.
7. Evidence inspection does not overpower the directory: **pass**.
8. Healthy state is quieter than degraded/quarantined state: **pass**.
9. No hover-driven horizontal layout shift: **pass**.
10. Product still preserves CoolPath provenance/trust semantics: **pass**.
11. Presenter controls use a centered desktop composition while retaining mobile scanning: **pass**.
12. Healthy incident status no longer stretches into an empty dashboard card: **pass**.

## Remaining non-visual constraints

- This redesign does not change backend/API behavior.
- Mock states remain explicitly deterministic fixtures.
- No real Bright Data post-refactor result is inferred from these screenshots.
- Final real Bright Data evidence remains a separate submission gate documented elsewhere in the repository.
