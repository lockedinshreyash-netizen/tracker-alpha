/* ── The field ──
   A page-wide grid of monospaced characters, barely there, drifting like
   heat over a road. Every click sends a ripple through it: a ring of
   brighter, denser characters running outwards and fading, tinted Alpha red
   at its crest. The cursor warms the characters near it. One living thing
   behind a still page.

   Canvas 2D, drawn in alpha buckets (one fillStyle per bucket, not per cell),
   at most 30 frames a second, and only while something is moving: with no
   ripple and no pointer, it settles to a slow 10 fps drift. Under reduced
   motion it draws one still frame and clicks make no ripple. */

(() => {
  const RAMP = ' .·:-=+*#%@';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const canvas = document.createElement('canvas');
  canvas.className = 'field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });

  let dpr = 1, W = 0, H = 0, cols = 0, rows = 0, cw = 10, ch = 18;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    cw = W < 700 ? 9 : 10; ch = cw * 1.8;
    cols = Math.ceil(W / cw) + 1; rows = Math.ceil(H / ch) + 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${Math.round(cw * 1.15)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textBaseline = 'top';
    wake();
  };

  /* Theme colours, read from CSS so light and dark both work. */
  let ink = [245, 245, 247], red = [255, 90, 79];
  const readTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    /* Themes hand over hex (#rrggbb / #rgb) or rgb(); both are read. */
    const parse = (raw, f) => {
      const v = raw.trim();
      const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (hex) {
        const x = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1];
        return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
      }
      const m = v.match(/\d+(\.\d+)?/g);
      return m && m.length >= 3 ? m.slice(0, 3).map(Number) : f;
    };
    ink = parse(cs.getPropertyValue('--field-ink'), ink);
    red = parse(cs.getPropertyValue('--field-red'), red);
  };

  const ripples = [];
  const pointer = { x: -9999, y: -9999, at: 0 };
  const SPEED = 0.55;   // px per ms
  const WIDTH = 46;     // half-width of the crest, px
  const LIFE = 2600;    // ms

  const ripple = (x, y, strength = 1) => {
    if (reduced) return;
    ripples.push({ x, y, t0: performance.now(), s: strength });
    if (ripples.length > 6) ripples.shift();
    wake();
  };

  /* Cheap smooth noise: a few crossed sines, enough for a drift. */
  const drift = (x, y, t) =>
    0.5 + 0.25 * Math.sin(x * 0.045 + t * 0.00021) * Math.cos(y * 0.06 - t * 0.00017)
        + 0.25 * Math.sin((x + y) * 0.021 + t * 0.00013);

  const LEVELS = 12;
  const buckets = Array.from({ length: LEVELS * 2 }, () => []);

  let raf = 0, last = 0;
  const frame = (now) => {
    raf = 0;
    const active = ripples.length > 0 || now - pointer.at < 1200;
    const interval = reduced ? Infinity : active ? 33 : 100;
    if (now - last < interval && last !== 0) { schedule(); return; }
    last = now;
    for (let i = ripples.length - 1; i >= 0; i--) if (now - ripples[i].t0 > LIFE) ripples.splice(i, 1);
    for (const b of buckets) b.length = 0;

    /* The resting field fades towards the edges (centred a little above the
       middle, where the content is); ripples do not, so a click anywhere is
       answered where it happened. */
    const fx = W / 2, fy = H * 0.36, rx = W * 0.62, ry = H * 0.72;
    for (let r = 0; r < rows; r++) {
      const y = r * ch;
      const dy = (y - fy) / ry;
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const dx = (x - fx) / rx;
        const fall = Math.max(0, 1 - (dx * dx + dy * dy));
        /* A fine, even grid of dots, shimmering slowly. */
        let v = (0.05 + 0.1 * drift(x, y, reduced ? 0 : now)) * fall;
        let heat = 0;
        for (const rp of ripples) {
          const t = now - rp.t0;
          const radius = t * SPEED;
          const d = Math.hypot(x - rp.x, y - rp.y);
          const k = (d - radius) / WIDTH;
          const crest = Math.exp(-k * k) * Math.exp(-t / 1100) * rp.s;
          v += crest * 0.95;
          heat = Math.max(heat, crest);
        }
        const pd = Math.hypot(x - pointer.x, y - pointer.y);
        if (pd < 160) v += (1 - pd / 160) * 0.22;
        if (v < 0.03) continue;
        v = Math.min(1, v);
        const charIdx = Math.min(RAMP.length - 1, Math.max(1, Math.round(v * (RAMP.length - 1))));
        const level = Math.min(LEVELS - 1, Math.floor(v * LEVELS));
        buckets[(heat > 0.35 ? LEVELS : 0) + level].push(c, r, charIdx);
      }
    }

    ctx.clearRect(0, 0, W, H);
    for (let b = 0; b < buckets.length; b++) {
      const cells = buckets[b];
      if (!cells.length) continue;
      const level = b % LEVELS;
      const hot = b >= LEVELS;
      const alpha = 0.05 + (level / (LEVELS - 1)) * (hot ? 0.75 : 0.32);
      const col = hot ? red : ink;
      ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${alpha.toFixed(3)})`;
      for (let i = 0; i < cells.length; i += 3) ctx.fillText(RAMP[cells[i + 2]], cells[i] * cw, cells[i + 1] * ch);
    }
    if (!reduced) schedule();
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const wake = () => { last = 0; schedule(); };

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.at = performance.now(); schedule(); }, { passive: true });
  window.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });
  /* Every click, anywhere: links and buttons included, because the ripple
     is the page answering the tap. */
  window.addEventListener('pointerdown', (e) => ripple(e.clientX, e.clientY), { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
  /* A theme change (palettes.js writes data-theme, data-palette and inline
     colour variables) repaints the field in the new accent. */
  new MutationObserver(() => { readTheme(); wake(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette', 'style'] });
  window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => { readTheme(); wake(); });

  readTheme();
  resize();
  /* The page arrives with one ripple out of the search bar. */
  window.alphaRipple = ripple;
})();
