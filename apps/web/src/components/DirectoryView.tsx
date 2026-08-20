import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  ShieldCheck
} from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useEntranceMotion } from "../hooks/useEntranceMotion";
import type { CityResponse, CoolingSite } from "../types";
import { CoolingParkScene } from "./CoolingParkScene";
import { formatInstant } from "./format";
import { SiteList } from "./SiteList";
import { statusContent } from "./status-content";
import { formatTemporalClaim } from "./temporal";

const PAGE_SIZE = 6;

function mostCommonValue(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const match = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return match && match[1] > 1 ? { value: match[0], count: match[1] } : undefined;
}

export function DirectoryView({
  city,
  onEvidence
}: {
  city: CityResponse;
  onEvidence: (site: CoolingSite, trigger: HTMLButtonElement) => void;
}) {
  const viewRef = useRef<HTMLElement>(null);
  const recordsRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const status = statusContent[city.source.status];
  const sites = city.snapshot?.sites ?? [];
  const reportLabel = city.snapshot ? status.reportLabel : "No verified report";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSites = normalizedQuery
    ? sites.filter((site) =>
        `${site.name} ${site.addressText}`.toLocaleLowerCase().includes(normalizedQuery)
      )
    : sites;
  const pageCount = Math.max(1, Math.ceil(filteredSites.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = filteredSites.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, filteredSites.length);
  const visibleSites = filteredSites.slice(pageStart === 0 ? 0 : pageStart - 1, pageEnd);
  const temporalStatements = sites.map((site) => formatTemporalClaim(site.temporalClaim));
  const commonTemporal = mostCommonValue(temporalStatements);
  const sharedTemporalStatement = commonTemporal?.value;
  const claimStatements = sites.map((site) =>
    site.explicitClaims.length > 0
      ? site.explicitClaims.map((claim) => claim.label).join(", ")
      : "No additional facility claims stated"
  );
  const commonClaim = mostCommonValue(claimStatements);
  const sharedClaimStatement = commonClaim?.value;

  const changePage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    window.requestAnimationFrame(() => {
      recordsRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });
  };

  useEntranceMotion(viewRef);

  return (
    <main id="main" ref={viewRef} className="page-width directory-view">
      <section className="directory-hero" aria-labelledby="directory-title" data-motion-section>
        <CoolingParkScene tone={status.tone} />

        <div className="directory-hero__copy">
          <p className="kicker">
            {city.city.displayName} / {city.city.region}
          </p>
          <h1 id="directory-title">Cooling locations you can count on</h1>
          <p className="directory-intro__lede">
            {sites.length} source-backed {sites.length === 1 ? "location" : "locations"} published
            from {city.source.agencyName}. CoolPath shows evidence without guessing whether a place
            is open or currently available.
          </p>

          <div
            className={`directory-meta directory-meta--${status.tone}`}
            aria-label="Directory verification status"
            aria-live="polite"
          >
            <span className="directory-meta__status">
              <span className="status-dot" aria-hidden="true" />
              <strong>{status.title}</strong>
            </span>
            <span className="directory-meta__report">{reportLabel}</span>
            <span className="directory-meta__separator" aria-hidden="true" />
            <span>
              {city.snapshot ? (
                <>
                  Updated{" "}
                  <time dateTime={city.snapshot.observedAt}>
                    {formatInstant(city.snapshot.observedAt, city.city.timezone)}
                  </time>
                </>
              ) : (
                "Not yet verified"
              )}
            </span>
            {city.source.mode === "mock" ? (
              <span className="source-fixture">Source fixture: {city.source.agencyName}</span>
            ) : (
              <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
                Source: {city.source.agencyName} <ArrowSquareOut size={14} aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="directory-search">
            <label id="directory-search-label" htmlFor="directory-search-input">
              Search published locations
            </label>
            <div className="directory-search__field">
              <MagnifyingGlass size={18} aria-hidden="true" />
              <input
                id="directory-search-input"
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setPage(1);
                }}
                placeholder="Search by facility or address"
                autoComplete="off"
                aria-labelledby="directory-search-label"
              />
            </div>
          </div>
        </div>
      </section>

      <section
        ref={recordsRef}
        className="directory-records"
        aria-labelledby="locations-title"
        data-motion-section
      >
        <header className="directory-results__header">
          <div>
            <h2 id="locations-title">Location records</h2>
            <p aria-live="polite" aria-atomic="true">
              {normalizedQuery
                ? `${filteredSites.length} of ${sites.length} verified records match your search`
                : `${sites.length} verified ${sites.length === 1 ? "record" : "records"}`}
            </p>
          </div>
          <div className="directory-results__meta">
            <span>No inferred availability</span>
            {filteredSites.length > PAGE_SIZE ? (
              <strong>
                {pageStart}–{pageEnd} of {filteredSites.length}
              </strong>
            ) : null}
          </div>
        </header>

        {sharedTemporalStatement || sharedClaimStatement ? (
          <aside className="directory-shared-facts" aria-label="Repeated source facts">
            <strong>Repeated source facts, shown once</strong>
            {commonTemporal ? (
              <span>
                {commonTemporal.count === sites.length
                  ? `All ${sites.length} records`
                  : `${commonTemporal.count} of ${sites.length} records`}
                : {commonTemporal.value}
              </span>
            ) : null}
            {commonClaim ? (
              <span>
                {commonClaim.count === sites.length
                  ? `All ${sites.length} records`
                  : `${commonClaim.count} of ${sites.length} records`}
                : {commonClaim.value}
              </span>
            ) : null}
          </aside>
        ) : null}

        {normalizedQuery && filteredSites.length === 0 ? (
          <section className="empty-state empty-state--search" role="status">
            <h2>No matching verified locations</h2>
            <p>Try a facility name or part of a published address.</p>
          </section>
        ) : (
          <SiteList
            sites={visibleSites}
            onEvidence={onEvidence}
            sharedTemporalStatement={sharedTemporalStatement}
            sharedClaimStatement={sharedClaimStatement}
          />
        )}

        {pageCount > 1 ? (
          <nav className="directory-pagination" aria-label="Location record pages">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => changePage(currentPage - 1)}
            >
              <CaretLeft size={15} aria-hidden="true" /> Previous
            </button>
            <div aria-label={`Page ${currentPage} of ${pageCount}`}>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  aria-label={`Page ${pageNumber}`}
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  onClick={() => changePage(pageNumber)}
                >
                  {pageNumber}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => changePage(currentPage + 1)}
            >
              Next <CaretRight size={15} aria-hidden="true" />
            </button>
          </nav>
        ) : null}

        <aside className="boundary-note" aria-label="Important limitations">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            <strong>Evidence, not emergency guidance.</strong> Confirm current opening and safety
            information with the source before travelling.
          </p>
        </aside>
      </section>
    </main>
  );
}
