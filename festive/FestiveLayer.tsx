import React, { useEffect, useMemo, useRef, useState } from 'react';
import './festive.css';
import type { FestiveTheme } from './useFestiveTheme';
import {
  CRACKER_BOX, DIYA, KANDIL, LANTERNS, LIGHTS_WIRE, MARIGOLD, SNOWBANK, TORAN, bauble, lightsSet,
} from './art';
import { launch } from './fireworks';

interface Props {
  theme: Exclude<FestiveTheme, 'none'>;
  dark: boolean;
  /** Width of the rail on a laptop, so the left ornament hangs clear of it. */
  railPx?: number;
  /** Console swatch: absolute in its box instead of fixed to the window. */
  preview?: boolean;
}

/* Seeded so the embers sit in the same places on every load (and in the
   console preview as in the app) — the mulberry32 used across the app. */
const seeded = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* The year the coming New Year opens: December 2026 → 2027, January 2027 → 2027. */
const newYear = () => {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  return ist.getUTCMonth() <= 1 ? ist.getUTCFullYear() : ist.getUTCFullYear() + 1;
};

/* The empty strip between <main> (max-w-5xl, 24px of padding inside) and the
   window edge, on each side. The hanging pieces need a real gutter: a plaque
   that reaches under the page header collides with the exam countdown. */
const MAIN_MAX = 1024;
const MAIN_PAD = 24;
const useGutter = (railPx: number, preview?: boolean): { gutter: number; width: number } => {
  const read = () => (typeof window === 'undefined' ? 0 : window.innerWidth);
  const [w, setW] = useState(read);
  useEffect(() => {
    if (preview) return;
    const on = () => setW(read());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [preview]);
  if (preview) return { gutter: Infinity, width: w };
  if (w < 768) return { gutter: 0, width: w };
  return { gutter: Math.max(0, (w - railPx - MAIN_MAX) / 2) + MAIN_PAD, width: w };
};
/* Room each piece needs: its own width plus its offset from the edge. */
const PLAQUE_NEEDS = 172;
const HANG_NEEDS = 100;
/* The cracker box stands in the right gutter above the gear when there is room. */
const CRACKER_NEEDS = 104;

/* ─── Snow ─── a canvas, because two hundred DOM flakes is a layout bill paid
   every frame. Runs only while the tab is visible; under reduced motion it
   draws one still frame and stops. */
const Snow: React.FC<{ dark: boolean; dense?: number }> = ({ dark, dense = 1 }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rand = seeded(27);
    const still = reducedMotion();
    let w = 0, h = 0, raf = 0, last = 0;
    type Flake = { x: number; y: number; r: number; v: number; phase: number; a: number };
    let flakes: Flake[] = [];

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(110, Math.max(14, (w * h) / 15000)) * dense);
      flakes = Array.from({ length: n }, () => {
        const r = 0.6 + rand() * rand() * 2.4;
        return { x: rand() * w, y: rand() * h, r, v: 10 + r * 11, phase: rand() * Math.PI * 2, a: 0.35 + rand() * 0.5 };
      });
    };

    const ink = dark ? '255,255,255' : '120,138,168';
    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const f of flakes) {
        f.y += f.v * dt;
        f.x += Math.sin(t / 1600 + f.phase) * 0.25 * f.r * dt * 10;
        if (f.y > h + 4) { f.y = -4; f.x = rand() * w; }
        if (f.x > w + 4) f.x = -4; else if (f.x < -4) f.x = w + 4;
        ctx.globalAlpha = f.a * (dark ? 0.85 : 0.7);
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${ink})`;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      draw(t, dt);
      raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && !still) { last = 0; raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());

    size();
    if (still) draw(0, 0); else start();
    const ro = new ResizeObserver(() => { size(); if (still) draw(0, 0); });
    ro.observe(canvas);
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [dark, dense]);

  return <canvas ref={ref} className="fx-snow" aria-hidden />;
};

/* ─── The plaque ─── the one line of words, hung on two threads at the right. */
const Plaque: React.FC<{ eyebrow: string; title: string; sub?: string; mark: React.ReactNode; tone: 'diwali' | 'christmas' }> =
  ({ eyebrow, title, sub, mark, tone }) => (
    <div className={`fx-plaque fx-plaque--${tone}`}>
      <span className="fx-plaque-thread fx-plaque-thread--l" />
      <span className="fx-plaque-thread fx-plaque-thread--r" />
      <div className="fx-plaque-card">
        <div className="fx-plaque-mark">{mark}</div>
        <div className="fx-plaque-eyebrow">{eyebrow}</div>
        <div className="fx-plaque-title">{title}</div>
        {sub && <div className="fx-plaque-sub">{sub}</div>}
      </div>
    </div>
  );

/* A clay diya seen from the side: oil in the bowl, the wick in the pinched
   spout, and the flame standing on the wick — not floating over the middle.
   Every length is a fraction of `size`, so one drawing serves the plaque and
   the ground. `beat` is the flame's own rhythm, so no two flicker together. */
const Diya: React.FC<{ size?: number; beat?: { dur: number; delay: number } }> = ({ size = 34, beat = { dur: 1.9, delay: 0 } }) => {
  const s = size;
  const flameW = s * 0.17;
  const flameH = s * 0.4;
  const tipX = s * 0.945;
  const tipY = s * 0.37;
  return (
    <span className="fx-diya" style={{ width: s, height: s * 0.48 + flameH * 0.9 }}>
      <span
        className="fx-diya-glow"
        style={{
          width: s * 2.2, height: s * 2.2, left: tipX - s * 1.1, bottom: tipY + flameH * 0.35 - s * 1.1,
          animationDuration: `${beat.dur * 1.6}s`, animationDelay: `${beat.delay}s`,
        }}
      />
      <span className="fx-diya-bowl" style={{ height: s * 0.48, backgroundImage: DIYA }} />
      <span
        className="fx-diya-flame"
        style={{
          width: flameW, height: flameH, left: tipX - flameW / 2, bottom: tipY,
          animationDuration: `${beat.dur}s, ${beat.dur * 2.7}s`, animationDelay: `${beat.delay}s, ${beat.delay}s`,
        }}
      />
    </span>
  );
};

/* Where a piece may stand: the rail's width, the gutter beside <main>, and the
   window width, so the diya row can keep clear of the two corner docks. */
interface Layout { rail: number; gutter: number; width: number; preview?: boolean }

/* ─── Diyas on the ground ─── not a row. People set them down in twos and
   threes on a step or a ledge, so each corner gets a little cluster: one large
   lamp in front, smaller ones set back and higher (further away), one turned
   the other way, a loose marigold beside them, and a pool of warm light on the
   ground they stand on. Each flame keeps its own rhythm. */
const CLUSTER: Array<{ x: number; y: number; s: number; flip?: boolean }> = [
  { x: 0, y: 8, s: 21, flip: true },
  { x: 54, y: 5, s: 25 },
  { x: 17, y: 0, s: 35 },
];
const CLUSTER_W = 92;

const DiyaCluster: React.FC<{ seed: number; mirror?: boolean; scale?: number; style: React.CSSProperties }> =
  ({ seed, mirror, scale = 1, style }) => {
    const beats = useMemo(() => {
      const rand = seeded(seed);
      return CLUSTER.map(() => ({ dur: 1.5 + rand() * 1.1, delay: -rand() * 3 }));
    }, [seed]);
    return (
      <div
        className="fx-cluster"
        style={{ ...style, width: CLUSTER_W, transform: `scale(${mirror ? -scale : scale}, ${scale})` }}
      >
        <span className="fx-pool" />
        <span className="fx-loose-marigold" style={{ backgroundImage: MARIGOLD, left: 80, bottom: 1 }} />
        {CLUSTER.map((d, i) => (
          <span
            key={i}
            className="fx-cluster-item"
            style={{ left: d.x, bottom: d.y, transform: d.flip ? 'scaleX(-1)' : undefined }}
          >
            <span className="fx-contact" style={{ width: d.s * 0.86, left: d.s * 0.06 }} />
            <Diya size={d.s} beat={beats[i]} />
          </span>
        ))}
      </div>
    );
  };

/* Where the two clusters stand: clear of the feedback launcher (bottom-left)
   and of the gear (bottom-right), plus whatever else stands there (`rightClear`,
   the cracker box when it sits beside the gear). */
const DiyaClusters: React.FC<{ layout: Layout; rightClear?: number }> = ({ layout, rightClear = 0 }) => {
  if (layout.preview) {
    return (
      <div className="fx-diyas">
        <DiyaCluster seed={11} scale={0.8} style={{ left: 10 }} />
        <DiyaCluster seed={29} scale={0.8} mirror style={{ right: 14 + rightClear }} />
      </div>
    );
  }
  const phone = layout.width < 768;
  const left = phone ? 74 : layout.rail + 78;
  const right = (phone ? 74 : 78) + rightClear;
  /* A phone narrower than both clusters side by side keeps just the left one. */
  const both = layout.width - left - right >= CLUSTER_W * 2 + 24;
  return (
    <div className="fx-diyas">
      <DiyaCluster seed={11} style={{ left }} />
      {both && <DiyaCluster seed={29} mirror style={{ right }} />}
    </div>
  );
};

/* ─── The firecracker box ─── the one thing in the layer you can touch. A tap
   launches a rocket from its mouth (festive/fireworks.ts). It glows gently
   until the first tap so it reads as something to press, then stops asking.
   Rendered outside .fx-root in the app, because the root sits under <main> and
   on a narrow screen the box has to sit over the page, beside the gear. */
const CrackerBox: React.FC<{ placement: 'gutter' | 'dock' | 'preview'; dark: boolean }> = ({ placement, dark }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [lit, setLit] = useState(0);

  const fire = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setLit(n => n + 1);
    launch(r.left + r.width * 0.46, r.top + r.height * 0.18, dark);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={fire}
      className={`fx-cracker fx-cracker--${placement} ${lit ? '' : 'fx-cracker--beckon'}`}
      aria-label="Light a firework"
      title="Light a firework"
    >
      <span key={lit} className={`fx-cracker-box ${lit ? 'fx-cracker-jolt' : ''}`} style={{ backgroundImage: CRACKER_BOX }} />
    </button>
  );
};

/* ─── Dussehra ─── the toran over the door and the diyas under it. */
const Dussehra: React.FC<{ layout: Layout }> = ({ layout }) => (
  <>
    <div className="fx-glow fx-glow--diwali" />
    <DiyaClusters layout={layout} />
    <div className="fx-toran" style={{ backgroundImage: TORAN }} />
    {layout.gutter >= PLAQUE_NEEDS && <Plaque
      tone="diwali"
      mark={<span className="fx-marigold" style={{ backgroundImage: MARIGOLD }} />}
      eyebrow="Vijayadashami"
      title="Happy Dussehra"
      sub="Good wins. Now go win."
    />}
  </>
);

/* ─── Diwali ─── a string of lanterns, the akash kandil, diyas on the ledge,
   rising sparks, and a box of crackers that actually go off. */
const Diwali: React.FC<{ dark: boolean; layout: Layout }> = ({ layout }) => {
  const embers = useMemo(() => {
    const rand = seeded(1031);
    return Array.from({ length: 18 }, () => ({
      left: `${(rand() * 100).toFixed(2)}%`,
      size: 2 + rand() * 2.6,
      duration: `${(11 + rand() * 9).toFixed(1)}s`,
      delay: `-${(rand() * 20).toFixed(1)}s`,
      drift: `${Math.round((rand() - 0.5) * 70)}px`,
    }));
  }, []);

  return (
    <>
      <div className="fx-glow fx-glow--diwali" />
      {embers.map((e, i) => (
        <span
          key={i}
          className="fx-ember"
          style={{
            left: e.left, width: e.size, height: e.size,
            animationDuration: e.duration, animationDelay: e.delay,
            ['--fx-drift' as string]: e.drift,
          }}
        />
      ))}
      <DiyaClusters layout={layout} rightClear={layout.preview ? 44 : layout.gutter >= CRACKER_NEEDS ? 0 : 60} />
      <div className="fx-lanterns" style={{ backgroundImage: LANTERNS }} />
      {layout.gutter >= HANG_NEEDS && (
        <div className="fx-hang fx-hang--left" style={{ left: layout.rail + 24 }}>
          <span className="fx-kandil-glow" />
          <span className="fx-sway fx-kandil" style={{ backgroundImage: `${KANDIL}, linear-gradient(#C9A24A, #C9A24A)` }} />
        </div>
      )}
      {layout.gutter >= PLAQUE_NEEDS && <Plaque
        tone="diwali"
        mark={<Diya />}
        eyebrow="Festival of lights"
        title="Shubh Deepavali"
        sub="Light up the hours."
      />}
    </>
  );
};

/* ─── Christmas + New Year ─── */
const Christmas: React.FC<{ dark: boolean; layout: Layout }> = ({ dark, layout }) => {
  const { rail: railPx, gutter, preview } = layout;
  const red = useMemo(() => bauble('#E03131', '#7A1010'), []);
  const gold = useMemo(() => bauble('#F2C14E', '#8A6410'), []);
  const bank = useMemo(
    () => (dark ? SNOWBANK('rgba(236,242,250,0.92)', 'rgba(255,255,255,0.6)') : SNOWBANK('#FFFFFF', 'rgba(140,160,190,0.35)')),
    [dark],
  );

  return (
    <>
      <div className="fx-glow fx-glow--christmas" />
      <Snow dark={dark} dense={preview ? 0.8 : 1} />
      <div className="fx-snowbank" style={{ backgroundImage: bank }} />
      <div className="fx-lights">
        <span style={{ backgroundImage: LIGHTS_WIRE }} />
        <span className="fx-twinkle fx-twinkle--a" style={{ backgroundImage: lightsSet('a') }} />
        <span className="fx-twinkle fx-twinkle--b" style={{ backgroundImage: lightsSet('b') }} />
      </div>
      {gutter >= HANG_NEEDS && (
        <div className="fx-hang fx-hang--left" style={{ left: railPx + 18 }}>
          <span className="fx-sway fx-bauble fx-bauble--long" style={{ backgroundImage: `${red}, linear-gradient(#C9B37E, #C9B37E)` }} />
          <span className="fx-sway fx-bauble fx-bauble--short" style={{ backgroundImage: `${gold}, linear-gradient(#C9B37E, #C9B37E)` }} />
        </div>
      )}
      {gutter >= PLAQUE_NEEDS && <Plaque
        tone="christmas"
        mark={<span className="fx-star">✦</span>}
        eyebrow="Christmas · New Year"
        title="Merry Christmas"
        sub={`And a happy ${newYear()}.`}
      />}
    </>
  );
};

/**
 * The festive layer: decoration over the page's background and under its
 * content, chosen for everyone at once from the console.
 *
 * Kept to the edges on purpose. A string (toran, lanterns or lights) runs
 * along the top, diyas line the bottom, one ornament hangs in the left gutter
 * and the greeting in the right (each only when that gutter is wide enough to
 * hold it), and the rest (glow, embers, snow) is faint enough to sit behind a
 * card without competing with it. The firecracker box is the only thing that
 * takes a pointer; nothing moves under `prefers-reduced-motion`.
 */
const FestiveLayer: React.FC<Props> = ({ theme, dark, railPx = 72, preview }) => {
  const rail = preview ? 0 : railPx;
  const { gutter, width } = useGutter(rail, preview);
  const layout: Layout = { rail, gutter, width, preview };
  const cracker = theme === 'diwali' && (
    <CrackerBox dark={dark} placement={preview ? 'preview' : gutter >= CRACKER_NEEDS ? 'gutter' : 'dock'} />
  );
  return (
    <>
      <div
        className={`fx-root fx-root--${theme} ${dark ? 'fx-dark' : 'fx-light'} ${preview ? 'fx-preview' : ''}`}
        aria-hidden
      >
        {theme === 'dussehra' && <Dussehra layout={layout} />}
        {theme === 'diwali' && <Diwali dark={dark} layout={layout} />}
        {theme === 'christmas' && <Christmas dark={dark} layout={layout} />}
        {preview && cracker}
      </div>
      {!preview && cracker && <div className={dark ? 'fx-dark' : 'fx-light'}>{cracker}</div>}
    </>
  );
};

export default FestiveLayer;
