import type { MouseEvent } from "react";

export type AppView = "public" | "technical";

export function AppHeader({
  view,
  onNavigate
}: {
  view: AppView;
  onNavigate: (view: AppView, event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <header className="app-header">
      <div className="page-width app-header__inner">
        <a
          className="wordmark"
          href="?"
          onClick={(event: MouseEvent<HTMLAnchorElement>) => onNavigate("public", event)}
        >
          <strong>CoolPath</strong>
        </a>
        <nav className="primary-nav" aria-label="Application views">
          <a
            href="?"
            aria-current={view === "public" ? "page" : undefined}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => onNavigate("public", event)}
          >
            Public directory
          </a>
          <a
            href="?view=technical"
            aria-current={view === "technical" ? "page" : undefined}
            onClick={(event: MouseEvent<HTMLAnchorElement>) => onNavigate("technical", event)}
          >
            Technical view
          </a>
        </nav>
      </div>
    </header>
  );
}
