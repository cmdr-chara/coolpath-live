import {
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  Heartbeat,
  ShieldCheck,
  Wrench
} from "@phosphor-icons/react";
import { useGSAP } from "@gsap/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { useCallback, useRef, useState } from "react";
import { decideHeal, getCity, getIncident, runDemoAction } from "./api";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { SignalField } from "./components/SignalField";
import { SiteList } from "./components/SiteList";
import { StatusBanner } from "./components/StatusBanner";
import { TechnicalView } from "./components/TechnicalView";
import type { CoolingSite } from "./types";

gsap.registerPlugin(useGSAP);

export default function App() {
  const [view, setView] = useState<"public" | "technical">("public");
  const [evidenceSite, setEvidenceSite] = useState<CoolingSite | null>(null);
  const shell = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const cityQuery = useQuery({ queryKey: ["city"], queryFn: getCity });
  const incidentQuery = useQuery({
    queryKey: ["incident", cityQuery.data?.source.id],
    queryFn: () => getIncident(cityQuery.data?.source.id ?? ""),
    enabled: Boolean(cityQuery.data?.source.id)
  });
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["city"] }),
      queryClient.invalidateQueries({ queryKey: ["incident"] })
    ]);
  }, [queryClient]);
  const action = useMutation({
    mutationFn: async (next: "reset" | "drift" | "heal" | "approve") => {
      if (next === "approve") return decideHeal(true);
      return runDemoAction(next);
    },
    onSuccess: refresh
  });

  useGSAP(
    () => {
      if (!shell.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const revealTargets = shell.current.querySelectorAll("[data-reveal]");
      const signalTargets = shell.current.querySelectorAll(".signal-field__trace");
      gsap.fromTo(
        revealTargets,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.65, stagger: 0.07, ease: "power3.out" }
      );
      gsap.fromTo(
        signalTargets,
        { strokeDashoffset: 180 },
        { strokeDashoffset: 0, duration: 1.25, ease: "power2.out", stagger: 0.08 }
      );
    },
    { dependencies: [view, cityQuery.data?.source.status], revertOnUpdate: true }
  );

  if (cityQuery.isLoading) return <LoadingScreen />;
  if (cityQuery.isError || !cityQuery.data) {
    return (
      <main className="app-shell app-shell--centered">
        <section className="error-state" role="alert">
          <Heartbeat size={36} weight="duotone" aria-hidden="true" />
          <h1>CoolPath could not load</h1>
          <p>Start the API and try again. No unverified data has been shown.</p>
          <button className="button" onClick={() => void cityQuery.refetch()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  const city = cityQuery.data;
  const lastVerified = city.snapshot?.observedAt
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: city.city.timezone
      }).format(new Date(city.snapshot.observedAt)) + ` (${city.city.timezone})`
    : "Not yet verified";
  const isTrusted = city.source.status === "HEALTHY" || city.source.status === "RECOVERED";

  return (
    <div
      className={`site-frame site-frame--${view} site-frame--${city.source.status.toLowerCase()}`}
      ref={shell}
    >
      <a className="skip-link" href="#main">
        Skip to cooling information
      </a>
      <div className="grain" aria-hidden="true" />
      <header className="topbar app-shell">
        <a className="brand" href="#main" aria-label="CoolPath Live home">
          <span className="brand-mark" aria-hidden="true">
            CP
          </span>
          <span className="brand-copy">
            <strong>CoolPath</strong>
            <small>Public signal / live</small>
          </span>
        </a>
        <nav className="view-switcher" aria-label="Application views">
          <button aria-pressed={view === "public"} onClick={() => setView("public")}>
            Public directory
          </button>
          <button aria-pressed={view === "technical"} onClick={() => setView("technical")}>
            Source health
          </button>
        </nav>
      </header>

      <main id="main" className="app-shell">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero__copy" data-reveal>
            <p className="eyebrow">Official cooling information / {city.city.displayName}</p>
            <h1 id="hero-title">
              Information you can <em>trace.</em>
            </h1>
            <p className="hero__lede">
              CoolPath publishes municipal cooling records only after they pass a strict source
              contract. Broken collector output never replaces the last trusted report.
            </p>
            <div className="hero__source-line">
              <span className={`pulse pulse--${isTrusted ? "live" : "watch"}`} />
              <span>{isTrusted ? "Verified civic signal" : "Last trusted civic signal"}</span>
              <span aria-hidden="true">/</span>
              <time dateTime={city.snapshot?.observedAt}>{lastVerified}</time>
            </div>
          </div>
          <div className="hero__visual" data-reveal>
            <SignalField state={city.source.status} city={city.city.displayName} />
          </div>
          <aside className="source-ledger" aria-label="Official source ledger" data-reveal>
            <div className="source-ledger__index">SOURCE / 001</div>
            <div>
              <span>Issuing authority</span>
              <strong>{city.source.agencyName}</strong>
            </div>
            <div>
              <span>Published records</span>
              <strong>{String(city.snapshot?.sites.length ?? 0).padStart(2, "0")}</strong>
            </div>
            <div>
              <span>Policy version</span>
              <strong>{city.source.policyVersion}</strong>
            </div>
            <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
              Open issuing source <ArrowSquareOut size={17} aria-hidden="true" />
            </a>
          </aside>
        </section>

        <StatusBanner state={city.source.status} />

        {city.source.mode === "mock" && view === "technical" ? (
          <section className="demo-sequence" aria-labelledby="demo-title" data-reveal>
            <div className="demo-sequence__intro">
              <span>Presenter console</span>
              <h2 id="demo-title">Break the source. Keep the truth.</h2>
              <p>
                A deterministic run through baseline, drift, human review and verified recovery.
              </p>
            </div>
            <div className="demo-actions">
              <button disabled={action.isPending} onClick={() => action.mutate("reset")}>
                <span>01</span>
                <ArrowClockwise size={18} aria-hidden="true" />
                Healthy baseline
              </button>
              <button disabled={action.isPending} onClick={() => action.mutate("drift")}>
                <span>02</span>
                <Heartbeat size={18} aria-hidden="true" />
                Simulate drift
              </button>
              <button
                disabled={
                  action.isPending || !incidentQuery.data || city.source.status === "REVIEW_PENDING"
                }
                onClick={() => action.mutate("heal")}
              >
                <span>03</span>
                <Wrench size={18} aria-hidden="true" />
                Prepare repair
              </button>
              <button
                className="demo-actions__approve"
                disabled={action.isPending || city.source.status !== "REVIEW_PENDING"}
                onClick={() => action.mutate("approve")}
              >
                <span>04</span>
                <Check size={18} aria-hidden="true" />
                Approve and re-run
              </button>
            </div>
            <p className="action-feedback" aria-live="polite">
              {action.isPending
                ? "Running the selected verification step…"
                : action.isError
                  ? "The demo action failed. Reset and try again."
                  : "Mock source, real validation path. No step bypasses the contract."}
            </p>
          </section>
        ) : null}

        {view === "public" ? (
          <section className="records-section" aria-labelledby="locations-title" data-reveal>
            <div className="records-heading">
              <div>
                <span>Published civic record</span>
                <h2 id="locations-title">Cooling locations</h2>
              </div>
              <p>
                {city.snapshot?.sites.length ?? 0} source-backed entries
                <br />
                No inferred availability
              </p>
            </div>
            <SiteList
              sites={city.snapshot?.sites ?? []}
              state={city.source.status}
              onEvidence={setEvidenceSite}
            />
            <div className="safety-note">
              <ShieldCheck size={20} aria-hidden="true" />
              <p>
                CoolPath is not emergency or medical guidance. It does not claim a location is safe,
                nearest, open now or currently available.
              </p>
            </div>
          </section>
        ) : (
          <section className="records-section" aria-labelledby="health-title" data-reveal>
            <div className="records-heading">
              <div>
                <span>Source integrity room</span>
                <h2 id="health-title">What happened to the signal</h2>
              </div>
              <p>
                Collector evidence
                <br />
                Contract and human review
              </p>
            </div>
            <TechnicalView city={city} incident={incidentQuery.data ?? null} />
          </section>
        )}
      </main>

      <footer className="app-shell">
        <div>
          <strong>CoolPath Live</strong>
          <span>Evidence before availability.</span>
        </div>
        <p>Public facility information only. No location tracking, accounts or analytics.</p>
        <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
          Official source <ArrowSquareOut size={15} aria-hidden="true" />
        </a>
      </footer>
      <EvidenceDrawer site={evidenceSite} onClose={() => setEvidenceSite(null)} />
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="app-shell loading-shell" aria-busy="true" aria-label="Loading CoolPath">
      <div className="skeleton skeleton--nav" />
      <div className="skeleton skeleton--hero" />
      <div className="skeleton skeleton--banner" />
      <div className="skeleton skeleton--card" />
      <div className="skeleton skeleton--card" />
    </main>
  );
}
