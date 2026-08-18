# Final repository audit — 2026-08-18

This is a repository-readiness audit for the WeMakeDevs x Bright Data Into the Scrape-Verse submission. It intentionally does not plan or script the demo video.

Official references checked on 2026-08-18:

- <https://www.wemakedevs.org/hackathons/scrape-verse>
- <https://www.wemakedevs.org/hackathons/scrape-verse/rules>
- <https://www.wemakedevs.org/hackathons/scrape-verse/schedule>

## Eligibility and repository requirements

### Pass

- Public source-code repository with visible commit history.
- Clear README with setup, architecture, real-mode configuration, reliability behavior and verification commands.
- Custom Bright Data Scraper Studio collector is identified and pinned: `c_msxe8lsm2630ya30wu`.
- Collector ID is wired into a real downstream application path: source adapter → validation → persistence → API → UI.
- Production adapter uses publicly available facility data only.
- Source acceptance, limitations and provider-policy decisions are documented in `docs/source-policy.md`.
- AI-assisted development is explicitly disclosed in `AI_USAGE.md`.
- Agent operating notes pin the Collector ID in `CODEX.md` as recommended by the event guidance.
- Deterministic CI does not contact Bright Data or consume provider credits.
- `.gitignore` excludes `.env`, SQLite runtime files, build output, coverage, Playwright reports, test results and local research-tool state.
- The tracked repository tree inspected during this audit does not contain `.env`, SQLite runtime databases, coverage output, Playwright reports or test-result directories.

### Pending before submission

- One deliberate final live rerun of `c_msxe8lsm2630ya30wu` against the post-refactor final candidate.
- Update `docs/evidence/bright-data.md` with the sanitized result of that final live run.
- Add `docs/evidence/scraper-studio-output.example.json` using a few representative public rows from a real Scraper Studio run.
- Final demo video and submission-form filing are intentionally deferred and are outside this audit pass.

The historical real Bright Data baseline remains valid evidence of the earlier integration, but it is explicitly labelled pre-refactor and must not be presented as proof that the final commit has already been rerun live.

## Judging alignment

### Potential impact

The project addresses a concrete failure mode in civic-information pipelines: a technically successful scrape can still be semantically incomplete, stale or malformed. CoolPath preserves the last trusted public snapshot instead of equating newest with correct.

### Creativity and innovation

The differentiator is the publication boundary around Scraper Studio output: candidate data is normalized, validated, quarantined when suspicious and promoted transactionally only when it passes the trust gates.

### Technical excellence

The repository has explicit domain, source-adapter, persistence, API and UI boundaries; versioned migrations; readiness/liveness separation; single-flight source operations; semantic cache validation; bounded errors; graceful shutdown; and deterministic test coverage.

### Use of Scraper Studio

Scraper Studio is central to the real ingestion path. The production Collector ID is a first-class configuration value and not a disconnected demo artifact.

### Reliability and self-healing

The application distinguishes provider/network failures from extraction drift, protects the trusted snapshot during quarantine and requires a repaired rerun to pass the same validation contract before publication. The deterministic mock flow demonstrates this lifecycle reproducibly without misrepresenting a synthetic site change as a real provider incident.

### Presentation readiness

The README now surfaces the real Collector ID, historical verified baseline, final-live verification status, evidence ledger, AI disclosure and reproduction path near the top so a judge does not need to discover them deep in the repository.

## Audit findings fixed in this pass

- Made the production Collector ID and evidence status visible from the README landing page.
- Changed real-mode setup from “create a collector” language to the actual existing production collector and its expected output shape.
- Pinned `PRIMARY_COLLECTOR_ID=c_msxe8lsm2630ya30wu` in `.env.example`; mock mode and credit-safe startup remain the defaults.
- Removed stale CI push triggers for already-merged development branches; pull requests continue to receive full verification.
- Kept the final post-refactor live proof explicitly pending instead of converting the historical baseline into an unsupported final claim.

## Deliberate non-actions

- No new application features.
- No additional refactor.
- No replacement or preventive modification of the working Scraper Studio collector.
- No fabricated live output or healing evidence.
- No requirement added for public deployment; the official submission rules require the repository, README, structured output, demo video and Scraper Studio explanation, not a hosted deployment.

## Final repository gate

Before submission, the final commit must pass:

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

GitHub Actions should report `CoolPath / full verification` as successful on the commit that will be submitted.
