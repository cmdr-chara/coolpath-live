import { ArrowSquareOut, ShieldWarning } from "@phosphor-icons/react";
import type { CityResponse, Incident } from "../types";
import { formatPercent, formatState, sourceHost } from "./format";
import { statusContent } from "./status-content";

export function TechnicalOverview({ city, incident }: { city: CityResponse; incident: Incident | null }) {
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const status = statusContent[city.source.status];
  const quarantined = Boolean(incident);
  const reportLabel = snapshot ? status.reportLabel : "No verified report";
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
  ] as const;

  return (
    <>
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
    </>
  );
}
