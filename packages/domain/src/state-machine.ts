import { z } from "zod";

export const sourceStates = [
  "UNINITIALIZED",
  "CHECKING",
  "HEALTHY",
  "DEGRADED",
  "STALE",
  "BROKEN",
  "HEALING",
  "REVIEW_PENDING",
  "RECOVERED"
] as const;

export const sourceStateSchema = z.enum(sourceStates);
export type SourceState = z.infer<typeof sourceStateSchema>;

interface TrustedSnapshotContext {
  hasTrustedSnapshot: boolean;
  withinTtl: boolean;
}

export type SourceEvent =
  | { type: "CHECK_STARTED" }
  | { type: "HEAL_RERUN_STARTED" }
  | { type: "RUN_PASSED"; recovered: boolean }
  | ({ type: "RUN_FAILED"; inconclusive: boolean } & TrustedSnapshotContext)
  | { type: "TTL_EXPIRED"; hasTrustedSnapshot: boolean }
  | { type: "HEAL_REQUESTED" }
  | { type: "HEAL_PREVIEW_READY" }
  | ({ type: "HEAL_REJECTED" } & TrustedSnapshotContext)
  | ({ type: "HEAL_FAILED" } & TrustedSnapshotContext);

export class InvalidSourceTransitionError extends Error {
  constructor(state: SourceState, event: SourceEvent["type"]) {
    super(`Source state ${state} cannot handle ${event}`);
    this.name = "InvalidSourceTransitionError";
  }
}

function requireState(
  state: SourceState,
  event: SourceEvent["type"],
  allowed: readonly SourceState[]
): void {
  if (!allowed.includes(state)) throw new InvalidSourceTransitionError(state, event);
}

function failedState(context: TrustedSnapshotContext): SourceState {
  if (!context.hasTrustedSnapshot) return "BROKEN";
  return context.withinTtl ? "DEGRADED" : "STALE";
}

export function transitionSourceState(state: SourceState, event: SourceEvent): SourceState {
  switch (event.type) {
    case "CHECK_STARTED":
      // CHECKING is intentionally idempotent for retrying a persisted interrupted check.
      // Same-process overlapping operations are rejected by SourceOperationCoordinator first.
      requireState(state, event.type, [
        "UNINITIALIZED",
        "CHECKING",
        "HEALTHY",
        "DEGRADED",
        "STALE",
        "BROKEN",
        "RECOVERED"
      ]);
      return "CHECKING";
    case "HEAL_RERUN_STARTED":
      requireState(state, event.type, ["REVIEW_PENDING"]);
      return "CHECKING";
    case "RUN_PASSED":
      requireState(state, event.type, ["CHECKING"]);
      return event.recovered ? "RECOVERED" : "HEALTHY";
    case "RUN_FAILED":
      requireState(state, event.type, ["CHECKING"]);
      return failedState(event);
    case "TTL_EXPIRED":
      requireState(state, event.type, ["HEALTHY", "DEGRADED", "STALE", "RECOVERED"]);
      return event.hasTrustedSnapshot ? "STALE" : "BROKEN";
    case "HEAL_REQUESTED":
      requireState(state, event.type, ["DEGRADED", "STALE", "BROKEN"]);
      return "HEALING";
    case "HEAL_PREVIEW_READY":
      requireState(state, event.type, ["HEALING"]);
      return "REVIEW_PENDING";
    case "HEAL_REJECTED":
      requireState(state, event.type, ["REVIEW_PENDING"]);
      return failedState(event);
    case "HEAL_FAILED":
      requireState(state, event.type, ["HEALING", "REVIEW_PENDING"]);
      return failedState(event);
  }
}

export function isWithinTtl(observedAt: string, ttlMinutes: number, now = new Date()): boolean {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return false;
  return now.getTime() - observed.getTime() <= ttlMinutes * 60_000;
}
