import { ArrowSquareOut, Heartbeat } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { decideHeal, getDirectory, runDemoAction } from "./api";
import { AppHeader, type AppView } from "./components/AppHeader";
import { DirectoryView } from "./components/DirectoryView";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { PresenterControls, type DemoAction } from "./components/PresenterControls";
import { TechnicalView } from "./components/TechnicalView";
import type { CoolingSite } from "./types";

const pendingMessages: Record<DemoAction, string> = {
  reset: "Resetting the source and publishing the healthy baseline…",
  drift: "Running the drifted collector and validating its candidate…",
  heal: "Preparing the field-specific repair preview…",
  approve: "Applying the approved selectors, re-running and validating the collector…",
  reject: "Rejecting the repair preview without changing the collector…"
};

const successMessages: Record<DemoAction, string> = {
  reset: "Healthy baseline published. The public snapshot passed the complete contract.",
  drift: "Drift detected. The candidate is quarantined and the last trusted report remains public.",
  heal: "Repair preview prepared. Manual approval is required before any selector change is used.",
  approve: "Repair approved. The re-run passed validation and the recovered snapshot was published.",
  reject: "Repair rejected. No selector change was applied; trusted data stays protected."
};

function readView(): AppView {
  return new URLSearchParams(window.location.search).get("view") === "technical"
    ? "technical"
    : "public";
}

export default function App() {
  const [view, setView] = useState<AppView>(readView);
  const [evidenceSite, setEvidenceSite] = useState<CoolingSite | null>(null);
  const [returnFocusTo, setReturnFocusTo] = useState<HTMLButtonElement | null>(null);
  const [actionFeedback, setActionFeedback] = useState(
    "Choose a stage to demonstrate the protected publication boundary."
  );
  const queryClient = useQueryClient();

  const cityQuery = useQuery({ queryKey: ["directory"], queryFn: getDirectory });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["directory"] });
  }, [queryClient]);

  const action = useMutation({
    mutationFn: async (next: DemoAction) => {
      if (next === "approve") return decideHeal(true);
      if (next === "reject") return decideHeal(false);
      return runDemoAction(next);
    },
    onMutate: (next) => {
      setActionFeedback(pendingMessages[next]);
    },
    onSuccess: async (_result, next) => {
      await refresh();
      setActionFeedback(successMessages[next]);
    },
    onError: (_error, next) => {
      setActionFeedback(
        next === "reset"
          ? "The demo reset failed before a replacement baseline was published. Retry the reset before continuing."
          : "The selected demo action failed. The existing public snapshot was not replaced."
      );
    }
  });

  useEffect(() => {
    const handlePopState = () => setView(readView());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((next: AppView, event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();
    const url = new URL(window.location.href);
    if (next === "technical") url.searchParams.set("view", "technical");
    else url.searchParams.delete("view");
    window.history.pushState({}, "", url);
    setView(next);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  if (cityQuery.isLoading) return <LoadingScreen />;
  if (cityQuery.isError || !cityQuery.data) {
    return (
      <main className="page-width centered-state">
        <section className="error-state" role="alert">
          <Heartbeat size={38} weight="duotone" aria-hidden="true" />
          <h1>CoolPath could not load</h1>
          <p>No unverified data has been shown. Confirm the API is running, then try again.</p>
          <button className="primary-action" onClick={() => void cityQuery.refetch()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  const city = cityQuery.data;

  return (
    <div className={`site-frame site-frame--${view}`}>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <AppHeader view={view} onNavigate={navigate} />

      {view === "public" ? (
        <DirectoryView
          city={city}
          onEvidence={(site, trigger) => {
            setReturnFocusTo(trigger);
            setEvidenceSite(site);
          }}
        />
      ) : (
        <TechnicalView
          city={city}
          incident={city.incident}
          controls={
            city.source.mode === "mock" ? (
              <PresenterControls
                state={city.source.status}
                incident={city.incident}
                pending={action.isPending}
                feedback={actionFeedback}
                onAction={(next) => action.mutate(next)}
              />
            ) : null
          }
        />
      )}

      <footer className="site-footer">
        <div className="page-width site-footer__inner">
          <div>
            <strong>CoolPath Live</strong>
            <span>Evidence before availability.</span>
          </div>
          <p>Public facility information only. No location tracking, accounts or analytics.</p>
          <a href={city.source.canonicalUrl} target="_blank" rel="noreferrer">
            Source page <ArrowSquareOut size={15} aria-hidden="true" />
          </a>
        </div>
      </footer>

      <EvidenceDrawer
        site={evidenceSite}
        sourceName={city.source.agencyName}
        timezone={city.city.timezone}
        state={city.source.status}
        returnFocusTo={returnFocusTo}
        onClose={() => setEvidenceSite(null)}
      />
    </div>
  );
}

function LoadingScreen() {
  return (
    <main className="page-width loading-state" aria-busy="true" aria-label="Loading CoolPath">
      <div className="loading-block loading-block--header" />
      <div className="loading-block loading-block--title" />
      <div className="loading-block loading-block--status" />
      <div className="loading-block loading-block--record" />
      <div className="loading-block loading-block--record" />
    </main>
  );
}
