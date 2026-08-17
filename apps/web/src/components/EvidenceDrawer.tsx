import { ArrowSquareOut, X } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CoolingSite, SourceState } from "../types";
import { formatInstant, sourceHost } from "./format";
import { statusContent } from "./status-content";
import { formatTemporalClaim, formatTemporalClaimLabel } from "./temporal";

export function EvidenceDrawer({
  site,
  sourceName,
  timezone,
  state,
  returnFocusTo,
  onClose
}: {
  site: CoolingSite | null;
  sourceName: string;
  timezone: string;
  state: SourceState;
  returnFocusTo: HTMLButtonElement | null;
  onClose: () => void;
}) {
  const status = statusContent[state];

  return (
    <Dialog.Root
      open={Boolean(site)}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-backdrop" />
        {site ? (
          <Dialog.Content
            className="evidence-drawer"
            aria-describedby="evidence-description"
            onCloseAutoFocus={(event: Event) => {
              if (!returnFocusTo) return;
              event.preventDefault();
              returnFocusTo.focus();
            }}
          >
            <div className="evidence-drawer__topline">
              <span>SOURCE RECORD / {site.id}</span>
              <span>{status.reportLabel}</span>
            </div>
            <Dialog.Close asChild>
              <button className="icon-button drawer-close" aria-label="Close evidence record">
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
            <p className="kicker">Evidence ledger</p>
            <Dialog.Title>{site.name}</Dialog.Title>
            <Dialog.Description id="evidence-description">
              Traceable to {sourceName}. Missing information remains explicitly unstated.
            </Dialog.Description>

            <dl className="evidence-ledger">
              <div>
                <dt>Published address</dt>
                <dd>{site.addressText}</dd>
              </div>
              <div>
                <dt>{formatTemporalClaimLabel(site.temporalClaim)}</dt>
                <dd>{formatTemporalClaim(site.temporalClaim)}</dd>
              </div>
              <div>
                <dt>Observed</dt>
                <dd>
                  <time dateTime={site.observedAt}>{formatInstant(site.observedAt, timezone)}</time>
                </dd>
              </div>
              <div>
                <dt>Evidence host</dt>
                <dd>
                  <code>{sourceHost(site.evidenceUrl)}</code>
                </dd>
              </div>
            </dl>

            <section className="claim-section" aria-labelledby="claims-title">
              <div className="section-label">Explicit claims</div>
              <h3 id="claims-title">Only what the source states</h3>
              {site.explicitClaims.length === 0 ? (
                <p>Not stated by the source.</p>
              ) : (
                site.explicitClaims.map((claim) => (
                  <article key={`${claim.kind}:${claim.label}`}>
                    <strong>{claim.label}</strong>
                    <p>{claim.evidenceText}</p>
                    {claim.evidenceLocator ? <code>{claim.evidenceLocator}</code> : null}
                  </article>
                ))
              )}
            </section>

            <a className="primary-action" href={site.evidenceUrl} target="_blank" rel="noreferrer">
              Open source page <ArrowSquareOut size={18} aria-hidden="true" />
            </a>
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
