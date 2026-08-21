# CoolPath Live judging matrix

Official requirements retrieved: 2026-08-20

Primary sources:

- https://www.wemakedevs.org/hackathons/scrape-verse
- https://www.wemakedevs.org/blogs/scrape-verse-kick-off
- https://www.wemakedevs.org/hackathons/scrape-verse/resources
- https://docs.brightdata.com/datasets/scraper-studio/build-with-the-cli
- https://docs.brightdata.com/datasets/scraper-studio/self-healing-tool
- https://docs.brightdata.com/cli/commands

The event lists six equally weighted judging criteria. The timestamps below target the three-minute master runbook in `docs/video-runbook.md`. Adjust them only after the submission form publishes an actual duration limit.

| Criterion                    | Project evidence                                                                                                                                                                                                                                                                     | Code/docs/UI location                                                                                                                                                                                   | Demo timestamp                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Potential impact             | Public cooling-location evidence remains available when a new scrape is invalid; the product avoids implying live availability and links every record to source evidence. Coverage is explicitly bounded rather than described as complete.                                          | Public directory and evidence drawer; `apps/web/src/components/DirectoryView.tsx`; `apps/web/src/components/EvidenceDrawer.tsx`; `docs/source-policy.md`; `docs/submission-copy.md`                     | 0:00-0:42                                        |
| Creativity and innovation    | CoolPath is not a scraper plus a list. It is a fail-closed public evidence ledger with a separate candidate branch, quarantine, incident, manual healing review, and protected last-trusted publication.                                                                             | Technical pipeline and quarantine branch; `apps/web/src/components/PublicationScan.tsx`; `packages/domain/src/quality.ts`; `packages/db/src/repository.ts`; `docs/architecture.md`                      | 0:42-1:12 and 1:43-2:30                          |
| Technical excellence         | Strict TypeScript and Zod at untrusted boundaries; bounded Bright Data polling; explicit transport taxonomy; single-flight source operations; transactional publication; SQLite migrations; sanitized errors; liveness/readiness; deterministic tests.                               | `packages/source-adapters/src/bright-data-client.ts`; `apps/api/src/ingestion-service.ts`; `apps/api/src/source-operation-coordinator.ts`; `packages/db`; `.github/workflows/ci.yml`; `CONTRIBUTING.md` | 2:30-2:52                                        |
| Use of Scraper Studio        | Stable custom collector `c_msxe8lsm2630ya30wu`; real four-field structured output; official CLI workflow; provider rows flow through PA211 normalization and into the application.                                                                                                   | `CODEX.md`; `packages/source-adapters/src/pa211-source.ts`; `docs/bright-data-reproduction.md`; `docs/evidence/scraper-studio-output.example.json`; Technical view lineage metrics                      | 1:12-1:43                                        |
| Reliability and self-healing | Real August 20 healing evidence records an unsafe preview rejection, safe preview approval, same Collector ID, and publishable rerun. Deterministic controls prove quarantine, rejection, approval, full revalidation, and recovery while public reads stay on the trusted snapshot. | `docs/evidence/healing-recovery.example.json`; `docs/evidence/drift-quarantine.example.json`; `apps/api/src/ingestion-service.test.ts`; presenter controls and incident UI                              | 1:43-2:30                                        |
| Presentation                 | Civic public view, legible technical lineage, six-record pagination, global search, accessible evidence interaction, explicit controlled-simulation label, recording-safe fallback, and an executable shot-by-shot runbook.                                                          | `apps/web`; `apps/web/VISUAL-QA.md`; `apps/web/e2e/coolpath.spec.ts`; `docs/video-runbook.md`                                                                                                           | Entire video, especially 0:00-0:42 and 1:43-2:30 |

## Track-specific proof

### WEB-SLINGER: Best Use of Bright Data

| Track phrase                                  | Evidence                                                                                                                                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The scraper you designed in Scraper Studio"  | Custom PA211 collector, four-field output schema, target qualification, sanitized real rows.                                                                                                                                                  |
| "How you drove it from your coding agent"     | Current `npx -p @brightdata/cli bdata` commands for login, run, heal, approve or reject, and rerun in `docs/bright-data-reproduction.md`.                                                                                                     |
| "What it did when the site changed under it"  | Controlled drift demonstrates the application boundary. Real Scraper Studio healing evidence demonstrates provider-side preview, rejection, approval, and same-collector rerun. CoolPath does not claim the external site changed on command. |
| "What the structured output went on to power" | Provider rows -> PA211 normalizer -> typed domain -> quality report -> candidate -> transactional publication -> SQLite -> public directory -> evidence drawer -> technical lineage -> incident and recovery.                                 |

### SPIDER-SENSE: Best Clean Code

A new engineer can start in mock mode without credentials, trace each trust boundary by package, run one verification command, reproduce provider behavior from an explicit runbook, understand which operations consume credits, identify where secrets belong, and inspect the tagged clean-candidate provider proof.

## Evidence boundary

The real Self-Healing operation and post-heal structured output are verified. A later bounded integrated API publication check ran from clean tagged candidate `bfbf77d`, used the same Collector ID exactly once, and produced a 23-location healthy trusted snapshot with no active incident. Its canonical artifact is `docs/evidence/live-api-publication.example.json`; the earlier dirty-worktree rehearsal is retained separately for provenance.

The submission form and any video-duration limit were not publicly available when these sources were retrieved on August 20, 2026. The repository therefore provides a concise three-minute master script rather than inventing a rule.
