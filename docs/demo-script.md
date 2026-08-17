# CoolPath Live demo script

Target length: 3-4 minutes. The demo should be recorded with the browser, terminal and Bright Data Scraper Studio identity visible when available.

## Opening: the problem

Show the healthy public directory.

Say: "Municipal pages can return HTTP 200 while a scraper silently produces zero rows or malformed fields. CoolPath publishes only evidence that passed a typed contract."

Point out:

- Reported by the official source
- Last verified
- Source-published hours
- Not stated handling
- Official evidence drawer

State clearly: "CoolPath is not emergency or medical guidance, and it does not claim a location is open now or currently available."

## Healthy baseline

Open **Source health** and show:

- Collector ID
- mock or live mode label
- collector version
- extracted record count
- required-field completeness
- published record count

In the staged demo, click **Healthy baseline**. Explain that Demo City is synthetic and deterministic; it is not presented as municipal data.

## Silent layout drift

Click **Simulate drift**.

Show that:

- the collector still returned data;
- validation found missing name and HTML contamination;
- the candidate was quarantined;
- the source became degraded;
- the public view still shows the last trusted three-record snapshot.

Say: "The newest run is not automatically the public truth. Public reads follow `publishedSnapshotId`."

## Self-healing review

Click **Prepare repair** and return to **Source health**.

Show the field-specific prompt and three selector changes. Emphasize:

- same Collector ID;
- asynchronous repair boundary;
- visible before/after selectors;
- no automatic approval;
- no silent public selector change.

If showing the real Bright Data flow, mention that processing can take several minutes. The staged fixture is the fallback and is labelled as such.

## Approval and recovery

Click **Approve and re-run**.

Show:

- the same collector runs again;
- all records pass the complete contract;
- the recovered snapshot is transactionally promoted;
- the incident is linked to its resolving run;
- the recovery timeline records the sequence.

Return to the public view and point out **Source recovered and re-verified**.

## Close

Summarize the product in one sentence:

"CoolPath combines Bright Data collection and self-healing with a strict evidence contract, so broken web extraction cannot silently become civic information."

Do not claim instant healing, full autonomy, guaranteed opening status, emergency suitability or production deployment unless those facts are demonstrated during the recording.
