import { CheckCircle, ClockCountdown, ShieldCheck, Warning, Wrench } from "@phosphor-icons/react";
import type { SourceState } from "../types";

const content: Record<
  SourceState,
  { title: string; description: string; tone: string; code: string }
> = {
  UNINITIALIZED: {
    title: "Verification has not started",
    description: "Use the issuing source until a trusted snapshot is available.",
    tone: "neutral",
    code: "GATE / WAIT"
  },
  CHECKING: {
    title: "Checking the official source",
    description: "The last trusted report remains protected during validation.",
    tone: "neutral",
    code: "GATE / RUN"
  },
  HEALTHY: {
    title: "Reported by the official source",
    description: "The published snapshot passed the current source contract.",
    tone: "positive",
    code: "GATE / PASS"
  },
  DEGRADED: {
    title: "Temporarily unverifiable",
    description: "Showing the last trusted report while the source issue is reviewed.",
    tone: "warning",
    code: "LOCK / ACTIVE"
  },
  STALE: {
    title: "Last trusted report",
    description: "This information is historical and outside its freshness window.",
    tone: "warning",
    code: "TTL / EXPIRED"
  },
  BROKEN: {
    title: "Current list unavailable",
    description: "No unverified candidate is public. Check the issuing source directly.",
    tone: "critical",
    code: "GATE / CLOSED"
  },
  HEALING: {
    title: "Collector repair in progress",
    description: "A field-specific repair is being prepared for human review.",
    tone: "warning",
    code: "REPAIR / RUN"
  },
  REVIEW_PENDING: {
    title: "Repair needs manual approval",
    description: "No selector change is applied before the preview is approved.",
    tone: "warning",
    code: "REVIEW / HOLD"
  },
  RECOVERED: {
    title: "Source recovered and re-verified",
    description: "The repaired collector passed the complete contract before publication.",
    tone: "positive",
    code: "GATE / RESTORED"
  }
};

export function StatusBanner({ state }: { state: SourceState }) {
  const item = content[state];
  const Icon =
    item.tone === "positive"
      ? CheckCircle
      : item.tone === "critical"
        ? Warning
        : state === "HEALING" || state === "REVIEW_PENDING"
          ? Wrench
          : state === "STALE"
            ? ClockCountdown
            : ShieldCheck;
  return (
    <section className={`status-banner status-banner--${item.tone}`} aria-live="polite" data-reveal>
      <Icon size={22} weight="duotone" aria-hidden="true" />
      <div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      <code>{item.code}</code>
    </section>
  );
}
