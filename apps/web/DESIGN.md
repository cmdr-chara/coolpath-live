# CoolPath Live — frontend design contract

Status: design source of truth for `frontend/reference-led-redesign`.

This document turns the current frontend, external UI references, and current OpenAI frontend guidance into an implementation contract. It is intentionally more specific than a mood board: every visual decision should be testable in rendered desktop and mobile screenshots.

## 1. Product thesis

CoolPath is a **civic utility with a source-integrity console**, not an editorial site, marketing landing page, newspaper, or decorative dashboard.

The public experience should feel immediate, trustworthy, quiet, and easy to scan under stress. The technical experience should feel like an operational control surface: information-dense, aligned, calm when healthy, and visually decisive only when something is wrong.

### Visual thesis

> Cool, precise civic infrastructure: neutral white/gray surfaces, compact Geist typography, one restrained blue brand accent, semantic status colors only when status matters, and almost no decorative chrome.

### Interaction thesis

1. Public users should reach the location list immediately and be able to narrow it by name/address without learning the system.
2. Evidence should open in a right-side inspector without losing list context.
3. Technical users should understand the publication path in one scan and only see large incident/recovery controls when there is actually an incident.

## 2. Primary audiences and jobs

### Public user

Likely question: “What cooling locations are published for Philadelphia, and where did this information come from?”

The interface should optimize for:

- locating a facility by name or address;
- reading source-published claims without inferred availability;
- understanding whether the list is currently trusted, historical, degraded, or unavailable;
- opening evidence/provenance for a specific row;
- following the canonical source when needed.

It should **not** ask the user to understand collectors, validation reason codes, snapshots, or healing.

### Judge / technical reviewer

Likely question: “Is Bright Data genuinely on the critical path, and what happens when extraction is wrong?”

The technical view should optimize for:

- seeing source → Scraper Studio → validation → published snapshot in one compact composition;
- verifying Collector ID, run counts, outcome, coverage, reason codes, and source state;
- seeing quarantine clearly when active;
- inspecting a repair diff and recovery timeline without drowning in permanent dashboard panels.

## 3. Current interface problems to remove

The existing frontend is functional and accessible, but its visual language over-indexes on editorial presentation.

### Typography

Current issues:

- `Newsreader Variable` is used as an expressive display serif for major headings and row indices.
- H1s scale with viewport width (`vw`) up to roughly 6rem.
- Heading line-height falls below 1 and letter spacing is strongly negative.
- Technical and public headings are much larger than their operational importance warrants.

Target:

- Geist Sans for all UI and display text.
- Geist Mono only for machine-readable identifiers, timestamps where alignment matters, reason codes, and compact metadata.
- No serif in the application UI.
- No `vw` font sizing.
- `letter-spacing: 0` for normal UI text. Uppercase metadata may use a very small positive tracking only when needed for legibility; never negative tracking.

### Palette

Current issues:

- cream/beige paper surfaces dominate the entire application;
- the result reads as a designed publication rather than a live civic service;
- green is simultaneously brand language and semantic status language.

Target:

- neutral cool background;
- white primary surface;
- blue brand accent;
- green/amber/red reserved for semantic source state;
- dark technical surfaces used sparingly, not as a permanent “cyber dashboard” aesthetic.

### Layout

Current issues:

- public intro behaves like an editorial hero with oversized title and large provenance block;
- every location row has four strong columns and an ornamental numbered index;
- technical view uses multiple large “boards”, “registers”, and boxed regions with equal visual weight;
- pipeline nodes are permanently oversized even when the source is healthy;
- explanatory copy competes with the actual tool.

Target:

- usable product is the first screen;
- compact page header, status strip, search, then records;
- repeated rows are list/table-like, not cards;
- technical view uses a compact summary and progressive disclosure;
- an active incident is allowed to become visually dominant; an absent incident should recede.

## 4. External reference audit

These references are not templates to copy. They are used to extract reusable interaction and hierarchy decisions.

### A. Linear — dense operational UI

Sources:

- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://linear.app/now/behind-the-latest-design-refresh
- https://linear.app/docs/project-overview
- https://linear.app/docs/filters

Observed reference screenshots from public image search included Linear project/cycle views with compact tabs, muted supporting chrome, aligned metadata, a strong central task surface, and low-radius controls.

Useful lessons for CoolPath:

- keep the central task louder than navigation and orientation chrome;
- maintain information density without giving every fact a separate card;
- align metadata into predictable columns/rows;
- use compact tabs/segmented view switching rather than large navigation treatments;
- use side inspectors for secondary detail so primary context remains visible;
- let healthy/default states feel quiet.

Do **not** copy:

- dark mode as the default public experience;
- issue-tracker terminology or card layouts;
- excessive keyboard-only affordances inappropriate for a public civic service.

### B. NHS service finder / NHS design system — literal public-service task design

Sources:

- https://service-manual.nhs.uk/design-system/components/search-input
- https://service-manual.nhs.uk/design-system/components/header
- https://service-manual.nhs.uk/design-system/styles/focus-state
- https://service-manual.nhs.uk/design-system/components/checkboxes

Observed public service-finder screenshots use a literal task heading, prominent search, high-contrast controls, direct language, and very little decorative content.

Useful lessons for CoolPath:

- lead with the user task, not the product philosophy;
- keep search and location results visually obvious;
- use explicit source/status language;
- favor robust contrast and visible focus over subtle aesthetic tricks;
- keep warnings contextual and specific;
- do not hide critical limitations behind decorative UI.

Do **not** copy:

- NHS branding, blue color system, or exact component styling;
- location/geolocation features that CoolPath intentionally does not provide.

### C. Vercel Web Interface Guidelines — interaction polish

Source:

- https://vercel.com/design/guidelines

Useful lessons for CoolPath:

- keyboard-operable flows everywhere;
- visible `:focus-visible` rings;
- native elements before ARIA reconstruction;
- at least 44px touch targets on mobile;
- 16px minimum mobile input text;
- use tabular numerals for comparable metrics;
- inline explanations before tooltips;
- manage focus when opening/closing overlays.

### D. USWDS — civic information semantics

Sources:

- https://designsystem.digital.gov/components/overview/
- https://designsystem.digital.gov/components/alert/
- https://designsystem.digital.gov/components/table/
- https://designsystem.digital.gov/components/summary-box/

Useful lessons for CoolPath:

- alerts are for status/validation messages, not decoration;
- tables are appropriate only where comparing consistent columns is the actual task;
- lists are better for record content with variable-length descriptions;
- summary boxes are for bounded key information, not general page framing;
- accessibility must be tested in the composed application, not assumed from a primitive.

## 5. OpenAI / GPT-5.6 implementation rules

Primary guidance:

- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/guides/frontend-prompt
- https://learn.chatgpt.com/use-cases/frontend-designs
- https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4
- https://academy.openai.com/en/public/clubs/champions-ecqup/videos/design-context-and-iteration-with-codex-2026-07-09

Apply these as hard constraints for this branch:

1. Treat CoolPath as an operational tool, not a landing page.
2. First viewport must expose the actual usable experience.
3. Avoid oversized hero sections and marketing composition.
4. Avoid card-heavy layouts and cards nested inside cards.
5. Reuse the existing component/data architecture instead of inventing a parallel app.
6. Use the icon library already present (`@phosphor-icons/react`).
7. Use stable responsive constraints instead of viewport-driven font scaling.
8. Do not use negative letter spacing.
9. Keep compact panels typographically compact.
10. Validate rendered desktop and mobile screenshots, not only build/test success.
11. Visual references are the target for hierarchy and rhythm, translated into CoolPath’s own domain and tokens.
12. Prefer a few iterative passes over a one-shot redesign.

## 6. Component strategy

### Decision: stay on Radix primitives

Do **not** migrate the app to a new component framework for this redesign.

Current stack already has React 19, Radix Dialog, TanStack Query, Phosphor icons, Geist fonts, and plain CSS. Switching to Base UI, React Aria, Radix Themes, Material UI, Mantine, or a full shadcn/Tailwind setup would add migration risk without solving the core problem: hierarchy and visual judgment.

Use shadcn/ui, Geist, Linear, NHS, and USWDS as reference systems, not as a wholesale runtime dependency.

Add Radix primitives only where they provide real behavior/accessibility value:

- `@radix-ui/react-tabs` for Public / Source Integrity view switching if URL semantics remain correct;
- `@radix-ui/react-tooltip` for genuinely unfamiliar icon-only controls;
- `@radix-ui/react-collapsible` for advanced technical detail;
- keep `@radix-ui/react-dialog` for the evidence inspector, styled as a right-side sheet;
- optional `@radix-ui/react-popover` only if a compact filter menu is added later.

### Component map

#### Shared

- `AppShell`
- `AppHeader`
- `ViewTabs`
- `StatusDot`
- `StatusStrip`
- `Button`
- `IconButton`
- `Tooltip`
- `Divider`
- `Metric`
- `EvidenceSheet`

#### Public view

- `DirectoryHeader`
- `DirectorySearch`
- `DirectoryMeta`
- `LocationList`
- `LocationRow`
- `EmptyResults`
- `PublicLimitations`

#### Technical view

- `IntegrityHeader`
- `IntegritySummary`
- `PipelineStrip`
- `PipelineStep`
- `IncidentPanel`
- `RunMetrics`
- `CoverageTable`
- `RepairReview`
- `ActivityTimeline`

## 7. Public view target

### Desktop composition

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ CoolPath                         Philadelphia      Public | Source integrity│
├──────────────────────────────────────────────────────────────────────────┤
│ Philadelphia cooling locations                                           │
│ 23 source-backed locations from Pennsylvania 211                         │
│                                                                          │
│ ● Verified   Updated Aug 18, 15:42   Pennsylvania 211 ↗                  │
│                                                                          │
│ [ Search by facility or address                                      ]   │
├──────────────────────────────────────────────────────────────────────────┤
│ Lucien E. Blackwell Regional Library                                     │
│ 125 S 52nd St, Philadelphia                         Evidence →            │
│ Cooling center · Additional facility claims not stated                   │
├──────────────────────────────────────────────────────────────────────────┤
│ Charles Santore Library                                                  │
│ ...                                                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Public hierarchy

1. City/task title.
2. Short literal source-backed summary.
3. One compact source-status strip.
4. Search.
5. Location rows.
6. Limitations after/below the list, with only a short essential line visible by default.

### Directory search

Add a client-side search input over the already-loaded trusted snapshot.

- Match `site.name` and `site.addressText` case-insensitively.
- Do not add geolocation, distance, “nearest”, or inferred availability.
- Use the real result count in an `aria-live="polite"` region.
- Clearing the query restores the full trusted list.
- Search is a convenience over trusted records, never a new data source.

### Location row

Remove:

- ornamental 01/02/03 index;
- serif styling;
- four-column editorial composition;
- large hover padding shift.

Keep:

- facility name;
- address;
- temporal/source claim summary;
- explicit claims when actually present;
- one clear Evidence action.

Rows should feel like high-quality search results, not cards.

### Evidence inspector

Keep the existing accessible Dialog behavior but style it as a right-side sheet.

Desktop:

- 420–520px width;
- full-height or near-full-height;
- subtle border/shadow only on the inspector edge;
- background white;
- content grouped by evidence/source semantics rather than cards.

Mobile:

- full viewport width;
- close button always visible;
- focus returned to triggering row action.

## 8. Technical view target

### Desktop composition

```text
Source integrity                                      ● HEALTHY
Pennsylvania 211        c_msxe8...        Bright Data live

25 received   23 accepted   0 rejected   23 published

SOURCE ───────── SCRAPER ───────── VALIDATION ───────── PUBLISHED
  ✓               ✓                 ✓                    ✓

Current incident
No unresolved incident

Latest verification                    Coverage
Outcome      Publishable                Required fields   100%
Completed    15:42                      Optional claims    84%
Reason codes 0                          ...

Activity
15:42  Snapshot published
15:42  Validation passed
15:41  Collector completed
```

### Technical hierarchy

1. Source state and identity.
2. Four top-level run/publication metrics.
3. Compact pipeline strip.
4. Incident panel — visually large **only when active**.
5. Latest run/coverage detail.
6. Repair diff if present.
7. Timeline.

### Pipeline

Replace four 250px cards with a compact step strip.

Each step contains only:

- icon/status marker;
- short label;
- one primary value;
- optional one-line secondary fact.

Healthy path should fit into roughly 100–140px vertical space on desktop.

When validation fails:

- the failed step becomes red/critical;
- a quarantine branch appears directly below that step;
- the incident panel becomes the dominant content block;
- published snapshot remains visibly separate and protected.

### Incident panel

Healthy state:

- one quiet row: “No unresolved incident”.

Active state:

- bounded red/amber surface;
- reason codes;
- opened time and severity;
- repair prompt behind disclosure;
- presenter controls grouped immediately with the incident in mock mode.

Do not permanently reserve a giant empty incident card.

## 9. Visual tokens

These values are the starting point. Fine adjustments are allowed after screenshot review, but changes must preserve the role of each token.

```css
:root {
  --bg: #f6f8fa;
  --surface: #ffffff;
  --surface-subtle: #f0f3f6;
  --surface-hover: #f7f9fb;

  --text: #161b22;
  --text-muted: #5f6b76;
  --text-subtle: #7a8692;

  --border: #d8dee5;
  --border-strong: #b9c2cc;

  --brand: #0b5cad;
  --brand-hover: #084b8d;
  --brand-soft: #e8f2fd;

  --healthy: #18794e;
  --healthy-soft: #e9f6ef;
  --warning: #9a6700;
  --warning-soft: #fff4d6;
  --critical: #c9372c;
  --critical-soft: #fdeceb;

  --focus: #005fcc;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  --shadow-sheet: -12px 0 40px rgb(22 27 34 / 0.12);
}
```

No generic decorative shadows. No glassmorphism. No gradients. No cream paper surfaces.

## 10. Typography

Use existing `@fontsource-variable/geist`.

Remove Newsreader from UI usage and remove the dependency if nothing else needs it after implementation.

Starting scale:

```text
Display / page H1: 40px / 48px, 650
Mobile H1:         32px / 40px, 650
Section H2:        24px / 32px, 650
Panel H3:          16px / 24px, 650
Body:              15px / 22px, 400–450
Compact body:      13px / 18px, 400–500
Label:             12px / 16px, 550–600
Mono metadata:     12px / 16px, 500
```

No heading smaller than its surrounding body hierarchy implies. No heading larger simply because viewport width increased.

Use `font-variant-numeric: tabular-nums` for comparable counts, percentages, and times.

## 11. Spacing and density

Canonical spacing scale:

```text
4, 8, 12, 16, 24, 32, 48, 64px
```

Rules:

- public maximum content width: 1180–1240px;
- technical maximum content width: 1280–1360px;
- header height: 56–64px desktop;
- row vertical padding: 18–22px desktop, 16–18px mobile;
- section separation: 32–48px, not 80–140px by default;
- most controls 32–40px desktop, at least 44px touch target on mobile;
- visible borders should clarify structure, not decorate every region.

## 12. Responsive behavior

### >= 1200px

- public rows can use 3 columns: identity / claim summary / action;
- technical metrics can form a single 4-column strip;
- pipeline stays horizontal;
- evidence sheet is fixed right inspector.

### 768–1199px

- provenance/status facts wrap to two rows;
- location row becomes identity + action on first line, claims below;
- technical metrics use 2x2 grid;
- pipeline remains horizontal only if labels fit without compression.

### < 768px

- header is compact but retains Public / Source integrity switching;
- H1 32px maximum;
- search is full-width;
- location rows are one column with Evidence action aligned below/after content;
- evidence sheet becomes full-screen;
- pipeline becomes vertical stepper;
- metric groups become 2 columns or 1 where labels require it;
- inputs use at least 16px text;
- interactive targets are at least 44px.

No horizontal page scrolling at 320px viewport width.

## 13. Status states

The application already has meaningful source states. Preserve semantics and redesign presentation only.

### Healthy / recovered

- small green dot + concise label;
- no large success banner dominating the page;
- source and timestamp remain visible.

### Historical / stale

- amber or neutral-warning strip;
- explicit wording that trusted data is older than freshness policy;
- list remains readable if a trusted snapshot exists.

### Degraded / quarantined

Public:

- concise warning strip;
- last trusted snapshot remains the main content;
- explain that a newer candidate was withheld without exposing internal detail.

Technical:

- failed validation step and incident panel become visually dominant;
- reason codes and quarantine facts available immediately.

### No trusted snapshot

- empty state is literal and calm;
- no fake cards or decorative illustration;
- source/provenance and retry/reload action remain visible.

## 14. Motion

Motion should communicate state, not style the page.

Allowed:

- 120–180ms opacity/background transition on row hover/focus;
- evidence sheet enter/exit transform + fade, respecting reduced motion;
- active pipeline/quarantine change transition in demo mode;
- subtle status-dot pulse **only while an operation is actively pending**, never continuously in healthy state.

Remove layout-shifting hover effects such as changing row horizontal padding.

If GSAP is no longer needed after implementation, remove `gsap` and `@gsap/react` rather than keeping unused animation dependencies.

## 15. Accessibility contract

Must retain or improve current behavior:

- skip link;
- semantic headings;
- native buttons and anchors;
- visible `:focus-visible`;
- dialog focus trap and return focus;
- `aria-live` for search result count and mutation feedback;
- no information encoded by color alone;
- 4.5:1 normal text contrast target;
- 44px mobile touch targets;
- 16px mobile input font size;
- reduced-motion support;
- source links have understandable accessible names;
- tables only where true column comparison exists.

## 16. Implementation phases

### Phase 1 — public view only

1. Replace palette/type tokens.
2. Redesign header/view switcher.
3. Replace public hero/provenance block with compact directory header/status.
4. Add trusted-snapshot client-side search.
5. Redesign location rows.
6. Restyle EvidenceDrawer as sheet.
7. Capture desktop/mobile screenshots and iterate before touching technical view.

### Phase 2 — technical view

1. Compact integrity header.
2. Metric strip.
3. Pipeline strip.
4. Incident progressive disclosure.
5. Run/coverage facts.
6. Repair review + timeline.
7. Capture healthy/drift/repair/recovered screenshots at desktop/mobile sizes.

### Phase 3 — cleanup

1. Remove obsolete CSS and unused dependencies.
2. Confirm no Newsreader/GSAP remains unless genuinely used.
3. Update E2E selectors only when behavior/semantics changed intentionally.
4. Run full repository verification.
5. Perform final visual QA matrix.

## 17. Visual QA matrix

Do not merge based only on tests/build.

Required screenshots:

```text
public / healthy / 1440x1000
public / healthy / 390x844
public / search results / 1440x1000
public / evidence sheet / 1440x1000
public / evidence sheet / 390x844
technical / healthy / 1440x1100
technical / drift/quarantine / 1440x1100
technical / repair prepared / 1440x1100
technical / recovered / 1440x1100
technical / drift / 390x844
```

Review each screenshot for:

- first-screen task clarity;
- hierarchy;
- text wrapping;
- row density;
- status prominence proportional to severity;
- alignment;
- inconsistent borders/radii;
- accidental card nesting;
- viewport overflow;
- inspector overlap;
- focus/keyboard path;
- whether any element looks like generic generated dashboard filler.

## 18. GPT-5.6 Sol / Codex execution prompt

Use this when Codex capacity is available again. The attached/referenced screenshots and this file are the source of truth for visual direction.

```text
You are redesigning only apps/web for CoolPath Live.

Read apps/web/DESIGN.md completely before changing code. Treat it as the visual and interaction contract. Preserve the existing API contracts, TanStack Query wiring, source-state semantics, mock demo behavior, accessibility intent, and backend boundaries.

This is an operational civic utility, not a landing page or editorial site. Use the actual usable directory as the first screen. Prefer dense but calm information, restrained visual styling, predictable navigation, list rows instead of decorative cards, progressive disclosure in the technical view, and compact typography.

Reuse React 19, the existing Radix primitives, Phosphor icons, Geist, and plain CSS. Do not migrate to a new component library or Tailwind. Add only narrowly justified Radix primitives. Do not modify backend packages.

Implement in phases:
1. Public view and Evidence sheet.
2. Render and visually inspect desktop/mobile screenshots; iterate until the public view matches DESIGN.md.
3. Technical view.
4. Render healthy, drift, repair, and recovery states at desktop/mobile sizes and iterate.
5. Remove obsolete CSS/dependencies and run full verification.

Hard rules:
- no serif UI typography;
- no viewport-scaled font sizes;
- no negative letter spacing;
- no cream/beige paper aesthetic;
- no oversized hero;
- no card-heavy dashboard;
- no layout-shifting hover padding;
- no feature-explainer marketing copy in the main task flow;
- no backend or API behavior changes;
- no claim of live Bright Data behavior from deterministic fixtures.

Visual QA matters as much as test success. Use Playwright/browser screenshots as an iterative comparison tool rather than stopping when the build passes.
```

## 19. Merge gate

The redesign is ready only when:

- public view is visibly task-first and more compact than current `main`;
- technical view reads as an integrity console rather than an editorial dashboard;
- all required screenshot states have been reviewed;
- desktop and mobile both pass visual QA;
- keyboard/focus behavior remains correct;
- Playwright E2E passes;
- typecheck, tests, lint, format, build, and verify pass;
- no backend behavior was changed;
- no live Bright Data evidence was fabricated or conflated with mock demo state.
