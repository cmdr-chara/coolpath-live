import { ArrowClockwise, Check, Heartbeat, Wrench } from "@phosphor-icons/react";
import type { Incident, SourceState } from "../types";

export type DemoAction = "reset" | "drift" | "heal" | "approve";

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
  const actions = [
    {
      id: "reset" as const,
      number: "01",
      label: "Healthy baseline",
      detail: "Publish the passing fixture",
      icon: ArrowClockwise,
      disabled: pending
    },
    {
      id: "drift" as const,
      number: "02",
      label: "Simulate drift",
      detail: "Quarantine malformed output",
      icon: Heartbeat,
      disabled: pending
    },
    {
      id: "heal" as const,
      number: "03",
      label: "Prepare repair",
      detail: "Generate a selector preview",
      icon: Wrench,
      disabled: pending || !incident || state === "REVIEW_PENDING"
    },
    {
      id: "approve" as const,
      number: "04",
      label: "Approve and re-run",
      detail: "Validate before publication",
      icon: Check,
      disabled: pending || state !== "REVIEW_PENDING"
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
                disabled={action.disabled}
                aria-describedby="presenter-feedback"
                onClick={() => onAction(action.id)}
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
        {feedback}
      </p>
    </section>
  );
}
