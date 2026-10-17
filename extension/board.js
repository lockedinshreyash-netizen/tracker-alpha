/* ── The extension's design board ──
   Two ways in:
     Student journey  fourteen scenes, in the order a student meets them, from
                      the store page and Chrome's install warning to removing
                      it again. Each scene sets the time of day, the data and
                      Chrome's own dialogs, and says what to look for.
     Playground       every number on one panel: streak, firewood, hours, goal,
                      exam, a running session, the time of day, how long since
                      Alpha was last opened.
   The window is the real newtab.html / welcome.html in an iframe, fed a
   summary in the URL (?demo=custom&s=…&at=…), so what you see is exactly
   what ships. Chrome's own dialogs are mocked, so the scary moments can be
   rehearsed too. DEV ONLY; never packed. */

(() => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const IST = 5.5 * HOUR;

  /* ── Time, in IST ── */
  const istToday = () => { const d = new Date(Date.now() + IST); return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]; };
  /** Epoch ms for `hour` (fractional ok) IST on today + dayOffset. */
  const atIST = (hour, dayOffset = 0) => { const [y, m, d] = istToday(); return Date.UTC(y, m, d + dayOffset) + hour * HOUR - IST; };
  const studyDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(ms - 4 * HOUR));
  const rolloverAfter = (ms) => {
    const [y, m, d] = studyDay(ms).split('-').map(Number);
    return Date.UTC(y, m - 1, d + 1) + 4 * HOUR - IST;
  };

  const TASKS = [
    { text: 'Rotational motion: 30 PYQs', doing: true, color: '#4C8DFF' },
    { text: 'Organic: GOC revision notes', doing: false, color: '#40C057' },
    { text: 'Definite integrals, exercise 7.9', doing: false, color: '#9775FA' },
    { text: 'Mock 4: error notebook', doing: false, color: null },
    { text: 'Thermodynamics short notes', doing: false, color: '#4C8DFF' },
  ];

  /* ── A summary, exactly the shape install/extensionSummary.ts writes ── */
  const summary = (o) => {
    const view = o.view;
    const written = o.written ?? view - 4 * 60_000;
    const day = studyDay(written);
    const past = o.week ?? [6, 8.5, 10, 4, 11, 7.5];
    const week = [...past, o.today].map((hours, i) => {
      const d = new Date(Date.parse(`${day}T00:00:00Z`) - (6 - i) * DAY).toISOString().slice(0, 10);
      return { day: d, hours };
    });
    const session = o.session === 'running'
      ? { kind: 'stopwatch', subject: 'Physics', runningSince: view - 47 * 60_000, bankedMs: 12 * 60_000, endsAt: null, phase: null }
      : o.session === 'paused'
        ? { kind: 'stopwatch', subject: 'Chemistry', runningSince: null, bankedMs: 38 * 60_000, endsAt: null, phase: null }
        : o.session === 'pomodoro'
          ? { kind: 'pomodoro', subject: 'Maths', runningSince: null, bankedMs: 0, endsAt: view + 18 * 60_000 + 20_000, phase: 'work' }
          : null;
    return {
      v: 1, at: written, day, rollover: rolloverAfter(written),
      name: o.name ?? 'Aarav Sharma',
      streak: o.streak ?? 12, best: o.best ?? 21, bank: o.bank ?? 3, holding: !!o.holding,
      todayHours: o.today, goalHours: o.goal ?? 10, week,
      exam: { label: o.exam ?? 'JEE Main', at: view + ((o.examDays ?? 76) - 0.5) * DAY },
      tasks: TASKS.slice(0, o.tasks ?? 4),
      session,
    };
  };

  const newtabUrl = (s, view, intro) => `newtab.html?demo=custom&s=${encodeURIComponent(JSON.stringify(s))}&at=${view}${intro ? '&intro=1' : ''}`;

  /* ── Chrome's own moments, mocked ── */
  const OV = {
    store: () => `<div class="store"><div class="store-card"><img src="icons/icon-128.png" alt=""><div><h2>Tracker Alpha: Lock In New Tab</h2><p>Every new tab shows your streak, today’s hours against your goal, your exam countdown and one button to start studying.</p><span>Add to Chrome</span></div></div></div>`,
    install: () => `${OV.store()}<div class="ov-scrim"></div><div class="dialog"><h2><img src="icons/icon-16.png" width="16" height="16" alt="">Add “Tracker Alpha: Lock In New Tab”?</h2><p>It can:</p><ul><li>Replace the page you see when opening a new tab</li><li>Read and change your data on trackeralpha.in</li></ul><div class="row"><span>Cancel</span><span class="blue">Add extension</span></div></div>`,
    keepit: () => `<div class="bubble"><h3>Change back to Google?</h3><p>The “Tracker Alpha: Lock In New Tab” extension changed what page is shown when you open a new tab.</p><div class="row"><span>Change it back</span><span class="blue">Keep it</span></div></div>`,
    remove: () => `<div class="ov-scrim"></div><div class="dialog"><h2><img src="icons/icon-16.png" width="16" height="16" alt="">Remove “Tracker Alpha: Lock In New Tab”?</h2><p>Your new tab goes back to how it was. Your Alpha data stays in Alpha.</p><div class="row"><span>Cancel</span><span class="blue">Remove</span></div></div>`,
    oldtab: () => `<div class="oldtab"><div class="oldtab-box"><p>Your old new tab</p><div>Search Google or type a URL</div></div></div>`,
  };

  /* ── The journey ── */
  const SCENES = [
    {
      when: 'Day 1 · 6:30 PM', title: 'She finds it',
      body: 'Priya taps “Add the new-tab extension” in Alpha on her laptop and lands on the Chrome Web Store.',
      check: 'The listing says what it does in one line. Nothing about the rest of the browser changes, and nothing here suggests it does.',
      overlay: 'store', tab: 'Chrome Web Store', omni: 'chromewebstore.google.com/detail/tracker-alpha', view: atIST(18.5),
    },
    {
      when: 'Day 1 · 6:31 PM', title: 'Chrome’s warning',
      body: 'Chrome shows its standard install box. “Read and change your data on trackeralpha.in” is the line that makes people nervous.',
      check: 'This text is Chrome’s, not ours, and can’t be changed. The welcome page that opens next explains both lines in plain words.',
      overlay: 'install', tab: 'Chrome Web Store', omni: 'chromewebstore.google.com/detail/tracker-alpha', view: atIST(18.52),
    },
    {
      when: 'Day 1 · 6:31 PM', title: 'Welcome: what changed, what didn’t',
      body: 'The extension opens this page once, straight after install. One thing changed (the new tab). A list of what didn’t: search, bookmarks, history, other sites, settings.',
      check: 'One sentence, then the facts as grouped lists: what changed (one row), what didn’t (four green ticks), and Chrome’s two warnings explained. Removal is spelled out before she’s even tried it.',
      url: (v) => `welcome.html?demo=1&at=${v}`, tab: 'Welcome to Tracker Alpha', omni: 'Tracker Alpha · welcome', view: atIST(18.52),
    },
    {
      when: 'Day 1 · 6:32 PM', title: 'First new tab: Chrome checks in',
      body: 'She opens a tab. Chrome asks if she meant it (it does this for every new-tab extension). Behind it, the page says it again: your browser works exactly like before.',
      check: 'A floating glass note with a green dot: “Your browser works exactly like before.” Once only. Search says “same as always”. The footer says it again, with Remove one click away.',
      url: (v) => `newtab.html?demo=empty&intro=1&at=${v}`, overlay: 'keepit', view: atIST(18.53),
    },
    {
      when: 'Day 2 · 7:40 AM', title: 'Morning: nothing logged yet',
      body: 'She opened Alpha last night, so her day is connected. First tab of the morning: a 12-day streak and “Day 13 starts with one session.”',
      check: 'Search first. Under it the day is one glass panel: a fine ring with the streak inside, the line, one button, and a hairline grid of readouts. Click anywhere: the dot field behind ripples out from the click.',
      data: { today: 0, streak: 12 }, view: atIST(7.67, 1),
    },
    {
      when: 'Day 2 · 10:15 AM', title: 'Mid-session',
      body: 'Physics has been running for 59 minutes in Alpha. She opens a tab to check a formula.',
      check: 'The ring breathes and its centre is the running clock (ticking). The button reads “Back to Physics”.',
      data: { today: 1.5, streak: 12, session: 'running' }, view: atIST(10.25, 1),
    },
    {
      when: 'Day 2 · 4:30 PM', title: 'Searching, exactly like before',
      body: 'She just wants to search. She types into the box (or the address bar, as always) and gets her usual search engine’s results.',
      check: 'The search capsule uses the browser’s own engine (chrome.search), never ours, and the address bar is untouched. The ring is a quarter full: “7.5 hours to go.”',
      data: { today: 2.5, streak: 12 }, view: atIST(16.5, 1), type: 'rotational motion jee pyqs',
    },
    {
      when: 'Day 2 · 10:40 PM', title: 'Goal hit',
      body: 'She logged her tenth hour. Every tab now says she’s done for today.',
      check: 'The ring closes and glows, and past 100% a second lap starts over the first, like Apple’s Move ring. “Goal hit. Rest like you earned it.”',
      data: { today: 11.5, streak: 13 }, view: atIST(22.67, 1),
    },
    {
      when: 'Day 3 · 6:50 AM', title: 'Next morning, Alpha not opened yet',
      body: 'A new study day started at 4 AM. She hasn’t opened Alpha yet, so the tab works it out from last night’s numbers.',
      check: 'The ring is empty again for the new day, the streak holds at 13, and the footer dot turns amber: “Last synced 8h ago”.',
      data: { today: 10.5, streak: 13 }, written: atIST(22.67, 1), view: atIST(6.83, 2),
    },
    {
      when: 'Day 5 · 8:00 PM', title: 'She missed a day',
      body: 'Day 4 slipped by with nothing logged. Firewood held her streak.',
      check: 'The flame turns amber, the kicker reads “14-day streak, held by firewood”, and the Firewood cell drops 3 → 2.',
      data: { today: 6, streak: 14, bank: 3 }, written: atIST(21, 3), view: atIST(20, 5),
    },
    {
      when: 'Day 9 · 9:00 PM', title: 'Gone for days, no firewood left',
      body: 'Four days away with no firewood. The streak is gone. The page doesn’t scold; it says the one true thing.',
      check: 'Streak 0, a cold grey flame, “The competition is studying. Are you?” and one button. No scolding.',
      data: { today: 3, streak: 14, bank: 0 }, written: atIST(21, 4), view: atIST(21, 9),
    },
    {
      when: 'Exam week', title: 'Six days left',
      body: 'Exam week. The countdown card does the talking.',
      check: 'The JEE Main cell reads 6 days. The page stays calm; nothing flashes or shouts.',
      data: { today: 4.5, goal: 12, streak: 61, best: 61, bank: 9, examDays: 6, tasks: 5 }, view: atIST(15, 1),
    },
    {
      when: 'Any time', title: 'She changes her mind',
      body: 'She clicks Remove at the bottom of a new tab (or in the ••• menu). Chrome asks to confirm.',
      check: 'Remove is in the footer and in the ••• menu. Chrome’s own confirm, done. Her Alpha data is untouched.',
      data: { today: 2, streak: 13 }, view: atIST(19, 1), overlay: 'remove',
    },
    {
      when: 'A second later', title: 'Her old new tab is back',
      body: 'Exactly what she had before installing it. Nothing left behind.',
      check: 'Removing gives everything back immediately. Nothing to restore by hand.',
      overlay: 'oldtab', view: atIST(19, 1),
    },
  ];

  /* ── DOM ── */
  const $ = (id) => document.getElementById(id);
  const frame = $('frame');
  const overlay = $('overlay');
  const win = $('window');
  const fit = $('fit');
  let size = { w: 1280, h: 800 };
  let index = 0;
  let mode = 'journey';
  let theme = 'dark';
  let showTicket = 0;
  let palette = 'alpha';
  const themed = (url) => `${url}${url.includes('?') ? '&' : '?'}theme=${theme}&palette=${palette}`;

  const setChrome = ({ tab = 'New Tab', omni = 'Search Google or type a URL' }) => {
    $('tab-title').textContent = tab;
    const box = $('omnibox');
    box.textContent = omni;
    box.classList.toggle('typed', omni !== 'Search Google or type a URL');
  };

  const show = ({ url, overlayKind, chrome: c, type }) => {
    setChrome(c);
    if (url) {
      url = themed(url);
      frame.hidden = false;
      if (frame.dataset.src !== url) { frame.dataset.src = url; frame.src = url; }
    } else {
      frame.hidden = true;
      frame.dataset.src = '';
    }
    overlay.hidden = !overlayKind;
    overlay.innerHTML = overlayKind ? OV[overlayKind]() : '';
    /* Typing belongs to the scene that asked for it: a later scene must not
       inherit it from a timer or a load event still pending. */
    const ticket = ++showTicket;
    if (type) {
      const typeIn = () => {
        if (ticket !== showTicket) return;
        const input = frame.contentDocument && frame.contentDocument.querySelector('.search input');
        if (!input) return;
        input.value = type;
        input.focus();
      };
      frame.addEventListener('load', typeIn, { once: true });
      setTimeout(typeIn, 400);
      setTimeout(typeIn, 1200);
    }
  };

  const sceneUrl = (sc) => {
    if (sc.url) return sc.url(sc.view);
    if (sc.data) return newtabUrl(summary({ ...sc.data, view: sc.view, written: sc.written }), sc.view, false);
    return null;
  };

  const renderScene = () => {
    const sc = SCENES[index];
    $('n-step').textContent = `Step ${index + 1} of ${SCENES.length} · ${sc.when}`;
    $('n-title').textContent = sc.title;
    $('n-body').textContent = sc.body;
    $('n-check').textContent = sc.check ? `Look for: ${sc.check}` : '';
    show({ url: sceneUrl(sc), overlayKind: sc.overlay, chrome: { tab: sc.tab, omni: sc.omni }, type: sc.type });
    [...$('steps').children].forEach((li, i) => {
      li.classList.toggle('on', i === index);
      li.classList.toggle('done', i < index);
    });
    $('prev').disabled = index === 0;
    $('next').disabled = index === SCENES.length - 1;
    $('next').textContent = index === SCENES.length - 1 ? 'End of journey' : 'Next step →';
  };

  $('steps').append(...SCENES.map((sc, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.innerHTML = `<span class="num">${i + 1}</span><span><span class="t"></span><span class="w"></span></span>`;
    b.querySelector('.t').textContent = sc.title;
    b.querySelector('.w').textContent = sc.when;
    b.addEventListener('click', () => { index = i; renderScene(); });
    li.append(b);
    return li;
  }));
  $('prev').addEventListener('click', () => { if (index > 0) { index--; renderScene(); } });
  $('next').addEventListener('click', () => { if (index < SCENES.length - 1) { index++; renderScene(); } });
  document.addEventListener('keydown', (e) => {
    if (mode !== 'journey' || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') $('next').click();
    if (e.key === 'ArrowLeft') $('prev').click();
  });

  /* ── Playground ── */
  const CONTROLS = [
    { h: 'The student' },
    { id: 'connected', label: 'Has opened Alpha in this browser', type: 'check', value: true },
    { id: 'intro', label: 'Show the first-run note', type: 'check', value: false },
    { id: 'name', label: 'Name', type: 'text', value: 'Aarav Sharma' },
    { h: 'Today' },
    { id: 'hour', label: 'Time of day', type: 'range', min: 0, max: 23.75, step: 0.25, value: 16.5, fmt: v => { const h = Math.floor(v); const m = Math.round((v - h) * 60); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; } },
    { id: 'today', label: 'Hours logged today', type: 'range', min: 0, max: 14, step: 0.5, value: 2.5, fmt: v => `${v}h` },
    { id: 'goal', label: 'Daily goal', type: 'range', min: 1, max: 14, step: 0.5, value: 10, fmt: v => `${v}h` },
    { id: 'session', label: 'Session in Alpha', type: 'select', value: 'none', options: [['none', 'None'], ['running', 'Stopwatch running'], ['paused', 'Stopwatch paused'], ['pomodoro', 'Pomodoro block']] },
    { id: 'tasks', label: 'Open Focus Tasks', type: 'range', min: 0, max: 5, step: 1, value: 4, fmt: v => String(v) },
    { h: 'Streak' },
    { id: 'streak', label: 'Streak', type: 'range', min: 0, max: 400, step: 1, value: 12, fmt: v => `${v} days` },
    { id: 'best', label: 'Best streak', type: 'range', min: 0, max: 400, step: 1, value: 21, fmt: v => `${v} days` },
    { id: 'bank', label: 'Firewood', type: 'range', min: 0, max: 30, step: 1, value: 3, fmt: v => String(v) },
    { id: 'holding', label: 'Held by firewood right now', type: 'check', value: false },
    { id: 'away', label: 'Last opened Alpha', type: 'select', value: '0', options: [['0', 'A few minutes ago'], ['1', 'Yesterday'], ['2', '2 days ago'], ['4', '4 days ago'], ['7', 'A week ago']] },
    { h: 'Exam' },
    { id: 'exam', label: 'Exam', type: 'select', value: 'JEE Main', options: [['JEE Main', 'JEE Main'], ['NEET', 'NEET']] },
    { id: 'examDays', label: 'Days to the exam', type: 'range', min: 0, max: 400, step: 1, value: 76, fmt: v => `${v}` },
  ];

  const form = $('controls');
  const values = {};
  for (const c of CONTROLS) {
    if (c.h) { const p = document.createElement('p'); p.className = 'ctl-h'; p.textContent = c.h; form.append(p); continue; }
    values[c.id] = c.value;
    if (c.type === 'check') {
      const label = document.createElement('label');
      label.className = 'ctl-row';
      label.innerHTML = `<input type="checkbox" ${c.value ? 'checked' : ''}> <span></span>`;
      label.querySelector('span').textContent = c.label;
      label.querySelector('input').addEventListener('change', e => { values[c.id] = e.target.checked; playRender(); });
      form.append(label);
      continue;
    }
    const wrap = document.createElement('label');
    wrap.className = 'ctl';
    const head = document.createElement('span');
    head.innerHTML = '<span></span><em></em>';
    head.firstChild.textContent = c.label;
    const em = head.lastChild;
    let input;
    if (c.type === 'select') {
      input = document.createElement('select');
      for (const [v, t] of c.options) { const o = document.createElement('option'); o.value = v; o.textContent = t; input.append(o); }
      input.value = c.value;
    } else {
      input = document.createElement('input');
      input.type = c.type;
      if (c.type === 'range') Object.assign(input, { min: c.min, max: c.max, step: c.step });
      input.value = c.value;
    }
    const paint = () => { em.textContent = c.fmt ? c.fmt(Number(input.value)) : ''; };
    input.addEventListener('input', () => {
      values[c.id] = c.type === 'range' ? Number(input.value) : input.value;
      paint();
      playRender();
    });
    paint();
    wrap.append(head, input);
    form.append(wrap);
  }

  let pending = 0;
  const playRender = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      const v = values;
      const away = Number(v.away);
      const view = atIST(v.hour, 1);
      const written = away === 0 ? view - 4 * 60_000 : view - away * DAY;
      $('n-step').textContent = 'Playground';
      $('n-title').textContent = 'Every number, live';
      $('n-body').textContent = 'Move anything on the left. The window is the real new tab, fed the same summary Alpha writes.';
      $('n-check').textContent = away > 0 ? `Look for: ${away === 1 ? 'a day' : `${away} days`} since Alpha was opened. Each fully missed day burns a firewood, or ends the streak when none is left.` : '';
      const url = v.connected
        ? newtabUrl(summary({
          view, written, name: v.name || null, streak: v.streak, best: Math.max(v.best, v.streak), bank: v.bank, holding: v.holding,
          today: v.today, goal: v.goal, session: away === 0 ? v.session : 'none', tasks: v.tasks, exam: v.exam, examDays: v.examDays,
        }), view, v.intro)
        : `newtab.html?demo=empty${v.intro ? '&intro=1' : ''}&at=${view}`;
      show({ url, overlayKind: null, chrome: {} });
    }, 120);
  };

  /* ── Modes ── */
  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    document.querySelectorAll('.mode').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    $('journey').hidden = mode !== 'journey';
    $('play').hidden = mode !== 'play';
    document.querySelector('.nav').style.visibility = mode === 'journey' ? 'visible' : 'hidden';
    if (mode === 'journey') renderScene(); else playRender();
  }));

  $('palette').addEventListener('change', (e) => {
    palette = e.target.value;
    if (mode === 'journey') renderScene(); else playRender();
  });
  document.querySelectorAll('.theme').forEach(b => b.addEventListener('click', () => {
    theme = b.dataset.theme;
    document.querySelectorAll('.theme').forEach(x => x.classList.toggle('on', x === b));
    if (mode === 'journey') renderScene(); else playRender();
  }));

  /* ── Fit the window to the stage ── */
  const CHROME_H = 84;
  const layout = () => {
    const W = size.w;
    const H = size.h + CHROME_H;
    win.style.width = `${W}px`;
    win.style.height = `${H}px`;
    frame.parentElement.style.height = `${size.h}px`;
    const pad = 28;
    const scale = Math.min((fit.clientWidth - pad * 2) / W, (fit.clientHeight - pad * 2) / H, 1);
    const left = (fit.clientWidth - W * scale) / 2;
    const top = Math.max(pad, (fit.clientHeight - H * scale) / 2);
    win.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  };
  document.querySelectorAll('.size').forEach(b => b.addEventListener('click', () => {
    size = { w: Number(b.dataset.w), h: Number(b.dataset.h) };
    document.querySelectorAll('.size').forEach(x => x.classList.toggle('on', x === b));
    layout();
  }));
  new ResizeObserver(layout).observe(fit);

  layout();
  renderScene();
})();
