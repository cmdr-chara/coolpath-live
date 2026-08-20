import { describe, expect, it } from "vitest";
import { pipelineVisualState } from "./pipeline-state";

describe("pipelineVisualState", () => {
  it("shows the complete trusted path only after a healthy publication", () => {
    expect(pipelineVisualState("HEALTHY", true)).toEqual({
      source: "passed",
      collector: "passed",
      contract: "passed",
      published: "passed",
      scanTone: "healthy"
    });
  });

  it("keeps the last published snapshot protected while validation fails", () => {
    const state = pipelineVisualState("DEGRADED", true);
    expect(state.contract).toBe("failed");
    expect(state.published).toBe("protected");
    expect(state.scanTone).toBe("warning");
  });

  it("does not imply repaired selectors are published during human review", () => {
    const state = pipelineVisualState("REVIEW_PENDING", true);
    expect(state.contract).toBe("review");
    expect(state.published).toBe("protected");
  });

  it("does not fabricate a protected publication without a trusted snapshot", () => {
    expect(pipelineVisualState("BROKEN", false).published).toBe("neutral");
    expect(pipelineVisualState("UNINITIALIZED", false).source).toBe("neutral");
  });
});
