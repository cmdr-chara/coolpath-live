# CoolPath Live runtime constraints

## Single-writer deployment

CoolPath's per-source operation coordinator is intentionally process-local. The supported production topology for this submission is **one API writer process per SQLite database**.

Within that topology:

- checks, healing requests and healing decisions for the same source are serialized by `SourceOperationCoordinator`;
- independent sources may run concurrently;
- SQLite WAL keeps normal reads available while the writer commits;
- trusted snapshot publication, source-state publication, incident resolution and publication timeline evidence are committed atomically by `CoolPathRepository`.

Running multiple API writer processes against the same database is still **not** the supported workflow-coordination topology. A future horizontally scaled deployment would require a durable source-operation lease or another cross-process coordination mechanism. CoolPath does not disguise the current in-memory coordinator as a distributed lock.

The final publication boundary is nevertheless defensive against an accidental delayed writer: publication compares run/observation ordering and compare-and-sets the trusted snapshot pointer inside the SQLite transaction. An older proving run therefore cannot silently replace a newer trusted publication. This protects the trust pointer; it does not turn the rest of the process-local workflow coordinator into a distributed scheduler.

SQLite also enforces at most one unresolved incident per source with a partial unique index, so that invariant does not depend only on process-local read-before-write sequencing.

## Crash recovery

Startup reconciles persisted transient lifecycle state before normal operation through `SourceLifecycleService`:

- interrupted `CHECKING` is treated as inconclusive and cannot promote a candidate;
- interrupted `HEALING` leaves the incident open, marks the attempted repair failed and preserves the trusted snapshot;
- a valid `REVIEW_PENDING` incident remains resumable for explicit operator review;
- malformed/non-resumable persisted review state is failed closed.

The trusted snapshot pointer is never reconstructed from the newest candidate after a restart; publication still requires the normal validated publication transaction.

## Destructive maintenance

Repository reset is a single SQLite transaction. A failure while clearing any table rolls back the entire reset, so a failed demo/maintenance reset cannot leave only part of the trust ledger deleted.
