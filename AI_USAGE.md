# AI-assisted development disclosure

CoolPath Live was built during the WeMakeDevs x Bright Data Into the Scrape-Verse hackathon with AI-assisted development and research tooling.

## Tools used

- OpenAI ChatGPT and Codex were used for repository inspection, implementation support, code review, test design, debugging, documentation and submission preparation.
- Firecrawl-assisted research was used during source discovery and evaluation.
- Additional agent/subagent assistance was used during source investigation and implementation review.

## Human responsibility and verification

AI output was not treated as authoritative. The project owner remained responsible for source selection, architecture, security boundaries, Bright Data configuration, acceptance of code changes and final submission claims.

Generated or suggested code was reviewed against the repository's explicit invariants and verified with strict TypeScript, ESLint, Prettier, unit/integration tests, Playwright E2E tests, build checks and GitHub Actions before acceptance.

Real Bright Data credentials are kept outside the repository. Real Scraper Studio runs and any final live evidence are performed deliberately by the project owner and are not simulated by CI or deterministic test clients.

The implementation and documentation are intended to be explainable by the submitter without relying on an AI system during judging.
