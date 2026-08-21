# Coding-agent / Scraper Studio evidence

This ledger records the coding agent's concrete participation in CoolPath's Scraper Studio workflow without presenting repository work as a live provider run.

## What the agent actually operated

During the jury-hardening pass, the agent inspected the real Scraper Studio adapter and the pinned production collector contract rather than reviewing only README claims.

The agent:

- kept production identity pinned to collector `c_msxe8lsm2630ya30wu` and source `pa211-philadelphia-cooling`;
- inspected the real `/dca/trigger` → `/dca/dataset` collection path;
- inspected the Self-Healing trigger, progress polling and approval/resume path;
- compared the implementation with Bright Data's documented asynchronous AI/Self-Healing sequence;
- identified that the previous implementation treated the approval response as immediate scraper readiness;
- changed the client so approval is followed by healing-progress polling before the same collector may rerun;
- added handling for an additional human-review gate instead of automatically rerunning;
- kept paid/mutating POST operations out of blind retry logic while adding bounded retry for safe provider polling reads;
- separated authentication, forbidden, missing-collector, invalid-input, rate-limit, timeout and DNS evidence instead of collapsing those failures into layout drift;
- made any source-row schema rejection fail closed at the publication gate;
- aligned the manual live-smoke path with the production PA211 normalizer/coverage semantics;
- centralized the PA211 source identity, canonical URL, origins, TTL and policy version so agent/operator instructions and runtime enforcement share one source definition;
- added deterministic tests for the provider sequencing and failure boundaries;
- defined the explicit agent safety contract in `CODEX.md`.

## Human-review boundary

The coding agent does not own the approval decision.

The implemented workflow is:

`incident → field-specific prompt → provider repair preview → human approve/reject → provider completion → same-collector rerun → full validation → publication`

If Bright Data requests another approval after an approval decision, CoolPath remains `REVIEW_PENDING`; it does not rerun or publish.

## What this ledger proves separately from the final live record

No Bright Data credential is stored in the repository or available to deterministic CI. This ledger proves the code and operating contract, while `docs/evidence/bright-data.md` and the machine-readable artifacts record the separately authorized live operations. The repository does not claim:

- that a coding agent independently approved a production repair.

The August 21 clean-candidate check was deliberately authenticated and performed only after the final candidate was frozen. The human approved the earlier production repair; the agent did not assume or manufacture that decision. `docs/evidence/bright-data.md` remains the authority for final provider evidence.

## Safety rule

Repository evidence can prove that the coding agent understands and controls the Scraper Studio lifecycle in code. It cannot substitute for the final real provider evidence. If the live gate is unavailable, the submission must say so explicitly rather than presenting the deterministic mock as a real Bright Data run.
