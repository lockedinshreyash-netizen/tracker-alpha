/* ── One rack, one row ──
   Each part of the store is a single rack: one row on one wall, as long as
   what is on it, that slides sideways, the way the packs' racks do. The wall
   stays; the row moves, shelf and all, so a plank or a ledge is one piece
   carried with what stands on it.

   Native horizontal scrolling does the moving (touch, trackpad and wheel
   already feel right), with the packs' ‹ › buttons beside the heading and a
   mouse drag on top: drag 1:1, and a drag of more than a few pixels is not a
   click, so letting go over a box does not open it. Vertical wheel and
   vertical swipes stay with the page. */

import React, { useCallback, useEffect, useRef, useState } from 'react';

const Chevron = ({ dir }: { dir: 'l' | 'r' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'l' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
  </svg>
);

const DRAG_THRESHOLD = 6;

interface Props {
  /** The heading over the rack; the ‹ › buttons sit on its right. */
  heading: React.ReactNode;
  /** What the buttons are read as: "Slide the kits rack left". */
  label: string;
  dark: boolean;
  /** The wall behind the row. */
  wall: React.CSSProperties;
  /** How far one press of ‹ or › moves: about one item. */
  step: number;
  delay?: number;
  children: React.ReactNode;
}

export const StoreRow = ({ heading, label, dark, wall, step, delay = 0, children }: Props) => {
  const track = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState<[boolean, boolean]>([true, true]);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEnds([el.scrollLeft <= 1, el.scrollLeft + el.clientWidth >= el.scrollWidth - 1]);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure]);

  const nudge = (dir: -1 | 1) => {
    const el = track.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * Math.max(step, el.clientWidth * 0.6), behavior: reduced ? 'auto' : 'smooth' });
  };

  /* A mouse drag moves the row 1:1. Touch and trackpads scroll natively. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      const el = track.current;
      if (!d || !el) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!d.moved) { d.moved = true; setDragging(true); }
      el.scrollLeft = d.left - dx;
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (d?.moved) {
        setDragging(false);
        // The click that follows a drag is not a click.
        const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener('click', stop, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);

  return (
    <section className="mk-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-end justify-between gap-4 mb-6 md:mb-8">
        <div className="min-w-0">{heading}</div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {(['l', 'r'] as const).map(d => (
            <button
              key={d}
              onClick={() => nudge(d === 'l' ? -1 : 1)}
              disabled={d === 'l' ? ends[0] : ends[1]}
              aria-label={`Slide the ${label} ${d === 'l' ? 'left' : 'right'}`}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${dark ? 'text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.07]' : 'text-zinc-700 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`}
            >
              <Chevron dir={d} />
            </button>
          ))}
        </div>
      </div>
      <div className={`relative rounded-2xl border overflow-hidden ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={wall}>
        <div
          ref={track}
          onPointerDown={onPointerDown}
          aria-label={label}
          className="overflow-x-auto overflow-y-hidden no-scrollbar overscroll-x-contain"
          style={{ cursor: dragging ? 'grabbing' : undefined, touchAction: 'pan-x pan-y', userSelect: dragging ? 'none' : undefined }}
        >
          {/* At least as wide as the wall, so the shelf always runs end to end. */}
          <div className="flex min-w-full w-max">{children}</div>
        </div>
      </div>
    </section>
  );
};
