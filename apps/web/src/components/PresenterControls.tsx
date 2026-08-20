import { ArrowClockwise, Check, Heartbeat, Wrench, X } from "@phosphor-icons/react";
import { useState } from "react";
import type { Incident, SourceState } from "../types";

export type DemoAction = "reset" | "drift" | "heal" | "approve" | "reject";

export function PresenterControls({
  state,
  incident,
  pending,
  feedback,
  onAction
}: {
  state: SourceState;
  incident: Incident | null;
  pending: boolean;
  feedback: string;
  onAction: (action: DemoAction) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const actions = [
    {
      id: "reset" as const,
      number: "01",
      label: "Healthy baseline",
      detail: "Publish the passing fixture",
      icon: ArrowClockwise,
      unavailableReason: pending ? "Wait for the current action to finish." : null
    },
    {
      id: "drift" as const,
      number: "02",
      label: "Simulate drift",
      detail: "Quarantine malformed output",
      icon: Heartbeat,
      unavailableReason: pending ? "Wait for the current action to finish." : null
    },
    {
      id: "heal" as const,
      number: "03",
      label: "Prepare repair",
      detail: "Generate a selector preview",
      icon: Wrench,
      unavailableReason: pending
        ? "Wait for the current action to finish."
        : state === "REVIEW_PENDING"
          ? "A repair preview is already ready for review."
          : !incident
            ? "Run Simulate drift first to create a quarantined candidate."
            : null
    },
    {
      id: "approve" as const,
      number: "04",
      label: "Approve and re-run",
      detail: "Validate before publication",
      icon: Check,
      unavailableReason: pending
        ? "Wait for the current action to finish."
        : state !== "REVIEW_PENDING"
          ? "Run Prepare repair first, then review the preview."
          : null
    },
    {
      id: "reject" as const,
      number: "05",
      label: "Reject repair",
      detail: "Keep the collector unchanged",
      icon: X,
      unavailableReason: pending
        ? "Wait for the current action to finish."
        : state !== "REVIEW_PENDING"
          ? "Run Prepare repair first, then review the preview."
          : null
    }
  ];

  return (
    <section className="presenter-console" aria-labelledby="presenter-title">
      <header>
        <div>
          <p className="section-label">Presenter controls / deterministic fixture</p>
          <h2 id="presenter-title">Drift → quarantine → review → recovery</h2>
        </div>
        <p>Mock source, real publication boundary. No action bypasses the typed contract.</p>
      </header>
      <ol className="presenter-steps">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <li key={action.id}>
              <button
                aria-describedby="presenter-feedback"
                data-unavailable={Boolean(action.unavailableReason)}
                title={action.unavailableReason ?? undefined}
                onClick={() => {
                  if (action.unavailableReason) {
                    setInstruction(`${action.label}: ${action.unavailableReason}`);
                    return;
                  }
                  setInstruction("");
                  onAction(action.id);
                }}
              >
                <span className="presenter-steps__number">{action.number}</span>
                <Icon size={20} aria-hidden="true" />
                <span>
                  <strong>{action.label}</strong>
                  <small>{action.detail}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p id="presenter-feedback" className="presenter-feedback" aria-live="polite">
        {instruction || feedback}
      </p>
    </section>
  );
}
