/* ── Fireworks ── the firecracker box's one trick (FestiveLayer, Diwali).

   A tap launches a rocket from the box; it climbs on an easing curve, leaving
   sparks, and bursts into a random shell — a peony, a ring or a gold willow —
   in one or two random colours.

   One canvas over the whole window, created on the first launch and removed
   once the sky is empty, so nothing runs while nobody is lighting anything.
   Trails come from fading the canvas with `destination-out` each frame rather
   than painting black over it: the canvas is transparent over the page, and
   that is the only way to leave a fading streak without hiding the app.

   It never touches AppState and never re-renders React. The sound is drawn
   in Web Audio from noise (a whoosh, a thump, a crackle), so there are no
   files to fetch, and it obeys the app's mute and volume. */

import { getSnapshot as soundState } from '../audio';

type Rgb = [number, number, number];

interface Rocket {
  x0: number; y0: number; x1: number; y1: number;
  t: number; dur: number; x: number; y: number;
  shell: Shell;
}
interface Spark {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; rgb: Rgb;
  drag: number; gravity: number; twinkle: boolean;
}
interface Flash { x: number; y: number; t: number; rgb: Rgb }
type ShellKind = 'peony' | 'ring' | 'willow';
interface Shell { kind: ShellKind; colors: Rgb[] }

const PALETTE: Rgb[] = [
  [255, 77, 77],   // red
  [255, 212, 59],  // gold
  [105, 219, 124], // green
  [77, 171, 247],  // blue
  [218, 119, 242], // violet
  [255, 146, 43],  // orange
  [240, 101, 149], // pink
  [102, 217, 232], // cyan
  [255, 255, 255], // white
];
const GOLD: Rgb = [255, 196, 77];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const between = (a: number, b: number) => a + Math.random() * (b - a);

/* On paper, white stars vanish and additive blending bleaches every colour,
   so the light theme draws from the saturated hues with ordinary blending. */
let onPaper = false;
const LIGHT_PALETTE = PALETTE.filter(c => c[0] + c[1] + c[2] < 640);

const randomShell = (): Shell => {
  const roll = Math.random();
  if (roll < 0.18) return { kind: 'willow', colors: [onPaper ? [240, 140, 0] : GOLD] };
  const hues = onPaper ? LIGHT_PALETTE : PALETTE;
  const a = pick(hues);
  let b = pick(hues);
  if (b === a) b = pick(hues);
  return { kind: roll < 0.48 ? 'ring' : 'peony', colors: Math.random() < 0.55 ? [a, b] : [a] };
};

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf = 0;
let last = 0;
let w = 0;
let h = 0;
const rockets: Rocket[] = [];
const sparks: Spark[] = [];
const flashes: Flash[] = [];
const MAX_ROCKETS = 6;
const MAX_SPARKS = 1400;

const resize = () => {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth; h = window.innerHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const mount = () => {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  /* Over the page and the rail, under every sheet and modal (z 75+). */
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    zIndex: '60', pointerEvents: 'none',
  });
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
};

const unmount = () => {
  window.removeEventListener('resize', resize);
  canvas?.remove();
  canvas = null; ctx = null;
};

const burst = (x: number, y: number, shell: Shell) => {
  const still = reducedMotion();
  const n = Math.round((shell.kind === 'willow' ? 90 : shell.kind === 'ring' ? 70 : 110) * (still ? 0.5 : 1));
  const power = between(170, 250) * (w < 600 ? 0.75 : 1);
  for (let i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
    const a = (Math.PI * 2 * i) / n + between(-0.04, 0.04);
    const speed = shell.kind === 'ring' ? power * between(0.94, 1.02) : power * Math.sqrt(Math.random());
    const willow = shell.kind === 'willow';
    sparks.push({
      x, y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: 0,
      max: willow ? between(2.0, 2.8) : between(1.1, 1.7),
      size: willow ? 1.4 : between(1.4, 2.3),
      rgb: shell.colors[i % shell.colors.length],
      drag: willow ? 2.2 : 1.6,
      gravity: willow ? 120 : 75,
      twinkle: !willow && Math.random() < 0.3,
    });
  }
  flashes.push({ x, y, t: 0, rgb: shell.colors[0] });
  sound.boom();
};

const step = (now: number) => {
  if (!ctx) return;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
  last = now;

  /* Fade what was drawn last frame: this is the trail. */
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = onPaper ? 'source-over' : 'lighter';

  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.t += dt;
    const p = Math.min(1, r.t / r.dur);
    const e = 1 - Math.pow(1 - p, 2.4);
    const px = r.x, py = r.y;
    r.x = r.x0 + (r.x1 - r.x0) * e;
    r.y = r.y0 + (r.y1 - r.y0) * e;
    ctx.strokeStyle = onPaper ? 'rgba(230,140,20,0.9)' : 'rgba(255,220,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(r.x, r.y); ctx.stroke();
    if (sparks.length < MAX_SPARKS) {
      sparks.push({
        x: r.x, y: r.y, vx: between(-25, 25), vy: between(10, 50),
        life: 0, max: between(0.25, 0.5), size: 1.1, rgb: GOLD,
        drag: 3, gravity: 60, twinkle: false,
      });
    }
    if (p >= 1) { rockets.splice(i, 1); burst(r.x, r.y, r.shell); }
  }

  for (let i = flashes.length - 1; i >= 0; i--) {
    const f = flashes[i];
    f.t += dt;
    const a = Math.max(0, 0.35 * (1 - f.t / 0.22));
    if (a <= 0) { flashes.splice(i, 1); continue; }
    const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 70);
    g.addColorStop(0, `rgba(${f.rgb.join(',')},${a})`);
    g.addColorStop(1, `rgba(${f.rgb.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(f.x - 70, f.y - 70, 140, 140);
  }

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.life += dt;
    if (s.life >= s.max) { sparks.splice(i, 1); continue; }
    const k = Math.exp(-s.drag * dt);
    s.vx *= k; s.vy = s.vy * k + s.gravity * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    const fade = 1 - s.life / s.max;
    let alpha = fade * fade;
    if (s.twinkle && s.life > s.max * 0.4) alpha *= Math.random() < 0.5 ? 0.15 : 1;
    ctx.fillStyle = `rgba(${s.rgb.join(',')},${alpha})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * (0.6 + 0.4 * fade), 0, Math.PI * 2);
    ctx.fill();
  }

  if (rockets.length || sparks.length || flashes.length) {
    raf = requestAnimationFrame(step);
  } else {
    raf = 0; last = 0;
    unmount();
  }
};

/** Launch one rocket from a point on screen (the box's mouth). */
export const launch = (fromX: number, fromY: number, dark = true) => {
  if (typeof window === 'undefined' || rockets.length >= MAX_ROCKETS) return;
  onPaper = !dark;
  mount();
  if (!ctx) return;
  const still = reducedMotion();
  const spread = Math.min(320, w * 0.3);
  const x1 = Math.max(60, Math.min(w - 60, fromX + between(-spread, spread * 0.4)));
  const y1 = Math.max(70, h * between(0.14, 0.38));
  rockets.push({
    x0: fromX, y0: fromY, x1, y1,
    t: 0, dur: still ? 0.001 : between(0.75, 1.0),
    x: fromX, y: fromY,
    shell: randomShell(),
  });
  if (!still) sound.whoosh();
  if (!raf) raf = requestAnimationFrame(step);
};

/* ── Sound ── synthesised, tiny, and quiet. */
let audio: AudioContext | null = null;
let noise: AudioBuffer | null = null;

const ac = (): AudioContext | null => {
  const { enabled, volume } = soundState();
  if (!enabled || volume <= 0 || document.hidden) return null;
  try {
    if (!audio) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      audio = new AC();
      noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch { return null; }
};

const level = () => {
  const v = soundState().volume;
  return v * v;
};

const noiseVoice = (a: AudioContext, start: number, dur: number, peak: number,
  filter: BiquadFilterType, f0: number, f1: number, q = 0.8) => {
  const src = a.createBufferSource();
  src.buffer = noise;
  const bq = a.createBiquadFilter();
  bq.type = filter; bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, start);
  bq.frequency.exponentialRampToValueAtTime(f1, start + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.03, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(bq).connect(g).connect(a.destination);
  src.start(start, Math.random() * 0.5, dur + 0.05);
};

const sound = {
  whoosh() {
    const a = ac(); if (!a) return;
    noiseVoice(a, a.currentTime, 0.8, 0.12 * level(), 'bandpass', 600, 3200, 1.4);
  },
  boom() {
    const a = ac(); if (!a) return;
    const t = a.currentTime;
    noiseVoice(a, t, 0.9, 0.5 * level(), 'lowpass', 900, 80);
    /* The crackle: a scatter of tiny high clicks as the stars burn out. */
    for (let i = 0; i < 14; i++) {
      noiseVoice(a, t + 0.25 + Math.random() * 0.9, 0.03, 0.09 * level(), 'highpass', 3000, 5000);
    }
  },
};
