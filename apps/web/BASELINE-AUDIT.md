# CoolPath Live — rendered frontend baseline audit

Captured from the mock application on `frontend/reference-led-redesign` before any application UI changes. The screenshots were generated automatically with Chromium in GitHub Actions at 1440px desktop and 390px mobile widths.

This document records what is visibly wrong in the rendered product so the redesign can be compared against a concrete baseline.

## 1. Public view — desktop

The loaded public view confirms that the current composition reads as an editorial feature before it reads as a service.

Observed problems:

- The serif `Cooling locations` display dominates the upper page and consumes attention that should belong to the actual location records.
- The large two-column intro/provenance composition places explanation and metadata ahead of the user’s primary task.
- The cream paper background, hairline rules, italic red record numbers, and serif section headings collectively create a magazine/archive aesthetic rather than a current civic utility.
- The `Location records` heading is again display-scale, creating a second visual hero before the first record.
- Repeated rows use too many simultaneous columns: ordinal, identity/address, temporal claim, explicit claims, and evidence action. This is visually expensive for only three demo records and will become harder to scan with the real 23-record snapshot.
- Row hover currently changes horizontal padding, so hover affects layout instead of only state styling.
- The limitations note is appropriate content but visually reads like another editorial footnote rather than a concise service constraint.

Implication:

The redesign should reduce the public preamble to one compact task header + status/source line + search, then start the records immediately.

## 2. Public view — 390px mobile

This is the clearest evidence that the current visual hierarchy is wrong.

Observed problems:

- `Cooling locations` occupies roughly the first third of the content viewport by itself.
- The user sees a large explanatory paragraph and a 2×2 provenance grid before reaching any actual location.
- `Location records` becomes another large two-line serif heading, again consuming scarce mobile vertical space.
- The first actual facility begins only near/below the first viewport boundary.
- The two-item header navigation is visually cramped and underweighted compared with the giant page title.
- Provenance cells are readable but feel like administrative metadata placed too early in the flow.
- The record ordinal `01` is visually prominent despite carrying no task value.

Implication:

On mobile, the first viewport should contain: compact header, city/title, current source status, search, and at least the beginning of the first real location row.

## 3. Evidence drawer — desktop

The evidence interaction is conceptually correct but the visual treatment inherits the oversized editorial language.

Observed problems:

- The inspector occupies about half the viewport and the huge serif facility title dominates its contents.
- The drawer’s typographic scale and provenance grid compete with the underlying directory instead of feeling like secondary inspection detail.
- With the overlay active, both the underlying record layout and drawer contain many thin rules, small mono labels, and large serif headings, producing visual interference.
- The drawer does successfully preserve list context, keeps a visible close control, and reflects the correct source/evidence boundary. Those behaviors should be retained.

Implication:

Keep the right-side inspector pattern, but make it compact and utilitarian: Geist Sans, one small status line, bounded evidence facts, explicit source link, and no display-serif treatment.

## 4. Technical view — 1440px desktop

The technical view currently spends the first viewport explaining itself instead of showing the publication system.

Observed problems:

- `Publication control room` is enormous and occupies the most prominent visual position even though the source state/pipeline is the actual product proof.
- The intro metadata grid duplicates facts that can fit into a compact top summary.
- A large status band and large presenter-control section appear before the pipeline.
- The pipeline begins only near the bottom of the first screenshot, which means the strongest Bright Data / trust-boundary proof is initially below the fold.
- Presenter controls are stretched across the full page even when only two actions are enabled.
- Healthy state still receives a large amount of permanent chrome; the interface does not become quiet when nothing is wrong.

Implication:

The technical first viewport should show source state, Collector ID, run/publication metrics, and the complete four-step pipeline. Presenter controls should be compact and contextual, and the incident surface should expand only when an incident exists.

## 5. Technical view — 390px mobile

Observed problems:

- `Publication control room` again uses oversized serif display type and dominates the screen.
- Source/collector/public-report/mode are forced into a 2×2 grid; the long collector identity wraps awkwardly inside a narrow fixed cell.
- The current source status consumes another full-width block before any pipeline content.
- The `Drift → quarantine → review → recovery` presenter heading is large and wraps across multiple lines.
- The actual publication pipeline is not visible in the first mobile viewport.
- The view therefore behaves like documentation about the system rather than a compact system interface.

Implication:

Mobile technical UI should use a vertical compact stepper with source state and metrics first, then contextual incident/recovery controls.

## 6. What should survive the redesign

The current frontend has strong behavioral foundations. Do not throw them away while changing presentation.

Keep:

- Public / Technical separation and URL-backed navigation.
- Skip link and visible focus behavior.
- Evidence drawer focus trap and return-focus behavior.
- Honest source attribution and limitations.
- Mock mode labeling.
- Real vs deterministic state distinction.
- Published-snapshot / quarantine semantics.
- Reason codes, selector diff, and timeline in the technical view.
- No geolocation, no “nearest”, no inferred availability.

## 7. External screenshot/reference comparison

### Linear

Publicly indexed Linear project and cycle screenshots show a useful contrast with the current CoolPath technical view:

- information is dense but supporting chrome recedes;
- tabs and state labels are compact;
- page identity is not expressed through giant editorial typography;
- related metadata aligns into small predictable zones;
- central task content stays visually dominant;
- side/detail surfaces provide secondary context without rebuilding the whole page as cards.

Linear’s own redesign writing describes reducing visual noise while increasing hierarchy, alignment, and navigation density. That is directly applicable to CoolPath’s technical view.

Reference sources:

- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://linear.app/now/behind-the-latest-design-refresh
- https://linear.app/docs/project-overview

### NHS service finder / NHS design system

Publicly indexed NHS service-finder screenshots show the opposite useful reference for CoolPath’s public view:

- literal user-task headline;
- search is immediately obvious;
- strong contrast and visible controls;
- minimal decorative typography;
- the page does not require the user to understand the system before using the service.

Reference sources:

- https://service-manual.nhs.uk/design-system/components/search-input
- https://service-manual.nhs.uk/design-system/styles/focus-state

### Vercel Web Interface Guidelines

Relevant implementation details:

- keyboard operation everywhere;
- visible focus rings;
- native elements before reconstructed ARIA widgets;
- ≥44px mobile touch targets;
- ≥16px mobile input text;
- tabular numerals for comparable metrics;
- focus management for overlays.

Reference:

- https://vercel.com/design/guidelines

### USWDS

Relevant civic-information semantics:

- alerts are for meaningful status, not decoration;
- lists are appropriate for variable-length records;
- tables are appropriate when consistent column comparison is the task;
- summary boxes should surface bounded key information rather than framing entire sections.

Reference:

- https://designsystem.digital.gov/components/overview/

## 8. Baseline acceptance test for the redesign

The redesign is a real improvement only if screenshots show all of the following:

1. At 390×844, the first public viewport reaches the first real location row.
2. At 1440×1000, public records begin materially higher than in the current baseline.
3. The public UI no longer contains display serif typography or ornamental record numbers.
4. At 1440×1000, the complete high-level technical pipeline is visible in the first viewport.
5. At 390×844, technical source state and at least the beginning of the pipeline are visible before presenter controls dominate the screen.
6. Long Collector IDs do not wrap inside narrow fixed metadata tiles.
7. Evidence inspection remains available without visually overpowering the directory.
8. Healthy state is visibly quieter than degraded/quarantined state.
9. No interaction introduces horizontal layout shifts on hover.
10. The result still reads unmistakably as CoolPath, but now as a live product rather than an editorial prototype.
