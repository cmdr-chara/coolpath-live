import type { SourceState } from "../types";

export interface StatusContent {
  title: string;
  description: string;
  tone: "neutral" | "positive" | "warning" | "critical";
  code: string;
  reportLabel: string;
  current: boolean;
}

export const statusContent: Record<SourceState, StatusContent> = {
  UNINITIALIZED: {
    title: "Verification has not started",
    description: "No published snapshot is available. Use the source page directly.",
    tone: "neutral",
    code: "GATE / WAIT",
    reportLabel: "No verified report",
    current: false
  },
  CHECKING: {
    title: "Checking the public source",
    description: "Any last trusted report remains protected while validation runs.",
    tone: "neutral",
    code: "GATE / RUN",
    reportLabel: "Last trusted report",
    current: false
  },
  HEALTHY: {
    title: "Verified public source",
    description: "The published snapshot passed the current source contract.",
    tone: "positive",
    code: "GATE / PASS",
    reportLabel: "Current verified data",
    current: true
  },
  DEGRADED: {
    title: "Temporarily unverifiable",
    description: "Showing the last trusted report while the source issue is reviewed.",
    tone: "warning",
    code: "LOCK / ACTIVE",
    reportLabel: "Last trusted report",
    current: false
  },
  STALE: {
    title: "Last trusted report",
    description: "This information is historical and outside its freshness window.",
    tone: "warning",
    code: "TTL / EXPIRED",
    reportLabel: "Historical report",
    current: false
  },
  BROKEN: {
    title: "Current source check failed",
    description:
      "No unverified candidate is public. A last trusted report is shown only when one exists.",
    tone: "critical",
    code: "GATE / CLOSED",
    reportLabel: "Last trusted report",
    current: false
  },
  HEALING: {
    title: "Collector repair in progress",
    description: "A field-specific repair is being prepared for human review.",
    tone: "warning",
    code: "REPAIR / RUN",
    reportLabel: "Last trusted report",
    current: false
  },
  REVIEW_PENDING: {
    title: "Repair needs manual approval",
    description: "No selector change is applied before the preview is approved.",
    tone: "warning",
    code: "REVIEW / HOLD",
    reportLabel: "Last trusted report",
    current: false
  },
  RECOVERED: {
    title: "Source recovered and re-verified",
    description: "The repaired collector passed the complete contract before publication.",
    tone: "positive",
    code: "GATE / RESTORED",
    reportLabel: "Current verified data",
    current: true
  }
};
