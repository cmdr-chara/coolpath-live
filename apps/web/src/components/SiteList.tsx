import { ArrowUpRight, CalendarBlank, MapPinLine, Wheelchair } from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import type { CoolingSite } from "../types";
import { formatTemporalClaim, formatTemporalClaimLabel } from "./temporal";

export function SiteList({
  sites,
  onEvidence
}: {
  sites: CoolingSite[];
  onEvidence: (site: CoolingSite, trigger: HTMLButtonElement) => void;
}) {
  if (sites.length === 0) {
    return (
      <section className="empty-state" role="status">
        <h2>No verified list is available</h2>
        <p>CoolPath does not publish a candidate that has not passed validation.</p>
      </section>
    );
  }

  return (
    <div className="site-list">
      {sites.map((site, index) => {
        const titleId = `site-${site.id.replaceAll(":", "-")}`;
        return (
          <article className="site-record" key={site.id} aria-labelledby={titleId}>
            <div className="site-record__index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="site-record__identity">
              <h2 id={titleId}>{site.name}</h2>
              <address>
                <MapPinLine size={18} aria-hidden="true" />
                <span>{site.addressText}</span>
              </address>
            </div>
            <dl className="site-record__facts">
              <div>
                <dt>
                  <CalendarBlank size={16} aria-hidden="true" />
                  {formatTemporalClaimLabel(site.temporalClaim)}
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
              className="text-action"
              aria-label={`View evidence for ${site.name}`}
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                onEvidence(site, event.currentTarget)
              }
            >
              Evidence record <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          </article>
        );
      })}
    </div>
  );
}
