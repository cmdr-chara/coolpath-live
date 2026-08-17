import type { SourceState } from "../types";

export function SignalField({ state, city }: { state: SourceState; city: string }) {
  const stable = state === "HEALTHY" || state === "RECOVERED";
  return (
    <figure className={`signal-field signal-field--${stable ? "stable" : "watch"}`}>
      <svg viewBox="0 0 620 420" role="img" aria-labelledby="signal-title signal-description">
        <title id="signal-title">Verification signal for {city}</title>
        <desc id="signal-description">
          Abstract contour lines connect the official source to the trusted public snapshot.
        </desc>
        <defs>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g className="signal-field__contours">
          <path d="M58 218C75 85 229 34 348 74s220 114 201 227-152 112-254 72S40 351 58 218Z" />
          <path d="M105 216c15-93 125-132 217-102s169 80 154 155-111 78-190 49-195-9-181-102Z" />
          <path d="M160 216c11-58 80-82 137-64s105 50 96 96-69 48-118 30-124-5-115-62Z" />
        </g>
        <path
          className="signal-field__trace"
          pathLength="180"
          d="M88 284C180 215 242 278 322 206s137-51 208-89"
        />
        <path
          className="signal-field__trace signal-field__trace--ghost"
          pathLength="180"
          d="M84 309c98-52 170 19 249-48s130-49 196-31"
        />
        <circle className="signal-field__origin" cx="88" cy="284" r="8" />
        <circle
          className="signal-field__destination"
          cx="530"
          cy="117"
          r="11"
          filter="url(#soft-glow)"
        />
      </svg>
      <figcaption>
        <span>Official source</span>
        <strong>{stable ? "Contract verified" : "Baseline protected"}</strong>
        <span>Public snapshot</span>
      </figcaption>
      <div className="signal-field__state">{state.replaceAll("_", " ")}</div>
    </figure>
  );
}
