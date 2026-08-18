import { useRef, type ReactNode } from "react";
import { useEntranceMotion } from "../hooks/useEntranceMotion";
import type { CityResponse, Incident } from "../types";
import { TechnicalEvidence } from "./TechnicalEvidence";
import { TechnicalIncident } from "./TechnicalIncident";
import { TechnicalOverview } from "./TechnicalOverview";

export function TechnicalView({
  city,
  incident,
  controls
}: {
  city: CityResponse;
  incident: Incident | null;
  controls?: ReactNode;
}) {
  const viewRef = useRef<HTMLElement>(null);
  useEntranceMotion(viewRef);

  return (
    <main id="main" ref={viewRef} className="technical-view">
      <div className="page-width technical-layout">
        <TechnicalOverview city={city} incident={incident} />
        <TechnicalIncident
          incident={incident}
          sourceState={city.source.status}
          timezone={city.city.timezone}
        />
        <TechnicalEvidence city={city} />
        {controls ? (
          <div className="technical-controls-motion" data-motion-section>
            {controls}
          </div>
        ) : null}
      </div>
    </main>
  );
}
