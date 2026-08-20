import { ArrowSquareOut } from "@phosphor-icons/react";
import type { CityResponse, Incident } from "../types";
import { formatState, sourceHost } from "./format";
import { lineageMetrics } from "./lineage-metrics";
import { PublicationScan } from "./PublicationScan";
import { statusContent } from "./status-content";

export function TechnicalOverview({
  city,
  incident
}: {
  city: CityResponse;
  incident: Incident | null;
}) {
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const status = statusContent[city.source.status];
  const lineage = lineageMetrics(run, snapshot?.sites.length ?? 0);
  const reportLabel = snapshot ? status.reportLabel : "No verified report";
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
          <p>{status.description}</p>
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
            <dt>Latest run</dt>
            <dd>{run ? formatState(run.outcome) : "Not available"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {city.source.mode === "mock" ? (
                <span className="source-fixture">Synthetic fixture</span>
              ) : (
                <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
                  {sourceHost(city.source.canonicalUrl)}
                  <ArrowSquareOut size={13} aria-hidden="true" />
                </a>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section
        className="integrity-metrics"
        aria-label="Latest Bright Data lineage metrics"
        data-motion-section
      >
        <div data-motion-item>
          <span>Provider rows</span>
          <strong>{lineage.providerRecordsReceived}</strong>
          <small>Scraper Studio dataset</small>
        </div>
        <div data-motion-item>
          <span>Normalized</span>
          <strong>{lineage.normalizedRecordsAccepted}</strong>
          <small>source rows accepted</small>
        </div>
        <div data-motion-item>
          <span>Published</span>
          <strong>{lineage.publishedRecords}</strong>
          <small>trusted public records</small>
        </div>
        <div data-motion-item>
          <span>Quarantined records</span>
          <strong>{lineage.recordsQuarantined}</strong>
          <small>withheld from public reads</small>
        </div>
      </section>

      <PublicationScan city={city} incident={incident} reportLabel={reportLabel} />
    </>
  );
}
