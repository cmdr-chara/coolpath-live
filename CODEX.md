# CoolPath Live — Scraper Studio operating notes

This repository uses one existing Bright Data Scraper Studio collector for the real Pennsylvania 211 source.

## Production collector

- Collector ID: `c_msxe8lsm2630ya30wu`
- Source ID: `pa211-philadelphia-cooling`
- Canonical source: Pennsylvania 211 public Philadelphia cooling-centre search
- Expected fields: `facility_name`, `address`, `service_text`, `evidence_url`

Do not recreate or replace this collector during routine development. Reuse the same `c_*` ID so downstream contracts stay stable and so any healing history remains attached to the same production endpoint.

## Credit-safe rules

- Never launch a live Bright Data collection from tests, CI, a public GET route, or an automated startup path unless explicitly enabled.
- `AUTO_START_REAL_CHECK=false` is the safe default.
- Prefer one deliberate end-to-end operator check over running both the smoke command and an operator check when one paid run can prove the final integration.
- Never commit or print `BRIGHT_DATA_API_TOKEN`, `OPERATOR_API_TOKEN`, `.env`, cookies, or authorization headers.
- Never fabricate a successful live run, structured output, or healing result. Record real provider evidence only after the command actually succeeds.

## Final live-verification flow

Use the current `main` candidate with a temporary database and the existing collector:

```dotenv
COOLPATH_MODE=real
DATABASE_URL=:memory:
AUTO_START_REAL_CHECK=false
PRIMARY_COLLECTOR_ID=c_msxe8lsm2630ya30wu
BRIGHT_DATA_API_TOKEN=<local secret>
OPERATOR_API_TOKEN=<local secret, at least 32 characters>
```

Start the API, then perform exactly one authenticated collection:

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

Record only sanitized evidence: collector ID, provider row count, accepted count, disposition, reason codes, source state, snapshot count and public evidence URLs.

If the final run fails, diagnose the existing pipeline before modifying the collector:

`Scraper Studio output → Bright Data client → PA211 normalizer → domain validation → repository publication → API`
