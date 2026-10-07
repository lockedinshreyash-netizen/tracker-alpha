/* ── One category: a wall with a rack on it ──
   The wall is the stationary part: a panel with a soft top shadow under the
   rail, the same in every category. The rack slides across it. The detail
   panel opens under the wall, its caret held over the chosen pack as the
   rack moves (written on each painted frame, never through React state). */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tokens } from '../../ui/kit';
import { PackDetail } from './PackDetail';
import { PackRack, type RackHandle, type RackItem } from './PackRack';
import type { RackSize } from './geometry';
import { wallStyle } from './PackRail';
import type { Pack, PreviewCard } from '../types';

const Chevron: React.FC<{ dir: 'l' | 'r' }> = ({ dir }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'l' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} />
  </svg>
);

export { wallStyle } from './PackRail';

export const PackCategory: React.FC<{
  title: string;
  items: RackItem[];
  size: RackSize;
  dark: boolean;
  reduced: boolean;
  selectedId: string | null;
  hiddenId: string | null;
  /** The chosen pack, when it hangs on this rack. */
  selected: Pack | null;
  preview: PreviewCard[] | null | 'error';
  busy: boolean;
  error: string | null;
  emptyHooks?: number;
  note?: string;
  delay?: number;
  onSelect: (pack: Pack) => void;
  onDeselect: () => void;
  onAcquire: () => void;
  onOpenTaken: (pack: Pack) => void;
  packRef: (id: string, el: HTMLElement | null) => void;
}> = ({ title, items, size, dark, reduced, selectedId, hiddenId, selected, preview, busy, error, emptyHooks, note, delay = 0, onSelect, onDeselect, onAcquire, onOpenTaken, packRef }) => {
  const t = tokens(dark);
  const rack = useRef<RackHandle>(null);
  const caret = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState<[boolean, boolean]>([true, true]);
  const index = selected ? items.findIndex(i => i.pack.id === selected.id) : -1;
  const indexRef = useRef(index);
  indexRef.current = index;
  const live = items.filter(i => !i.taken).length;

  // Stable, so React does not detach and re-attach it on every render. Placed
  // at once rather than on the rack's next frame (which may never come).
  const setCaret = useCallback((el: HTMLDivElement | null) => {
    caret.current = el;
    if (el) rack.current?.sync();
  }, []);

  const onFrame = useCallback((x: number, lead: number) => {
    const el = caret.current;
    if (!el || indexRef.current < 0) return;
    const w = el.parentElement?.clientWidth ?? 0;
    const cx = Math.min(w - 28, Math.max(20, lead + indexRef.current * size.spacing + size.w / 2 + x));
    el.style.transform = `translateX(${cx - 8}px) rotate(45deg)`;
  }, [size.spacing, size.w]);

  // A chosen pack comes fully into view, and so does its panel.
  useEffect(() => {
    if (index < 0) return;
    rack.current?.reveal(index);
    const id = window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' }), 60);
    return () => window.clearTimeout(id);
  }, [index, reduced]);

  return (
    <section className="mk-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className={`font-display uppercase text-[22px] md:text-[26px] leading-none tracking-[0.04em] ${t.heading}`}>{title}</h2>
          <p className={`text-[12px] mt-2 ${t.muted}`}>{note ?? `${items.length} ${items.length === 1 ? 'pack' : 'packs'}${live < items.length ? ` · ${items.length - live} in My Alpha` : ''}`}</p>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {(['l', 'r'] as const).map(d => (
            <button
              key={d}
              onClick={() => rack.current?.nudge(d === 'l' ? -1 : 1)}
              disabled={d === 'l' ? ends[0] : ends[1]}
              aria-label={d === 'l' ? `Slide ${title} rack left` : `Slide ${title} rack right`}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${dark ? 'text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.07]' : 'text-zinc-700 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`}
            >
              <Chevron dir={d} />
            </button>
          ))}
        </div>
      </div>

      <div className={`relative rounded-2xl border pt-3 ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={wallStyle(dark)}>
        <PackRack
          ref={rack}
          items={items}
          size={size}
          dark={dark}
          reduced={reduced}
          label={`${title} rack`}
          selectedId={selectedId}
          hiddenId={hiddenId}
          emptyHooks={emptyHooks}
          onSelect={onSelect}
          onOpenTaken={onOpenTaken}
          onFrame={onFrame}
          onEnds={(a, b) => setEnds([a, b])}
          packRef={packRef}
        />
      </div>

      {selected && (
        <div ref={detailRef} className="scroll-mt-24 scroll-mb-6">
          <PackDetail
            key={selected.id}
            pack={selected}
            preview={preview}
            dark={dark}
            busy={busy}
            error={error}
            caretRef={setCaret}
            onClose={onDeselect}
            onAcquire={onAcquire}
          />
        </div>
      )}
    </section>
  );
};
