# Into the Scrape-Verse submission checklist

This checklist tracks the artifacts required or strongly expected by the current WeMakeDevs Into the Scrape-Verse rules and judging guidance.

## Eligibility and required artifacts

- [x] Public source-code repository.
- [x] Clear README with setup instructions and project architecture.
- [x] Custom Bright Data Scraper Studio collector exists: `c_msxe8lsm2630ya30wu`.
- [x] Scraper Studio is wired into a real downstream API/database/UI pipeline.
- [x] Only publicly available source data is used by the production adapter.
- [x] AI-assisted development is disclosed in `AI_USAGE.md`.
- [x] Coding-agent Scraper Studio operating contract/evidence is documented without pretending it is a live provider run.
- [x] Final live rerun of the same Collector ID against clean tagged candidate `bfbf77d`.
- [x] Working-tree real-mode API/database publication rehearsal recorded at `docs/evidence/live-api-publication.example.json`.
- [x] Sanitized example structured output at `docs/evidence/scraper-studio-output.example.json`.
- [x] Final demo video showing the working project.
- [x] Add the final demo-video link to the README and submission copy.
- [ ] Add the final demo-video link to the official submission form.
- [ ] Final submission description and explicit Scraper Studio explanation copied into the form.
- [ ] Submit while the official submission form is open.

## Code-hardening gate

Before treating the branch as code-complete, require a green canonical CI run on the exact final HEAD. Do not reuse a green status or test count from an older commit.

The final code candidate must include the hardened lifecycle:

- asynchronous Bright Data healing completion before rerun;
- explicit approve/reject review;
- same-collector rerun only after approval/provider readiness;
- fail-closed source-row validation;
- protected trusted snapshot during quarantine/recovery;
- startup recovery for interrupted operations;
- canonical PA211 source policy shared by seed/normalizer/manifest/smoke path;
- deterministic tests and Playwright coverage for the review/recovery path.

## Real Bright Data proof

Historical pre-refactor evidence is recorded in `docs/evidence/bright-data.md` and must not be presented as final post-refactor verification.

For the final gate:

1. Use the current final commit.
2. Set `DATABASE_URL=:memory:` and `AUTO_START_REAL_CHECK=false`.
3. Reuse `c_msxe8lsm2630ya30wu`; do not rebuild the collector.
4. Start the API in real mode.
5. Perform one authenticated `POST /api/operator/sources/pa211-philadelphia-cooling/check`.
6. Record the sanitized response.
7. Inspect `/readyz` and `/api/cities/philadelphia` without triggering another provider call.
8. Update `docs/evidence/bright-data.md` with the actual final values.
9. Add a few representative real public rows to the example-output JSON artifact.
10. Rerun repository verification if any code or documentation changed after the live gate.

## Demo-video proof order

Recommended 3–4 minute sequence:

1. Show the real Collector ID `c_msxe8lsm2630ya30wu` and sanitized structured output.
2. Explain the problem: an HTTP 200 can still produce missing or malformed civic data.
3. Show the public directory and provenance.
4. Show the technical publication boundary: Scraper Studio → typed contract → published snapshot / quarantine.
5. Demonstrate deterministic drift, quarantine and last-trusted-snapshot protection.
6. Demonstrate the explicit repair decision: reject preserves the trusted snapshot; approve waits for the repair and requires a validated rerun before recovery.
7. Show the repository boundaries, `CONTRIBUTING.md`, coding-agent operating evidence and green CI as the clean-code proof.
8. Close with the final product and the rule: the newest scrape is not automatically the public truth.

## Final repository freeze

Before submission:

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm format
pnpm build
pnpm test:e2e
pnpm audit:prod
pnpm verify
git diff --check
```

Then inspect the final repository for secrets, `.env`, SQLite runtime files, coverage output, Playwright reports, temporary workflows and accidental generated artifacts.

## Optional judging boosts

- [x] Genuine `bdata scraper heal` evidence with the same Collector ID, including one rejected preview, one approved preview and a publishable post-heal rerun.
- [ ] LinkedIn post tagging WeMakeDevs for the separate Daily Bugle track.
- [ ] Final screenshots showing real-mode `HEALTHY`, published snapshot count and technical provenance.
