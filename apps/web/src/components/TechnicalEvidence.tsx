import { Check } from "@phosphor-icons/react";
import publishedProvenance from "../assets/published-provenance-v2.webp";
import verificationEvidence from "../assets/verification-evidence-v2.webp";
import type { CityResponse } from "../types";
import { formatInstant, formatPercent, formatState } from "./format";
import { lineageMetrics } from "./lineage-metrics";

export function TechnicalEvidence({ city }: { city: CityResponse }) {
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const lineage = lineageMetrics(run, snapshot?.sites.length ?? 0);

  return (
    <section className="technical-card-grid" aria-label="Verification evidence" data-motion-section>
      <article className="technical-card verification-card" data-motion-item>
        <div className="technical-card__content">
          <p className="section-label">Validation accounting</p>
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
              <dt>Non-locations filtered</dt>
              <dd>{lineage.recordsFilteredNotLocations}</dd>
            </div>
            <div>
              <dt>Exact duplicates removed</dt>
              <dd>{lineage.exactDuplicatesRemoved}</dd>
            </div>
            <div>
              <dt>Validation rejections</dt>
              <dd>{lineage.recordsRejectedByValidation}</dd>
            </div>
            <div>
              <dt>Reason codes</dt>
              <dd>{run?.reasonCodes.length ?? 0}</dd>
            </div>
          </dl>
        </div>
        <img
          className="technical-card__illustration"
          src={verificationEvidence}
          alt=""
          width={900}
          height={675}
          loading="lazy"
          aria-hidden="true"
        />
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
          <strong>{lineage.publishedRecords}</strong>
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
        <img
          className="technical-card__illustration"
          src={publishedProvenance}
          alt=""
          width={900}
          height={675}
          loading="lazy"
          aria-hidden="true"
        />
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
  );
}
