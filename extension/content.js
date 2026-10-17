/* ── Tracker Alpha: the bridge ──
   Runs on trackeralpha.in only. The app writes a small summary of the day to
   one localStorage key (install/extensionSummary.ts in the app); this copies
   it into the extension's own storage, so the new tab can show it on any page.
   It reads that one key and nothing else, and nothing leaves this device. */

(() => {
  const KEY = 'alpha_ext_summary_v1';
  let last = '';

  const copy = () => {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { return; }
    if (!raw || raw === last) return;
    let summary;
    try { summary = JSON.parse(raw); } catch { return; }
    if (!summary || summary.v !== 1) return;
    last = raw;
    chrome.storage.local.set({ summary, copiedAt: Date.now() });
  };

  copy();
  /* The app fires this right after each write. */
  window.addEventListener('alpha:summary', copy);
  /* And when the tab is left, so the newest numbers are there for the next tab. */
  document.addEventListener('visibilitychange', copy);
  window.addEventListener('pagehide', copy);
})();
