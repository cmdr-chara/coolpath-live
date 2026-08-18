# Into the Scrape-Verse submission checklist

This checklist tracks the artifacts required or strongly expected by the current WeMakeDevs Into the Scrape-Verse rules and judging guidance.

## Eligibility and required artifacts

- [x] Public source-code repository.
- [x] Clear README with setup instructions and project architecture.
- [x] Custom Bright Data Scraper Studio collector exists: `c_msxe8lsm2630ya30wu`.
- [x] Scraper Studio is wired into a real downstream API/database/UI pipeline.
- [x] Only publicly available source data is used by the production adapter.
- [x] AI-assisted development is disclosed in `AI_USAGE.md`.
- [ ] Final live rerun of the same Collector ID against the final submission commit.
- [ ] Sanitized example structured output at `docs/evidence/scraper-studio-output.example.json`.
- [ ] Final demo video showing the working project.
- [ ] Add the final demo-video link to the README/submission form.
- [ ] Final submission description and explicit Scraper Studio explanation copied into the form.
- [ ] Submit while the official submission form is open.

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
6. Demonstrate manual repair approval and validated recovery, clearly labelling the mock drift fixture when used.
7. Show the repository boundaries, `CONTRIBUTING.md` and green CI as the clean-code proof.
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
pnpm verify
git diff --check
```

Then inspect the final repository for secrets, `.env`, SQLite runtime files, coverage output, Playwright reports, temporary workflows and accidental generated artifacts.

## Optional judging boosts

- [ ] Genuine `bdata scraper heal` evidence with the same Collector ID if a real extraction problem exists.
- [ ] LinkedIn post tagging WeMakeDevs for the separate Daily Bugle track.
- [ ] Final screenshots showing real-mode `HEALTHY`, published snapshot count and technical provenance.
