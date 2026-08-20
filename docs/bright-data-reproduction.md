# Bright Data reproduction guide

Retrieved: 2026-08-20

This runbook separates local deterministic verification from paid provider operations. It uses the existing Pennsylvania 211 collector and never creates a replacement collector merely for a demo.

## Official references

- Hackathon rules: https://www.wemakedevs.org/hackathons/scrape-verse
- Hackathon getting started: https://www.wemakedevs.org/blogs/scrape-verse-kick-off
- Hackathon resources: https://www.wemakedevs.org/hackathons/scrape-verse/resources
- Scraper Studio overview: https://docs.brightdata.com/datasets/scraper-studio/overview
- Build with the CLI: https://docs.brightdata.com/datasets/scraper-studio/build-with-the-cli
- Coding-agent prompts: https://docs.brightdata.com/datasets/scraper-studio/coding-agent-prompts
- CLI command reference: https://docs.brightdata.com/cli/commands
- Self-Healing: https://docs.brightdata.com/datasets/scraper-studio/self-healing-tool
- Scraper Studio API quickstart: https://docs.brightdata.com/datasets/scraper-studio/quickstart
- AI Agent: https://docs.brightdata.com/datasets/scraper-studio/ai-agent
- Scraper Studio IDE: https://docs.brightdata.com/datasets/scraper-studio/develop-a-scraper
- Documentation index: https://docs.brightdata.com/llms.txt

## Terms used by CoolPath

| Term                      | Meaning                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collector ID              | Stable Scraper Studio definition. CoolPath uses `c_msxe8lsm2630ya30wu`. It must remain unchanged across normal runs and healing.                       |
| Collection or snapshot ID | One execution returned by `POST /dca/trigger`, normally a `j_*` value. The API quickstart uses the returned `collection_id` as the dataset polling ID. |
| Dataset                   | Structured JSON rows returned by `GET /dca/dataset?id=<snapshot_id>` after the collection is ready.                                                    |
| Candidate snapshot        | CoolPath's local, untrusted representation of one evaluated run. It is not public merely because the provider returned rows.                           |
| Published snapshot        | The trusted local snapshot selected by `source.publishedSnapshotId` after normalization and validation pass.                                           |

Do not call a `j_*` execution ID a Collector ID. Do not describe provider dataset rows as published CoolPath records until the application has accepted and promoted them.

## Source and credential constraints

The Bright Data target is the public Pennsylvania 211 Philadelphia cooling-center search on `https://search.pa211.org`. Pennsylvania 211 is a nonprofit service directory, not a government website. Do not replace it with `phila.gov`, `fresno.gov`, or another government domain for this event.

The collector input is one allowlisted canonical URL. The structured output fields are:

```text
facility_name
address
service_text
evidence_url
```

Keep credentials server-side. Use environment variables or Bright Data's stored CLI authentication. Never paste a token into a command that will be recorded, shell history, documentation, frontend code, or a committed file.

## Prerequisites

```bash
node --version       # Node.js 22 or newer
corepack enable
pnpm --version       # repository packageManager is pnpm 11.19.0
pnpm install --frozen-lockfile
```

For a headless terminal, authenticate without placing the credential in the command transcript:

```bash
npx -p @brightdata/cli bdata login --device
```

Set only non-secret identifiers in the shell used for recording:

```bash
export COOLPATH_COLLECTOR_ID='c_msxe8lsm2630ya30wu'
export COOLPATH_SOURCE_ID='pa211-philadelphia-cooling'
export COOLPATH_SOURCE_URL='https://search.pa211.org/search?query=TH-2600.1900&query_label=Cooling%20Centers&query_type=taxonomy&location=Philadelphia%2C%20PA&coords=-75.1652%2C39.9526&distance=10'
```

## Deterministic mock workflow

Mock mode requires no Bright Data credentials and performs no provider calls.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. The default fixture publishes three trusted locations. The Technical view supports:

1. healthy baseline;
2. controlled drift simulation;
3. candidate quarantine while the last trusted snapshot stays public;
4. healing preview;
5. explicit rejection without rerun;
6. explicit approval followed by a proving rerun;
7. recovered publication with the same deterministic collector identity.

The fixture evidence is `docs/evidence/drift-quarantine.example.json`. It is not a live provider response and must be described as controlled drift simulation in narration.

## Real-mode startup without automatic collection

Real mode must start without spending credits. `AUTO_START_REAL_CHECK` remains false.

```bash
COOLPATH_MODE=real \
AUTO_START_REAL_CHECK=false \
DATABASE_URL=':memory:' \
pnpm --filter @coolpath/api dev
```

The process should start, `/healthz` should report liveness, and `/readyz` may remain `503 not_ready` until an authenticated operator deliberately publishes a trusted snapshot. Startup, public GET requests, health probes, readiness probes, and tests must not trigger Bright Data.

## Canonical coding-agent CLI workflow

### 1. Run the existing collector

```bash
npx -p @brightdata/cli bdata scraper run "$COOLPATH_COLLECTOR_ID" "$COOLPATH_SOURCE_URL" --pretty -o /tmp/coolpath-baseline.json
```

Inspect only the structured fields needed for the demo. Avoid opening unnecessary raw account or provider metadata.

```bash
jq '{rows: length, fields: (.[0] | keys)}' /tmp/coolpath-baseline.json
jq '.[0:3] | map({facility_name, address, service_text, evidence_url})' /tmp/coolpath-baseline.json
```

Expected shape: a JSON array whose records expose the four fields above. Historical verified runs returned 24 or 25 provider rows; the normalizer accepted 23 cooling locations. These are observations, not a completeness guarantee.

### 2. Request a bounded repair

Use a truthful, field-specific prompt. Do not claim the external page changed if the purpose is to improve a known duplicate or non-location result.

```bash
npx -p @brightdata/cli bdata scraper heal "$COOLPATH_COLLECTOR_ID" \
  "Preserve the English Pennsylvania 211 cooling-center search and the fields facility_name, address, service_text, and evidence_url. Exclude duplicate results and entries that are not physical cooling locations. Keep evidence URLs on https://search.pa211.org/search/." \
  --url "$COOLPATH_SOURCE_URL" \
  --pretty \
  -o /tmp/coolpath-heal-preview.json
```

The expected default result is an approval envelope with a preview. Stop and inspect it. The jury flow uses manual review only.

```bash
jq '{status, preview_result, next_step}' /tmp/coolpath-heal-preview.json
```

Review conditions:

- Collector ID remains `c_msxe8lsm2630ya30wu`.
- Target remains the English Pennsylvania 211 search.
- No government target is introduced.
- Output retains the four required fields unless an intentional extension is documented.
- Preview contains no personal data or private content.
- Evidence URLs remain HTTPS and on `search.pa211.org`.

### 3A. Reject an unsafe preview

```bash
npx -p @brightdata/cli bdata scraper approve "$COOLPATH_COLLECTOR_ID" --reject --pretty
```

A rejection must be narrated as: no selector change applied, no proving rerun performed, trusted CoolPath data unchanged.

### 3B. Approve a safe preview

Run this instead of the rejection command only after the review conditions pass:

```bash
npx -p @brightdata/cli bdata scraper approve "$COOLPATH_COLLECTOR_ID" --url "$COOLPATH_SOURCE_URL" --pretty -o /tmp/coolpath-heal-approval.json
```

Approval changes the existing Scraper Studio collector in place. It is not evidence that CoolPath can publish the result.

### 4. Re-run the same Collector ID

```bash
npx -p @brightdata/cli bdata scraper run "$COOLPATH_COLLECTOR_ID" "$COOLPATH_SOURCE_URL" --pretty -o /tmp/coolpath-post-heal.json
```

Compare the field list and safe aggregates. Do not commit the full provider payload.

```bash
jq '{rows: length, fields: (.[0] | keys)}' /tmp/coolpath-post-heal.json
```

### 5. Prove application publication

Start the API in real mode with `AUTO_START_REAL_CHECK=false`, then make one authenticated operator request. The token remains an environment variable and is never echoed.

```bash
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${OPERATOR_API_TOKEN}" \
  "http://127.0.0.1:8787/api/operator/sources/${COOLPATH_SOURCE_ID}/check" \
  | jq '.data | {runId, disposition, reasons, recordCount, coverage}'
```

Then inspect the public read model without making another provider request:

```bash
curl --fail-with-body "http://127.0.0.1:8787/api/cities/philadelphia" \
  | jq '.data | {source: .source, snapshot: {id: .snapshot.id, runId: .snapshot.runId, records: (.snapshot.sites | length)}, latestRun: {id: .latestRun.id, outcome: .latestRun.outcome, coverage: .latestRun.validationSummary.coverage}, incident: .incident}'
```

The published snapshot must reference the proving run, the disposition must be `publishable`, the active incident must be null, and the public count must not exceed normalized accepted rows.

## Scraper Studio API behavior implemented by the application

1. `POST /dca/trigger` queues the stable collector and returns `collection_id`.
2. CoolPath treats that value as the execution or snapshot ID.
3. `GET /dca/dataset?id=<snapshot_id>` is polled within a complete-operation timeout.
4. `202` or a building status means continue polling.
5. A ready JSON array becomes untrusted provider rows.
6. `401`, `403`, `404`, `422`, `429`, timeout, DNS, and temporary provider failures are classified separately.
7. Safe GET polling can use bounded backoff. Mutating trigger, repair, and approval requests are not blindly repeated.
8. No automated test invokes the live provider.

## What consumes Bright Data credits

Provider execution can consume credits. Treat these as deliberate external operations:

- `scraper run`;
- a Self-Healing request;
- an approved healing workflow;
- the post-heal rerun;
- the real operator check, because it triggers and polls the collector.

These do not consume Bright Data credits:

- mock mode;
- unit, integration, and E2E tests;
- local evidence verification;
- application startup with automatic collection disabled;
- `/healthz`;
- `/readyz`;
- public directory GET requests;
- reading committed sanitized evidence.

## Troubleshooting

| Symptom                                             | Interpretation and action                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CLI authentication fails                            | Re-run device login outside the recording or verify account access. Do not expose a token on screen.       |
| `401` or `403`                                      | Stop. Credentials or permissions are invalid. Do not retry repeatedly.                                     |
| `404`                                               | Stop and verify the pinned Collector ID. Do not create a new collector to hide the problem.                |
| `422`                                               | Inspect the allowlisted input URL and required provider input shape.                                       |
| `429` or provider `5xx`                             | Wait and retry only within the documented bounded workflow. Use the deterministic fallback for the video.  |
| Dataset never becomes ready                         | Stop after the configured timeout. Do not leave an unbounded polling loop.                                 |
| Healing preview changes language, target, or schema | Reject it. The August 20 evidence records exactly this safety decision.                                    |
| API is live but readiness is `503`                  | Expected before a trusted snapshot exists in real mode. Liveness and readiness are intentionally distinct. |
| Candidate is quarantined                            | Inspect reason codes and retain the current published snapshot. Do not force publication.                  |

## Existing evidence and remaining external step

The repository already contains sanitized evidence of:

- real structured Scraper Studio output;
- a real healing request on August 20, 2026;
- rejection of the first unsafe preview;
- approval of a corrected preview;
- unchanged Collector ID;
- a publishable post-heal rerun;
- one integrated real-mode API publication rehearsal from a dirty pre-final working tree.

The remaining external gate is one bounded integrated API publication run against the exact final submission commit. Update `docs/evidence/live-api-publication.example.json` only with a new sanitized artifact that states `workingTreeClean: true` and `exactFinalCommit: true`. Do not overwrite historical evidence merely to make the claim look complete.
