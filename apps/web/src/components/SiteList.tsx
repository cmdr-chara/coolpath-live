import { ArrowUpRight, CalendarBlank, MapPinLine, Wheelchair } from "@phosphor-icons/react";
import type { MouseEvent } from "react";
import type { CoolingSite } from "../types";
import { formatTemporalClaim, formatTemporalClaimLabel } from "./temporal";

export function SiteList({
  sites,
  onEvidence,
  sharedTemporalStatement,
  sharedClaimStatement
}: {
  sites: CoolingSite[];
  onEvidence: (site: CoolingSite, trigger: HTMLButtonElement) => void;
  sharedTemporalStatement: string | undefined;
  sharedClaimStatement: string | undefined;
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
        const temporalStatement = formatTemporalClaim(site.temporalClaim);
        const showTemporalStatement = temporalStatement !== sharedTemporalStatement;
        const normalizedClaimStatement =
          explicitClaimLabel === "Additional facility claims not stated"
            ? "No additional facility claims stated"
            : explicitClaimLabel;
        const showClaimStatement = normalizedClaimStatement !== sharedClaimStatement;
        const hasUniqueSummary = showTemporalStatement || showClaimStatement;

        return (
          <article
            className={`site-record${hasUniqueSummary ? "" : " site-record--compact"}`}
            key={site.id}
            aria-labelledby={titleId}
            data-motion-item
          >
            <div className="site-record__identity">
              <span className="site-record__mark" aria-hidden="true">
                <MapPinLine size={19} weight="bold" />
              </span>
              <div>
                <h2 id={titleId}>{site.name}</h2>
                <address>{site.addressText}</address>
              </div>
            </div>

            {hasUniqueSummary ? (
              <div className="site-record__summary">
                {showTemporalStatement ? (
                  <span>
                    <CalendarBlank size={15} aria-hidden="true" />
                    <strong>{formatTemporalClaimLabel(site.temporalClaim)}</strong>
                    <span>{temporalStatement}</span>
                  </span>
                ) : null}
                {showClaimStatement ? (
                  <span>
                    <Wheelchair size={15} aria-hidden="true" />
                    <strong>Source claims</strong>
                    <span>{explicitClaimLabel}</span>
                  </span>
                ) : null}
              </div>
            ) : null}

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
