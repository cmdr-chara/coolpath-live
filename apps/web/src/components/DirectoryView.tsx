import { ArrowSquareOut, ShieldCheck } from "@phosphor-icons/react";
import type { CityResponse, CoolingSite } from "../types";
import { formatInstant } from "./format";
import { SiteList } from "./SiteList";
import { statusContent } from "./status-content";
import { StatusBanner } from "./StatusBanner";

export function DirectoryView({
  city,
  onEvidence
}: {
  city: CityResponse;
  onEvidence: (site: CoolingSite, trigger: HTMLButtonElement) => void;
}) {
  const status = statusContent[city.source.status];
  const sites = city.snapshot?.sites ?? [];
  const reportLabel = city.snapshot ? status.reportLabel : "No verified report";

  return (
    <main id="main" className="page-width directory-view">
      <section className="directory-intro" aria-labelledby="directory-title">
        <div className="directory-intro__title">
          <p className="kicker">
            {city.city.displayName} / {city.city.region}
          </p>
          <h1 id="directory-title">Cooling locations</h1>
          <p className="directory-intro__lede">
            Source-published information from {city.source.agencyName}. CoolPath does not infer
            opening status, current availability, safety, distance or medical suitability.
          </p>
        </div>
        <dl className="provenance-summary" aria-label="Directory provenance">
          <div>
            <dt>Data status</dt>
            <dd>{reportLabel}</dd>
          </div>
          <div>
            <dt>Verified public source</dt>
            <dd>
              <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
                {city.source.agencyName} <ArrowSquareOut size={14} aria-hidden="true" />
              </a>
            </dd>
          </div>
          <div>
            <dt>Last verified</dt>
            <dd>
              {city.snapshot ? (
                <time dateTime={city.snapshot.observedAt}>
                  {formatInstant(city.snapshot.observedAt, city.city.timezone)}
                </time>
              ) : (
                "Not yet verified"
              )}
            </dd>
          </div>
          <div>
            <dt>Published records</dt>
            <dd>{sites.length}</dd>
          </div>
        </dl>
      </section>

      <StatusBanner state={city.source.status} hasSnapshot={Boolean(city.snapshot)} />

      <section className="directory-records" aria-labelledby="locations-title">
        <header className="section-heading">
          <div>
            <p className="section-label">Published directory</p>
            <h2 id="locations-title">Location records</h2>
          </div>
          <p>
            {sites.length} source-backed {sites.length === 1 ? "entry" : "entries"}
            <br />
            No inferred availability
          </p>
        </header>
        <SiteList sites={sites} onEvidence={onEvidence} />
      </section>

      <aside className="boundary-note" aria-label="Important limitations">
        <ShieldCheck size={22} aria-hidden="true" />
        <div>
          <strong>Evidence, not emergency guidance.</strong>
          <p>
            CoolPath does not claim that a location is safe, nearest, open now, currently available,
            medically appropriate or reachable by a safe route.
          </p>
        </div>
      </aside>
    </main>
  );
}
