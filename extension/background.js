/* ── Install ──
   Opens the welcome page once, right after the student installs, so the
   first thing they read is what changed (the new tab) and what didn't
   (everything else). Not on updates: a returning student already knows. */
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'welcome.html' });
});
