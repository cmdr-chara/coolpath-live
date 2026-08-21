# Public deployment

CoolPath Live is published at <https://cmdr-chara.github.io/coolpath-live/> through the
`Deploy GitHub Pages` workflow.

## Deployment contract

The hosted site is a read-only judging and inspection surface. It contains the same React application
and shared API contracts as the local product, backed by a committed public read model exported from a
real, previously validated SQLite snapshot:

- 23 Pennsylvania 211 location records;
- real source mode and source provenance;
- the published snapshot, run summary, aggregate coverage, and bounded timeline;
- an explicit `STALE` state and `Historical report` label;
- no raw rejected provider rows, authorization headers, API tokens, cookies, or private metadata.

GitHub Pages cannot run the Fastify/SQLite writer. The deployment therefore does not expose operator
or demo mutation endpoints, does not run the collector, and cannot spend Bright Data credits. Dynamic
drift, quarantine, human review, approval, and recovered publication are demonstrated in the final
video and in the deterministic local workflow.

## Build and publication

`.github/workflows/pages.yml` runs only on `main` or an explicit manual dispatch. It:

1. installs the locked pnpm workspace on Node.js 24;
2. builds the complete monorepo with the Vite base path set to `/coolpath-live/`;
3. validates the committed deployment envelopes against the built shared Zod contracts;
4. stages the two read-only JSON routes under the web distribution;
5. uploads only `apps/web/dist` to the `github-pages` environment.

No repository or Actions secret is required.

## Refreshing the public snapshot

The export command never invokes Bright Data. It accepts only an existing trusted SQLite database,
copies it to a temporary directory, forces the exported source state to `STALE`, reads through the real
Fastify public routes, validates both envelopes, and deletes the temporary database:

```bash
pnpm deploy:export -- --database ./data/coolpath-real.db
```

This updates:

- `docs/evidence/deployed-city-list.example.json`;
- `docs/evidence/deployed-public-read-model.example.json`.

To reproduce the Pages artifact locally:

```bash
VITE_BASE_PATH=/coolpath-live/ \
VITE_API_BASE_URL=/coolpath-live \
VITE_CITY_SLUG=philadelphia \
VITE_STATIC_DEPLOYMENT=true \
pnpm build
pnpm deploy:stage
```

The static deployment must never be described as live availability. A full hosted writer deployment
would require a single Node.js process, a persistent SQLite volume, server-side Bright Data and
operator credentials, HTTPS, and `AUTO_START_REAL_CHECK=false` by default.
