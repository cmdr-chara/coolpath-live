import { ArrowUpRight, CalendarBlank, MapPinLine, Wheelchair } from "@phosphor-icons/react";
import type { CoolingSite, SourceState } from "../types";
import { formatTemporalClaim } from "./temporal";

export function SiteList({
  sites,
  state,
  onEvidence
}: {
  sites: CoolingSite[];
  state: SourceState;
  onEvidence: (site: CoolingSite) => void;
}) {
  if (state === "BROKEN" || sites.length === 0) {
    return (
      <section className="empty-state">
        <h2>No current list is available</h2>
        <p>CoolPath does not publish a candidate that has not passed validation.</p>
      </section>
    );
  }
  const trusted = state === "HEALTHY" || state === "RECOVERED";
  return (
    <div className="site-list">
      {sites.map((site, index) => (
        <article className="site-record" key={site.id} data-reveal>
          <div className="site-record__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="site-record__main">
            <p>{trusted ? "Official source record" : "Last trusted record"}</p>
            <h2>{site.name}</h2>
            <div className="site-record__address">
              <MapPinLine size={18} aria-hidden="true" />
              <span>{site.addressText}</span>
            </div>
          </div>
          <dl className="site-record__facts">
            <div>
              <dt>
                <CalendarBlank size={16} aria-hidden="true" />
                Source-published time
              </dt>
              <dd>{formatTemporalClaim(site.temporalClaim)}</dd>
            </div>
            <div>
              <dt>
                <Wheelchair size={16} aria-hidden="true" />
                Explicit facility claims
              </dt>
              <dd>
                {site.explicitClaims.length > 0
                  ? site.explicitClaims.map((claim) => claim.label).join(", ")
                  : "Not stated by the source"}
              </dd>
            </div>
          </dl>
          <button
            className="evidence-button"
            aria-label={`Evidence for ${site.name}`}
            onClick={() => onEvidence(site)}
          >
            Evidence <ArrowUpRight size={17} aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}
