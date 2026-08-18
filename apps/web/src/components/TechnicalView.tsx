import { ArrowSquareOut, Check, GitDiff, ShieldWarning } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";
import { useEntranceMotion } from "../hooks/useEntranceMotion";
import type { CityResponse, Incident } from "../types";
import { formatInstant, formatPercent, formatState, sourceHost } from "./format";
import { statusContent } from "./status-content";

export function TechnicalView({
  city,
  incident,
  controls
}: {
  city: CityResponse;
  incident: Incident | null;
  controls?: ReactNode;
}) {
  const viewRef = useRef<HTMLElement>(null);
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const status = statusContent[city.source.status];
  const quarantined = Boolean(incident);
  const reportLabel = snapshot ? status.reportLabel : "No verified report";
  const incidentTitle = !incident
    ? "No unresolved incident"
    : city.source.status === "REVIEW_PENDING"
      ? "Repair review pending"
      : city.source.status === "HEALING"
        ? "Repair in progress"
        : "Candidate quarantined";

  const pipeline = [
    {
      key: "source",
      label: "Source",
      value: city.source.agencyName,
      detail: sourceHost(city.source.canonicalUrl),
      tone: "passed"
    },
    {
      key: "collector",
      label: "Scraper Studio",
      value: run ? `${run.recordCount} rows returned` : "No completed run",
      detail: city.source.collectorId,
      tone: "passed"
    },
    {
      key: "contract",
      label: "Validation",
      value: run ? formatState(run.outcome) : "Not available",
      detail: `${formatPercent(run?.validationSummary.requiredFieldCompleteness)} required fields`,
      tone: quarantined ? "failed" : "passed"
    },
    {
      key: "published",
      label: "Published snapshot",
      value: snapshot ? `${snapshot.sites.length} trusted records` : "No snapshot",
      detail: reportLabel,
      tone: snapshot ? "passed" : "neutral"
    }
  ];

  useEntranceMotion(viewRef);

  return (
    <main id="main" ref={viewRef} className="technical-view">
      <div className="page-width technical-layout">
        <section className="integrity-header" aria-labelledby="technical-title" data-motion-section>
          <div className="integrity-header__title">
            <p className="kicker">Source integrity / {city.city.displayName}</p>
            <h1 id="technical-title">Source integrity</h1>
            <p>{city.source.agencyName}</p>
          </div>

          <div className={`integrity-state integrity-state--${status.tone}`} aria-live="polite">
            <span className="status-dot" aria-hidden="true" />
            <div>
              <strong>{status.title}</strong>
              <span>{reportLabel}</span>
            </div>
          </div>

          <dl className="integrity-identity">
            <div>
              <dt>Collector</dt>
              <dd>
                <code>{city.source.collectorId}</code>
              </dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{city.source.mode === "mock" ? "Deterministic fixture" : "Bright Data live"}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
                  {sourceHost(city.source.canonicalUrl)}
                  <ArrowSquareOut size={13} aria-hidden="true" />
                </a>
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="integrity-metrics"
          aria-label="Latest publication metrics"
          data-motion-section
        >
          <div data-motion-item>
            <span>Rows returned</span>
            <strong>{run?.recordCount ?? 0}</strong>
          </div>
          <div data-motion-item>
            <span>Published</span>
            <strong>{snapshot?.sites.length ?? 0}</strong>
          </div>
          <div data-motion-item>
            <span>Required fields</span>
            <strong>{formatPercent(run?.validationSummary.requiredFieldCompleteness)}</strong>
          </div>
          <div data-motion-item>
            <span>Reason codes</span>
            <strong>{run?.reasonCodes.length ?? 0}</strong>
          </div>
        </section>

        <section className="pipeline-panel" aria-labelledby="pipeline-title" data-motion-section>
          <header className="pipeline-panel__header">
            <div>
              <p className="section-label">Publication boundary</p>
              <h2 id="pipeline-title">One route from source to public data</h2>
            </div>
            <p>
              Public reads follow <code>publishedSnapshotId</code>, never the newest candidate.
            </p>
          </header>

          <ol className="pipeline-strip" aria-label="Source publication pipeline">
            {pipeline.map((step, index) => (
              <li
                key={step.key}
                className={`pipeline-step pipeline-step--${step.tone}`}
                data-motion-item
              >
                <span className="pipeline-step__marker" aria-hidden="true">
                  {step.tone === "failed" ? "!" : step.tone === "passed" ? "✓" : index + 1}
                </span>
                <div>
                  <span className="pipeline-step__label">{step.label}</span>
                  <strong>{step.value}</strong>
                  <small>{step.detail}</small>
                </div>
              </li>
            ))}
          </ol>

          <aside
            className={`quarantine-branch ${
              quarantined ? "quarantine-branch--active" : "quarantine-branch--idle"
            }`}
            aria-label="Quarantine branch"
          >
            <ShieldWarning size={17} aria-hidden="true" />
            <div>
              <strong>{quarantined ? "Candidate quarantined" : "Quarantine clear"}</strong>
              <span>
                {quarantined
                  ? `${incident?.reasonCodes.length ?? 0} validation reasons. Published snapshot protected.`
                  : "No candidate is currently held outside the publication path."}
              </span>
            </div>
          </aside>
        </section>

        {controls ? (
          <div className="technical-controls-motion" data-motion-section>
            {controls}
          </div>
        ) : null}

        <div
          className={`operations-grid ${
            incident ? "operations-grid--incident" : "operations-grid--healthy"
          }`}
          data-motion-section
        >
          <section
            className={`incident-register ${
              incident ? "incident-register--active" : "incident-register--clear"
            }`}
            aria-labelledby="incident-title"
          >
            <header className="ledger-title">
              {incident ? (
                <ShieldWarning size={20} aria-hidden="true" />
              ) : (
                <Check size={20} aria-hidden="true" />
              )}
              <div>
                <span>Current incident</span>
                <h2 id="incident-title">{incidentTitle}</h2>
              </div>
            </header>
            {incident ? (
              <>
                <dl className="incident-meta">
                  <div>
                    <dt>Opened</dt>
                    <dd>{formatInstant(incident.openedAt, city.city.timezone)}</dd>
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
              </>
            ) : (
              <p className="ledger-empty">
                The current public snapshot is backed by a passing collector run.
              </p>
            )}
          </section>

          <section className="run-register" aria-labelledby="run-title">
            <header>
              <span>Latest collector run</span>
              <h2 id="run-title">Verification facts</h2>
            </header>
            <dl>
              <div>
                <dt>Outcome</dt>
                <dd>{run ? formatState(run.outcome) : "Not available"}</dd>
              </div>
              <div>
                <dt>Record count</dt>
                <dd>{run?.recordCount ?? 0}</dd>
              </div>
              <div>
                <dt>Optional claim coverage</dt>
                <dd>{formatPercent(run?.validationSummary.optionalClaimCoverage)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{formatInstant(run?.completedAt, city.city.timezone)}</dd>
              </div>
              <div>
                <dt>Snapshot ID</dt>
                <dd>
                  <code>{snapshot?.id ?? "Not available"}</code>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {incident?.healDiff.length ? (
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

        <section className="timeline-register" aria-labelledby="timeline-title" data-motion-section>
          <header>
            <span>Activity</span>
            <h2 id="timeline-title">Publication history</h2>
          </header>
          {city.timeline.length === 0 ? (
            <p className="ledger-empty">No source events have been recorded yet.</p>
          ) : (
            <ol>
              {city.timeline.map((event) => (
                <li key={event.id} className={`timeline-event timeline-event--${event.tone}`}>
                  <time dateTime={event.occurredAt}>
                    {formatInstant(event.occurredAt, city.city.timezone)}
                  </time>
                  <div>
                    <strong>{event.title}</strong>
                    <p>{event.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
