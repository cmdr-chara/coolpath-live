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

export type SourceState = (typeof sourceStates)[number];

export type SourceEvent =
  | { type: "CHECK_STARTED" }
  | { type: "RUN_PASSED"; recovered: boolean }
  | { type: "RUN_FAILED"; hasTrustedSnapshot: boolean; withinTtl: boolean; inconclusive: boolean }
  | { type: "TTL_EXPIRED"; hasTrustedSnapshot: boolean }
  | { type: "HEAL_REQUESTED" }
  | { type: "HEAL_PREVIEW_READY" }
  | { type: "HEAL_REJECTED" };

export function transitionSourceState(state: SourceState, event: SourceEvent): SourceState {
  switch (event.type) {
    case "CHECK_STARTED":
      return "CHECKING";
    case "RUN_PASSED":
      return event.recovered ? "RECOVERED" : "HEALTHY";
    case "RUN_FAILED":
      if (event.inconclusive && event.hasTrustedSnapshot) {
        return event.withinTtl ? "DEGRADED" : "STALE";
      }
      if (event.hasTrustedSnapshot && event.withinTtl) return "DEGRADED";
      if (event.hasTrustedSnapshot) return "STALE";
      return "BROKEN";
    case "TTL_EXPIRED":
      return event.hasTrustedSnapshot ? "STALE" : "BROKEN";
    case "HEAL_REQUESTED":
      return "HEALING";
    case "HEAL_PREVIEW_READY":
      return "REVIEW_PENDING";
    case "HEAL_REJECTED":
      return state === "REVIEW_PENDING" ? "BROKEN" : state;
  }
}

export function isWithinTtl(observedAt: string, ttlMinutes: number, now = new Date()): boolean {
  const observed = new Date(observedAt);
  if (Number.isNaN(observed.getTime())) return false;
  return now.getTime() - observed.getTime() <= ttlMinutes * 60_000;
}
