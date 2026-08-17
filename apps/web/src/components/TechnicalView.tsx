import { ArrowDown, Check, GitDiff, ShieldWarning } from "@phosphor-icons/react";
import type { CityResponse, Incident } from "../types";

function percent(value: number | undefined): string {
  return value === undefined ? "Not available" : `${Math.round(value * 100)}%`;
}

export function TechnicalView({
  city,
  incident
}: {
  city: CityResponse;
  incident: Incident | null;
}) {
  const run = city.latestRun;
  const failed = Boolean(incident);
  return (
    <div className="technical-room">
      <section
        className={`source-flow source-flow--${failed ? "incident" : "clear"}`}
        aria-label="Source verification pipeline"
      >
        <div className="flow-node">
          <span>01</span>
          <small>Official source</small>
          <strong>{city.source.agencyName}</strong>
        </div>
        <div className="flow-connector" aria-hidden="true">
          <i />
        </div>
        <div className="flow-node">
          <span>02</span>
          <small>Collector</small>
          <strong>{city.source.collectorId}</strong>
          <code>v{run?.collectorVersion ?? "?"}</code>
        </div>
        <div className="flow-connector" aria-hidden="true">
          <i />
        </div>
        <div className={`flow-node ${failed ? "flow-node--failed" : ""}`}>
          <span>03</span>
          <small>Contract</small>
          <strong>{run?.outcome ?? "No run"}</strong>
          <code>
            {run?.recordCount ?? 0} rows /{" "}
            {percent(run?.validationSummary.requiredFieldCompleteness)}
          </code>
        </div>
        <div className="flow-connector" aria-hidden="true">
          <i />
        </div>
        <div className="flow-node flow-node--published">
          <span>04</span>
          <small>Public snapshot</small>
          <strong>{city.snapshot?.sites.length ?? 0} trusted records</strong>
          <code>{failed ? "last-known-good protected" : "current and published"}</code>
        </div>
        {failed ? (
          <div className="quarantine-branch">
            <ArrowDown size={18} aria-hidden="true" />
            <span>Candidate diverted</span>
            <strong>QUARANTINED</strong>
          </div>
        ) : null}
      </section>

      <div className="technical-ledger">
        <section className={`incident-ledger ${incident ? "incident-ledger--active" : ""}`}>
          <div className="ledger-heading">
            {incident ? (
              <ShieldWarning size={21} aria-hidden="true" />
            ) : (
              <Check size={21} aria-hidden="true" />
            )}
            <span>Current incident</span>
          </div>
          <h3>{incident ? incident.healState.replaceAll("_", " ") : "No unresolved incident"}</h3>
          {incident ? (
            <>
              <div className="reason-list">
                {incident.reasonCodes.map((reason) => (
                  <code key={reason}>{reason}</code>
                ))}
              </div>
              {incident.healPrompt ? <p className="heal-prompt">{incident.healPrompt}</p> : null}
            </>
          ) : (
            <p>The published snapshot is backed by a passing collector run.</p>
          )}
        </section>
        <section className="run-ledger">
          <div>
            <span>Mode</span>
            <strong>{city.source.mode === "mock" ? "Staged demo" : "Bright Data live"}</strong>
          </div>
          <div>
            <span>Policy</span>
            <strong>{city.source.policyVersion}</strong>
          </div>
          <div>
            <span>Optional coverage</span>
            <strong>{percent(run?.validationSummary.optionalClaimCoverage)}</strong>
          </div>
          <div>
            <span>Completed</span>
            <strong>
              {run ? formatDate(run.completedAt, city.city.timezone) : "Not available"}
            </strong>
          </div>
        </section>
      </div>

      {incident?.healDiff.length ? (
        <section className="repair-diff">
          <div className="ledger-heading">
            <GitDiff size={21} aria-hidden="true" />
            <span>Human review / selector diff</span>
          </div>
          <h3>Repair changes only the failed fields.</h3>
          <div className="diff-list">
            {incident.healDiff.map((change) => (
              <div className="diff-row" key={change.field}>
                <strong>{change.field}</strong>
                <code>{change.before}</code>
                <ArrowDown size={16} aria-label="changes to" />
                <code>{change.after}</code>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="timeline-panel">
        <div className="ledger-heading">
          <span>Recovery history</span>
        </div>
        <h3>Every source decision leaves a trace.</h3>
        <ol className="timeline">
          {city.timeline.map((event) => (
            <li key={event.id} className={`timeline__item timeline__item--${event.tone}`}>
              <time dateTime={event.occurredAt}>
                {formatDate(event.occurredAt, city.city.timezone)}
              </time>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function formatDate(value: string, timeZone: string): string {
  return `${new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone
  }).format(new Date(value))} (${timeZone})`;
}
