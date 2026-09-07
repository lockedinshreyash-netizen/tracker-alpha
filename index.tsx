
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

/* Dev-only contact sheet for the share cards (`?share=debug`). Lazily imported
   so it never reaches a production bundle, and checked before App mounts so the
   harness is not sitting behind the landing page and the onboarding tour. */
if (import.meta.env.DEV && new URLSearchParams(location.search).get('share') === 'debug') {
  import('./share/DebugCards').then(({ default: DebugCards }) => root.render(<DebugCards />));
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
