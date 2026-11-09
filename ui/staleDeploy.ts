/* ── A newer Alpha replaced the code this tab needs ──
   Every deploy gives the lazy chunks new names (`pdf-DpNyx9aG.js` becomes
   `pdf-CcZYcL52.js`) and the old files are gone from the host. A tab opened
   before the deploy still asks for the old names the first time it opens a
   screen it has not opened yet (adding a book loads pdf.js, the Decks tab
   loads Decks…), and gets "Failed to fetch dynamically imported module".

   Vite announces that failure as `vite:preloadError` on window. The fix is
   the new code, so the page reloads once. A second failure within a minute
   is not an old tab (the host is down, the network is gone), so it is left
   to the caller to say so, rather than reloading in a loop. Everything the
   student had is already on the device (AppState in localStorage, Notes and
   Learn in IndexedDB), so a reload between screens costs nothing but the
   step they were on. */

const KEY = 'alpha_stale_reload_v1';
const WINDOW_MS = 60_000;

export const isStaleChunkError = (e: unknown): boolean => {
  const m = e instanceof Error ? e.message : String(e ?? '');
  return /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|unable to preload css/i.test(m);
};

const reloadedLately = (): boolean => {
  try {
    const at = Number(sessionStorage.getItem(KEY));
    return !!at && Date.now() - at < WINDOW_MS;
  } catch {
    return false;
  }
};

/** Reloads onto the new deploy, unless that was just tried. Says whether it reloaded. */
export const reloadForUpdate = (): boolean => {
  if (reloadedLately()) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { /* private mode: reload anyway */ }
  window.location.reload();
  return true;
};

export const installStaleDeployReload = (): void => {
  window.addEventListener('vite:preloadError', event => {
    // Preventing it stops the import throwing into a screen that is about to be replaced.
    if (reloadForUpdate()) event.preventDefault();
  });
};
