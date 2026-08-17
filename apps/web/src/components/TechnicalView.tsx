import { ArrowDown, ArrowSquareOut, Check, GitDiff, ShieldWarning } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { CityResponse, Incident } from "../types";
import { formatInstant, formatPercent, formatState, sourceHost } from "./format";
import { statusContent } from "./status-content";
import { StatusBanner } from "./StatusBanner";

export function TechnicalView({
  city,
  incident,
  controls
}: {
  city: CityResponse;
  incident: Incident | null;
  controls?: ReactNode;
}) {
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const status = statusContent[city.source.status];
  const quarantined = Boolean(incident);
  const reportLabel = snapshot ? status.reportLabel : "No verified report";

  return (
    <main id="main" className="technical-view">
      <section className="page-width technical-intro" aria-labelledby="technical-title">
        <div>
          <p className="kicker">Source integrity / {city.city.displayName}</p>
          <h1 id="technical-title">Publication control room</h1>
          <p>
            See exactly how source-published information becomes a trusted public snapshot—and how
            malformed extraction is held for human review.
          </p>
        </div>
        <dl className="technical-intro__facts">
          <div>
            <dt>Source</dt>
            <dd>{city.source.agencyName}</dd>
          </div>
          <div>
            <dt>Collector ID</dt>
            <dd>
              <code>{city.source.collectorId}</code>
            </dd>
          </div>
          <div>
            <dt>Public report</dt>
            <dd>{reportLabel}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{city.source.mode === "mock" ? "Deterministic fixture" : "Bright Data live"}</dd>
          </div>
        </dl>
      </section>

      <div className="page-width">
        <StatusBanner state={city.source.status} hasSnapshot={Boolean(snapshot)} />
        {controls}

        <section className="pipeline-board" aria-labelledby="pipeline-title">
          <header className="pipeline-board__header">
            <div>
              <p className="section-label">End-to-end publication path</p>
              <h2 id="pipeline-title">Untrusted input has one route to public data.</h2>
            </div>
            <p>
              Public reads use <code>publishedSnapshotId</code>, never the newest candidate.
            </p>
          </header>

          <div className="pipeline-layout">
            <ol className="pipeline-flow" aria-label="Source publication pipeline">
              <li className="pipeline-node pipeline-node--source">
                <span className="pipeline-node__step">01 / SOURCE</span>
                <strong>{city.source.agencyName}</strong>
                <dl>
                  <div>
                    <dt>Host</dt>
                    <dd>{sourceHost(city.source.canonicalUrl)}</dd>
                  </div>
                  <div>
                    <dt>Policy</dt>
                    <dd>{city.source.policyVersion}</dd>
                  </div>
                </dl>
                <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
                  Open source <ArrowSquareOut size={14} aria-hidden="true" />
                </a>
              </li>

              <li className="pipeline-node pipeline-node--collector">
                <span className="pipeline-node__step">02 / SCRAPER STUDIO</span>
                <strong>{city.source.collectorId}</strong>
                <dl>
                  <div>
                    <dt>Version</dt>
                    <dd>{run?.collectorVersion ?? "Not available"}</dd>
                  </div>
                  <div>
                    <dt>Rows returned</dt>
                    <dd>{run?.recordCount ?? 0}</dd>
                  </div>
                </dl>
              </li>

              <li
                className={`pipeline-node pipeline-node--contract ${
                  quarantined ? "pipeline-node--failed" : "pipeline-node--passed"
                }`}
              >
                <span className="pipeline-node__step">03 / TYPED CONTRACT</span>
                <strong>{run ? formatState(run.outcome) : "No completed run"}</strong>
                <dl>
                  <div>
                    <dt>Required fields</dt>
                    <dd>{formatPercent(run?.validationSummary.requiredFieldCompleteness)}</dd>
                  </div>
                  <div>
                    <dt>Reason codes</dt>
                    <dd>{run?.reasonCodes.length ?? 0}</dd>
                  </div>
                </dl>
              </li>

              <li className="pipeline-node pipeline-node--published">
                <span className="pipeline-node__step">04 / PUBLISHED SNAPSHOT</span>
                <strong>
                  {snapshot ? `${snapshot.sites.length} trusted records` : "No snapshot"}
                </strong>
                <dl>
                  <div>
                    <dt>Public state</dt>
                    <dd>{reportLabel}</dd>
                  </div>
                  <div>
                    <dt>Observed</dt>
                    <dd>{formatInstant(snapshot?.observedAt, city.city.timezone)}</dd>
                  </div>
                </dl>
              </li>
            </ol>

            <aside
              className={`quarantine-ledger ${
                quarantined ? "quarantine-ledger--active" : "quarantine-ledger--idle"
              }`}
              aria-label="Quarantine branch"
            >
              <ArrowDown size={20} aria-hidden="true" />
              <div>
                <span>CONTRACT FAILURE BRANCH</span>
                <strong>{quarantined ? "Candidate quarantined" : "Quarantine clear"}</strong>
                <p>
                  {quarantined
                    ? `${
                        incident?.reasonCodes.length ?? 0
                      } validation reasons. Published snapshot protected.`
                    : "No candidate is currently held outside the publication path."}
                </p>
              </div>
            </aside>
          </div>
        </section>

        <div className="operations-grid">
          <section
            className={`incident-register ${incident ? "incident-register--active" : ""}`}
            aria-labelledby="incident-title"
          >
            <header className="ledger-title">
              {incident ? (
                <ShieldWarning size={22} aria-hidden="true" />
              ) : (
                <Check size={22} aria-hidden="true" />
              )}
              <div>
                <span>Current incident</span>
                <h2 id="incident-title">
                  {incident ? formatState(incident.healState) : "No unresolved incident"}
                </h2>
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
              <h2 id="run-title">Bounded verification facts</h2>
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
                <dt>Required completeness</dt>
                <dd>{formatPercent(run?.validationSummary.requiredFieldCompleteness)}</dd>
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
          <section className="repair-review" aria-labelledby="repair-title">
            <header className="ledger-title">
              <GitDiff size={22} aria-hidden="true" />
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

        <section className="timeline-register" aria-labelledby="timeline-title">
          <header>
            <span>Recovery timeline</span>
            <h2 id="timeline-title">Every publication decision leaves a trace.</h2>
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
