/* ── Welcome page behaviour ──
   "Open a new tab" opens a real new tab in the extension (which shows the
   new tab page, exactly what the student will see from now on). On the
   design board it stays inside the board's frame instead. */
(() => {
  const params = new URLSearchParams(location.search);
  const demo = params.has('demo');
  const theme = params.get('theme');
  const palette = params.get('palette');
  const extra = `${params.get('at') ? `&at=${params.get('at')}` : ''}${theme ? `&theme=${theme}` : ''}${palette ? `&palette=${palette}` : ''}`;
  const tryLink = document.getElementById('try');
  if (demo) {
    tryLink.href = `newtab.html?demo=empty&intro=1${extra}`;
    /* Connecting means a trip to Alpha; on the board, skip to its result. */
    document.getElementById('connect').href = `newtab.html?demo=full${extra}`;
    return;
  }
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    tryLink.addEventListener('click', (e) => { e.preventDefault(); chrome.tabs.create({}); });
  }
})();
