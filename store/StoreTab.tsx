/* ── The Alpha Store ──
   Review's old slot in the rail. Alpha's own study material on one page,
   each kind on one rack in one row: subject kits (boxes of everything for one
   subject), formula sheets (a set of decks on one page) and flashcard packs
   (the rack store that used to live inside Decks). The filter icon beside the
   heading narrows the page to one kind, one subject, or both
   (store/filter.ts, StoreFilterButton). The
   store is the shop; Decks is where you study what you own, so taking
   anything here ends on its page in Decks.

   A zero-logic container like mocks/MocksTab.tsx: data and the three ways of
   taking something come from useStore, and nothing here touches AppState.
   Lazy from App, so the rack physics, the openings and the store's sounds
   never reach anyone who does not open it.

   Another tab can ask for a section (Decks' store sign asks for packs); the
   filter then shows that kind, once. */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import * as sfx from '../audio';
import { PageHeader, tokens } from '../ui/kit';
import type { ExamPreference } from '../types';
import type { DecksIntent, Pack, PreviewCard } from '../decks/types';
import { Icon, pill } from '../decks/ui';
import { PackCard } from '../decks/store/PackCard';
import { IDLE, isOpening, transition } from '../decks/store/PackAcquisition';
import { useReducedMotion } from '../decks/store/env';
import { REAL_STORE, useStore, type StoreOps } from './useStore';
import type { Kit, Sheet, StoreSection } from './types';
import { KitBox } from './kits/KitBox';
import { tableStyle, useBoxSize } from './kits/KitCard';
import { KitShelf, kitColumn, shelfStyle } from './kits/KitShelf';
import { SheetRack, sheetColumn } from './sheets/SheetRack';
import { StoreRow } from './StoreRow';
import { StoreFilterButton } from './StoreFilterButton';
import { emptyFor, filterLine, matchesSubject, readFilter, showsType, writeFilter, type StoreFilter } from './filter';
import { rackName } from '../decks/store/racks';
import { KITS_LAUNCHED } from './launch';
import { KitPage } from './kits/KitPage';
import { KitOpening } from './kits/KitOpening';
import { useShelfWidth } from './sheets/SheetCard';
import { SheetDetail } from './sheets/SheetDetail';
import { SheetPaper } from './sheets/SheetPaper';
import { SheetTake } from './sheets/SheetTake';

const PackStore = React.lazy(() => import('../decks/store/PackStore'));

interface Props {
  user: User | null;
  isAdmin: boolean;
  theme: 'dark' | 'light';
  examPreference: ExamPreference;
  onOpenAuth: () => void;
  /** Show this section, once (Decks' store sign asks for packs). */
  intent?: { section: StoreSection; nonce: number } | null;
  /** Go to Decks, and open this item there. Null kind: just go. */
  onOpenInDecks: (kind: DecksIntent['kind'] | null, id?: string) => void;
  /** The design board's fixtures; the app always asks the database. */
  ops?: StoreOps;
}

type View = { kind: 'home' } | { kind: 'sheet'; id: string } | { kind: 'kit'; id: string };

const visible = <T extends { status: string; inLibrary: boolean }>(list: T[] | null, isAdmin: boolean): T[] =>
  (list ?? []).filter(x => x.status === 'published' || x.inLibrary || (isAdmin && x.status === 'draft'));

const toEntries = (cards: PreviewCard[]) => cards.map(c => ({ deckId: c.deckId, kind: c.kind, front: c.front, back: c.back }));

const StoreTab = ({ user, isAdmin, theme, examPreference, onOpenAuth, intent, onOpenInDecks, ops = REAL_STORE }: Props) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const reduced = useReducedMotion();
  const store = useStore(!!user, ops);
  const [view, setView] = useState<View>({ kind: 'home' });
  const [filter, setFilterState] = useState<StoreFilter>(() => readFilter(examPreference));
  const setFilter = useCallback((f: StoreFilter) => { setFilterState(f); writeFilter(f); }, []);

  /* A section asked for by another tab: back to the page, showing that kind. */
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!intent || handled.current === intent.nonce) return;
    handled.current = intent.nonce;
    setView({ kind: 'home' });
    setFilter({ ...readFilter(examPreference), type: intent.section === 'kits' && !KITS_LAUNCHED ? 'all' : intent.section });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);
  // The openings' sounds land on their animations, so they are fetched on the way in.
  useEffect(() => { sfx.preload('store'); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [view.kind]);

  /* ── Sheets ── */
  const [previews, setPreviews] = useState<Record<string, PreviewCard[] | 'error'>>({});
  const asked = useRef(new Set<string>());
  const { sheetPreview } = store;
  const askPreview = useCallback((id: string) => {
    if (asked.current.has(id)) return;
    asked.current.add(id);
    sheetPreview(id)
      .then(list => setPreviews(q => ({ ...q, [id]: list })))
      .catch(() => setPreviews(q => ({ ...q, [id]: 'error' })));
  }, [sheetPreview]);
  const previewOf = (id: string) => {
    const p = previews[id];
    return Array.isArray(p) ? toEntries(p) : p === 'error' ? [] : null;
  };
  const sheets = useMemo(() => visible(store.sheets, isAdmin), [store.sheets, isAdmin]);
  useEffect(() => { sheets.slice(0, 24).forEach(s => askPreview(s.id)); }, [sheets, askPreview]);
  useEffect(() => { if (view.kind === 'sheet') askPreview(view.id); }, [view, askPreview]);

  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetFlight, setSheetFlight] = useState<{ sheet: Sheet; from: DOMRect } | null>(null);
  const paperEl = useRef<HTMLDivElement>(null);

  const takeSheet = async (sheet: Sheet) => {
    if (sheetBusy) return;
    setSheetBusy(true);
    setSheetError(null);
    try {
      await store.acquireSheet(sheet);
      const from = paperEl.current?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - 100, window.innerHeight / 2 - 140, 200, 283);
      setSheetFlight({ sheet, from });
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSheetBusy(false);
    }
  };

  /* ── Kits ── the pack's state machine, one box at a time. */
  const kits = useMemo(() => visible(store.kits, isAdmin), [store.kits, isAdmin]);
  const [kitState, dispatch] = useReducer(transition, IDLE);
  const [kitFlight, setKitFlight] = useState<{ kit: Kit; from: DOMRect } | null>(null);
  const boxEl = useRef<HTMLDivElement>(null);
  const boxSize = useBoxSize();

  const openKit = (k: Kit) => { dispatch({ type: 'SELECT', packId: k.id }); setView({ kind: 'kit', id: k.id }); };
  const takeKit = async (kit: Kit) => {
    if (kitState.phase !== 'selected') return;
    dispatch({ type: 'ACQUIRE' });
    try {
      await store.acquireKit(kit);
      const from = boxEl.current?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2 - 150, window.innerHeight / 2 - 120, 300, 240);
      setKitFlight({ kit, from });
      dispatch({ type: 'CONFIRMED' });
    } catch (e) {
      dispatch({ type: 'FAILED', error: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
  };

  /** A free kit that holds things sold on their own gives them away: say so, to staff. */
  const kitWarning = (kit: Kit): string | null => {
    if (!isAdmin || kit.access !== 'free') return null;
    const paid = kit.items.filter(i =>
      (i.kind === 'pack' && (store.packs ?? []).some(p => p.id === i.id && p.access !== 'free'))
      || (i.kind === 'sheet' && (store.sheets ?? []).some(s => s.id === i.id && s.access !== 'free')));
    return paid.length
      ? `This kit is free and holds ${paid.length} paid ${paid.length === 1 ? 'item' : 'items'}. Anyone who takes the kit gets ${paid.length === 1 ? 'it' : 'them'} free.`
      : null;
  };

  /* ── Signed out ── */
  if (!user) return <SignedOut dark={dark} onOpenAuth={onOpenAuth} />;

  /* ── One item ── */
  if (view.kind === 'sheet') {
    const sheet = store.sheets?.find(s => s.id === view.id);
    if (sheet) {
      const p = previews[sheet.id];
      return (
        <>
          <SheetDetail
            sheet={sheet}
            preview={p === 'error' ? 'error' : Array.isArray(p) ? toEntries(p) : null}
            dark={dark}
            busy={sheetBusy}
            error={sheetError}
            onBack={() => { setView({ kind: 'home' }); setSheetError(null); }}
            onAcquire={() => void takeSheet(sheet)}
            onOpenOwned={() => onOpenInDecks('sheet', sheet.id)}
            paperRef={paperEl}
            flying={!!sheetFlight}
          />
          {sheetFlight && (
            <SheetTake
              sheet={sheetFlight.sheet}
              preview={previewOf(sheetFlight.sheet.id)}
              from={sheetFlight.from}
              dark={dark}
              reduced={reduced}
              onDone={async () => {
                const id = sheetFlight.sheet.id;
                await store.refresh();
                setSheetFlight(null);
                setSheetBusy(false);
                onOpenInDecks('sheet', id);
              }}
            />
          )}
        </>
      );
    }
  }
  if (view.kind === 'kit') {
    const kit = store.kits?.find(k => k.id === view.id);
    if (kit) {
      return (
        <>
          <KitPage
            kit={kit}
            dark={dark}
            reduced={reduced}
            busy={kitState.phase !== 'selected' && kitState.phase !== 'idle'}
            error={kitState.error}
            warning={kitWarning(kit)}
            onBack={() => { dispatch({ type: 'DESELECT' }); setView({ kind: 'home' }); }}
            onAcquire={() => void takeKit(kit)}
            onOpenOwned={() => onOpenInDecks('kit', kit.id)}
            boxRef={boxEl}
            flying={isOpening(kitState) && !!kitFlight}
          />
          {isOpening(kitState) && kitFlight && (
            <KitOpening
              kit={kitFlight.kit}
              from={kitFlight.from}
              dark={dark}
              reduced={reduced}
              onStep={() => dispatch({ type: 'STEP' })}
              onDone={async () => {
                const id = kitFlight.kit.id;
                await store.refresh();
                setKitFlight(null);
                dispatch({ type: 'FINISH' });
                onOpenInDecks('kit', id);
              }}
            />
          )}
        </>
      );
    }
  }

  /* ── The store ── */
  const owned = (store.packs ?? []).filter(p => p.inLibrary).length;
  const bySubject = <T extends { subject: Pack['subject'] }>(list: T[]) => list.filter(x => matchesSubject(x, filter));
  return (
    <div className="font-ui">
      <PageHeader
        dark={dark}
        title="Alpha Store"
        subtitle={filterLine(filter)}
        right={<StoreFilterButton value={filter} onChange={setFilter} exam={examPreference} dark={dark} />}
        className="mb-12 md:mb-14"
      />

      <div className="space-y-16 md:space-y-20">
      {showsType(filter, 'kits') && (
        <div id="store-kits" className="scroll-mt-24">
          <KitsSection kits={store.kits === null ? null : bySubject(kits)} dark={dark} size={boxSize} onOpen={openKit} empty={emptyFor('kits', filter)} />
        </div>
      )}

      {showsType(filter, 'sheets') && (
        <div id="store-sheets" className="scroll-mt-24">
          <SheetsSection sheets={store.sheets === null ? null : bySubject(sheets)} dark={dark} previewOf={previewOf} empty={emptyFor('sheets', filter)} onOpen={s => { setSheetError(null); setView({ kind: 'sheet', id: s.id }); }} />
        </div>
      )}

      {showsType(filter, 'packs') && (
      <div id="store-packs" className="scroll-mt-24">
        <React.Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
          <PackStore
            embedded
            oneRack
            rackTitle={filter.subject === 'all' ? 'All packs' : rackName(filter.subject)}
            emptyNote={(() => { const e = emptyFor('packs', filter); return e ? { title: e.title, note: e.line } : undefined; })()}
            packs={store.packs === null ? null : bySubject(store.packs)}
            dark={dark}
            examPreference={examPreference}
            isAdmin={isAdmin}
            owned={owned}
            onBack={() => onOpenInDecks(null)}
            onOpenOwned={id => onOpenInDecks('pack', id)}
            acquire={store.acquirePack}
            loadPreview={store.packPreview}
            onAcquired={async id => {
              await store.refresh();
              onOpenInDecks('pack', id);
            }}
          />
        </React.Suspense>
      </div>
      )}
      </div>
    </div>
  );
};

/* ── Each part of the store is one rack, in one row (StoreRow) ── */

/** A part's heading, set like the packs' ("ALPHA PACKS / Curated knowledge."). */
const Heading = ({ dark, title, line, accent }: { dark: boolean; title: string; line: string; accent: string }) => {
  const t = tokens(dark);
  return (
    <>
      <h2 className={`font-display uppercase text-[34px] md:text-[44px] leading-[0.92] tracking-[-0.01em] ${t.heading}`}>{title}</h2>
      <p className={`text-[16px] md:text-[18px] mt-3 ${t.muted}`}>{line} <span className="font-accent">{accent}</span></p>
    </>
  );
};

const KitsSection = ({ kits, dark, size, onOpen, empty }: { kits: Kit[] | null; dark: boolean; size: number; onOpen: (k: Kit) => void; empty: { title: string; line: string } | null }) => {
  const w = size - 10;
  return (
    <StoreRow
      heading={<Heading dark={dark} title="Alpha Kits" line="Everything for one subject." accent="In one box." />}
      label="kits rack"
      dark={dark}
      wall={shelfStyle(dark)}
      step={kitColumn(w)}
    >
      {kits === null
        ? <div className="w-full h-[340px]" aria-busy="true" />
        : <KitShelf kits={kits} dark={dark} w={w} onOpen={onOpen} empty={empty ?? undefined} />}
    </StoreRow>
  );
};

const SheetsSection = ({ sheets, dark, previewOf, onOpen, empty }: {
  sheets: Sheet[] | null; dark: boolean; previewOf: (id: string) => ReturnType<typeof toEntries> | null; onOpen: (s: Sheet) => void;
  empty: { title: string; line: string } | null;
}) => {
  const w = useShelfWidth();
  return (
    <StoreRow
      heading={<Heading dark={dark} title="Formula Sheets" line="Every formula on one page." accent="Read it the night before." />}
      label="sheets rack"
      dark={dark}
      wall={shelfStyle(dark)}
      step={sheetColumn(w)}
      delay={60}
    >
      {sheets === null
        ? <div className="w-full h-[360px]" aria-busy="true" />
        : <SheetRack sheets={sheets} dark={dark} w={w} previewOf={previewOf} onOpen={onOpen} empty={empty ?? undefined} />}
    </StoreRow>
  );
};

/* ── Signed out: the store, shown, with the one way in ── */

const SAMPLE_PACK: Pick<Pack, 'title' | 'packNo' | 'subject' | 'decks' | 'examLine' | 'access' | 'priceInr' | 'finish' | 'status'> = {
  title: 'Physics Essentials', packNo: 1, subject: 'Physics',
  decks: [{ id: 'a', title: '', subject: 'Physics', status: 'published', cards: 180 }, { id: 'b', title: '', subject: 'Physics', status: 'published', cards: 0 }, { id: 'c', title: '', subject: 'Physics', status: 'published', cards: 0 }],
  examLine: 'JEE • PCM', access: 'free', priceInr: null, finish: 'ink', status: 'published',
};

const SignedOut = ({ dark, onOpenAuth }: { dark: boolean; onOpenAuth: () => void }) => {
  const t = tokens(dark);
  return (
    <div className="space-y-8 font-ui">
      <PageHeader dark={dark} title="Alpha Store" subtitle={KITS_LAUNCHED ? 'Kits, packs and formula sheets, made by Alpha.' : 'Formula sheets and flashcard packs, made by Alpha.'} />
      <section className={`mk-rise rounded-2xl border overflow-hidden ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={tableStyle(dark)}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_auto] items-center gap-8 p-7 md:p-12">
          <div>
            <p className={`font-display text-[30px] md:text-[40px] leading-[1.02] ${t.heading}`}>Sign in to open the store.</p>
            <p className={`text-[15px] mt-3 max-w-[420px] ${t.muted}`}>What you take here is saved to your account and waits for you in Decks, on every device.</p>
            <button onClick={onOpenAuth} className={`mt-7 ${pill.redLg}`}>Sign in {Icon.arrow}</button>
          </div>
          <div aria-hidden className="relative flex items-end justify-center gap-2 h-[230px] w-[330px] max-w-full mx-auto">
            <div className="absolute left-0 bottom-3" style={{ transform: 'rotate(-6deg)' }}>
              <SheetPaper sheet={{ title: 'Kinematics', sheetNo: 1, subject: 'Physics', examLine: 'JEE Main' }} entries={null} width={112} lines={5} />
            </div>
            <div className="absolute right-0 bottom-6" style={{ transform: 'rotate(5deg)' }}>
              <PackCard pack={SAMPLE_PACK} w={96} h={146} style={{ ['--pk-shadow-o' as string]: dark ? 0.6 : 0.2 }} />
            </div>
            {KITS_LAUNCHED && (
              <div className="relative z-10 -mb-4">
                <KitBox kit={{ title: 'Physics Kit', kitNo: 1, subject: 'Physics', examLine: 'JEE', finish: dark ? 'white' : 'black' }} size={170} />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StoreTab;
