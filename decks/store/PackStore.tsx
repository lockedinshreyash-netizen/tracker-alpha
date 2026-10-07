/* ── Alpha Packs: the store ──
   A knowledge store you stand in front of. Each subject is a rack on a wall
   (PackCategory); each pack hangs on its own hook (PackRack). Slide a rack,
   tap a pack to see what is in it (PackDetail), take it, and watch it open
   (PackOpeningAnimation). Then it is a deck in My Alpha, and the physical
   metaphor ends there: the library draws it as an ordinary deck.

   This file holds the state machine (./PackAcquisition) and nothing else
   that is clever. One pack at a time, and the server decides: `acquire`
   resolves only when the pack is really yours, and the opening plays only
   after that. A pack in My Alpha leaves an empty hook behind, on purpose.

   Presentational over its props: DecksTab passes the real `acquire` and
   `loadPreview`; the design board passes fakes. */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { tokens } from '../../ui/kit';
import type { ExamPreference } from '../../types';
import { Icon } from '../ui';
import { IDLE, isBusy, isOpening, transition } from './PackAcquisition';
import { PackCategory } from './PackCategory';
import { PackOpeningAnimation } from './PackOpeningAnimation';
import type { RackItem } from './PackRack';
import { useRackSize, useReducedMotion } from './env';
import type { DeckSubject, Pack, PreviewCard } from '../types';

interface Props {
  /** Null while loading. */
  packs: Pack[] | null;
  dark: boolean;
  examPreference: ExamPreference;
  isAdmin: boolean;
  /** Packs already in My Alpha, for the header. */
  owned: number;
  onBack: () => void;
  onOpenOwned: (packId: string) => void;
  /** Resolves once the pack is the caller's; throws an Error whose message is for the screen. */
  acquire: (pack: Pack) => Promise<void>;
  loadPreview: (packId: string) => Promise<PreviewCard[]>;
  /** The opening finished: refresh and go to the pack in My Alpha. */
  onAcquired: (packId: string) => Promise<void> | void;
}

const NAME: Record<DeckSubject, string> = { Physics: 'Physics', Chemistry: 'Chemistry', Maths: 'Mathematics', Biology: 'Biology' };

const order = (a: Pack, b: Pack) =>
  Number(b.collection === 'essentials') - Number(a.collection === 'essentials') || a.sortOrder - b.sortOrder || a.packNo - b.packNo;

const PackStore: React.FC<Props> = ({ packs, dark, examPreference, isAdmin, owned, onBack, onOpenOwned, acquire, loadPreview, onAcquired }) => {
  const t = tokens(dark);
  const size = useRackSize();
  const reduced = useReducedMotion();
  const [state, dispatch] = useReducer(transition, IDLE);
  const [previews, setPreviews] = useState<Record<string, PreviewCard[] | 'error'>>({});
  const els = useRef(new Map<string, HTMLElement>());
  const [flight, setFlight] = useState<{ pack: Pack; from: DOMRect } | null>(null);

  const visible = useMemo(
    () => (packs ?? []).filter(p => p.status === 'published' || p.inLibrary || (isAdmin && p.status === 'draft')),
    [packs, isAdmin],
  );

  // One rack per subject, the student's exam first; packs with no subject last.
  const categories = useMemo(() => {
    const subjects: DeckSubject[] = examPreference === 'NEET' ? ['Physics', 'Chemistry', 'Biology', 'Maths'] : ['Physics', 'Chemistry', 'Maths', 'Biology'];
    const out: { key: string; title: string; items: RackItem[] }[] = [];
    subjects.forEach(s => {
      const list = visible.filter(p => p.subject === s).sort(order);
      if (list.length) out.push({ key: s, title: NAME[s], items: list.map(p => ({ pack: p, taken: p.inLibrary })) });
    });
    const rest = visible.filter(p => !p.subject).sort(order);
    if (rest.length) out.push({ key: 'more', title: 'More packs', items: rest.map(p => ({ pack: p, taken: p.inLibrary })) });
    return out;
  }, [visible, examPreference]);

  const selected = visible.find(p => p.id === state.packId) ?? null;
  const busy = isBusy(state);

  // A chosen pack's three cards, fetched once.
  useEffect(() => {
    if (!selected || previews[selected.id]) return;
    let live = true;
    loadPreview(selected.id)
      .then(list => { if (live) setPreviews(p => ({ ...p, [selected.id]: list })); })
      .catch(() => { if (live) setPreviews(p => ({ ...p, [selected.id]: 'error' })); });
    return () => { live = false; };
  }, [selected, previews, loadPreview]);

  const packRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) els.current.set(id, el); else els.current.delete(id);
  }, []);

  const onSelect = useCallback((pack: Pack) => {
    if (state.phase === 'selected' && state.packId === pack.id) dispatch({ type: 'DESELECT' });
    else dispatch({ type: 'SELECT', packId: pack.id });
  }, [state.phase, state.packId]);

  const onAcquire = async () => {
    if (state.phase !== 'selected' || !selected) return;
    const pack = selected;
    dispatch({ type: 'ACQUIRE' });
    try {
      await acquire(pack);
      // Measured now, from where it actually hangs, lifted on its hook.
      const el = els.current.get(pack.id);
      const from = el?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - size.w / 2, window.innerHeight / 2 - size.h / 2, size.w, size.h);
      setFlight({ pack, from });
      dispatch({ type: 'CONFIRMED' });
    } catch (e) {
      dispatch({ type: 'FAILED', error: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
  };

  const onDone = async () => {
    const id = flight?.pack.id;
    if (!id) return;
    try { await onAcquired(id); } finally {
      setFlight(null);
      dispatch({ type: 'FINISH' });
    }
  };

  const opening = isOpening(state) && flight;
  const hiddenId = opening ? flight.pack.id : null;
  const preview = selected ? previews[selected.id] ?? null : null;
  const live = visible.filter(p => !p.inLibrary).length;

  return (
    <div className="font-ui">
      <button onClick={onBack} disabled={busy} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 ${t.muted}`}>
        {Icon.back} Decks
      </button>

      <header className="mk-rise flex flex-wrap items-end justify-between gap-6 mt-4 mb-10 md:mb-14">
        <div>
          <h1 className={`font-display uppercase text-[46px] md:text-[72px] leading-[0.9] tracking-[-0.01em] ${t.heading}`}>Alpha Packs</h1>
          <p className={`text-[16px] md:text-[18px] mt-4 ${t.muted}`}>Curated knowledge. <span className="font-accent">Ready to load.</span></p>
        </div>
        <button onClick={onBack} disabled={busy} className={`inline-flex items-center gap-2.5 h-11 pl-5 pr-4 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97] ${
          dark ? 'text-zinc-100 bg-white/[0.06] hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.08]' : 'text-zinc-900 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`}>
          My Alpha
          {owned > 0 && <span className={`num-stat text-[12px] h-6 min-w-6 px-1.5 rounded-full inline-flex items-center justify-center ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>{owned}</span>}
          {Icon.arrow}
        </button>
      </header>

      {packs === null ? (
        <PackCategory
          title="Loading"
          note="Stocking the shelves…"
          items={[]}
          emptyHooks={6}
          size={size} dark={dark} reduced={reduced}
          selectedId={null} hiddenId={null} selected={null} preview={null} busy={false} error={null}
          onSelect={() => undefined} onDeselect={() => undefined} onAcquire={() => undefined} onOpenTaken={() => undefined} packRef={packRef}
        />
      ) : categories.length === 0 ? (
        /* Before launch: a real rack, bare hooks, and one line. */
        <PackCategory
          title="Coming soon"
          note="The first packs are on their way. The hooks are ready."
          items={[]}
          emptyHooks={6}
          size={size} dark={dark} reduced={reduced}
          selectedId={null} hiddenId={null} selected={null} preview={null} busy={false} error={null}
          onSelect={() => undefined} onDeselect={() => undefined} onAcquire={() => undefined} onOpenTaken={() => undefined} packRef={packRef}
        />
      ) : (
        <div className="space-y-14 md:space-y-16">
          {categories.map((cat, i) => {
            const mine = !!selected && cat.items.some(it => it.pack.id === selected.id);
            return (
              <PackCategory
                key={cat.key}
                title={cat.title}
                items={cat.items}
                size={size}
                dark={dark}
                reduced={reduced}
                delay={i * 60}
                selectedId={state.packId}
                hiddenId={hiddenId}
                // Kept open through the opening: closing it would shift the page under the pack in flight.
                selected={mine ? selected : null}
                preview={preview}
                busy={busy}
                error={state.error}
                onSelect={onSelect}
                onDeselect={() => dispatch({ type: 'DESELECT' })}
                onAcquire={() => void onAcquire()}
                onOpenTaken={p => onOpenOwned(p.id)}
                packRef={packRef}
              />
            );
          })}
          {live === 0 && (
            <p className={`text-center text-[14px] ${t.muted}`}>Every pack on these racks is in My Alpha. New ones land here first.</p>
          )}
        </div>
      )}

      {opening && flight && (
        <PackOpeningAnimation
          pack={flight.pack}
          from={flight.from}
          w={size.w}
          h={size.h}
          dark={dark}
          preview={Array.isArray(previews[flight.pack.id]) ? previews[flight.pack.id] as PreviewCard[] : null}
          reduced={reduced}
          onStep={() => dispatch({ type: 'STEP' })}
          onDone={() => void onDone()}
        />
      )}
    </div>
  );
};

export default PackStore;
