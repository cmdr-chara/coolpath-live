import { CheckCircle, ClockCountdown, ShieldCheck, Warning, Wrench } from "@phosphor-icons/react";
import type { SourceState } from "../types";
import { statusContent } from "./status-content";

export function StatusBanner({
  state,
  hasSnapshot = true
}: {
  state: SourceState;
  hasSnapshot?: boolean;
}) {
  const item = statusContent[state];
  const reportLabel = hasSnapshot ? item.reportLabel : "No verified report";
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
    <section
      className={`status-banner status-banner--${item.tone}`}
      aria-label="Source verification status"
      aria-live="polite"
    >
      <Icon size={24} weight="duotone" aria-hidden="true" />
      <div className="status-banner__copy">
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      <div className="status-banner__meta">
        <span>{reportLabel}</span>
        <code>{item.code}</code>
      </div>
    </section>
  );
}
