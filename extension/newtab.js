/* ── Tracker Alpha · the new tab ──
   Search first: a large glass capsule at the top, because most new tabs are
   opened to search, and typing anywhere lands in it. Under it, the student's
   day as one instrument panel: a fine ring (today's hours against the goal)
   with the streak at its centre, the one line true right now, one button,
   and a hairline grid of readouts (today, the week, the exam, firewood, the
   next task). Behind it all, the ASCII field (ascii.js), which ripples
   wherever they click.

   Reads the summary the app left on this device (content.js copies it into
   chrome.storage.local). Built with textContent, never innerHTML: task text
   is the student's own words.

   Outside the extension (dev server, design board) it reads the app's
   localStorage on the same origin, a fixture (?demo=full|empty|session|done|
   holding|stale), or a summary in the URL (?demo=custom&s=…). `at` sets the
   clock, `theme=light|dark` forces a theme, `intro=1` shows the first-run
   note. */

(() => {
  const APP = 'https://trackeralpha.in';
  const KEY = 'alpha_ext_summary_v1';
  const DAY_MS = 86_400_000;
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  const offset = params.has('at') ? Number(params.get('at')) - Date.now() : 0;
  const clockNow = () => Date.now() + offset;
  /* The light/dark base is decided by palettes.js (the chosen theme, or the
     board's ?theme= for Alpha). Kept here only to carry it into links. */
  const theme = params.get('theme');

  /* ── DOM ── */
  const h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const NS = 'http://www.w3.org/2000/svg';
  const s = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };
  const icon = (markup, size = 16) => {
    const t = document.createElement('template');
    t.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markup}</svg>`;
    return t.content.firstChild;
  };
  const ARROW = '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>';
  const SEARCH = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>';
  const FLAME = '<path d="M12 2.5c1.2 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.3 1.1-4 2.4-5.1 0 2 .8 3.2 2 3.7-.6-3.7.1-6.6 1.1-9.6Z" fill="currentColor" stroke="none"/>';

  /* ── Time, on the app's axis: a study day runs from 04:00 IST ── */
  const studyDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ms - 4 * 3_600_000));
  const fmtH = (n) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : r.toFixed(1); };
  const clock = (ms) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = t % 60;
    return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
  };
  const ago = (ms) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m} min ago`;
    const hrs = Math.round(m / 60);
    return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
  };
  const hoursWord = (n) => (n === 1 ? 'hour' : 'hours');

  /* ── A summary from an earlier study day, projected onto today ── */
  const project = (sm, now) => {
    const passed = Math.max(0, Math.floor((now - sm.rollover) / DAY_MS) + (now >= sm.rollover ? 1 : 0));
    if (passed === 0) return { ...sm, stale: false };
    const missed = passed - (sm.todayHours > 0 ? 1 : 0);
    let { streak, bank, holding } = sm;
    if (missed > 0) {
      if (bank >= missed) { bank -= missed; holding = true; } else { streak = 0; bank = 0; holding = false; }
    } else holding = false;
    const week = [...sm.week, ...Array.from({ length: passed }, (_, i) => ({ day: studyDay(sm.rollover + i * DAY_MS + 3_600_000), hours: 0 }))].slice(-7);
    return { ...sm, streak, bank, holding, todayHours: 0, day: studyDay(now), week, session: null, stale: true };
  };

  /* ── The line ── */
  const line = (sm) => {
    const left = Math.max(0, sm.goalHours - sm.todayHours);
    if (sm.session) return ['On the clock.', 'Keep going.'];
    if (sm.goalHours > 0 && sm.todayHours >= sm.goalHours) return ['Goal hit.', 'Rest like you earned it.'];
    if (sm.todayHours > 0) return [`${fmtH(left)} ${hoursWord(left)} to go.`, 'The day is not over.'];
    if (sm.holding) return ['Firewood is holding it.', 'Log today.'];
    if (sm.streak > 0) return [`Day ${sm.streak + 1} starts with`, 'one session.'];
    return ['The competition is studying.', 'Are you?'];
  };

  const greeting = (name) => {
    const hr = new Date(clockNow()).getHours();
    const part = hr < 5 ? 'Still up' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    return name ? `${part}, ${name.split(' ')[0]}` : part;
  };

  /* ── The ring ── A dim track, an arc for today's hours over the goal, and a
     shadowed second lap past 100%. Thin and precise, not a donut. */
  const R = 52;
  const C = 2 * Math.PI * R;
  const ring = (pct, kind) => {
    const svg = s('svg', { viewBox: '0 0 128 128', class: `ring ring-${kind}`, 'aria-hidden': 'true' });
    const defs = s('defs');
    const grad = s('linearGradient', { id: 'rg', x1: '0', y1: '0', x2: '1', y2: '1' });
    /* Through `style`: presentation attributes cannot read CSS variables. */
    grad.append(s('stop', { offset: '0', style: 'stop-color: var(--ring-a)' }), s('stop', { offset: '1', style: 'stop-color: var(--ring-b)' }));
    const shadow = s('filter', { id: 'rs', x: '-30%', y: '-30%', width: '160%', height: '160%' });
    shadow.append(s('feDropShadow', { dx: '0', dy: '0', stdDeviation: '2.4', 'flood-color': '#000', 'flood-opacity': '0.6' }));
    defs.append(grad, shadow);
    svg.append(defs);
    /* Sixty ticks, a watch's minute track, under the ring. */
    const ticks = s('g', { class: 'ticks' });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const r1 = i % 5 === 0 ? 61 : 62.4, r2 = 63.6;
      ticks.append(s('line', { x1: 64 + r1 * Math.cos(a), y1: 64 + r1 * Math.sin(a), x2: 64 + r2 * Math.cos(a), y2: 64 + r2 * Math.sin(a) }));
    }
    svg.append(ticks);
    svg.append(s('circle', { cx: 64, cy: 64, r: R, class: 'ring-track' }));
    const first = Math.min(pct, 1);
    if (first > 0) svg.append(s('circle', { cx: 64, cy: 64, r: R, class: 'ring-arc', stroke: 'url(#rg)', 'stroke-dasharray': `${C * first} ${C}`, style: `--len: ${C * first}px` }));
    if (pct > 1) {
      const extra = Math.min(pct - 1, 0.98);
      svg.append(s('circle', { cx: 64, cy: 64, r: R, class: 'ring-arc ring-lap', stroke: 'url(#rg)', filter: 'url(#rs)', 'stroke-dasharray': `${C * extra} ${C}`, style: `--len: ${C * extra}px` }));
    }
    return svg;
  };

  /* ── Search, first: the browser's own engine, never ours ── */
  let searchInput = null;
  const searchBox = () => {
    const input = h('input', { type: 'search', name: 'q', placeholder: 'Search the web, same as always', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Search the web with your usual search engine' });
    searchInput = input;
    const form = h('form', {
      class: 'search rise', style: '--d: 60ms', role: 'search',
      onsubmit: (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;
        const r = form.getBoundingClientRect();
        window.alphaRipple?.(r.left + r.width / 2, r.top + r.height / 2, 1.4);
        if (hasChrome && chrome.search && chrome.search.query) chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
        else location.href = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      },
    }, icon(SEARCH, 19), input, h('kbd', { class: 'search-kbd', 'aria-hidden': 'true' }, '/'));
    return form;
  };
  /* Type anywhere and it lands in the search; "/" focuses it, as in every
     good command bar. Never steals a modified key or a key meant for a field. */
  document.addEventListener('keydown', (e) => {
    if (!searchInput || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
    if (e.key.length === 1 && /\S/.test(e.key)) searchInput.focus();
  });

  /* ── Nothing was taken away ── */
  const INTRO_KEY = 'introSeen';
  const showIntro = () => new Promise(resolve => {
    if (demo) { resolve(params.get('intro') === '1'); return; }
    if (hasChrome) { chrome.storage.local.get(INTRO_KEY, r => resolve(!r[INTRO_KEY])); return; }
    try { resolve(!localStorage.getItem(`alpha_ext_${INTRO_KEY}`)); } catch { resolve(false); }
  });
  const hideIntro = () => {
    if (demo) return;
    if (hasChrome) chrome.storage.local.set({ [INTRO_KEY]: true });
    else try { localStorage.setItem(`alpha_ext_${INTRO_KEY}`, '1'); } catch { /* shows once more */ }
  };
  const keep = () => {
    const p = new URLSearchParams();
    if (demo) p.set('demo', '1');
    if (params.has('at')) p.set('at', params.get('at'));
    if (theme) p.set('theme', theme);
    if (params.get('palette')) p.set('palette', params.get('palette'));
    const q = p.toString();
    return q ? `?${q}` : '';
  };
  const welcomeUrl = () => `welcome.html${keep()}`;

  const introNote = () => {
    const note = h('aside', { class: 'intro', role: 'note' },
      h('span', { class: 'intro-dot', 'aria-hidden': 'true' }),
      h('p', {}, h('b', {}, 'Your browser works exactly like before.'), ' Search, bookmarks and every other site are untouched. Only this page is new.'),
      h('a', { class: 'intro-link', href: welcomeUrl() }, 'What changed'),
      h('button', { type: 'button', class: 'intro-ok', onclick: () => { hideIntro(); note.classList.add('gone'); setTimeout(() => note.remove(), 320); } }, 'Got it'));
    return note;
  };

  const toast = (text) => {
    const t = h('div', { class: 'toast', role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.classList.add('gone'), 3600);
    setTimeout(() => t.remove(), 4000);
  };
  const removeSelf = () => {
    if (hasChrome && chrome.management && chrome.management.uninstallSelf && !demo) chrome.management.uninstallSelf({ showConfirmDialog: true });
    else toast('In Chrome, this asks “Remove Tracker Alpha?” and one click puts your old new tab back.');
  };

  /* ── The menu: the rest of Alpha, and the honest exits ── */
  const menuBtn = document.getElementById('menu-btn');
  let menu = null;
  const closeMenu = () => { if (!menu) return; menu.remove(); menu = null; menuBtn.setAttribute('aria-expanded', 'false'); };
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (typeof closePicker === 'function') closePicker();
    if (menu) { closeMenu(); return; }
    const item = (label, href) => h('a', { role: 'menuitem', href }, label);
    menu = h('div', { class: 'menu', role: 'menu' },
      h('p', { class: 'menu-h' }, 'Open in Alpha'),
      ...[['Today', 'today'], ['Plan', 'plan'], ['Syllabus', 'syllabus'], ['Mocks', 'mocks'], ['Decks', 'decks'], ['Groups', 'groups'], ['Streak', 'streak']].map(([l, o]) => item(l, `${APP}/?open=${o}`)),
      h('hr'),
      item('What this extension changes', welcomeUrl()),
      h('button', { role: 'menuitem', type: 'button', onclick: () => { closeMenu(); removeSelf(); } }, 'Remove extension'));
    document.body.append(menu);
    menuBtn.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', (e) => { if (menu && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  /* The dot is the sync state: green fresh, amber stale, grey not connected. */
  /* ── Themes: background and accent only (palettes.js) ── */
  const themeBtn = document.getElementById('theme-btn');
  let picker = null;
  const closePicker = () => { if (!picker) return; picker.remove(); picker = null; themeBtn.setAttribute('aria-expanded', 'false'); };
  const swatch = (p, on) => {
    const tile = h('span', { class: `sw-tile ${p.base === 'auto' ? 'auto' : ''}`, style: p.bg ? `background: ${p.bg}` : null },
      h('span', { class: `sw-card ${p.base === 'dark' ? 'dark' : ''}` },
        h('span', { class: 'sw-ring', style: `border-color: ${p.hi}; border-right-color: ${p.base === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'}` }),
        h('span', { class: 'sw-lines' }, h('i'), h('i')),
        h('span', { class: 'sw-btn', style: `background: ${p.hi}` })));
    return h('button', {
      type: 'button', class: `sw ${on ? 'on' : ''}`, role: 'radio', 'aria-checked': String(on), 'aria-label': `${p.name}${p.note ? `, ${p.note.toLowerCase()}` : ''}`,
      onclick: (e) => {
        window.AlphaPalettes.apply(p.id);
        window.AlphaPalettes.save(p.id);
        const r = e.currentTarget.getBoundingClientRect();
        window.alphaRipple?.(r.left + r.width / 2, r.top + r.height / 2, 1.6);
        picker.querySelectorAll('.sw').forEach(x => { const yes = x === e.currentTarget; x.classList.toggle('on', yes); x.setAttribute('aria-checked', String(yes)); });
      },
    }, tile, h('span', { class: 'sw-name' }, p.name));
  };
  themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeMenu();
    if (picker) { closePicker(); return; }
    const cur = window.AlphaPalettes.current().id;
    picker = h('div', { class: 'picker', role: 'dialog', 'aria-label': 'New tab theme' },
      h('div', { class: 'picker-head' }, h('p', { class: 'menu-h' }, 'New tab theme'), h('p', { class: 'picker-sub' }, 'Just this page. Alpha keeps its own look.')),
      h('div', { class: 'sw-grid', role: 'radiogroup' }, window.AlphaPalettes.list.map(p => swatch(p, p.id === cur))));
    document.body.append(picker);
    themeBtn.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('click', (e) => { if (picker && !picker.contains(e.target) && e.target !== themeBtn) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });

  const footer = (status, state = 'ok') => h('footer', { class: 'foot rise', style: '--d: 420ms' },
    h('span', { class: `foot-dot ${state}`, 'aria-hidden': 'true' }),
    h('span', {}, status),
    h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'),
    h('span', {}, 'Your browser works exactly as before'),
    h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'),
    h('button', { type: 'button', onclick: removeSelf }, 'Remove'));

  /* ── The instrument panel ── */
  const cell = (label, value, extra) => h('div', { class: 'cell' }, h('span', { class: 'cell-l' }, label), h('span', { class: 'cell-v' }, value), extra || null);
  const weekBars = (sm) => {
    const max = Math.max(sm.goalHours, ...sm.week.map(w => w.hours), 1);
    return h('span', { class: 'bars', 'aria-label': `This week: ${sm.week.map(w => fmtH(w.hours)).join(', ')} hours` }, sm.week.map((w, i) => h('i', {
      class: i === sm.week.length - 1 ? 'now' : sm.goalHours > 0 && w.hours >= sm.goalHours ? 'met' : '',
      style: `height: ${Math.max(3, (w.hours / max) * 22)}px; animation-delay: ${380 + i * 45}ms`,
    })));
  };
  const meter = (pct) => h('span', { class: 'meter', 'aria-hidden': 'true' }, h('i', { style: `width: ${Math.min(100, Math.max(pct * 100, 1.5))}%` }));

  /* ── Render ── */
  let liveTimer = null;
  const app = document.getElementById('app');
  const withIntro = async (nodes) => ((await showIntro()) ? [introNote(), ...nodes] : nodes);
  /* A summary can arrive from another tab mid-search; what they typed stays. */
  const paint = (nodes) => {
    const prev = searchInput;
    const value = prev ? prev.value : '';
    const focused = prev && document.activeElement === prev;
    app.replaceChildren(...nodes);
    if (searchInput && searchInput !== prev) {
      searchInput.value = value;
      if (focused) searchInput.focus();
    }
  };
  const lines = ([a, b]) => h('h1', { class: 'line' }, h('span', {}, a), h('em', {}, b));

  const top = (hello) => [
    h('p', { class: 'hello rise' }, hello),
    searchBox(),
  ];

  const renderEmpty = async () => {
    paint(await withIntro([
      ...top('Tracker Alpha'),
      h('section', { class: 'panel rise', style: '--d: 160ms' },
        h('div', { class: 'panel-main' },
          h('div', { class: 'dial' }, ring(0, 'empty'), h('div', { class: 'dial-in' }, h('img', { src: 'icons/icon-128.png', alt: '', width: 44, height: 44, class: 'dial-mark' }))),
          h('div', { class: 'copy' },
            h('p', { class: 'kicker' }, 'Not connected'),
            lines(['Your day lives', 'here.']),
            h('a', { class: 'go', href: `${APP}/?open=today` }, 'Open Alpha', icon(ARROW, 14)))),
        h('p', { class: 'panel-note' }, 'Open Alpha once in this browser. Your streak, today’s hours and your tasks will show up on every new tab.')),
      h('div', { class: 'spacer' }),
      footer('Not connected', 'off'),
    ]));
  };

  const render = async (raw) => {
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (!raw || raw.v !== 1) { await renderEmpty(); return; }
    const now = clockNow();
    const sm = project(raw, now);
    const goal = sm.goalHours;
    const pct = goal > 0 ? sm.todayHours / goal : 0;
    const days = Math.max(0, Math.ceil((sm.exam.at - now) / DAY_MS));
    const kind = sm.session ? 'live' : pct >= 1 ? 'done' : sm.holding ? 'held' : 'day';

    let centre;
    let go;
    if (sm.session) {
      const time = h('span', { class: 'dial-n live' }, '');
      const tick = () => {
        const n = clockNow();
        const x = sm.session;
        time.textContent = x.kind === 'pomodoro' ? (x.endsAt ? clock(x.endsAt - n) : 'Paused') : clock(x.bankedMs + (x.runningSince ? n - x.runningSince : 0));
      };
      tick();
      liveTimer = setInterval(tick, 1000);
      centre = h('div', { class: 'dial-in' }, h('span', { class: 'dial-k' }, h('i', { class: 'pulse' }), 'Live'), time);
      go = h('a', { class: 'go', href: `${APP}/?open=today` }, `Back to ${sm.session.subject}`, icon(ARROW, 14));
    } else {
      centre = h('div', { class: 'dial-in' },
        h('span', { class: `dial-flame ${sm.streak === 0 ? 'cold' : sm.holding ? 'held' : ''}` }, icon(FLAME, 15)),
        h('span', { class: 'dial-n' }, String(sm.streak)),
        h('span', { class: 'dial-k' }, sm.holding ? 'held' : 'streak'));
      go = h('a', { class: 'go', href: `${APP}/?open=today` }, pct >= 1 ? 'Open Alpha' : 'Start the clock', icon(ARROW, 14));
    }

    const kicker = sm.session ? `${sm.session.subject} · ${sm.session.kind === 'pomodoro' ? 'Pomodoro block' : 'session running'}`
      : sm.holding ? `${sm.streak}-day streak, held by firewood`
        : sm.streak > 0 ? `${sm.streak}-day streak${sm.best > sm.streak ? ` · best ${sm.best}` : ''}`
          : 'No streak yet';

    const next = sm.tasks.find(t => t.doing) || sm.tasks[0];

    paint(await withIntro([
      ...top(greeting(sm.name)),
      h('section', { class: 'panel rise', style: '--d: 160ms', 'aria-label': 'Your day' },
        h('div', { class: 'panel-main' },
          h('a', { class: 'dial', href: `${APP}/?open=today`, 'aria-label': `${fmtH(sm.todayHours)} of ${fmtH(goal)} hours today. ${sm.streak} day streak.` }, ring(pct, kind), centre),
          h('div', { class: 'copy' },
            h('p', { class: 'kicker' }, kicker),
            lines(line(sm)),
            go)),
        h('div', { class: 'grid' },
          cell('Today', h('span', {}, fmtH(sm.todayHours), h('small', {}, goal > 0 ? ` / ${fmtH(goal)}h` : 'h')), meter(pct)),
          cell('This week', weekBars(sm)),
          cell(sm.exam.label, h('span', {}, String(days), h('small', {}, days === 1 ? ' day' : ' days'))),
          cell('Firewood', h('span', {}, String(sm.bank), h('small', {}, sm.bank === 1 ? ' log' : ' logs')))),
        next ? h('div', { class: 'next' }, h('span', { class: 'next-l' }, next.doing ? 'Doing' : 'Next'), h('span', { class: 'next-t' }, next.text), h('a', { class: 'next-go', href: `${APP}/?open=today`, 'aria-label': 'Open your board' }, icon(ARROW, 13))) : null),
      h('div', { class: 'spacer' }),
      footer(sm.stale ? `Last synced ${ago(now - raw.at)}` : `Synced ${ago(now - raw.at)}, on this device`, sm.stale ? 'stale' : 'ok'),
    ]));
  };

  /* ── The clock in the bar ── */
  const clockEl = document.getElementById('clock');
  const paintClock = () => {
    const d = new Date(clockNow());
    const h12 = d.getHours() % 12 || 12;
    clockEl.textContent = `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}   ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  };
  paintClock();
  setInterval(paintClock, 10_000);

  /* ── Data ── */
  const fixture = (k) => {
    const now = clockNow();
    const day = studyDay(now);
    const at = (i) => studyDay(now - (6 - i) * DAY_MS);
    const base = {
      v: 1, at: now - 4 * 60_000, day, rollover: now + 6 * 3_600_000, name: 'Aarav Sharma',
      streak: 12, best: 21, bank: 3, holding: false, todayHours: 2.5, goalHours: 10,
      week: [6, 8.5, 10, 4, 11, 7.5, 2.5].map((hours, i) => ({ day: at(i), hours })),
      exam: { label: 'JEE Main', at: Date.UTC(2027, 0, 1) },
      tasks: [
        { text: 'Rotational motion: 30 PYQs', doing: true, color: '#4C8DFF' },
        { text: 'Organic: GOC revision notes', doing: false, color: '#40C057' },
      ],
      session: null,
    };
    if (k === 'empty') return null;
    if (k === 'session') return { ...base, session: { kind: 'stopwatch', subject: 'Physics', runningSince: now - 47 * 60_000, bankedMs: 12 * 60_000, endsAt: null, phase: null } };
    if (k === 'done') return { ...base, todayHours: 11.5, week: base.week.map((w, i) => (i === 6 ? { ...w, hours: 11.5 } : w)) };
    if (k === 'holding') return { ...base, todayHours: 0, holding: true, bank: 2, week: base.week.map((w, i) => (i >= 5 ? { ...w, hours: 0 } : w)) };
    if (k === 'stale') return { ...base, at: now - 2 * DAY_MS, rollover: now - DAY_MS - 3_600_000, todayHours: 4 };
    return base;
  };

  const start = (raw) => render(raw).then(() => {
    /* One ripple out of the search bar as the page arrives. */
    const f = document.querySelector('.search');
    if (f) { const r = f.getBoundingClientRect(); setTimeout(() => window.alphaRipple?.(r.left + r.width / 2, r.top + r.height / 2, 0.8), 250); }
  });

  if (demo === 'custom') {
    let custom = null;
    try { custom = JSON.parse(params.get('s') || 'null'); } catch { custom = null; }
    start(custom);
  } else if (demo) {
    start(fixture(demo));
  } else if (hasChrome) {
    chrome.storage.local.get('summary', ({ summary }) => start(summary));
    /* Logged a session in another tab? This one updates without a reload. */
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.summary) render(changes.summary.newValue);
    });
  } else {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { raw = null; }
    start(raw);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || demo || !hasChrome) return;
    chrome.storage.local.get('summary', ({ summary }) => render(summary));
  });
})();
