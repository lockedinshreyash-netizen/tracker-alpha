import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { landingWillShow } from './landing/gate';
import { setLandingClock } from './landing/clock';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const params = new URLSearchParams(location.search);

/* Dev-only contact sheet for the share cards (`?share=debug`). Lazily imported
   so it never reaches a production bundle, and checked before App mounts so the
   harness is not sitting behind the landing page and the onboarding tour. */
if (import.meta.env.DEV && params.get('share') === 'debug') {
  import('./share/DebugCards').then(({ default: DebugCards }) => ReactDOM.createRoot(rootElement).render(<DebugCards />));
} else if (import.meta.env.DEV && params.get('cbt') === 'debug') {
  // The CBT exam, review and error test on a fixture bank, no database.
  import('./cbt/DebugCbt').then(({ default: DebugCbt }) => ReactDOM.createRoot(rootElement).render(<DebugCbt />));
} else if (import.meta.env.DEV && params.get('decks') === 'debug') {
  // Alpha Decks' review, editor and import preview on fixture cards, no database.
  import('./decks/DebugDecks').then(({ default: DebugDecks }) => ReactDOM.createRoot(rootElement).render(<DebugDecks />));
} else if (import.meta.env.DEV && params.get('sfx') === 'debug') {
  // Every sound effect through the real player, for tuning levels.
  import('./sound/DebugSounds').then(({ default: DebugSounds }) => ReactDOM.createRoot(rootElement).render(<DebugSounds />));
} else if (import.meta.env.DEV && params.get('keep') === 'debug') {
  // Every way Alpha keeps itself close: the keep step per platform, the nudge step and plan.
  import('./install/DebugKeep').then(({ default: DebugKeep }) => ReactDOM.createRoot(rootElement).render(<DebugKeep />));
} else if (import.meta.env.DEV && params.get('analytics') === 'debug') {
  // The console's Analytics section in every state, on fixtures, no database.
  import('./analytics/DebugAnalytics').then(({ default: DebugAnalytics }) => ReactDOM.createRoot(rootElement).render(<DebugAnalytics />));
} else {
  const app = (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  /* The production build ships the landing page pre-rendered inside #root
     (scripts/prerenderLanding.ts). A visitor who will see it gets it hydrated
     in place — same nodes, so nothing flashes and the CSS entrance does not
     replay — starting from the build's clock so the first render matches.
     Anyone else (returning, signed in, invited) never saw it: index.html's
     inline script hid it before first paint, and it is cleared here. */
  const built = rootElement.dataset.lpBuilt;
  if (built && landingWillShow()) {
    setLandingClock(Number(built));
    ReactDOM.hydrateRoot(rootElement, app);
  } else {
    if (built) rootElement.replaceChildren();
    // The class only existed to hide the static copy. If App later decides to
    // show the landing after all (a stored session that turned out expired),
    // its own render must be visible.
    document.documentElement.classList.remove('lp-skip');
    ReactDOM.createRoot(rootElement).render(app);
  }
}
