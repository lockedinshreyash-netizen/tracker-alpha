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

   What a hook holds: a stack. A pack you can take hangs at the front, with
   two more copies peeking out behind it (PackStackEdges), so it is plain that
   the hook does not empty when one is taken. A pack you already have is not
   removed either. You took the front one, so the next copy shows, further back
   on the rod, darkened and slightly out of focus, with a crisp "In My Alpha"
   badge that opens it, and the last copy still peeks out behind that. A rack never empties as its
   owner fills My Alpha. The same copy appears the moment a pack is taken and
   flies off. A slot with no pack is "coming soon" (PackSoon).

   The arithmetic is in ./physics.ts; this file is only the hand. All
   geometry is inline style: CDN Tailwind cannot see computed classes. */

import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PackCard, PackStackEdges, priceLabel } from './PackCard';
import { HookBack, HookFront } from './PackHook';
import { PackRail } from './PackRail';
import { PackSoon } from './PackSoon';
import { geometry, type RackSize } from './geometry';
import {
  type Bounds, type Motion, type Sample, atRest, clamp, edgeHit, glideAt, omegaFor, planRelease, releaseVelocity, rubber,
  MAX_OVER, smoothAccel, snap, springStep, swayStep, swaying,
} from './physics';
import type { Pack } from '../types';

/** One hook. `pack: null` is a "coming soon" slot. `taken`: the pack is in My Alpha. */
export interface RackItem { pack: Pack | null; taken: boolean }

/** How far back along the rod the copy behind a taken pack hangs, and how much smaller it looks there. */
const REAR = 9;
const REAR_SCALE = 0.965;

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
  /** The line on a "coming soon" slot, e.g. "More Physics packs". */
  soonLabel?: string;
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
  /** The last push past an end from the wheel, to tell a push from a dying momentum tail. */
  wheelPush: number;
  /** Until when outward wheel deltas are ignored, after an end has sprung back. */
  wheelLock: number;
  lastT: number;
  raf: number;
  theta: number[];
  w: number[];
}

export const PackRack = React.forwardRef<RackHandle, Props>(({
  items, size, dark, label, selectedId, hiddenId, reduced, emptyHooks = 0, soonLabel = 'More packs', onSelect, onOpenTaken, onFrame, packRef, onEnds,
}, ref) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const swayEls = useRef<(HTMLDivElement | null)[]>([]);
  const [vw, setVw] = useState(0);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);
  const phys = useRef<Phys>({ x: 0, v: 0, accel: 0, mode: 'idle', motion: null, springV: 0, dragX: 0, wheelRaw: 0, wheelPush: 0, wheelLock: 0, lastT: 0, raf: 0, theta: [], w: [] });

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
    else if (s.mode === 'wheel') x = rubber(s.wheelRaw, L.bounds);
    else if (s.mode === 'glide' && s.motion?.kind === 'glide') {
      x = glideAt(s.motion, now);
      if (x > L.bounds.max || x < L.bounds.min) {
        // Reached an end mid-glide: one short, firm bump instead of sailing on.
        const v = (x - s.x) / dt;
        x = clamp(x, L.bounds.min, L.bounds.max);
        s.motion = edgeHit(L.bounds, v);
        s.springV = s.motion.v;
        s.mode = 'spring';
      } else if (Math.abs(s.motion.to - x) < 0.35) { x = s.motion.to; s.mode = 'idle'; }
    } else if (s.mode === 'spring' && s.motion?.kind === 'spring') {
      const r = springStep(x, s.springV, s.motion.to, dt, s.motion.stiff);
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

  const springTo = useCallback((to: number, stiff = false) => {
    const s = phys.current;
    s.motion = { kind: 'spring', to: clamp(to, live.current.bounds.min, live.current.bounds.max), v: s.v, stiff };
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
      s.dragX = rubber(offset + dx, L.bounds);
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
      else { s.mode = 'spring'; s.springV = s.motion.v; }
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
      const step = -d * unit;
      const now = performance.now();
      const pastEnd = s.x > L.bounds.max || s.x < L.bounds.min;
      const outward = s.x >= L.bounds.max - 0.5 ? step > 0 : s.x <= L.bounds.min + 0.5 ? step < 0 : false;
      // An end has just sprung back: the momentum still arriving cannot push it out again.
      if (outward && now < s.wheelLock) return;
      // Past an end and the push is fading: that is momentum, not a hand. Spring back now.
      if (pastEnd && outward && Math.abs(step) < s.wheelPush) {
        s.wheelPush = 0;
        s.wheelLock = now + 450;
        springTo(clamp(s.x, L.bounds.min, L.bounds.max), true);
        return;
      }
      if (s.mode !== 'wheel') s.wheelRaw = s.x;
      s.wheelPush = pastEnd && outward ? Math.abs(step) : 0;
      s.wheelRaw = clamp(s.wheelRaw + step, L.bounds.min - MAX_OVER * 4, L.bounds.max + MAX_OVER * 4);
      s.mode = 'wheel';
      kick();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const p = phys.current;
        if (p.mode !== 'wheel') return;
        const B = live.current.bounds;
        const over = p.x > B.max || p.x < B.min;
        springTo(over ? clamp(p.x, B.min, B.max) : snap(p.x, live.current.spacing, B), over);
      }, 100);
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
        // The copy behind a taken pack: in the shadow of the one that was in front of it.
        ['--pk-rear' as string]: dark ? 'brightness(0.3) saturate(0.5) blur(1.6px)' : 'brightness(0.62) saturate(0.5) blur(1.6px)',
        ['--pk-rear-hover' as string]: dark ? 'brightness(0.42) saturate(0.6) blur(1.2px)' : 'brightness(0.74) saturate(0.6) blur(1.2px)',
      }}
    >
      <div ref={trackRef} className="absolute left-0 top-0" style={{ width: trackW, height, willChange: 'transform' }}>
        <PackRail width={trackW} dark={dark} brackets={brackets} />
        {slots.map((it, i) => {
          const hx = lead + i * size.spacing + size.w / 2;
          const pack = it?.pack ?? null;
          const soon = !!it && !pack;
          const hanging = !!pack && !it?.taken && pack.id !== hiddenId;
          // Taken (or being taken right now): the copy behind it shows.
          const behind = !!pack && !hanging;
          const selected = !!pack && pack.id === selectedId;
          const cards = pack ? pack.decks.reduce((m, d) => m + d.cards, 0) : 0;
          const d = REAR * k;
          return (
            <React.Fragment key={pack?.id ?? `${soon ? 'soon' : 'hook'}-${i}`}>
              <HookBack x={hx} pivotY={size.pivotY} dark={dark} scale={k} />
              {pack && (
                <div
                  ref={el => { swayEls.current[i] = el; }}
                  className="absolute"
                  style={{ left: hx - size.w / 2, top: packTop, width: size.w, height: size.h, transformOrigin: `${g0.pivot.x}px ${g0.pivot.y}px`, willChange: 'transform' }}
                >
                  {/* The copies further back: two behind a pack you can take, one behind the dark copy of a taken one. */}
                  <PackStackEdges g={g0} finish={pack.finish} dark={dark} depths={hanging ? [1, 2] : [2]} step={d} />
                  {behind && (
                    <button
                      type="button"
                      data-pack={it?.taken ? pack.id : undefined}
                      disabled={!it?.taken}
                      onClick={() => onOpenTaken(pack)}
                      aria-label={`${pack.title} is in My Alpha. Open it.`}
                      className="pk-rear-btn absolute left-0 top-0 block rounded-[14px] outline-none disabled:cursor-default"
                      style={{ transform: `translateY(${-d}px) scale(${REAR_SCALE})`, transformOrigin: `${g0.pivot.x}px ${g0.pivot.y}px` }}
                    >
                      <PackCard pack={pack} w={size.w} h={size.h} className="pk-rear" />
                      {it?.taken && (
                        <span
                          className={`absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 h-8 pl-2 pr-3.5 rounded-full text-[10px] font-bold uppercase tracking-[0.1em] font-ui whitespace-nowrap shadow-[0_8px_20px_-8px_rgba(0,0,0,0.6)] ${
                            dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}
                          style={{ top: g0.perf + (size.h - g0.perf) * 0.38 }}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center ${dark ? 'bg-black text-white' : 'bg-white text-zinc-900'}`}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                          </span>
                          In My Alpha
                        </span>
                      )}
                      <span aria-hidden className="pk-focus absolute pointer-events-none" style={{ left: -5, right: -5, top: g0.perf - 5, bottom: -5, borderRadius: 18 * k }} />
                    </button>
                  )}
                  {hanging && <button
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
                  </button>}
                </div>
              )}
              {soon && (
                <div className="absolute pointer-events-none" style={{ left: hx - size.w / 2, top: packTop }}>
                  <PackSoon w={size.w} h={size.h} dark={dark} label={soonLabel} />
                </div>
              )}
              <HookFront x={hx} pivotY={size.pivotY} dark={dark} scale={k} bare={!hanging && !behind} reach={behind ? d : 0} />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
});

PackRack.displayName = 'PackRack';
