/* ── Dev-only design board: `?store=debug` ──
   Every Alpha Store screen on fixtures, with no database, in either theme:
   the three sections stocked and empty, signed out, a kit's page (with the
   free-kit-holds-paid-items warning an administrator sees), the unboxing, a
   sheet's page and its "into the folder", the sheet reader with Cover answers
   on and off, a kit in My Alpha, the Decks library holding kits and sheets,
   the console stocked and empty, both editors and the formula import.

   The store screens run for real on fixtures: open a free kit and watch it
   unbox, take a free sheet and watch it go into the folder; "Pro + bought"
   unlocks the rest. Gated on import.meta.env.DEV in index.tsx and tree-shaken
   out of production, like decks/DebugDecks.tsx. Nothing is written anywhere;
   actions just log. Animations are best checked by seeking them, not by
   timing screenshots: a hidden browser pane throttles frames. */

import React, { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { FIXTURE_DECKS, FIXTURE_PACKS, PREVIEW } from '../decks/DebugDecks';
import Library from '../decks/Library';
import SheetView from '../decks/SheetView';
import KitView from '../decks/KitView';
import StoreAdmin, { type StoreAdminOps } from '../admin/StoreAdmin';
import { checkout } from './checkout';
import StoreTab from './StoreTab';
import type { StoreOps } from './useStore';
import { KitPage } from './kits/KitPage';
import { SheetDetail } from './sheets/SheetDetail';
import KitEditor from './admin/KitEditor';
import SheetEditor from './admin/SheetEditor';
import FormulaImport from './admin/FormulaImport';
import type { AdminDeckStat, DeckSubject, PackAccess, PreviewCard } from '../decks/types';
import type { Kit, KitItem, Sheet, SheetEntry, StoreSection } from './types';

/* ── Fixtures ── */

const f = (deckId: string, deckTitle: string, front: string, back: string, kind: 'basic' | 'cloze' = 'basic'): SheetEntry =>
  ({ deckId, deckTitle, noteId: `${deckId}:${front.slice(0, 24)}`, kind, front, back, tags: [] });

const KINEMATICS: SheetEntry[] = [
  f('s-kin', 'Kinematics', 'First equation of motion', '\\(v = u + at\\)'),
  f('s-kin', 'Kinematics', 'Second equation of motion', '\\(s = ut + \\tfrac12 at^2\\)'),
  f('s-kin', 'Kinematics', 'Third equation of motion', '\\(v^2 = u^2 + 2as\\)'),
  f('s-kin', 'Kinematics', 'Distance in the n-th second', '\\(s_n = u + \\tfrac{a}{2}(2n - 1)\\)'),
  f('s-kin', 'Kinematics', 'Range of a projectile', '\\(R = \\dfrac{u^2 \\sin 2\\theta}{g}\\)'),
  f('s-kin', 'Kinematics', 'Maximum height', '\\(H = \\dfrac{u^2 \\sin^2\\theta}{2g}\\)'),
  f('s-kin', 'Kinematics', 'Time of flight', '\\(T = \\dfrac{2u\\sin\\theta}{g}\\)'),
  f('s-kin', 'Kinematics', 'Relative velocity of A with respect to B', '\\(\\vec v_{AB} = \\vec v_A - \\vec v_B\\)'),
];
const LAWS: SheetEntry[] = [
  f('s-law', 'Laws of Motion', 'Newton’s second law', '\\(\\vec F = m\\vec a = \\dfrac{d\\vec p}{dt}\\)'),
  f('s-law', 'Laws of Motion', 'Impulse', '\\(J = F\\,\\Delta t = \\Delta p\\)'),
  f('s-law', 'Laws of Motion', 'Limiting friction', '\\(f_s = \\mu_s N\\)'),
  f('s-law', 'Laws of Motion', 'Centripetal force is {{c1::\\(\\dfrac{mv^2}{r}\\)}}, towards the {{c2::centre}}.', 'It is not a new force: it is whatever net force points to the centre.', 'cloze'),
  f('s-law', 'Laws of Motion', 'Banking angle (no friction)', '\\(\\tan\\theta = \\dfrac{v^2}{rg}\\)'),
];
const ENERGY: SheetEntry[] = [
  f('s-en', 'Work, Energy & Power', 'Kinetic energy', '\\(K = \\tfrac12 mv^2 = \\dfrac{p^2}{2m}\\)'),
  f('s-en', 'Work, Energy & Power', 'Work–energy theorem', '\\(W_{\\text{net}} = \\Delta K\\)'),
  f('s-en', 'Work, Energy & Power', 'Power', '\\(P = \\vec F \\cdot \\vec v\\)'),
  f('s-en', 'Work, Energy & Power', 'Spring potential energy', '\\(U = \\tfrac12 kx^2\\)'),
  f('s-en', 'Work, Energy & Power', 'In an elastic collision, {{c1::kinetic energy}} and {{c2::momentum}} are both conserved.', '', 'cloze'),
];
const CHEM: SheetEntry[] = [
  f('s-gas', 'Gases & Thermodynamics', 'Ideal gas equation', '\\(PV = nRT\\)'),
  f('s-gas', 'Gases & Thermodynamics', 'Gibbs free energy', '\\(\\Delta G = \\Delta H - T\\Delta S\\)'),
  f('s-gas', 'Gases & Thermodynamics', 'Haber process', '\\(\\ce{N2 + 3H2 <=> 2NH3}\\)'),
  f('s-gas', 'Gases & Thermodynamics', 'First law', '\\(\\Delta U = q + w\\)'),
];
const ENTRIES: Record<string, SheetEntry[]> = { sh1: [...KINEMATICS, ...LAWS, ...ENERGY], sh2: CHEM, sh3: KINEMATICS.slice(0, 5), sh4: [] };

const sheet = (id: string, title: string, subject: DeckSubject | null, access: PackAccess, o: Partial<Sheet> = {}): Sheet => {
  const entries = ENTRIES[id] ?? [];
  const decks = Array.from(new Map(entries.map(e => [e.deckId, e.deckTitle])).entries())
    .map(([d, t]) => ({ id: d, title: t, subject, status: 'published' as const, entries: entries.filter(e => e.deckId === d).length }));
  return {
    id, title, description: null, subject, examLine: null, access, priceInr: access === 'paid' ? 49 : null, status: 'published', sortOrder: 0,
    sheetNo: Number(id.slice(2)), at: null, inLibrary: false, unlocked: access === 'free', students: 0, decks, entries: entries.length, ...o,
  };
};

const FIXTURE_SHEETS: Sheet[] = [
  sheet('sh1', 'Mechanics formulas', 'Physics', 'free', { description: 'Every formula in Class 11 mechanics, on one page.', examLine: 'JEE Main' }),
  sheet('sh2', 'Physical Chemistry', 'Chemistry', 'paid', { description: 'The equations of physical chemistry, and nothing else.' }),
  sheet('sh3', 'Projectiles', 'Physics', 'pro'),
  sheet('sh4', 'Integration results', 'Maths', 'free', { status: 'draft' }),
];

const packItem = (i: number): KitItem => {
  const p = FIXTURE_PACKS[i];
  return { kind: 'pack', id: p.id, title: p.title, subject: p.subject, status: 'published', count: p.decks.reduce((n, d) => n + d.cards, 0), decks: p.decks.length, finish: p.finish, packNo: p.packNo };
};
const sheetItem = (s: Sheet): KitItem => ({ kind: 'sheet', id: s.id, title: s.title, subject: s.subject, status: s.status, count: s.entries });
const deckItem = (id: string, title: string, subject: DeckSubject, count: number): KitItem => ({ kind: 'deck', id, title, subject, status: 'published', count });

const kit = (id: string, title: string, o: Partial<Kit>): Kit => ({
  id, title, tagline: null, description: null, subject: null, examLine: null, finish: 'white', access: 'free', priceInr: null, status: 'published',
  sortOrder: 0, kitNo: Number(id.slice(2)), at: null, inLibrary: false, unlocked: true, students: 0, items: [], ...o,
});

const FIXTURE_KITS: Kit[] = [
  kit('kt1', 'Physics Kit', {
    subject: 'Physics', finish: 'black', examLine: 'JEE • PCM', tagline: 'Everything for mechanics.',
    description: 'Physics Essentials, the mechanics formula sheet and two loose decks. Take the box and all of it is yours.',
    items: [packItem(0), packItem(1), sheetItem(FIXTURE_SHEETS[0]), deckItem('x1', 'JEE Physics Formulae', 'Physics', 412)],
  }),
  kit('kt2', 'Chemistry Kit', {
    subject: 'Chemistry', finish: 'white', access: 'paid', priceInr: 299, unlocked: false, examLine: 'JEE • NEET', tagline: 'Physical, organic, inorganic.',
    items: [packItem(4), packItem(5), packItem(6), sheetItem(FIXTURE_SHEETS[1])],
  }),
  kit('kt3', 'Maths Kit', { subject: 'Maths', finish: 'white', access: 'pro', unlocked: false, tagline: 'Calculus to coordinates.', items: [packItem(8), packItem(9), packItem(10)] }),
];

const toPreview = (id: string): PreviewCard[] => (ENTRIES[id] ?? []).slice(0, 8).map(e => ({ deckId: '', kind: e.kind, front: e.front, back: e.back }));

const ADMIN_DECKS: AdminDeckStat[] = [
  ...FIXTURE_DECKS.filter(d => d.scope === 'global').map(d => ({
    id: d.id, title: d.title, status: d.status, collection: (d.collection ?? 'more'), subject: d.subject, chapter: d.chapter, updatedAt: d.updatedAt,
    publishedAt: null, cards: d.total, students: 40, active7d: 12, reviews7d: 300, againRate: 0.12, packId: null, packTitle: null,
  })),
  ...['s-kin', 's-law', 's-en', 's-gas'].map(id => ({
    id, title: { 's-kin': 'Kinematics', 's-law': 'Laws of Motion', 's-en': 'Work, Energy & Power', 's-gas': 'Gases & Thermodynamics' }[id]!, status: 'published' as const,
    collection: 'sheet' as const, subject: (id === 's-gas' ? 'Chemistry' : 'Physics') as DeckSubject, chapter: null, updatedAt: new Date().toISOString(),
    publishedAt: null, cards: Object.values(ENTRIES).flat().filter(e => e.deckId === id).length / 1, students: 0, active7d: 0, reviews7d: 0, againRate: null, packId: null, packTitle: null,
  })),
];

/* ── The board ── */

const SCREENS = {
  kits: 'Store — the whole page',
  sheets: 'Store — landing on sheets',
  packs: 'Store — landing on packs (from Decks)',
  empty: 'Store — nothing published yet',
  signedout: 'Store — signed out',
  kitpage: 'Kit page (admin warning)',
  sheetpage: 'Sheet page (locked)',
  reader: 'Sheet reader',
  readercover: 'Sheet reader — cover answers',
  readerempty: 'Sheet reader — empty sheet',
  kitview: 'Kit in My Alpha',
  library: 'Decks — kits and sheets on the shelf',
  console: 'Console — Store',
  consoleempty: 'Console — Store, nothing yet',
  kiteditor: 'Kit editor',
  sheeteditor: 'Sheet editor',
  import: 'Import formulas',
} as const;
type Screen = keyof typeof SCREENS;

const ME = { id: 'me', email: 'me@x.in' } as User;
const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

const DebugStore = () => {
  const params = new URLSearchParams(location.search);
  const [dark, setDark] = useState(() => params.get('theme') !== 'light');
  const [screen, setScreen] = useState<Screen>(() => (params.get('screen') as Screen) in SCREENS ? (params.get('screen') as Screen) : 'kits');
  const [pro, setPro] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const say = (s: string) => setLog(l => [...l.slice(-4), s]);
  // What the student has, so taking something really changes the board.
  const [owned, setOwned] = useState<Set<string>>(() => new Set());
  const [version, setVersion] = useState(0);

  const go = (s: Screen) => {
    setScreen(s);
    const p = new URLSearchParams(location.search);
    p.set('screen', s);
    history.replaceState(null, '', `?${p}`);
  };

  const ops: StoreOps = useMemo(() => {
    const empty = screen === 'empty';
    const unlock = <T extends { access: PackAccess; unlocked: boolean; id: string }>(x: T): T => ({ ...x, unlocked: x.unlocked || pro || owned.has(x.id) });
    return {
      packs: async () => FIXTURE_PACKS.map(p => unlock({ ...p, inLibrary: owned.has(p.id) })),
      sheets: async () => (empty ? [] : FIXTURE_SHEETS.map(s => unlock({ ...s, inLibrary: owned.has(s.id) }))),
      kits: async () => (empty ? [] : FIXTURE_KITS.map(k => unlock({ ...k, inLibrary: owned.has(k.id) }))),
      addPack: async id => { await wait(300); setOwned(o => new Set(o).add(id)); say(`add_pack ${id}`); },
      addSheet: async id => { await wait(300); setOwned(o => new Set(o).add(id)); say(`add_sheet ${id}`); },
      addKit: async id => { await wait(400); setOwned(o => new Set(o).add(id)); say(`add_kit ${id}`); },
      packPreview: async id => PREVIEW[FIXTURE_PACKS.find(p => p.id === id)?.subject ?? 'Physics'] ?? [],
      sheetPreview: async id => { await wait(250); return toPreview(id); },
      checkout,
    };
    // `version` re-reads after a take; `owned` is read through the closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, pro, version]);

  const adminOps = (empty: boolean): StoreAdminOps => ({
    kits: async () => (empty ? [] : FIXTURE_KITS.map((k, i) => ({ ...k, status: i === 2 ? 'draft' as const : k.status, students: 80 * (i + 1) }))),
    sheets: async () => (empty ? [] : FIXTURE_SHEETS.map((s, i) => ({ ...s, students: 50 * (i + 1) }))),
    decks: async () => ADMIN_DECKS,
    packs: async () => FIXTURE_PACKS,
    createKit: async m => { say(`create kit ${m.title}`); return 'new'; },
    updateKit: async (id, m) => say(`update kit ${id} ${m.title}`),
    setKitItems: async (id, items) => say(`kit ${id}: ${items.map(i => i.kind).join(',')}`),
    setKitStatus: async (id, s) => say(`kit ${id} ${s}`),
    deleteKit: async id => say(`delete kit ${id}`),
    createSheet: async m => { say(`create sheet ${m.title}`); return 'new'; },
    updateSheet: async (id, m) => say(`update sheet ${id} ${m.title}`),
    setSheetDecks: async (id, d) => say(`sheet ${id}: ${d.join(',')}`),
    setSheetStatus: async (id, s) => say(`sheet ${id} ${s}`),
    deleteSheet: async id => say(`delete sheet ${id}`),
  });

  const section: StoreSection = screen === 'sheets' ? 'sheets' : screen === 'packs' ? 'packs' : 'kits';
  const intent = useMemo(() => (screen === "kits" ? null : { section, nonce: 1 }), [section, screen]);
  const load = async (id: string) => { await wait(350); return ENTRIES[id] ?? []; };
  const theme = dark ? 'dark' : 'light';

  return (
    <div className="min-h-screen font-ui" style={{ background: dark ? '#0B0B0D' : '#F2F0EC' }}>
      <div className={`sticky top-0 z-40 border-b backdrop-blur ${dark ? 'bg-black/60 border-white/[0.06] text-zinc-300' : 'bg-white/70 border-zinc-200 text-zinc-700'}`}>
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center gap-3 text-[12px] font-semibold">
          <span className="opacity-50 hidden sm:inline">Store · design board</span>
          <select value={screen} onChange={e => go(e.target.value as Screen)} aria-label="Screen"
            className={`h-8 px-3 rounded-full text-[12px] font-semibold outline-none ${dark ? 'bg-white/[0.08] text-white' : 'bg-zinc-900 text-white'}`}>
            {(Object.keys(SCREENS) as Screen[]).map(k => <option key={k} value={k}>{SCREENS[k]}</option>)}
          </select>
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={pro} onChange={e => setPro(e.target.checked)} />Pro + bought</label>
          <button onClick={() => { setOwned(new Set()); setVersion(v => v + 1); }} className="px-3 h-8 rounded-full hover:opacity-70">Restock</button>
          <button onClick={() => setDark(d => !d)} className="ml-auto px-3 h-8 rounded-full hover:opacity-70">{dark ? 'Light' : 'Dark'}</button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 md:px-6 py-8 pb-16">
        {(screen === 'kits' || screen === 'sheets' || screen === 'packs' || screen === 'empty' || screen === 'signedout') && (
          <StoreTab
            key={`${screen}:${version}`}
            user={screen === 'signedout' ? null : ME}
            isAdmin
            theme={theme}
            examPreference="JEE"
            onOpenAuth={() => say('sign in')}
            intent={intent}
            onOpenInDecks={(kind, id) => { say(`open in Decks: ${kind ?? 'tab'} ${id ?? ''}`); setVersion(v => v + 1); }}
            ops={ops}
          />
        )}
        {screen === 'kitpage' && (
          <KitPage kit={FIXTURE_KITS[0]} dark={dark} reduced={false} busy={false} error={null}
            warning="This kit is free and holds 1 paid item. Anyone who takes the kit gets it free."
            onBack={() => say('back')} onAcquire={() => say('acquire')} onOpenOwned={() => say('open owned')} />
        )}
        {screen === 'sheetpage' && (
          <SheetDetail sheet={FIXTURE_SHEETS[1]} preview={toPreview('sh2').map(c => ({ ...c }))} dark={dark} busy={false}
            error="Buying sheets opens soon. Free sheets work today." onBack={() => say('back')} onAcquire={() => say('acquire')} onOpenOwned={() => say('open')} />
        )}
        {(screen === 'reader' || screen === 'readercover' || screen === 'readerempty') && (
          <ReaderFrame key={screen} cover={screen === 'readercover'}>
            <SheetView sheet={screen === 'readerempty' ? FIXTURE_SHEETS[3] : { ...FIXTURE_SHEETS[0], inLibrary: true }} dark={dark} load={load} onBack={() => say('back')} onRemove={() => say('remove')} />
          </ReaderFrame>
        )}
        {screen === 'kitview' && (
          <KitView kit={{ ...FIXTURE_KITS[0], inLibrary: true }} dark={dark} reduced={false}
            onShelf={i => i.kind !== 'deck'} onBack={() => say('back')} onOpenItem={i => say(`open ${i.kind} ${i.id}`)}
            onAddItem={async i => { await wait(400); say(`add ${i.kind} ${i.id}`); }} onRemove={() => say('remove kit')} />
        )}
        {screen === 'library' && (
          <Library
            dark={dark}
            isAdmin={false}
            signedIn
            summaries={FIXTURE_DECKS.filter(d => d.scope === 'personal')}
            explore={[]}
            error={null}
            onOpenDeck={id => say(`deck ${id}`)}
            onReview={id => say(`review ${id}`)}
            onNewDeck={() => say('new deck')}
            onImport={() => say('import')}
            onAddExplore={async () => undefined}
            onStudyExplore={() => undefined}
            onOpenAuth={() => undefined}
            onRetry={() => undefined}
            packs={FIXTURE_PACKS.map(p => ({ ...p, inLibrary: p.id === 'pk1' || p.id === 'pk2' || p.id === 'pk6' }))}
            sheets={FIXTURE_SHEETS.map(s => ({ ...s, inLibrary: s.id === 'sh1' || s.id === 'sh2' }))}
            kits={[{ ...FIXTURE_KITS[0], inLibrary: true }]}
            onOpenStore={() => say('store')}
            onOpenSheet={id => say(`sheet ${id}`)}
            onOpenKit={id => say(`kit ${id}`)}
          />
        )}
        {(screen === 'console' || screen === 'consoleempty') && (
          <StoreAdmin key={screen} adminId="me" theme={theme} onOpenDeck={id => say(`open deck ${id}`)} ops={adminOps(screen === 'consoleempty')} />
        )}
        {screen === 'kiteditor' && (
          <KitEditor dark={dark} kit={FIXTURE_KITS[0]} packs={FIXTURE_PACKS} sheets={FIXTURE_SHEETS} decks={ADMIN_DECKS}
            onClose={() => say('close')} onSave={async (m, items) => say(`save kit ${m.title}: ${items.length} items`)} />
        )}
        {screen === 'sheeteditor' && (
          <SheetEditor dark={dark} sheet={null} decks={ADMIN_DECKS} packs={FIXTURE_PACKS}
            onClose={() => say('close')} onSave={async (m, d) => say(`save sheet ${m.title}: ${d.length} sections`)} />
        )}
        {screen === 'import' && (
          <FormulaImport uid="me" dark={dark} sheets={FIXTURE_SHEETS} decks={ADMIN_DECKS}
            onClose={() => say('close')} onDone={d => say(`imported ${d.inserted} into ${d.target} ${d.title}`)} />
        )}
      </main>

      {log.length > 0 && (
        <div className={`fixed bottom-4 left-4 z-[200] max-w-[360px] rounded-xl px-3 py-2 text-[11px] font-mono ${dark ? 'bg-white/[0.08] text-zinc-300' : 'bg-zinc-900 text-zinc-100'}`}>
          {log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      )}
    </div>
  );
};

/** Sets the reader's Cover answers preference for this frame before it mounts. */
const ReaderFrame = ({ cover, children }: { cover: boolean; children: React.ReactNode }) => {
  useState(() => { try { localStorage.setItem('alpha_sheet_cover_v1', cover ? '1' : '0'); } catch { /* fine */ } return null; });
  return <>{children}</>;
};

export default DebugStore;
