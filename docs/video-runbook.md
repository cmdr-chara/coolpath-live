# CoolPath Live video runbook

Prepared: 2026-08-20

No public video-duration limit was available on the hackathon page, getting-started guide, or resources page when this runbook was prepared. This is a three-minute master script. Shorten it only after the submission form publishes a different constraint.

## Recording setup

- Record at 1920 x 1080, browser zoom 100 percent.
- Use mock mode for the repeatable application sequence.
- Use committed sanitized artifacts for the real provider proof unless one deliberate live run is part of the final recording.
- Keep the terminal at a readable font size and the browser DevTools closed.
- Close Bright Data dashboards, account pages, billing pages, `.env`, shell history, password managers, email, and chat.
- Ensure no token value, bearer header value, cookie, account identity, or private provider metadata is visible.
- Use Pennsylvania 211 attribution. Never call it a city, municipal, or government source.
- Do not open or scrape a government target.

## Preflight

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm test:e2e
pnpm audit --prod --audit-level high
pnpm verify:evidence
```

Start the deterministic demo on isolated ports with the repository-defined commands. Confirm that the browser shows the three-location baseline, the Technical view labels the mode as deterministic, and no frontend request fails.

Prepare two terminal tabs:

1. `docs/bright-data-reproduction.md`, positioned at the canonical CLI commands.
2. A safe `jq` view of `docs/evidence/healing-recovery.example.json` and `docs/evidence/scraper-studio-output.example.json`.

Do not display raw provider output if the sanitized artifact tells the story.

## Three-minute master sequence

### 0:00-0:20 - Problem and product claim

**Location:** Public directory, `http://127.0.0.1:5173/`

**Action:** Begin on the hero and first verified records. Do not scroll immediately.

**Expected state:** Verified deterministic baseline, three trusted locations, source fixture label, search, evidence controls.

**Narration:**

> Cooling-location pages can change while downstream software keeps trusting the newest scrape. CoolPath Live makes a stricter promise: unverified web data never becomes public merely because a collector returned it.

**Backup:** If the app fails to start, show the latest verified public-view screenshot and state that it is deterministic fixture evidence.

**Hide:** Browser profile, bookmarks containing private names, local file paths outside the repository.

### 0:20-0:42 - Public trusted directory

**Location:** Public directory.

**Action:** Search for `Harbour`, clear the search, open the Harbour Library Evidence drawer, then close it with Escape.

**Expected state:** Search filters only the published snapshot. The drawer shows source-backed claims. Focus returns to the Evidence button.

**Narration:**

> Public reads go only through `publishedSnapshotId`. Search, pagination, and the evidence drawer operate on the trusted snapshot. CoolPath never infers that a facility is open or available right now.

**Backup:** Skip the search and open the first Evidence button directly.

**Hide:** Nothing sensitive should appear in mock mode.

### 0:42-1:12 - Bright Data lineage

**Location:** Technical view, `?view=technical`.

**Action:** Select Technical view. Point to Collector, mode, provider rows, normalized rows, published records, validation accounting, and the publication path.

**Expected state:** The screen reads Source -> Scraper Studio -> Normalization + validation -> Published. Provider rows and normalized rows are distinct. The trusted snapshot ID is visible.

**Narration:**

> Bright Data is the production ingestion boundary. The stable Collector ID returns structured rows. CoolPath separately reports what the provider returned, what normalization accepted, what validation rejected, and what was actually published.

**Backup:** Use a static full-window capture of the healthy Technical view.

**Hide:** Do not switch to a real dashboard.

### 1:12-1:43 - Coding-agent and real structured output

**Location:** Terminal in repository root.

**Action:** Show, but do not necessarily execute, the canonical commands:

```bash
npx -p @brightdata/cli bdata scraper run "$COOLPATH_COLLECTOR_ID" "$COOLPATH_SOURCE_URL" --pretty
npx -p @brightdata/cli bdata scraper heal "$COOLPATH_COLLECTOR_ID" "<bounded repair request>" --url "$COOLPATH_SOURCE_URL" --pretty
npx -p @brightdata/cli bdata scraper approve "$COOLPATH_COLLECTOR_ID" --url "$COOLPATH_SOURCE_URL" --pretty
```

Then show the safe fields and counts from `docs/evidence/scraper-studio-output.example.json`.

**Expected state:** Same `c_*` Collector ID, four output fields, 24 provider rows, 23 normalized locations, one filtered non-location, publishable disposition.

**Narration:**

> The coding agent drives the existing collector from the terminal. The real sanitized artifact contains facility name, address, service text, and evidence URL. Those rows are what power the application pipeline.

**Backup:** Show the committed JSON artifact with `jq`; do not wait on Bright Data during the recording.

**Hide:** CLI authentication state, shell history, literal tokens, account identifiers, full raw provider payload.

### 1:43-2:05 - Controlled drift and quarantine

**Location:** Technical view.

**Action:** Click `Simulate drift`.

**Expected state:** Source becomes temporarily unverifiable. The candidate is quarantined, reason codes appear, and Published remains protected.

**Narration:**

> This is explicitly a controlled drift simulation, not a claim that Pennsylvania 211 changed during recording. The malformed candidate fails the contract, moves to quarantine, and cannot replace the last trusted public snapshot.

Switch briefly to Public directory and point out that Harbour Library still exists with the `Last trusted report` language.

**Backup:** Use `docs/evidence/drift-quarantine.example.json` and the verified drift screenshot.

**Hide:** None in mock mode.

### 2:05-2:30 - Real healing evidence and deterministic recovery

**Location:** Terminal, then Technical view.

**Action:** Show a compact `jq` view of `docs/evidence/healing-recovery.example.json`: first preview rejected, second approved, same Collector ID, post-heal publishable counts. Return to the app, click `Prepare repair`, point to the selector diff, then click `Approve and re-run`.

**Expected state:** Manual review is visible before approval. Recovery clears the quarantine branch and publishes only after the proving rerun passes.

**Narration:**

> The real Scraper Studio healing evidence was human-reviewed. The first preview was rejected because it changed the language path. The corrected preview was approved, completed on the same Collector ID, and was re-run successfully. This deterministic sequence mirrors that safety boundary and proves that approval alone never publishes data.

**Backup:** Show the sanitized healing artifact and finish the UI sequence without a provider call.

**Hide:** Full healing prompt, private preview metadata, account dashboard.

### 2:30-2:52 - Clean architecture and verification

**Location:** Editor or terminal.

**Action:** Show the package boundaries and final verification summary. Suggested files:

```text
packages/source-adapters/src/bright-data-client.ts
packages/source-adapters/src/pa211-normalizer.ts
packages/domain/src/quality.ts
apps/api/src/ingestion-service.ts
packages/db/src/repository.ts
apps/web/src/components/lineage-metrics.ts
```

Show the green command results for `pnpm verify`, `pnpm test:e2e`, `pnpm audit --prod --audit-level high`, and `pnpm verify:evidence`.

**Expected state:** No failing command, no test artifact or secret in the staged diff.

**Narration:**

> The provider protocol, normalization, domain validation, orchestration, persistence, and presentation are separate typed boundaries. Tests use deterministic clients, never Bright Data, and cover failure, concurrency, quarantine, rejection, recovery, readiness, migrations, search, pagination, and accessible evidence interaction.

**Backup:** Show the latest successful GitHub Actions run, but do not imply it covers unpushed local commits.

**Hide:** GitHub account controls, unrelated repositories, private terminal tabs.

### 2:52-3:00 - Close

**Location:** Recovered Technical view or public directory.

**Narration:**

> CoolPath turns Scraper Studio output into public evidence that fails closed: the newest scrape is only a candidate, the last trusted snapshot survives drift, and recovery keeps the same Collector ID without downstream repair code.

## Deterministic fallback sequence

Use this fallback whenever provider latency, authentication, credits, or dashboard safety would weaken the recording:

1. Run the complete UI flow in mock mode.
2. State `controlled drift simulation` before clicking drift.
3. Show the committed real structured-output and real healing artifacts in the terminal.
4. State that the artifacts are live captured and sanitized.
5. Do not say the fallback is live.
6. Do not edit timestamps or counts to make the artifacts look newer.

## Final safety checklist

- [ ] Pennsylvania 211 is described as a nonprofit public directory.
- [ ] No government website appears as the Bright Data target.
- [ ] Controlled drift is labelled as controlled simulation.
- [ ] Real Self-Healing evidence is labelled as live captured and sanitized.
- [ ] The same Collector ID is visible before and after healing.
- [ ] The first unsafe preview rejection is mentioned.
- [ ] No automatic approval is used or implied.
- [ ] No token, bearer value, cookie, `.env`, shell history, billing detail, or account identity is visible.
- [ ] No raw rejected record or unnecessary provider payload is opened.
- [ ] Public data is not described as complete coverage or real-time availability.
- [ ] The exact-final-commit live API run is not claimed unless its artifact says `exactFinalCommit: true`.
