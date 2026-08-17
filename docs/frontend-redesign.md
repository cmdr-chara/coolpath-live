# CoolPath Live frontend redesign

## Direction

The frontend is rebuilt as a **civic evidence ledger**: a calm public directory paired with a denser publication-control view. Both views use the same typography, spacing, borders, language and state colors. The public view prioritizes the first usable record; the technical view turns the publication boundary into the demo's central visual.

The interface deliberately avoids maps, geolocation, accounts, weather, availability inference, rounded-card grids, glass effects, decorative gradients and marketing-scale hero copy.

## Reference decisions

The redesign borrows individual decisions rather than copying a whole product:

1. **Federal Register document pages** — status and provenance are placed before explanatory prose; current and historical document states are explicit. Reference: <https://www.federalregister.gov/documents/current>
2. **ProPublica Nonprofit Explorer** — dense editorial records, restrained typography and source context make complex public data scan quickly. Reference: <https://projects.propublica.org/nonprofits/organizations/131624102>
3. **GOV.UK Design System summary lists and notification banners** — plain-language status, strong semantic structure and visible focus behavior. References: <https://design-system.service.gov.uk/components/summary-list/> and <https://design-system.service.gov.uk/components/notification-banner/>
4. **GitHub Actions workflow visualization** — directional nodes and a visible failure branch make pipeline state legible without a generic dashboard. Reference: <https://docs.github.com/en/actions/how-tos/monitor-workflows/use-the-visualization-graph>
5. **Office for National Statistics service manual** — restrained, accessible data-publishing conventions and emphasis on comprehension before decoration. Reference: <https://service-manual.ons.gov.uk/design-system/data-visualisation>

## Design system

### Typography

- **Newsreader Variable**: editorial display headings and record-section titles.
- **Geist Variable**: interface copy, data labels and controls.
- **System monospace**: collector IDs, contract outcomes, reason codes and timestamps.

### Color roles

| Token | Value | Role |
| --- | --- | --- |
| Paper | `#f4f0e7` | deterministic page background |
| Ink | `#16221e` | primary text |
| Muted | `#59635e` | supporting text |
| Verified green | `#1b604b` | passing/current source state |
| Review amber | `#935b16` | stale, degraded, healing and review states |
| Quarantine red | `#963e35` | contract failure and blocked publication |
| Focus blue | `#005ea8` | keyboard focus only |
| Technical forest | `#10251f` | publication pipeline board |

The theme is fixed and does not change with operating-system dark mode.

### Spacing and shape

Spacing follows a small 4/8/12/16/24/32/48/64 scale. Components are organized by rules, columns and shared baselines. Rectangular controls and square state markers replace pills and rounded card containers.

### Motion

Motion is limited to the evidence drawer, navigation underline, action hover and loading opacity. All motion is disabled under `prefers-reduced-motion: reduce`. GSAP-driven reveal code is removed; the existing package declarations remain temporarily so the published branch stays consistent with its frozen lockfile.

## Audit findings and resolutions

| Impact | Finding | Resolution |
| --- | --- | --- |
| Critical | The frontend requested `/api/cities/demo-city` unconditionally, while real mode seeds the `philadelphia` slug. | The client now discovers `/api/cities`, honors optional `VITE_CITY_SLUG`, otherwise prefers a real source and then loads the selected slug. |
| High | A 720px marketing hero and decorative signal field delayed the first record, especially on mobile. | Replaced with a compact city/provenance ledger. The first location is asserted inside a 375×812 initial viewport. |
| High | Copy repeatedly described data as “official,” “municipal” or issued by an authority, which is inaccurate for nonprofit Pennsylvania 211. Generic “hours” labels could also misdescribe a service statement or activation period. | Standardized source language and added claim-aware temporal labels for hours, periods, statements and unstated timing. |
| High | `BROKEN` rendering discarded all sites even when a protected published snapshot existed. | Records render whenever a published snapshot exists; only the empty snapshot state hides the list. |
| High | Public/technical navigation existed only in React state and was not shareable or restorable with browser history. | Replaced with URL-backed links using `?view=technical`, `aria-current` and `popstate` handling. |
| High | The controlled Radix dialog had no registered trigger, so focus restoration was not explicit. | The opening button is stored and restored through `onCloseAutoFocus`; Radix continues to provide the focus trap and Escape behavior. |
| Medium | Status language and current-versus-historical logic were distributed across components. | Added one typed `status-content.ts` source used by the banner, records, drawer and pipeline. |
| Medium | The technical flow only emphasized quarantine during an incident and underplayed the protected publication pointer. | Quarantine is now a permanent branch with active/idle states; `publishedSnapshotId` is named in the core flow. |
| Medium | App composition mixed data loading, navigation, hero art, public records, presenter controls and technical rendering. | Split into `DirectoryView`, `TechnicalView`, `PresenterControls`, `AppHeader`, shared formatting and shared state content. |
| Medium | API errors discarded server-safe messages and offered little state-specific context. | Added a typed request error, safe response-message parsing, retry UI and a bounded incident-detail fallback. |
| Low | GSAP was used for broad reveal motion rather than product state. | Removed GSAP-driven UI code. Package declarations are retained in this branch until the lockfile can be regenerated in the repository runtime. |

## State language

| Source state | Public label | Public behavior |
| --- | --- | --- |
| `HEALTHY` | Current verified data | show the published snapshot |
| `RECOVERED` | Current verified data | show the newly re-verified snapshot |
| `DEGRADED`, `HEALING`, `REVIEW_PENDING`, `CHECKING`, `BROKEN` | Last trusted report | show a protected snapshot when one exists |
| `STALE` | Historical report | show explicit historical wording |
| `UNINITIALIZED` or no snapshot | No verified report | show an empty state and source-page path |

No state claims a facility is open now, safe, nearest, currently available, medically appropriate or safely reachable.

## Responsive and interaction contract

- **375px**: two-line navigation, compact provenance, first record visible in the initial 812px viewport, single-column technical flow and full-width drawer.
- **768px**: two-column provenance, two-column presenter sequence, stacked operational ledgers.
- **1440px**: four-node publication pipeline, editorial records and two-column incident/run register.
- **Wide desktop**: content remains capped at 1440px; density increases through whitespace rather than stretched text lines.
- Evidence controls have record-specific accessible names.
- Navigation is keyboard reachable and URL backed.
- Async presenter feedback uses `aria-live="polite"`.
- Drawer close restores focus to the exact evidence button that opened it.
- Horizontal selector tables expose a keyboard-focusable scroll region.

## Security and regression boundary

The redesign leaves the Bright Data collector, source normalizer, typed contract, quality gates, quarantine logic, transactional snapshot publication and operator endpoints unchanged. Scraped strings remain React text nodes; no `dangerouslySetInnerHTML`, arbitrary URL input, client token or secret-bearing field is introduced. External links retain `target="_blank"` with `rel="noreferrer"`.
