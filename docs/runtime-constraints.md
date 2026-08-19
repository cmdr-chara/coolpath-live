# CoolPath Live runtime constraints

## Single-writer deployment

CoolPath's per-source operation coordinator is intentionally process-local. The supported production topology for this submission is **one API writer process per SQLite database**.

Within that topology:

- checks, healing requests and healing decisions for the same source are serialized by `SourceOperationCoordinator`;
- independent sources may run concurrently;
- SQLite WAL keeps normal reads available while the writer commits;
- trusted snapshot promotion, source-state publication, incident resolution and publication timeline evidence are committed atomically by `CoolPathRepository`.

Running multiple API writer processes against the same database is **not** claimed to be safe. A future horizontally scaled deployment would require a durable source-operation lease or another cross-process coordination mechanism. CoolPath does not disguise the current in-memory coordinator as a distributed lock.

## Crash recovery

Startup reconciles persisted transient lifecycle state before normal operation:

- interrupted `CHECKING` is treated as inconclusive and cannot promote a candidate;
- interrupted `HEALING` leaves the incident open, marks the attempted repair failed and preserves the trusted snapshot;
- a valid `REVIEW_PENDING` incident remains resumable for explicit operator review;
- malformed/non-resumable persisted review state is failed closed.

The trusted snapshot pointer is never reconstructed from the newest candidate after a restart; publication still requires the normal validated publication transaction.
