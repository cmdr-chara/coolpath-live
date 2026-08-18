import { ArrowSquareOut, MagnifyingGlass, ShieldCheck } from "@phosphor-icons/react";
import { useState } from "react";
import type { CityResponse, CoolingSite } from "../types";
import { formatInstant } from "./format";
import { SiteList } from "./SiteList";
import { statusContent } from "./status-content";

export function DirectoryView({
  city,
  onEvidence
}: {
  city: CityResponse;
  onEvidence: (site: CoolingSite, trigger: HTMLButtonElement) => void;
}) {
  const [query, setQuery] = useState("");
  const status = statusContent[city.source.status];
  const sites = city.snapshot?.sites ?? [];
  const reportLabel = city.snapshot ? status.reportLabel : "No verified report";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSites = normalizedQuery
    ? sites.filter((site) =>
        `${site.name} ${site.addressText}`.toLocaleLowerCase().includes(normalizedQuery)
      )
    : sites;

  return (
    <main id="main" className="page-width directory-view">
      <section className="directory-intro" aria-labelledby="directory-title">
        <p className="kicker">
          {city.city.displayName} / {city.city.region}
        </p>
        <h1 id="directory-title">{city.city.displayName} cooling locations</h1>
        <p className="directory-intro__lede">
          {sites.length} source-backed {sites.length === 1 ? "location" : "locations"} published
          from {city.source.agencyName}. CoolPath does not infer whether a location is open or
          currently available.
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
          <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
            {city.source.agencyName} <ArrowSquareOut size={14} aria-hidden="true" />
          </a>
        </div>
      </section>

      <section className="directory-search" aria-labelledby="directory-search-label">
        <label id="directory-search-label" htmlFor="directory-search-input">
          Search published locations
        </label>
        <div className="directory-search__field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            id="directory-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search by facility or address"
            autoComplete="off"
          />
        </div>
      </section>

      <section className="directory-records" aria-labelledby="locations-title">
        <header className="directory-results__header">
          <div>
            <h2 id="locations-title">Location records</h2>
            <p aria-live="polite" aria-atomic="true">
              {normalizedQuery
                ? `${filteredSites.length} of ${sites.length} verified records match your search`
                : `${sites.length} verified ${sites.length === 1 ? "record" : "records"}`}
            </p>
          </div>
          <span>No inferred availability</span>
        </header>

        {normalizedQuery && filteredSites.length === 0 ? (
          <section className="empty-state empty-state--search" role="status">
            <h2>No matching verified locations</h2>
            <p>Try a facility name or part of a published address.</p>
          </section>
        ) : (
          <SiteList sites={filteredSites} onEvidence={onEvidence} />
        )}
      </section>

      <aside className="boundary-note" aria-label="Important limitations">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Evidence, not emergency guidance.</strong> CoolPath does not claim that a location
          is safe, nearest, open now, currently available, medically appropriate or reachable by a
          safe route.
        </p>
      </aside>
    </main>
  );
}
