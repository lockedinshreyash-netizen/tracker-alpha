/* ── The rack ──
   A physical display: rail, hooks, and packs on the hooks, all in one layer
   that slides. The wall behind it (PackCategory) does not move, so you stand
   still and push the display.

   Discipline borrowed from schedule/DayTimeline.tsx and board/useCardDrag.ts:
   - A gesture never re-renders React. Position, velocity and every pack's
     sway live in a ref. A requestAnimationFrame loop writes `transform`
     directly to the track and to each pack, and runs only while something
     moves: a drag, a glide, a spring, or a pack still settling.
   - Pointer Events with move/up on window, a 6px threshold before a press
     becomes a drag, and the click after a real drag is swallowed. A tap on
     a rack that is still gliding only catches it.
   - `touch-action: pan-y`: a vertical swipe still scrolls the page. Only a
     horizontal one moves the rack.
   - A trackpad's horizontal wheel moves it directly (the OS supplies the
     momentum), then it settles onto a hook. Vertical wheel is left alone.

   The arithmetic is in ./physics.ts; this file is only the hand. All
   geometry is inline style: CDN Tailwind cannot see computed classes. */

import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PackCard, priceLabel } from './PackCard';
import { HookBack, HookFront } from './PackHook';
import { PackRail } from './PackRail';
import { geometry, type RackSize } from './geometry';
import {
  type Bounds, type Motion, type Sample, atRest, clamp, glideAt, omegaFor, planRelease, releaseVelocity, rubber,
  smoothAccel, snap, springStep, swayStep, swaying,
} from './physics';
import type { Pack } from '../types';

export interface RackItem { pack: Pack; taken: boolean }

export interface RackHandle {
  /** Push the rack a page left (-1) or right (1). */
  nudge: (dir: 1 | -1) => void;
  /** Bring hook `i` fully into view. */
  reveal: (i: number) => void;
  /** Paint now, so anything following the rack (the detail caret) catches up. */
  sync: () => void;
}

interface Props {
  items: RackItem[];
  size: RackSize;
  dark: boolean;
  label: string;
  selectedId: string | null;
  /** The pack in flight: its hook is drawn empty. */
  hiddenId: string | null;
  reduced: boolean;
  /** Bare hooks to draw when there is nothing to hang. */
  emptyHooks?: number;
  onSelect: (pack: Pack) => void;
  onOpenTaken: (pack: Pack) => void;
  /** Every painted frame: the rack's offset and where its first hook sits. */
  onFrame?: (x: number, lead: number) => void;
  packRef?: (id: string, el: HTMLElement | null) => void;
  /** Can the rack move left / right from here — for the arrow buttons. */
  onEnds?: (atStart: boolean, atEnd: boolean) => void;
}

const THRESHOLD = 6;

interface Phys {
  x: number;
  v: number;
  accel: number;
  mode: 'idle' | 'drag' | 'glide' | 'spring' | 'wheel';
  motion: Motion | null;
  springV: number;
  dragX: number;
  wheelRaw: number;
  lastT: number;
  raf: number;
  theta: number[];
  w: number[];
}

export const PackRack = React.forwardRef<RackHandle, Props>(({
  items, size, dark, label, selectedId, hiddenId, reduced, emptyHooks = 0, onSelect, onOpenTaken, onFrame, packRef, onEnds,
}, ref) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const swayEls = useRef<(HTMLDivElement | null)[]>([]);
  const [vw, setVw] = useState(0);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);
  const phys = useRef<Phys>({ x: 0, v: 0, accel: 0, mode: 'idle', motion: null, springV: 0, dragX: 0, wheelRaw: 0, lastT: 0, raf: 0, theta: [], w: [] });

  const g0 = useMemo(() => geometry(size.w, size.h, 1), [size.w, size.h]);
  const n = items.length || emptyHooks;
  const span = Math.max(0, n - 1) * size.spacing + size.w;
  const lead = vw && span + size.pad * 2 < vw ? (vw - span) / 2 : size.pad;
  const trackW = Math.max(vw, lead * 2 + span);
  const bounds: Bounds = useMemo(() => ({ min: Math.min(0, vw - trackW), max: 0 }), [vw, trackW]);
  const packTop = size.pivotY - g0.pivot.y;
  const height = packTop + size.h + 40;
  const k = size.w / 198;

  // The loop reads these, never the props, so it never closes over stale ones.
  const live = useRef({ bounds, vw, spacing: size.spacing, reduced, onFrame, lead, onEnds, w: size.w });
  live.current = { bounds, vw, spacing: size.spacing, reduced, onFrame, lead, onEnds, w: size.w };

  /* ── Paint ── */
  const ends = useRef('');
  const paint = useCallback(() => {
    const s = phys.current;
    const L = live.current;
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${s.x}px,0,0)`;
    swayEls.current.forEach((el, i) => { if (el) el.style.transform = `rotate(${L.reduced ? 0 : s.theta[i] ?? 0}rad)`; });
    L.onFrame?.(s.x, L.lead);
    const e = `${s.x >= L.bounds.max - 1}|${s.x <= L.bounds.min + 1}`;
    if (e !== ends.current) { ends.current = e; L.onEnds?.(s.x >= L.bounds.max - 1, s.x <= L.bounds.min + 1); }
  }, []);

  const frame = useCallback((now: number) => {
    const s = phys.current;
    const L = live.current;
    const dt = clamp(now - s.lastT, 1, 34);
    s.lastT = now;
    let x = s.x;
    if (s.mode === 'drag') x = s.dragX;
    else if (s.mode === 'wheel') x = rubber(s.wheelRaw, L.bounds, L.vw || 1);
    else if (s.mode === 'glide' && s.motion?.kind === 'glide') {
      x = glideAt(s.motion, now);
      if (Math.abs(s.motion.to - x) < 0.35) { x = s.motion.to; s.mode = 'idle'; }
    } else if (s.mode === 'spring' && s.motion) {
      const r = springStep(x, s.springV, s.motion.to, dt);
      x = r.x;
      s.springV = r.v;
      if (atRest(x, s.springV, s.motion.to)) { x = s.motion.to; s.mode = 'idle'; }
    }
    const v = (x - s.x) / dt;
    s.accel = smoothAccel(s.accel, (v - s.v) / dt, dt);
    s.v = v;
    s.x = x;

    let moving = s.mode !== 'idle';
    if (!L.reduced) {
      for (let i = 0; i < swayEls.current.length; i += 1) {
        const r = swayStep(s.theta[i] ?? 0, s.w[i] ?? 0, s.accel, dt, omegaFor(i));
        s.theta[i] = r.theta;
        s.w[i] = r.w;
        if (swaying(r.theta, r.w)) moving = true;
      }
    }
    paint();
    if (!moving && Math.abs(s.accel) < 1e-6) {
      s.raf = 0;
      s.accel = 0;
      s.v = 0;
      return;
    }
    s.raf = requestAnimationFrame(frame);
  }, [paint]);

  const kick = useCallback(() => {
    const s = phys.current;
    if (s.raf) return;
    s.lastT = performance.now();
    s.raf = requestAnimationFrame(frame);
  }, [frame]);

  useEffect(() => () => { if (phys.current.raf) cancelAnimationFrame(phys.current.raf); }, []);

  const springTo = useCallback((to: number) => {
    const s = phys.current;
    s.motion = { kind: 'spring', to: clamp(to, live.current.bounds.min, live.current.bounds.max), v: s.v };
    s.springV = s.v;
    s.mode = 'spring';
    kick();
  }, [kick]);

  /* ── Size ── */
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    setVw(el.clientWidth);
    const ro = new ResizeObserver(() => setVw(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A resize (or a pack taken off the end) can leave the rack past an end.
  useLayoutEffect(() => {
    const s = phys.current;
    if (s.mode === 'idle' && (s.x < bounds.min || s.x > bounds.max)) s.x = clamp(s.x, bounds.min, bounds.max);
    paint();
  }, [bounds, lead, n, paint]);

  /* ── Handle ── */
  const reveal = useCallback((i: number) => {
    const s = phys.current;
    const L = live.current;
    const margin = Math.min(24, L.vw * 0.05);
    const left = L.lead + i * L.spacing + s.x;
    const right = left + L.w;
    if (left < margin) springTo(s.x + (margin - left));
    else if (right > L.vw - margin) springTo(s.x - (right - (L.vw - margin)));
  }, [springTo]);

  useImperativeHandle(ref, () => ({
    nudge: dir => {
      const s = phys.current;
      const L = live.current;
      const page = Math.max(L.spacing, Math.floor((L.vw * 0.8) / L.spacing) * L.spacing);
      springTo(snap((s.mode === 'spring' && s.motion ? s.motion.to : s.x) - dir * page, L.spacing, L.bounds));
    },
    reveal,
    sync: paint,
  }), [springTo, reveal, paint]);

  /* ── Pointer ── */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const s = phys.current;
    const id = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    let claimed = false;
    let offset = s.x;
    const samples: Sample[] = [];
    // Catch a moving rack: it stops under the finger, and the tap selects nothing.
    if (s.mode !== 'idle' && Math.abs(s.v) > 0.05) {
      s.mode = 'drag';
      s.dragX = s.x;
      suppressClick.current = true;
      kick();
    }

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!claimed) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { done(ev, true); return; }
        if (Math.abs(dx) < THRESHOLD) return;
        claimed = true;
        offset = s.x - dx;
        s.mode = 'drag';
        setDragging(true);
      }
      const L = live.current;
      s.dragX = rubber(offset + dx, L.bounds, L.vw || 1);
      samples.push({ t: performance.now(), x: s.dragX });
      if (samples.length > 10) samples.shift();
      kick();
    };
    const done = (ev: PointerEvent, abandoned = false) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDragging(false);
      if (claimed) suppressClick.current = true;
      if (s.mode !== 'drag') return;
      const now = performance.now();
      const v = abandoned ? 0 : releaseVelocity(samples, now);
      const L = live.current;
      s.motion = planRelease(s.x, v, L.spacing, L.bounds, now);
      if (s.motion.kind === 'glide') s.mode = 'glide';
      else { s.mode = 'spring'; s.springV = v; }
      kick();
    };
    const up = (ev: PointerEvent) => done(ev);
    const cancel = (ev: PointerEvent) => done(ev, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  /* ── Wheel / trackpad ── */
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    let timer = 0;
    const onWheel = (e: WheelEvent) => {
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const d = horizontal ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!d) return;
      e.preventDefault();
      const s = phys.current;
      const L = live.current;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? L.vw : 1;
      if (s.mode !== 'wheel') s.wheelRaw = s.x;
      s.wheelRaw = clamp(s.wheelRaw - d * unit, L.bounds.min - L.vw * 0.4, L.bounds.max + L.vw * 0.4);
      s.mode = 'wheel';
      kick();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (phys.current.mode !== 'wheel') return;
        springTo(snap(phys.current.x, live.current.spacing, live.current.bounds));
      }, 140);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => { el.removeEventListener('wheel', onWheel); window.clearTimeout(timer); };
  }, [kick, springTo]);

  /* ── Keys: arrows walk the packs ── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const list: HTMLButtonElement[] = trackRef.current ? Array.from(trackRef.current.querySelectorAll<HTMLButtonElement>('button[data-pack]')) : [];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    list[clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, list.length - 1)]?.focus();
  };

  const brackets = useMemo(() => {
    const out = [26, trackW - 26];
    for (let i = 2; i < n - 1; i += 4) out.push(lead + i * size.spacing + size.w / 2 + size.spacing / 2);
    return out;
  }, [trackW, n, lead, size.spacing, size.w]);

  const slots = items.length ? items : Array.from({ length: emptyHooks }, () => null);
  swayEls.current.length = slots.length;

  return (
    <div
      ref={viewRef}
      role="group"
      aria-roledescription="rack"
      aria-label={label}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      className={`pk-rack relative overflow-hidden select-none ${dragging ? 'pk-dragging cursor-grabbing' : 'cursor-grab'}`}
      style={{
        height,
        touchAction: 'pan-y',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)',
        maskImage: 'linear-gradient(90deg, transparent 0, #000 22px, #000 calc(100% - 22px), transparent 100%)',
        ['--pk-shadow-o' as string]: dark ? 0.62 : 0.2,
      }}
    >
      <div ref={trackRef} className="absolute left-0 top-0" style={{ width: trackW, height, willChange: 'transform' }}>
        <PackRail width={trackW} dark={dark} brackets={brackets} />
        {slots.map((it, i) => {
          const hx = lead + i * size.spacing + size.w / 2;
          const pack = it?.pack ?? null;
          const hanging = !!pack && !it?.taken && pack.id !== hiddenId;
          const selected = !!pack && pack.id === selectedId;
          const cards = pack ? pack.decks.reduce((m, d) => m + d.cards, 0) : 0;
          return (
            <React.Fragment key={pack?.id ?? `hook-${i}`}>
              <HookBack x={hx} pivotY={size.pivotY} dark={dark} scale={k} />
              {hanging && pack && (
                <div
                  ref={el => { swayEls.current[i] = el; }}
                  className="absolute"
                  style={{ left: hx - size.w / 2, top: packTop, width: size.w, height: size.h, transformOrigin: `${g0.pivot.x}px ${g0.pivot.y}px`, willChange: 'transform' }}
                >
                  <button
                    ref={el => packRef?.(pack.id, el)}
                    type="button"
                    data-pack={pack.id}
                    data-selected={selected}
                    aria-pressed={selected}
                    aria-label={`${pack.title}. ${cards} cards. ${pack.access === 'pro' ? 'Included with Alpha Pro' : priceLabel(pack) === 'FREE' ? 'Free' : priceLabel(pack)}.`}
                    onClick={() => onSelect(pack)}
                    onFocus={e => { if (e.currentTarget.matches(':focus-visible')) reveal(i); }}
                    className="pk-lift block relative rounded-[14px] outline-none"
                    style={{ transformOrigin: `${g0.pivot.x}px ${g0.pivot.y}px` }}
                  >
                    <PackCard pack={pack} w={size.w} h={size.h} />
                    <span aria-hidden className="pk-focus absolute pointer-events-none" style={{ left: -5, right: -5, top: g0.perf - 5, bottom: -5, borderRadius: 18 * k }} />
                  </button>
                </div>
              )}
              <HookFront x={hx} pivotY={size.pivotY} dark={dark} scale={k} bare={!hanging} />
              {pack && it?.taken && (
                <button
                  type="button"
                  onClick={() => onOpenTaken(pack)}
                  className={`absolute -translate-x-1/2 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] font-ui whitespace-nowrap transition-colors ${
                    dark ? 'bg-white/[0.06] text-zinc-300 hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.08]' : 'bg-white text-zinc-700 hover:bg-zinc-50 shadow-sm ring-1 ring-inset ring-zinc-200'}`}
                  style={{ left: hx, top: size.pivotY + 44 * k }}
                  aria-label={`${pack.title} is in My Alpha. Open it.`}
                >
                  In My Alpha <span aria-hidden>→</span>
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

PackRack.displayName = 'PackRack';
