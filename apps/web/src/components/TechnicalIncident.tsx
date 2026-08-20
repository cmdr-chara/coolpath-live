import { GitDiff, ShieldWarning } from "@phosphor-icons/react";
import type { Incident, SourceState } from "../types";
import { formatInstant } from "./format";

function incidentTitle(state: SourceState): string {
  if (state === "REVIEW_PENDING") return "Repair review pending";
  if (state === "HEALING") return "Repair in progress";
  return "Candidate quarantined";
}

export function TechnicalIncident({
  incident,
  sourceState,
  timezone
}: {
  incident: Incident | null;
  sourceState: SourceState;
  timezone: string;
}) {
  if (!incident) return null;

  return (
    <>
      <section className="incident-feature" aria-labelledby="incident-title" data-motion-section>
        <div className="incident-feature__title">
          <ShieldWarning size={22} aria-hidden="true" />
          <div>
            <span>Current incident</span>
            <h2 id="incident-title">{incidentTitle(sourceState)}</h2>
            <p>The failed candidate remains outside the public publication path.</p>
          </div>
        </div>
        <dl className="incident-feature__meta">
          <div>
            <dt>Opened</dt>
            <dd>{formatInstant(incident.openedAt, timezone)}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{incident.severity}</dd>
          </div>
        </dl>
        <ul className="reason-codes" aria-label="Incident reasons">
          {incident.reasonCodes.map((reason) => (
            <li key={reason}>
              <code>{reason}</code>
            </li>
          ))}
        </ul>
        {incident.healPrompt ? (
          <details className="repair-prompt">
            <summary>Read the field-specific repair prompt</summary>
            <p>{incident.healPrompt}</p>
          </details>
        ) : null}
      </section>

      {incident.healDiff.length ? (
        <section className="repair-review" aria-labelledby="repair-title" data-motion-section>
          <header className="ledger-title">
            <GitDiff size={20} aria-hidden="true" />
            <div>
              <span>Human review / selector diff</span>
              <h2 id="repair-title">Repair only the failed fields.</h2>
            </div>
          </header>
          <div className="table-scroll" tabIndex={0} aria-label="Scrollable selector changes">
            <table>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {incident.healDiff.map((change) => (
                  <tr key={change.field}>
                    <th scope="row">{change.field}</th>
                    <td>
                      <code>{change.before}</code>
                    </td>
                    <td>
                      <code>{change.after}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
