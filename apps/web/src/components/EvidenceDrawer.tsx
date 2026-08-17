import { ArrowSquareOut, X } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import type { CoolingSite } from "../types";
import { formatTemporalClaim } from "./temporal";

export function EvidenceDrawer({
  site,
  onClose
}: {
  site: CoolingSite | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root
      open={Boolean(site)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-backdrop" />
        {site ? (
          <Dialog.Content
            className="evidence-drawer"
            aria-labelledby="evidence-title"
            aria-describedby="evidence-description"
          >
            <div className="evidence-drawer__rail" aria-hidden="true">
              VERIFIED SOURCE RECORD / {site.id}
            </div>
            <Dialog.Close asChild>
              <button className="icon-button drawer-close" aria-label="Close evidence">
                <X size={19} aria-hidden="true" />
              </button>
            </Dialog.Close>
            <p className="eyebrow">Evidence ledger</p>
            <Dialog.Title id="evidence-title">{site.name}</Dialog.Title>
            <Dialog.Description id="evidence-description">
              Every statement below is traceable to the issuing public source. Missing information
              remains explicitly unstated.
            </Dialog.Description>
            <dl className="evidence-ledger">
              <div>
                <dt>Published address</dt>
                <dd>{site.addressText}</dd>
              </div>
              <div>
                <dt>Temporal statement</dt>
                <dd>{formatTemporalClaim(site.temporalClaim)}</dd>
              </div>
              <div>
                <dt>Observed at</dt>
                <dd>
                  <time dateTime={site.observedAt}>{site.observedAt}</time>
                </dd>
              </div>
              <div>
                <dt>Evidence URL</dt>
                <dd>
                  <code>{site.evidenceUrl}</code>
                </dd>
              </div>
            </dl>
            <section className="claim-section" aria-labelledby="claims-title">
              <h3 id="claims-title">Explicit claims</h3>
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
            <a className="button" href={site.evidenceUrl} target="_blank" rel="noreferrer">
              Open official evidence <ArrowSquareOut size={18} aria-hidden="true" />
            </a>
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
