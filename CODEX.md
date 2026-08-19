# CoolPath Live — Scraper Studio operating notes

This repository uses one existing Bright Data Scraper Studio collector for the real Pennsylvania 211 source.

## Production collector

- Collector ID: `c_msxe8lsm2630ya30wu`
- Source ID: `pa211-philadelphia-cooling`
- Canonical source: Pennsylvania 211 public Philadelphia cooling-centre search
- Expected fields: `facility_name`, `address`, `service_text`, `evidence_url`

Do not recreate or replace this collector during routine development. Reuse the same `c_*` ID so downstream contracts stay stable and so any healing history remains attached to the same production endpoint.

## Agent operating contract

A coding agent working on CoolPath must treat Scraper Studio as an external production system, not as disposable test infrastructure.

The agent may, when explicitly asked and when valid local credentials are available:

1. inspect the pinned collector/source configuration;
2. run one deliberate source check through the authenticated operator boundary;
3. inspect the sanitized structured-output shape and CoolPath validation summary;
4. interpret hard failures and soft anomalies without exposing raw private/provider metadata;
5. prepare the field-specific healing request generated from the incident reason codes;
6. inspect the returned repair preview/diff;
7. present the repair for an explicit human approve/reject decision;
8. after approval, wait for the asynchronous Bright Data healing job to finish before rerunning;
9. rerun the **same collector ID**;
10. verify the full normalizer/domain/publication contract before calling the source recovered.

The agent must not silently create a replacement collector, change the source URL, bypass the seeded allowlist, approve its own repair without an explicit operator decision, publish a quarantined candidate, or fabricate provider evidence.

Repository code and deterministic tests can prove the control flow. A claim that the final candidate works against the real provider requires a real authenticated run tied to the exact commit being submitted.

## Credit-safe rules

- Never launch a live Bright Data collection from tests, CI, a public GET route, or an automated startup path unless explicitly enabled.
- `AUTO_START_REAL_CHECK=false` is the safe default.
- Prefer one deliberate end-to-end operator check over running both the smoke command and an operator check when one paid run can prove the final integration.
- Never commit or print `BRIGHT_DATA_API_TOKEN`, `OPERATOR_API_TOKEN`, `.env`, cookies, or authorization headers.
- Never fabricate a successful live run, structured output, healing preview, approval or recovery result. Record real provider evidence only after the operation actually succeeds.
- Do not intentionally damage a healthy production collector merely to manufacture a Self-Healing screenshot.

## Final live-verification flow

Use the exact submission candidate with a temporary database and the existing collector:

```dotenv
COOLPATH_MODE=real
DATABASE_URL=:memory:
AUTO_START_REAL_CHECK=false
PRIMARY_COLLECTOR_ID=c_msxe8lsm2630ya30wu
BRIGHT_DATA_API_TOKEN=<local secret>
OPERATOR_API_TOKEN=<local secret, at least 32 characters>
```

Record the exact Git commit before starting. Start the API, then perform exactly one authenticated collection:

```bash
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${OPERATOR_API_TOKEN}" \
  http://127.0.0.1:8787/api/operator/sources/pa211-philadelphia-cooling/check
```

After that single provider run, inspect readiness and the published representation without triggering another collection:

```bash
curl --fail http://127.0.0.1:8787/readyz
curl --fail http://127.0.0.1:8787/api/cities/philadelphia
```

Record only sanitized evidence: commit SHA, collector ID, provider row count, accepted count, filtered/rejected counts, disposition, reason codes, source state, snapshot count and public evidence URLs.

If the final run fails, diagnose the existing pipeline before modifying the collector:

`Scraper Studio output → Bright Data client → PA211 normalizer → domain validation → repository publication → API`

## Real healing workflow

Only initiate Self-Healing for a genuine active extraction incident.

1. Confirm the incident is caused by extraction/layout failure rather than authentication, rate limit, DNS, timeout or provider configuration failure.
2. Confirm the source still points to `c_msxe8lsm2630ya30wu` and the expected canonical PA211 URL.
3. Review the field-specific prompt derived from the actual incident reason codes.
4. Trigger the healing request through the authenticated operator endpoint.
5. Inspect the persisted selector diff; do not treat an unreviewed change as trusted.
6. Obtain an explicit human approval or rejection.
7. On rejection, confirm no rerun/publication occurs and the trusted snapshot remains protected.
8. On approval, wait until Bright Data reports the asynchronous repair ready. If Bright Data requests another approval, remain in `REVIEW_PENDING` and do not rerun.
9. Rerun the same collector only after the repair is ready.
10. Require source normalization, runtime schemas, origin/identity gates and anomaly policy to pass before the recovery publication transaction can resolve the incident.

If any of these steps cannot be objectively demonstrated, describe that stage as unverified rather than inferring success from the deterministic mock flow.
