import { ArrowRight, ShieldWarning } from "@phosphor-icons/react";
import type { CityResponse, Incident } from "../types";
import { formatPercent, formatState, sourceHost } from "./format";
import { lineageMetrics } from "./lineage-metrics";
import { pipelineVisualState, type PipelineTone } from "./pipeline-state";

interface PipelineStep {
  key: "source" | "collector" | "contract" | "published";
  label: string;
  value: string;
  detail: string;
  tone: PipelineTone;
}

function toneLabel(tone: PipelineTone): string {
  if (tone === "passed") return "Passed";
  if (tone === "failed") return "Failed";
  if (tone === "review") return "Needs review";
  if (tone === "active") return "Running";
  if (tone === "protected") return "Protected";
  return "Waiting";
}

export function PublicationScan({
  city,
  incident,
  reportLabel
}: {
  city: CityResponse;
  incident: Incident | null;
  reportLabel: string;
}) {
  const run = city.latestRun;
  const snapshot = city.snapshot;
  const lineage = lineageMetrics(run, snapshot?.sites.length ?? 0);
  const visualState = pipelineVisualState(city.source.status, Boolean(snapshot));
  const pipeline: PipelineStep[] = [
    {
      key: "source",
      label: "Source",
      value: city.source.agencyName,
      detail:
        city.source.mode === "mock"
          ? "Synthetic demo fixture"
          : sourceHost(city.source.canonicalUrl),
      tone: visualState.source
    },
    {
      key: "collector",
      label: "Scraper Studio",
      value: run ? `${lineage.providerRecordsReceived} provider rows` : "No completed run",
      detail: city.source.collectorId,
      tone: visualState.collector
    },
    {
      key: "contract",
      label: "Normalization + validation",
      value: run ? formatState(run.outcome) : "Not available",
      detail: run
        ? `${lineage.normalizedRecordsAccepted} normalized; ${formatPercent(
            run.validationSummary.requiredFieldCompleteness
          )} required fields`
        : "No candidate evaluated",
      tone: visualState.contract
    },
    {
      key: "published",
      label: "Published snapshot",
      value: snapshot ? `${lineage.publishedRecords} trusted records` : "No snapshot",
      detail: reportLabel,
      tone: visualState.published
    }
  ];

  return (
    <section className="publication-flow" aria-labelledby="pipeline-title" data-motion-section>
      <header className="publication-flow__header">
        <div>
          <p className="section-label">Publication boundary</p>
          <h2 id="pipeline-title">
            Source → Scraper Studio → Normalization + validation → Published
          </h2>
        </div>
        <p>
          Public reads use <code>publishedSnapshotId</code>, never an unverified candidate.
        </p>
      </header>

      <ol className="publication-flow__steps" aria-label="Source publication pipeline">
        {pipeline.map((step, index) => (
          <li
            key={step.key}
            className={`publication-flow__step publication-flow__step--${step.tone}`}
          >
            <div className="publication-flow__step-heading">
              <span className="publication-flow__number">0{index + 1}</span>
              <span className="publication-flow__status">{toneLabel(step.tone)}</span>
            </div>
            <span className="publication-flow__label">{step.label}</span>
            <strong>{step.value}</strong>
            <small>{step.detail}</small>
            {index < pipeline.length - 1 ? (
              <ArrowRight className="publication-flow__arrow" size={18} aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>

      {incident ? (
        <aside className="publication-flow__quarantine" aria-label="Quarantine branch">
          <ShieldWarning size={22} aria-hidden="true" />
          <div>
            <span>Held outside public reads</span>
            <strong>Candidate quarantined</strong>
            <small>
              {incident.reasonCodes.length} validation reasons. The last trusted snapshot remains
              published.
            </small>
          </div>
        </aside>
      ) : null}
    </section>
  );
}
