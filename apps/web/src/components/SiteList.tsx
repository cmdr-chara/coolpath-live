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
      {sites.map((site) => {
        const titleId = `site-${site.id.replaceAll(":", "-")}`;
        const explicitClaimLabel =
          site.explicitClaims.length > 0
            ? site.explicitClaims.map((claim) => claim.label).join(", ")
            : "Additional facility claims not stated";

        return (
          <article className="site-record" key={site.id} aria-labelledby={titleId}>
            <div className="site-record__identity">
              <h2 id={titleId}>{site.name}</h2>
              <address>
                <MapPinLine size={17} aria-hidden="true" />
                <span>{site.addressText}</span>
              </address>
            </div>

            <div className="site-record__summary">
              <span>
                <CalendarBlank size={15} aria-hidden="true" />
                <strong>{formatTemporalClaimLabel(site.temporalClaim)}</strong>
                <span>{formatTemporalClaim(site.temporalClaim)}</span>
              </span>
              <span>
                <Wheelchair size={15} aria-hidden="true" />
                <strong>Source claims</strong>
                <span>{explicitClaimLabel}</span>
              </span>
            </div>

            <button
              className="text-action"
              aria-label={`View evidence for ${site.name}`}
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                onEvidence(site, event.currentTarget)
              }
            >
              Evidence <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </article>
        );
      })}
    </div>
  );
}
