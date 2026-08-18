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

## Final post-refactor verification

**Status: pending one deliberate live rerun against the final code candidate.**

The existing CI suite deliberately uses deterministic scraper clients and does not contact Bright Data. Green CI therefore proves the application contracts and regression behavior, but it does not by itself prove that the external provider still integrates with the final refactored code.

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

The application implements a fail-closed healing lifecycle: prepare a field-specific repair, require manual approval, rerun the same collector and validate the fresh result before publication.

A genuine `bdata scraper heal` run using `c_msxe8lsm2630ya30wu` is useful judging evidence if there is a real extraction problem to repair. Do not intentionally damage a healthy production collector solely to manufacture a healing screenshot. If genuine healing is performed, record the same Collector ID, the bounded problem description, approval, rerun and final structured shape without exposing credentials.
