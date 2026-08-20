import parkHero from "../assets/coolpath-park-hero-v2.webp";
import type { StatusContent } from "./status-content";

export function CoolingParkScene({ tone }: { tone: StatusContent["tone"] }) {
  return (
    <figure className={`cooling-park-scene cooling-park-scene--${tone}`} aria-hidden="true">
      <img src={parkHero} alt="" width={1600} height={800} loading="eager" fetchPriority="high" />
    </figure>
  );
}
