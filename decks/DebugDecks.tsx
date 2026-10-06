/* ── Dev-only design board: `?decks=debug` ──
   Every Decks screen on fixture data, with no database — and every state of
   each, empty ones included: a full shelf, one deck, only Alpha decks, all
   caught up, an empty deck, first run with and without Alpha decks, signed
   out, the console with and without decks, every sheet and the review room —
   in either theme. Gated on import.meta.env.DEV in index.tsx and
   tree-shaken out of production, like cbt/DebugCbt.tsx. Nothing here writes
   anywhere; actions just log. */

import React, { Suspense, useMemo, useState } from 'react';
import Library from './Library';
import DeckView, { DeckSource } from './DeckView';
import CardEditor from './CardEditor';
import ImportSheet from './ImportSheet';
import { DeckDetailsSheet, SettingsSheet } from './DeckSheets';
import { deckAccent } from './theme';
import ReviewSession from './ReviewSession';
import DecksAdmin from '../admin/DecksAdmin';
import type { AdminDeckStat, DeckSummary, ExploreDeck, Note, QueueCard } from './types';

/* A benzene ring as a PNG data URI, drawn here so the fixture needs no asset. */
const RING = (() => {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 140;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, 160, 140);
  g.strokeStyle = '#111'; g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 6; i += 1) { const a = Math.PI / 6 + (i * Math.PI) / 3; g.lineTo(80 + 50 * Math.cos(a), 70 + 50 * Math.sin(a)); }
  g.stroke();
  g.beginPath(); g.arc(80, 70, 28, 0, Math.PI * 2); g.stroke();
  return c.toDataURL('image/png');
})();

const NOTES: Omit<QueueCard, 'cardId' | 'progress'>[] = [
  { noteId: 'a', ord: 1, kind: 'cloze', front: 'Aldehydes can be reduced to {{c1::primary alcohols}} using {{c2::LiAlH₄}}.', back: 'Ketones give secondary alcohols.', tags: ['organic'] },
  { noteId: 'a', ord: 2, kind: 'cloze', front: 'Aldehydes can be reduced to {{c1::primary alcohols}} using {{c2::LiAlH₄}}.', back: 'Ketones give secondary alcohols.', tags: ['organic'] },
  { noteId: 'b', ord: 1, kind: 'cloze', front: 'The Haber process: \\(\\ce{N2 + 3H2 <=> 2NH3}\\) uses an {{c1::iron::metal}} catalyst.', back: '', tags: ['inorganic'] },
  { noteId: 'c', ord: 1, kind: 'cloze', front: 'Kinetic energy is {{c1::\\(\\frac{1}{2}mv^2\\)}}.<br><i>Units: joules.</i>', back: '', tags: ['physics'] },
  { noteId: 'd', ord: 0, kind: 'basic', front: 'What is the hybridisation of carbon in <b>ethyne</b>?', back: '<i>sp</i> — two π bonds, linear', tags: [] },
  { noteId: 'e', ord: 1, kind: 'cloze', front: 'अम्ल + क्षार → {{c1::लवण + जल}}<ul><li>Acid + base</li><li>Neutralisation</li></ul>', back: '', tags: ['hindi'] },
  { noteId: 'f', ord: 1, kind: 'cloze', front: `Benzene is drawn as a hexagon with a {{c1::circle}} inside.<img src="${RING}"> And <img src="benzene.png">`, back: '', tags: [] },
];
const fixtureCards = (): QueueCard[] => NOTES.map((n, i) => ({ ...n, cardId: `card-${i}`, progress: null }));

const deck = (o: Partial<DeckSummary> & Pick<DeckSummary, 'id' | 'title'>): DeckSummary => ({
  scope: 'personal', status: 'published', collection: null, description: null, subject: null, classId: null, chapter: null, ownerId: 'me',
  updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), newPerDay: 20, maxReviews: 200, desiredRetention: 0.9,
  total: 0, unseen: 0, newAvailable: 0, due: 0, learning: 0, young: 0, mature: 0, suspended: 0, reviewsToday: 0,
  nextDue: new Date(Date.now() + 3 * 3600000).toISOString(), ...o,
});

export const FIXTURE_DECKS: DeckSummary[] = [
  deck({ id: 'd1', title: 'Organic Chemistry', subject: 'Chemistry', classId: 12, total: 248, unseen: 27, newAvailable: 12, due: 34, learning: 8, young: 33, mature: 180 }),
  deck({ id: 'd2', title: 'Physics Formulae', subject: 'Physics', classId: 11, total: 183, unseen: 90, newAvailable: 20, due: 9, learning: 3, young: 52, mature: 38 }),
  deck({ id: 'd3', title: 'Things I Keep Forgetting', total: 41, unseen: 0, newAvailable: 0, due: 0, learning: 0, young: 12, mature: 29 }),
  deck({ id: 'd4', title: 'Integration Tricks', subject: 'Maths', classId: 12, total: 0, unseen: 0 }),
  deck({ id: 'g1', title: 'JEE 2027 Chemistry Essentials', scope: 'global', collection: 'essentials', subject: 'Chemistry', total: 512, unseen: 470, newAvailable: 20, due: 6, learning: 2, young: 30, mature: 10, ownerId: 'admin' }),
  deck({ id: 'g2', title: 'NCERT Inorganic — Every Line That Matters', scope: 'global', collection: 'more', subject: 'Chemistry', classId: 12, total: 320, unseen: 320, newAvailable: 20, ownerId: 'admin' }),
  deck({ id: 'g3', title: 'High-Yield Organic Reactions', scope: 'global', collection: 'essentials', status: 'draft', subject: 'Chemistry', total: 96, unseen: 96, ownerId: 'admin' }),
];

const CAUGHT_UP: DeckSummary[] = [
  deck({ id: 'c1', title: 'Organic Chemistry', subject: 'Chemistry', classId: 12, total: 248, unseen: 27, reviewsToday: 46, young: 33, mature: 180, learning: 8 }),
  deck({ id: 'c2', title: 'Physics Formulae', subject: 'Physics', classId: 11, total: 183, unseen: 90, reviewsToday: 12, young: 52, mature: 38, nextDue: new Date(Date.now() + 26 * 3600000).toISOString() }),
];

const EMPTY_DECKS: DeckSummary[] = [deck({ id: 'e1', title: 'Electrostatics', subject: 'Physics', classId: 12, nextDue: null })];

export const FIXTURE_EXPLORE: ExploreDeck[] = [
  { id: 'x1', title: 'JEE Physics Formulae', description: 'Every formula from Class 11 and 12, one card each.', subject: 'Physics', classId: null, chapter: null, collection: 'essentials', publishedAt: null, cards: 412, inLibrary: false },
  { id: 'x4', title: 'Organic Name Reactions', description: 'Every named reaction in the syllabus, with the reagent hidden.', subject: 'Chemistry', classId: 12, chapter: null, collection: 'essentials', publishedAt: null, cards: 268, inLibrary: false },
  { id: 'x2', title: 'JEE Common Mistakes', description: 'The traps examiners love. Learn them before the paper does.', subject: null, classId: null, chapter: null, collection: 'more', publishedAt: null, cards: 150, inLibrary: false },
  { id: 'x3', title: 'Coordinate Geometry Essentials', description: 'Conics, lines and circles — the identities you keep looking up.', subject: 'Maths', classId: 11, chapter: null, collection: 'more', publishedAt: null, cards: 204, inLibrary: false },
];

const ADMIN_STATS: AdminDeckStat[] = [
  { id: 'g3', title: 'High-Yield Organic Reactions', status: 'draft', collection: 'essentials', subject: 'Chemistry', chapter: null, updatedAt: new Date(Date.now() - 3600000).toISOString(), publishedAt: null, cards: 96, students: 1, active7d: 1, reviews7d: 40, againRate: null },
  { id: 'g1', title: 'JEE 2027 Chemistry Essentials', status: 'published', collection: 'essentials', subject: 'Chemistry', chapter: null, updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(), publishedAt: null, cards: 512, students: 1840, active7d: 1210, reviews7d: 48210, againRate: 0.11 },
  { id: 'g2', title: 'NCERT Inorganic — Every Line That Matters', status: 'published', collection: 'more', subject: 'Chemistry', chapter: 'p-Block Elements', updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(), publishedAt: null, cards: 320, students: 612, active7d: 288, reviews7d: 9450, againRate: 0.18 },
];

const FIXTURE_NOTES: Note[] = [
  ...NOTES.filter((n, i, a) => a.findIndex(x => x.noteId === n.noteId) === i).map(n => ({
    id: n.noteId, deckId: 'd1', kind: n.kind, front: n.front, back: n.back, tags: n.tags, guid: null, version: 1, updatedAt: new Date().toISOString(),
  })),
  { id: 'g', deckId: 'd1', kind: 'cloze', front: 'Ozonolysis of an alkene followed by {{c1::Zn/H₂O}} gives {{c2::aldehydes or ketones}}.', back: '', tags: ['organic', 'reactions'], guid: null, version: 1, updatedAt: '' },
  { id: 'h', deckId: 'd1', kind: 'cloze', front: 'The Cannizzaro reaction needs an aldehyde with no {{c1::α-hydrogen}}.', back: 'e.g. HCHO, PhCHO', tags: ['organic', 'named-reactions'], guid: null, version: 1, updatedAt: '' },
];

const source = (reviews: boolean): DeckSource => ({
  activity: async () => {
    const out = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      const n = !reviews || [0, 3, 6, 9].includes(i) ? 0 : Math.round(20 + 40 * Math.abs(Math.sin(i * 1.7)));
      out.push({ day: d, reviews: n, again: Math.round(n * 0.12) });
    }
    return out;
  },
  notes: async (_d, { search, tag }) => {
    const q = (search ?? '').toLowerCase();
    const list = FIXTURE_NOTES.filter(n => (!q || n.front.toLowerCase().includes(q)) && (!tag || n.tags.includes(tag)));
    return { notes: list, total: list.length };
  },
  tags: async () => ['organic', 'inorganic', 'reactions', 'named-reactions', 'physics', 'hindi'],
  suspended: async () => new Set(['e']),
});

/* Every state worth looking at, grouped. */
const SCREENS = {
  library: 'Library — full',
  onedeck: 'Library — one deck of my own',
  alphaonly: 'Library — only Alpha decks',
  caughtup: 'Library — all caught up',
  emptydecks: 'Library — a deck with no cards',
  first: 'First run — with Alpha decks',
  firstbare: 'First run — nothing published yet',
  signedout: 'Signed out',
  deck: 'Deck — studying',
  noreviews: 'Deck — no reviews yet',
  emptydeck: 'Deck — empty',
  alpha: 'Deck — Alpha draft (admin)',
  editor: 'Card editor',
  import: 'Import',
  create: 'Create a deck (admin)',
  settings: 'Study settings',
  admin: 'Console — Decks',
  adminempty: 'Console — no Alpha decks',
  review: 'Review room',
} as const;
type Screen = keyof typeof SCREENS;

const LIBRARY: Partial<Record<Screen, { summaries: DeckSummary[]; explore: ExploreDeck[]; signedIn?: boolean }>> = {
  library: { summaries: FIXTURE_DECKS, explore: FIXTURE_EXPLORE },
  onedeck: { summaries: [FIXTURE_DECKS[0], FIXTURE_DECKS[4]], explore: FIXTURE_EXPLORE },
  alphaonly: { summaries: FIXTURE_DECKS.filter(d => d.scope === 'global' && d.status !== 'draft'), explore: FIXTURE_EXPLORE.slice(2) },
  caughtup: { summaries: CAUGHT_UP, explore: [] },
  emptydecks: { summaries: EMPTY_DECKS, explore: FIXTURE_EXPLORE },
  first: { summaries: [], explore: FIXTURE_EXPLORE },
  firstbare: { summaries: [], explore: [] },
  signedout: { summaries: [], explore: [], signedIn: false },
};

const DebugDecks: React.FC = () => {
  const params = new URLSearchParams(location.search);
  const [dark, setDark] = useState(() => params.get('theme') !== 'light');
  const [screen, setScreen] = useState<Screen>(() => (params.get('screen') as Screen) in SCREENS ? (params.get('screen') as Screen) : 'library');
  const [reviewing, setReviewing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const cards = useMemo(fixtureCards, [reviewing]);
  const say = (s: string) => setLog(l => [...l.slice(-4), s]);

  const go = (s: Screen) => {
    setScreen(s);
    const p = new URLSearchParams(location.search);
    p.set('screen', s);
    history.replaceState(null, '', `?${p}`);
  };
  const lib = LIBRARY[screen];
  const deckFor = screen === 'emptydeck' ? EMPTY_DECKS[0] : screen === 'alpha' ? FIXTURE_DECKS[6] : screen === 'noreviews' ? { ...FIXTURE_DECKS[1], young: 0, mature: 0, learning: 0, unseen: 183 } : FIXTURE_DECKS[0];

  return (
    <div className="min-h-screen font-ui" style={{ background: dark ? '#0B0B0D' : '#F2F0EC' }}>
      <div className={`sticky top-0 z-40 border-b backdrop-blur ${dark ? 'bg-black/60 border-white/[0.06] text-zinc-300' : 'bg-white/70 border-zinc-200 text-zinc-700'}`}>
        <div className="max-w-5xl mx-auto px-6 h-12 flex items-center gap-3 text-[12px] font-semibold">
          <span className="opacity-50 hidden sm:inline">Decks · design board</span>
          <select value={screen} onChange={e => go(e.target.value as Screen)} aria-label="Screen"
            className={`h-8 px-3 rounded-full text-[12px] font-semibold outline-none ${dark ? 'bg-white/[0.08] text-white' : 'bg-zinc-900 text-white'}`}>
            {(Object.keys(SCREENS) as Screen[]).map(k => <option key={k} value={k}>{SCREENS[k]}</option>)}
          </select>
          <button onClick={() => setDark(d => !d)} className="ml-auto px-3 h-8 rounded-full hover:opacity-70">{dark ? 'Light' : 'Dark'}</button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 md:px-6 py-8 pb-16">
        {lib && (
          <Library
            dark={dark}
            isAdmin
            signedIn={lib.signedIn ?? true}
            summaries={lib.summaries}
            explore={lib.explore}
            error={null}
            onOpenDeck={id => say(`open ${id}`)}
            onReview={() => setReviewing(true)}
            onNewDeck={() => say('new deck')}
            onImport={() => say('import')}
            onAddExplore={async id => { say(`add ${id}`); await new Promise(r => setTimeout(r, 600)); }}
            onStudyExplore={() => setReviewing(true)}
            onOpenAuth={() => say('sign in')}
            onRetry={() => say('retry')}
          />
        )}
        {(screen === 'deck' || screen === 'alpha' || screen === 'emptydeck' || screen === 'noreviews') && (
          <DeckView
            deck={deckFor}
            dark={dark}
            canEdit
            isAdmin
            source={source(screen !== 'noreviews')}
            version={0}
            onBack={() => go('library')}
            onReview={tags => { say(`review ${tags ?? ''}`); setReviewing(true); }}
            onAddCard={() => say('add card')}
            onEditNote={n => say(`edit ${n.id}`)}
            onDeleteNote={async n => say(`delete ${n.id}`)}
            onSuspendNote={async (n, v) => say(`pause ${n.id} ${v}`)}
            onImport={() => say('import')}
            onExport={() => say('export')}
            onSettings={() => say('settings')}
            onRemove={() => say('remove')}
            onDelete={() => say('delete')}
            onSetStatus={st => say(`status ${st}`)}
            onSetCollection={c => say(`shelf ${c}`)}
          />
        )}
        {screen === 'editor' && (
          <CardEditor
            deckId="d1"
            deckTitle="Organic Chemistry"
            isGlobal={false}
            dark={dark}
            accent={deckAccent('Chemistry', dark)}
            initial={{ kind: 'cloze', front: 'Aldehydes can be reduced to {{c1::primary alcohols}} using {{c2::LiAlH₄}}.', back: 'Ketones give secondary alcohols.', tags: ['organic'] }}
            suggestions={['organic', 'reduction', 'named-reactions', 'high-yield']}
            onClose={() => go('library')}
            onSaved={n => say(`saved ${n.front}`)}
            save={async d => ({ ...d, id: String(Date.now()), deckId: 'd1', guid: null, version: 1, updatedAt: new Date().toISOString() })}
          />
        )}
        {screen === 'import' && (
          <ImportSheet uid="debug" dark={dark} isAdmin decks={FIXTURE_DECKS.slice(0, 3)} onClose={() => go('library')} onImported={id => say(`imported ${id}`)} />
        )}
        {screen === 'create' && (
          <DeckDetailsSheet dark={dark} isAdmin examPreference="JEE" onClose={() => go('library')} onSubmit={async (m, a) => say(`create ${m.title} ${a.scope} ${a.collection}`)} />
        )}
        {screen === 'settings' && (
          <SettingsSheet deck={FIXTURE_DECKS[0]} dark={dark} canEdit onClose={() => go('deck')} onSave={async st => say(JSON.stringify(st))} onReset={async () => say('reset')} onEditDetails={() => go('create')} />
        )}
        {(screen === 'admin' || screen === 'adminempty') && (
          <Suspense fallback={null}>
            <DecksAdmin key={screen} theme={dark ? 'dark' : 'light'} onOpenDeck={id => say(`open ${id}`)} loadStats={async () => (screen === 'admin' ? ADMIN_STATS : [])} />
          </Suspense>
        )}
        {screen === 'review' && (
          <button className="h-11 px-6 rounded-full bg-[#E10600] text-white font-bold text-[14px]" onClick={() => setReviewing(true)}>Start review ({cards.length} cards)</button>
        )}
        {log.length > 0 && <pre className={`mt-10 text-[11px] whitespace-pre-wrap ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{log.join('\n')}</pre>}
      </main>

      {reviewing && (
        <Suspense fallback={null}>
          <ReviewSession
            uid="debug"
            deck={{ id: 'debug', title: 'Organic Chemistry', desiredRetention: 0.9, subject: 'Chemistry', chapter: 'Aldehydes, Ketones & Carboxylic Acids', nextDue: new Date(Date.now() + 3 * 3600000).toISOString() }}
            dark={dark}
            initialCards={cards}
            onExit={n => { setReviewing(false); say(`Session ended: ${n} reviewed`); }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default DebugDecks;
