# CoolPath Live — frontend visual QA

Date: 2026-08-18

This review records the visual acceptance work for `frontend/reference-led-redesign`. The current direction is the approved **Civic Clarity / Concept 1** treatment: a calm civic product with real product hierarchy, restrained motion, and local decorative artwork rather than a generic dashboard aesthetic.

The application was rendered with Chromium in GitHub Actions against the deterministic mock API. The successful image-led QA run captured public desktop/mobile plus technical healthy/drift states. Later refinements only add the circular facility marker and tighten presenter alignment; the normal CI/Playwright suite remains the merge gate for those code changes.

## Art direction

The final implementation deliberately avoids both the old editorial/newsprint treatment and a generic equal-card AI dashboard.

Three local SVG artworks provide visual variety without remote dependencies:

- `assets/philadelphia-park.svg` — public cooling-directory hero;
- `assets/civic-building.svg` — technical verification-facts surface;
- `assets/bridge-river.svg` — technical trust/provenance surface.

The images are decorative and do not assert weather, location availability, operating status, or historical run data. The UI continues to display only facts supported by the existing API/domain model.

## Public directory

### Desktop — pass

- The hero image lives **inside the same product container** as the task copy, verification state, source provenance, and search.
- The composition is asymmetric rather than mathematically centered: copy leads on the left and the park/skyline art supplies context on the right.
- The headline is `Cooling locations you can count on`; it is product-facing rather than an internal system label.
- Search is part of the hero task flow instead of a detached utility block.
- Verification state, last/current report language, observed time, and source remain visible without inventing availability.
- Location results remain left-aligned and scan-friendly below the hero.
- Each location receives a small circular civic marker; the marker adds recognition without turning every row into a large card illustration.
- Evidence remains a secondary action.

### Mobile — pass

- The same hero artwork becomes a subdued in-container background instead of a tall standalone image, preserving task density.
- Task title, status/source metadata, and search remain ahead of the results.
- The successful image-led render still reached the first real location in the initial 390×844 viewport.
- Input text remains at least 16px and Evidence controls retain touch-friendly sizing.
- Dense results return to conventional left alignment.

### Search — pass

- Search filters only the already-published trusted snapshot.
- Result count updates through an `aria-live` region.
- Name/address matching is case-insensitive.
- Empty results remain literal and do not invent alternatives.
- Clearing search restores the complete trusted list.

### Evidence inspector — pass

- Existing Radix Dialog focus semantics are preserved.
- The right-side inspector remains contextual rather than becoming another full dashboard page.
- Escape closes the inspector and focus returns to the triggering Evidence control.

## Source integrity

### Healthy desktop — pass

The healthy technical view no longer renders a `No unresolved incident` card at all.

The visual hierarchy is:

1. source integrity + current source status;
2. Collector ID, mode, and canonical source;
3. four publication/validation metrics;
4. Source → Scraper Studio → Validation → Published boundary;
5. varied evidence surfaces: verification facts, latest activity, published snapshot, and trust/provenance;
6. deterministic presenter controls at the end.

The verification-facts surface contains its own civic-building artwork. The trust surface uses separate bridge/river artwork. This prevents the technical view from visually repeating the public hero and gives sections distinct identities.

No fake recent-run chart or unsupported temperature value is rendered: the current API does not expose those facts.

### Healthy mobile — pass

- Source status and Collector metadata remain first.
- Metrics and the publication path precede presenter controls.
- The pipeline becomes a vertical stepper.
- Technical imagery collapses responsively without becoming the main mobile task.

### Drift / quarantine — pass

The successful image-led drift render confirms:

- warning source status becomes prominent;
- the deterministic degraded candidate exposes its actual mock metrics/reason counts;
- only the failed validation/candidate path becomes critical;
- the last trusted Published step remains visually distinct;
- quarantine becomes explicit;
- a dedicated incident feature appears **only while an incident exists**;
- the incident title is product-facing (`Candidate quarantined`, `Repair review pending`, or `Repair in progress`).

Healthy state therefore has no empty incident placeholder, while failure state has enough visual weight to be immediately legible.

### Repair and recovery — preserved

- Selector changes remain a comparison table when a repair preview exists.
- Preparing a repair never implies publication.
- Approval/re-run still must validate before the new snapshot can publish.
- On recovery, the incident feature disappears and the normal trust surfaces remain.

## Presenter controls

The presenter is intentionally a separate bottom band rather than a primary dashboard card.

Desktop:

- heading and explanatory copy share a centered axis;
- four steps form one continuous control surface;
- icon/text groups are optically centered inside each step;
- step numbers remain small positional metadata.

Mobile returns to left-aligned controls for scanning and touch use.

## Motion and micro-interactions

Amicro was used as an interaction reference, but CoolPath keeps its existing GSAP + `@gsap/react` stack instead of adding Motion/Framer.

Implemented motion remains restrained:

- short entrance sequencing for top-level sections;
- small stagger for location rows, metrics, and pipeline steps;
- bounded focus/hover/press feedback;
- directional arrow feedback;
- one-shot status arrival feedback.

There is no scroll-jacking, parallax, looping decorative animation, magnetic cursor, or animation required for correctness. `prefers-reduced-motion: reduce` disables the decorative motion layer.

## Accessibility and interaction checks

Covered by the existing/new Playwright flows and implementation review:

- URL-backed Public / Technical navigation;
- browser-history restoration;
- skip link and focus-visible rules;
- Evidence focus trap, Escape, and focus restoration;
- mobile first-location viewport requirement;
- trusted-snapshot search;
- drift → quarantine → review → recovery semantics;
- no live Bright Data calls in E2E/visual QA.

## Acceptance summary

1. Public art is contained inside the hero rather than floating outside the product surface: **pass**.
2. Public and technical views use different artwork: **pass**.
3. Technical view has visual variety without inventing unsupported data: **pass**.
4. Healthy view contains no `No unresolved incident` placeholder: **pass**.
5. Incident UI exists only for an actual incident state: **pass**.
6. Public mobile still reaches a real location in the initial viewport in the successful Concept 1 render: **pass**.
7. Technical mobile prioritizes source state/metrics/pipeline before controls: **pass**.
8. Published snapshot remains distinct from a failed candidate: **pass**.
9. Presenter controls are secondary and optically centered on desktop: **pass by implementation constraint; final micro-refinement is CI-gated**.
10. Product provenance and safety boundaries remain unchanged: **pass**.

## Remaining non-visual constraints

- This branch changes frontend presentation only; backend/API/domain/database behavior is unchanged.
- Mock states remain explicitly deterministic fixtures.
- These screenshots do not prove the pending real post-refactor Bright Data run.
- Final live Bright Data evidence remains a separate submission gate documented elsewhere in the repository.
