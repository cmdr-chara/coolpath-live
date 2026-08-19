# CoolPath Live — demo script

## 1. Real provider proof first

Show the pinned Bright Data Scraper Studio collector `c_msxe8lsm2630ya30wu`, the final exact-commit live verification result and a small sanitized example of real structured output. Do not use the deterministic mock as a substitute for this evidence.

Explain the production path briefly:

`Scraper Studio → PA211 normalizer → runtime contract → quality gate → candidate snapshot → publication/quarantine → API → UI`

## 2. Public trust rule

Open the public directory and state the product rule:

> The newest scrape is not automatically the public truth.

Open one evidence record and show the source URL, observed timestamp and explicit source claims.

## 3. Deterministic drift

Switch to the technical view. Point out the label **Presenter controls / deterministic fixture** and the copy **Mock source, real publication boundary** before using the controls.

Run:

1. **Healthy baseline**
2. **Simulate drift**

Show that the new candidate is quarantined while the previous trusted locations remain public.

## 4. Human repair review

Run **Prepare repair**.

Show:

- the incident reason codes;
- the field-specific repair prompt;
- the selector diff;
- the `REVIEW_PENDING` state.

Make clear that CoolPath has not applied or trusted the repair yet.

## 5. Demonstrate both decisions

The presenter exposes both human decisions.

### Rejection branch

Use **Reject repair** if you want to demonstrate the negative decision first. Show that:

- no repaired collector rerun occurs;
- the incident remains visible;
- the trusted snapshot remains public;
- no selector change is represented as recovered.

Then prepare the repair again.

### Approval branch

Use **Approve and re-run**. Explain that the real Bright Data adapter does not treat the approval HTTP response as immediate readiness: it waits for the asynchronous Self-Healing job to finish. If the provider requests another review, CoolPath remains `REVIEW_PENDING` rather than rerunning.

After provider readiness, CoolPath reruns the same collector identity and requires the complete normalizer/domain/publication contract before a recovered snapshot can become public.

In the deterministic fixture, show `RECOVERED` and **Quarantine clear**.

## 6. Clean-code proof

Show the boundaries rather than file count:

- `packages/source-adapters/src/pa211-source.ts` — one canonical production source policy;
- `packages/source-adapters/src/bright-data-client.ts` — provider-specific trigger/poll/healing protocol;
- `packages/domain/src/state-machine.ts` — legal lifecycle transitions;
- `packages/domain/src/quality.ts` — fail-closed data-quality policy;
- `packages/db/src/repository.ts` — transactional trusted-publication boundary;
- `apps/api/src/ingestion-service.ts` — application orchestration;
- `packages/domain/src/api-contracts.ts` + `apps/web/src/api.ts` — executable network contract;
- `CODEX.md` + `docs/evidence/coding-agent-scraper-studio.md` — coding-agent operating/safety evidence;
- `docs/runtime-constraints.md` — explicit single-writer topology rather than a fake distributed-lock claim.

End on the final green CI status for the exact candidate being submitted. Do not quote an older test count if HEAD changed afterward.
