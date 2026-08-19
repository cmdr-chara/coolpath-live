# Bright Data Scraper Studio evidence

This file separates evidence that was verified before the major hardening/refactoring pass from evidence that must still be re-verified against the final submission candidate.

## Collector identity

- Collector ID: `c_msxe8lsm2630ya30wu`
- Source ID: `pa211-philadelphia-cooling`
- Source: Pennsylvania 211 public Philadelphia cooling-centre search
- Structured fields: `facility_name`, `address`, `service_text`, `evidence_url`

The Collector ID is not a secret. API credentials and operator tokens are secrets and must never be committed or shown in the demo.

## Verified pre-refactor baseline

Before the large backend and clean-code refactors, the real Pennsylvania 211 collector was verified end to end with the following observed result:

- Bright Data Collector ID: `c_msxe8lsm2630ya30wu`
- Provider records returned: 25
- Failed crawls: 0
- Provider crawl success: 100%
- Accepted cooling locations after source filtering/deduplication: 23
- Real smoke disposition: `publishable`
- Real smoke reason codes: none
- Real API source state: `HEALTHY`
- Published snapshot: 23 locations

The 25→23 reduction came from the source-specific normalization policy, including exclusion of non-location/hotline results and duplicate identities. These numbers describe that verified run only; they are not a claim that Pennsylvania 211 always contains exactly 25 provider rows or 23 accepted locations.

## Final post-hardening verification

**Status: pending one deliberate live rerun against the exact final submission commit.**

The current deterministic CI suite deliberately does not contact Bright Data. Green CI proves application contracts, provider sequencing logic, publication safety and regression behavior, but it does not by itself prove that the external collector still integrates with the final code.

The hardened real adapter now waits for asynchronous Self-Healing completion before any approved repair may rerun, treats an additional provider review gate as `REVIEW_PENDING`, uses bounded retry only for safe provider reads and keeps source-row schema rejection fail closed. Those are code-level guarantees, not substitutes for the live provider gate.

The final live gate should reuse the same Collector ID and perform exactly one paid collection through the authenticated real-mode operator endpoint. Use `DATABASE_URL=:memory:` and `AUTO_START_REAL_CHECK=false` so the check is isolated and does not create a second provider run during startup.

After the single collection, record the sanitized values below:

- Git commit tested: pending
- Collector ID: `c_msxe8lsm2630ya30wu`
- Provider records received: pending
- Normalized records accepted: pending
- Filtered non-locations: pending
- Exact duplicates removed: pending
- Records rejected by validation: pending
- Disposition: pending
- Reason codes: pending
- `/readyz`: pending
- Source state: pending
- Published snapshot count: pending

Do not fill these fields from the historical baseline. They must come from the final live run.

## Structured-output artifact

The hackathon submission requires example structured output. Add a small sanitized file at:

`docs/evidence/scraper-studio-output.example.json`

only after a real Scraper Studio run has produced the output. Include a few representative public rows rather than the full provider response. Do not include tokens, headers, cookies, private provider metadata, rejected raw records or unrelated personal/contact fields.

## Healing evidence

The application implements a fail-closed healing lifecycle:

`detected extraction failure → field-specific repair request → provider repair preview → explicit human approve/reject → provider completion → same-collector rerun → full validation → recovery publication`

A rejected preview does not rerun the collector. An approved preview cannot rerun until the asynchronous provider job reaches a ready terminal state; if another review gate appears, the source remains `REVIEW_PENDING`.

A genuine Self-Healing run using `c_msxe8lsm2630ya30wu` is useful judging evidence if there is a real extraction problem to repair. Do not intentionally damage a healthy production collector solely to manufacture a healing screenshot. If genuine healing is performed, record the same Collector ID, bounded problem description, selector diff, explicit decision, provider completion, rerun and final structured shape without exposing credentials.

## Coding-agent evidence

`CODEX.md` defines the coding-agent operating contract for the pinned collector. `docs/evidence/coding-agent-scraper-studio.md` records the agent's concrete repository-side inspection and hardening of the real Scraper Studio lifecycle while explicitly stating that no live provider invocation occurred during the hardening pass.
