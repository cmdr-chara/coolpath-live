import type { SourceState } from "../types";

export type PipelineTone = "neutral" | "active" | "passed" | "failed" | "review" | "protected";

export interface PipelineVisualState {
  source: PipelineTone;
  collector: PipelineTone;
  contract: PipelineTone;
  published: PipelineTone;
  scanTone: "healthy" | "active" | "warning" | "critical";
}

export function pipelineVisualState(
  state: SourceState,
  hasPublishedSnapshot: boolean
): PipelineVisualState {
  const protectedPublication: PipelineTone = hasPublishedSnapshot ? "protected" : "neutral";

  switch (state) {
    case "HEALTHY":
    case "RECOVERED":
      return {
        source: "passed",
        collector: "passed",
        contract: "passed",
        published: hasPublishedSnapshot ? "passed" : "neutral",
        scanTone: "healthy"
      };
    case "CHECKING":
      return {
        source: "passed",
        collector: "active",
        contract: "active",
        published: protectedPublication,
        scanTone: "active"
      };
    case "DEGRADED":
      return {
        source: "passed",
        collector: "passed",
        contract: "failed",
        published: protectedPublication,
        scanTone: "warning"
      };
    case "STALE":
      return {
        source: "passed",
        collector: "passed",
        contract: "review",
        published: protectedPublication,
        scanTone: "warning"
      };
    case "BROKEN":
      return {
        source: "passed",
        collector: "failed",
        contract: "neutral",
        published: protectedPublication,
        scanTone: "critical"
      };
    case "HEALING":
      return {
        source: "passed",
        collector: "active",
        contract: "review",
        published: protectedPublication,
        scanTone: "warning"
      };
    case "REVIEW_PENDING":
      return {
        source: "passed",
        collector: "passed",
        contract: "review",
        published: protectedPublication,
        scanTone: "warning"
      };
    case "UNINITIALIZED":
      return {
        source: "neutral",
        collector: "neutral",
        contract: "neutral",
        published: "neutral",
        scanTone: "active"
      };
  }
}
