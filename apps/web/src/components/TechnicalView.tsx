import { ArrowSquareOut, Check, GitDiff, ShieldWarning } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";
import bridgeRiver from "../assets/bridge-river.svg";
import civicBuilding from "../assets/civic-building.svg";
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
  const incidentTitle =
    city.source.status === "REVIEW_PENDING"
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
      label: "Published",
      value: snapshot ? `${snapshot.sites.length} trusted records` : "No snapshot",
      detail: reportLabel,
      tone: snapshot ? "passed" : "neutral"
    }
  ];

  useEntranceMotion(viewRef);

  return (
    <main id="main" ref={viewRef} className="technical-view">
      <div className="page-width technical-layout">
        <section className="integrity-hero" aria-labelledby="technical-title" data-motion-section>
          <div className="integrity-hero__copy">
            <p className="kicker">Source integrity / {city.city.displayName}</p>
            <div className="integrity-hero__title-row">
              <h1 id="technical-title">Source integrity</h1>
              <span className={`integrity-pill integrity-pill--${status.tone}`}>
                <span className="status-dot" aria-hidden="true" />
                {status.title}
              </span>
            </div>
            <p>
              The public directory is backed by a published snapshot that passed the validation
              boundary.
            </p>
          </div>

          <dl className="integrity-hero__identity">
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
            <span>Published</span>
            <strong>{snapshot?.sites.length ?? 0}</strong>
            <small>trusted locations</small>
          </div>
          <div data-motion-item>
            <span>Rows returned</span>
            <strong>{run?.recordCount ?? 0}</strong>
            <small>latest collector run</small>
          </div>
          <div data-motion-item>
            <span>Required fields</span>
            <strong>{formatPercent(run?.validationSummary.requiredFieldCompleteness)}</strong>
            <small>validation coverage</small>
          </div>
          <div data-motion-item>
            <span>Reason codes</span>
            <strong>{run?.reasonCodes.length ?? 0}</strong>
            <small>{quarantined ? "candidate held" : "latest run"}</small>
          </div>
        </section>

        <section className="pipeline-panel" aria-labelledby="pipeline-title" data-motion-section>
          <header className="pipeline-panel__header">
            <div>
              <p className="section-label">Publication boundary</p>
              <h2 id="pipeline-title">Source → Scraper Studio → Validation → Published</h2>
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

        {incident ? (
          <section className="incident-feature" aria-labelledby="incident-title" data-motion-section>
            <div className="incident-feature__title">
              <ShieldWarning size={22} aria-hidden="true" />
              <div>
                <span>Current incident</span>
                <h2 id="incident-title">{incidentTitle}</h2>
                <p>The failed candidate remains outside the public publication path.</p>
              </div>
            </div>
            <dl className="incident-feature__meta">
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
          </section>
        ) : null}

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

        <section className="technical-card-grid" aria-label="Verification evidence" data-motion-section>
          <article className="technical-card verification-card" data-motion-item>
            <div className="technical-card__content">
              <p className="section-label">Verification facts</p>
              <dl className="fact-list">
                <div>
                  <dt>Outcome</dt>
                  <dd>{run ? formatState(run.outcome) : "Not available"}</dd>
                </div>
                <div>
                  <dt>Required fields</dt>
                  <dd>{formatPercent(run?.validationSummary.requiredFieldCompleteness)}</dd>
                </div>
                <div>
                  <dt>Optional coverage</dt>
                  <dd>{formatPercent(run?.validationSummary.optionalClaimCoverage)}</dd>
                </div>
                <div>
                  <dt>Reason codes</dt>
                  <dd>{run?.reasonCodes.length ?? 0}</dd>
                </div>
              </dl>
            </div>
            <img src={civicBuilding} alt="" aria-hidden="true" />
          </article>

          <article className="technical-card activity-card" data-motion-item>
            <p className="section-label">Latest activity</p>
            {city.timeline.length === 0 ? (
              <p className="card-empty">No source events have been recorded yet.</p>
            ) : (
              <ol>
                {city.timeline.slice(0, 3).map((event) => (
                  <li key={event.id} className={`activity-item activity-item--${event.tone}`}>
                    <time dateTime={event.occurredAt}>
                      {formatInstant(event.occurredAt, city.city.timezone)}
                    </time>
                    <div>
                      <strong>{event.title}</strong>
                      <span>{event.detail}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>

          <article className="technical-card snapshot-card" data-motion-item>
            <p className="section-label">Published snapshot</p>
            <div className="snapshot-card__hero">
              <strong>{snapshot?.sites.length ?? 0}</strong>
              <span>trusted records available to public reads</span>
            </div>
            <dl className="fact-list fact-list--compact">
              <div>
                <dt>Observed</dt>
                <dd>{formatInstant(snapshot?.observedAt, city.city.timezone)}</dd>
              </div>
              <div>
                <dt>Snapshot ID</dt>
                <dd>
                  <code>{snapshot?.id ?? "Not available"}</code>
                </dd>
              </div>
            </dl>
          </article>

          <article className="technical-card trust-card" data-motion-item>
            <img src={bridgeRiver} alt="" aria-hidden="true" />
            <div className="trust-card__copy">
              <p className="section-label">Data you can trust</p>
              <ul>
                <li>
                  <Check size={15} aria-hidden="true" /> Public source provenance
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Validation before publication
                </li>
                <li>
                  <Check size={15} aria-hidden="true" /> Human review before repaired selectors publish
                </li>
              </ul>
            </div>
          </article>
        </section>

        {controls ? (
          <div className="technical-controls-motion" data-motion-section>
            {controls}
          </div>
        ) : null}
      </div>
    </main>
  );
}
