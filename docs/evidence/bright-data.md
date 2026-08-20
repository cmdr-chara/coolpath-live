# Bright Data evidence record

Last reviewed: 2026-08-20

This document is the narrative index for CoolPath's Bright Data evidence. Machine-readable artifacts live beside it. Every artifact states whether it is live captured and sanitized, a deterministic fixture, or illustrative command output.

## Production integration identity

- Source ID: `pa211-philadelphia-cooling`
- Collector ID: `c_msxe8lsm2630ya30wu`
- Target organization: Pennsylvania 211
- Target origin: `https://search.pa211.org`
- Government website: no
- Expected structured fields: `facility_name`, `address`, `service_text`, `evidence_url`
- Coverage model: bounded first page, not complete source coverage

Pennsylvania 211 is a nonprofit public service directory. It must not be described as a city agency, municipal source, or official government source. CoolPath does not use a government website as the Bright Data target for this event.

## Evidence classification

| Classification                | Meaning                                                                                                                                  | Current artifacts                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `live_captured_and_sanitized` | Derived from an authenticated real Bright Data or real-mode application operation, with credentials and unnecessary raw payload removed. | `scraper-studio-output.example.json`, `healing-recovery.example.json`, `live-api-publication.example.json` |
| `deterministic_fixture`       | Reproducible repository-owned data used by tests and presenter controls. It is not a real provider response or real website change.      | `drift-quarantine.example.json`                                                                            |
| `illustrative_command_output` | Safe command shape or expected envelope shown for reproduction, not proof that the command ran in the current session.                   | `docs/bright-data-reproduction.md`                                                                         |

## Real structured-output evidence

The sanitized post-heal output captured on August 20, 2026 records:

- 24 provider rows received;
- 23 normalized cooling locations accepted;
- one non-location row filtered;
- zero exact duplicates removed by the application in that run;
- zero source-validation rejections;
- zero domain-validation rejections;
- zero quarantined canonical records;
- publishable disposition;
- no reason codes;
- raw dataset hash `15c27afa2814212ac2f026903b8aa7014f26d3a80b6ccc8d35b2e61fae44d797`.

Three representative public rows are preserved in `scraper-studio-output.example.json`. The full provider payload is not committed.

Historical baseline evidence before the approved healing observed 25 provider rows and 23 accepted locations: one exact duplicate and one non-location or hotline-style row were excluded. The difference between 25 and 24 is documented rather than presented as a coverage guarantee.

## Real Scraper Studio Self-Healing evidence

A genuine Self-Healing operation was performed on August 20, 2026 against the existing collector.

The bounded repair goal was to remove a duplicate and a non-location result while preserving:

- the English Pennsylvania 211 search;
- the four-field structured schema;
- HTTPS evidence URLs on `search.pa211.org`;
- the same Collector ID;
- no government target;
- no personal data.

The first preview was rejected because it changed evidence results to the Spanish `/es/` path. The second preview preserved the English `/search/` evidence path and was approved. Provider completion reached `done`, the collector remained `c_msxe8lsm2630ya30wu`, and the post-heal rerun produced the publishable 24-to-23 result above.

This is real Scraper Studio healing evidence. It is not evidence that the external website changed during the operation, and the repository does not make that claim. The application still filtered one non-location row after the provider rerun, so the evidence also does not claim perfect provider output.

Machine-readable record: `healing-recovery.example.json`.

## Integrated real-mode API publication rehearsal

One authenticated real-mode operator check was captured on August 20, 2026 using an in-memory database and automatic startup collection disabled.

Before the call:

- `/healthz`: 200, process alive;
- `/readyz`: 503, no trusted snapshot;
- source state: `UNINITIALIZED`.

One operator request triggered and polled the real collector. The application recorded run `f217d82c-8858-4972-88bc-7c752ea5f5b4`, normalized 24 provider rows to 23 accepted locations, passed validation, and transactionally published snapshot `ce336fb4-ba34-4579-ad0d-be9abf24dc55`.

After the call:

- `/readyz`: 200;
- source state: `HEALTHY`;
- published site count: 23;
- active incident: none;
- no persistent database artifact created after shutdown.

Truth limitation: this rehearsal ran from a dirty pre-final working tree at Git HEAD `926c8f1d99b1a7d621f3b6ef5fef0e5780e0df02`. Its machine-readable artifact therefore says `workingTreeClean: false` and `exactFinalCommit: false`. It must not be narrated as exact-final-commit proof.

Machine-readable record: `live-api-publication.example.json`.

## Deterministic drift, quarantine, review, and recovery

The presenter and automated tests use a source-owned fixture with three trusted records and a stable demo collector identity. Controlled drift produces one malformed record with a missing name and HTML-contaminated address text. The canonical contract rejects it, the candidate snapshot is quarantined, an incident opens, and the existing three-record published snapshot remains available.

The fixture then supports:

- a field-specific selector preview;
- explicit rejection with no rerun and no collector change;
- explicit approval;
- a proving rerun;
- full validation;
- recovered publication on the same demo collector identity.

This evidence is deterministic fixture behavior. It is not a live provider response and does not claim a real external website change.

Machine-readable record: `drift-quarantine.example.json`.

## Data lineage proven by the repository

```text
Pennsylvania 211 public source
  -> Bright Data Scraper Studio collector c_msxe8lsm2630ya30wu
  -> provider dataset rows
  -> PA211 row schema and origin policy
  -> filtering and exact deduplication
  -> canonical CoolingSite records
  -> typed quality and drift evaluation
  -> candidate snapshot
  -> transactionally published or quarantined
  -> SQLite publishedSnapshotId
  -> Fastify public API
  -> React directory, evidence drawer, technical lineage, incidents, recovery
```

The Technical view now reads provider-row and normalization counts from `validationSummary.coverage`. It does not mislabel the post-normalization `recordCount` as provider rows.

## Security and privacy record

The committed evidence contains no:

- Bright Data API token;
- operator token;
- bearer header value;
- cookie;
- `.env` value;
- billing or account detail;
- private response;
- personal contact data;
- raw rejected row;
- full healing prompt;
- government scrape target.

The collector ID is treated as a non-secret integration identifier. Credentials remain server-side.

## Remaining external gate

Before the final submission claim is upgraded, perform one bounded integrated API publication check against the exact clean final submission commit, using the existing collector and no automatic startup collection. Capture only sanitized metadata and update or add an artifact that states:

- `workingTreeClean: true`;
- `exactFinalCommit: true`;
- same Collector ID;
- provider and normalization counts;
- disposition and reason codes;
- published snapshot linkage;
- no active incident;
- no secret exposure.

Do not repeat paid calls if the first bounded check is conclusive. Do not mutate the external collector unless a separately reviewed repair is genuinely required.
