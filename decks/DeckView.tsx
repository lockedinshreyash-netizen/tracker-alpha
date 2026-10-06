/* ── One deck ──
   Opening a deck answers three questions in this order, and nothing else
   competes with them:

   1. What do I do today?  The count, and Start review — the page's one red
      button. When nothing is due it says when the next card is.
   2. How am I doing?      How much of the deck is in long-term memory (an
      interval of three weeks or more), as a ring, with the four groups named.
   3. Have I been showing up?  Reviews per study day, the last fourteen.

   Then the cards themselves: searchable, filterable by tag, every cloze
   answer marked in place so a note reads as a whole sentence.

   For an Alpha deck an administrator also gets the publishing strip — its
   status and the shelf students find it on; a student gets the deck and
   nothing that would be refused.

   An empty deck is not four empty panels. Until there is a card, the page is
   one invitation: write the first card or import some, beside an example
   card in the deck's own subject and colour, and three short tips for
   writing good ones. Data comes in through `source`, so the design board can
   run every one of these states on fixtures. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Segmented, tokens } from '../ui/kit';
import { CardFace } from './CardFace';
import { ordinals } from './cloze';
import { getISTDateString } from '../utils';
import { STATE_COLOR, deckAccent, fmtUntil } from './theme';
import {
  ActivityBars, AlphaBadge, Icon, MasteryLegend, MasteryRing, MoreMenu, StackArt, StatusPill, SubjectEyebrow,
  fillDays, fmtAgo, masteryOf, pill,
} from './ui';
import { COLLECTION_COPY } from './AudiencePicker';
import type { ActivityDay, DeckCollection, DeckStatus, DeckSubject, DeckSummary, Note } from './types';

export interface DeckSource {
  activity: (deckId: string) => Promise<ActivityDay[]>;
  notes: (deckId: string, opts: { search?: string; tag?: string | null; page?: number }) => Promise<{ notes: Note[]; total: number }>;
  tags: (deckId: string) => Promise<string[]>;
  suspended: (deckId: string, noteIds: string[]) => Promise<Set<string>>;
}

interface Props {
  deck: DeckSummary;
  dark: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  source: DeckSource;
  /** Bumped by the parent after anything that changes the notes. */
  version: number;
  onBack: () => void;
  onReview: (tags?: string[] | null) => void;
  onAddCard: () => void;
  onEditNote: (note: Note) => void;
  onDeleteNote: (note: Note) => Promise<void>;
  onSuspendNote: (note: Note, suspended: boolean) => Promise<void>;
  onImport: () => void;
  onExport: () => void;
  onSettings: () => void;
  onRemove: () => void;
  onDelete: () => void;
  onSetStatus: (status: DeckStatus) => void;
  /** Administrators: move an Alpha deck between Essentials and More. */
  onSetCollection: (collection: DeckCollection) => void;
}

const DeckView: React.FC<Props> = ({
  deck, dark, canEdit, isAdmin, source, version, onBack, onReview, onAddCard, onEditNote, onDeleteNote, onSuspendNote,
  onImport, onExport, onSettings, onRemove, onDelete, onSetStatus, onSetCollection,
}) => {
  const t = tokens(dark);
  const accent = deckAccent(deck.subject, dark);
  const [activity, setActivity] = useState<ActivityDay[] | null>(null);

  useEffect(() => {
    let live = true;
    source.activity(deck.id).then(a => { if (live) setActivity(a); }).catch(() => { if (live) setActivity([]); });
    return () => { live = false; };
  }, [deck.id, source, version]);

  const today = getISTDateString();
  const days = useMemo(() => fillDays(activity ?? [], today, 14), [activity, today]);
  const reviews14 = days.reduce((n, d) => n + d.reviews, 0);
  const active14 = days.filter(d => d.reviews > 0).length;
  const isGlobal = deck.scope === 'global';

  return (
    <div className="space-y-6 font-ui">
      {/* Back */}
      <button onClick={onBack} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 ${t.muted}`}>
        {Icon.back} Decks
      </button>

      {/* Header */}
      <header className="mk-rise flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 max-w-[640px]">
          <div className="flex items-center gap-3 flex-wrap">
            <SubjectEyebrow subject={deck.subject} classId={deck.classId} chapter={deck.chapter} dark={dark} fallback={isGlobal ? 'Alpha deck' : 'Your deck'} />
            {isGlobal ? <AlphaBadge dark={dark} status={deck.status} /> : (
              <span className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>· Private</span>
            )}
          </div>
          <h1 className={`font-display text-[34px] md:text-[44px] leading-[1.02] mt-3 ${t.heading}`}>{deck.title}</h1>
          <p className={`text-[13px] mt-2.5 ${t.muted}`}>
            {deck.total.toLocaleString()} {deck.total === 1 ? 'card' : 'cards'}
            {deck.suspended > 0 && ` · ${deck.suspended} paused`}
            {` · updated ${fmtAgo(deck.updatedAt)}`}
          </p>
          {deck.description && <p className={`text-[14px] leading-relaxed mt-3 ${t.body}`}>{deck.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && <button onClick={onAddCard} className={pill.ghost(dark)}>{Icon.plus}Add card</button>}
          <MoreMenu
            dark={dark}
            label="Deck actions"
            items={[
              { label: 'Import cards', icon: Icon.upload, onSelect: onImport, hidden: !canEdit },
              { label: 'Export to CSV', icon: Icon.download, onSelect: onExport },
              { label: 'Study settings', icon: Icon.gear, onSelect: onSettings },
              { label: 'Remove from library', icon: Icon.trash, onSelect: onRemove, hidden: !isGlobal, danger: true },
              { label: 'Delete deck', icon: Icon.trash, onSelect: onDelete, hidden: !canEdit || (isGlobal && !isAdmin), danger: true },
            ]}
          />
        </div>
      </header>

      {isGlobal && isAdmin && (
        <PublishStrip status={deck.status} collection={deck.collection ?? 'more'} dark={dark} onSetStatus={onSetStatus} onSetCollection={onSetCollection} />
      )}

      {deck.total === 0 ? (
        <EmptyDeck deck={deck} dark={dark} accent={accent} canEdit={canEdit} onAddCard={onAddCard} onImport={onImport} />
      ) : (
      <>
      {/* Today · Memory */}
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-4">
        <TodayCard deck={deck} dark={dark} accent={accent} onReview={() => onReview(null)} onAddCard={canEdit ? onAddCard : undefined} />
        <section className={`mk-rise rounded-2xl border p-6 md:p-7 ${t.card}`} style={{ animationDelay: '60ms' }}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Memory</p>
          {deck.total ? (
            <div className="flex items-center gap-6 mt-4">
              <MasteryRing m={masteryOf(deck)} dark={dark} size={150} />
              <div className="flex-1 min-w-0"><MasteryLegend m={masteryOf(deck)} dark={dark} suspended={deck.suspended} /></div>
            </div>
          ) : (
            <p className={`text-[14px] mt-4 ${t.muted}`}>Add cards and your progress shows up here.</p>
          )}
        </section>
      </div>

      {/* Activity */}
      <section className={`mk-rise rounded-2xl border p-6 md:p-7 ${t.card}`} style={{ animationDelay: '90ms' }}>
        <div className="flex items-baseline justify-between gap-4 mb-6">
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Reviews · last 14 days</p>
          {activity && (
            <p className={`text-[13px] ${t.muted}`}>
              <b className={`num-stat ${t.heading}`}>{reviews14.toLocaleString()}</b> reviews · <b className={`num-stat ${t.heading}`}>{active14}</b> of 14 days
            </p>
          )}
        </div>
        {activity ? (
          <div className="relative">
            <ActivityBars days={days} dark={dark} accent={accent} />
            {/* No reviews yet: the empty axis stays, so the chart's shape is learnt before it fills. */}
            {reviews14 === 0 && (
              <div className="absolute inset-x-0 top-0 h-[120px] flex items-center justify-center pointer-events-none">
                <p className={`text-[13px] font-semibold px-4 py-2 rounded-full ${dark ? 'bg-[#111114] text-zinc-400' : 'bg-white text-zinc-500'}`}>
                  Your reviews will show up here, day by day.
                </p>
              </div>
            )}
          </div>
        ) : <div className="h-[140px]" />}
      </section>

      {/* Cards */}
      <CardList deck={deck} dark={dark} canEdit={canEdit} source={source} version={version} accent={accent}
        onEditNote={onEditNote} onDeleteNote={onDeleteNote} onSuspendNote={onSuspendNote} onReviewTag={tag => onReview([tag])} onAddCard={onAddCard} />
      </>
      )}
    </div>
  );
};

/* ── Today ── */

const TodayCard: React.FC<{ deck: DeckSummary; dark: boolean; accent: string; onReview: () => void; onAddCard?: () => void }> = ({ deck, dark, accent, onReview, onAddCard }) => {
  const t = tokens(dark);
  const c = STATE_COLOR(dark);
  const total = deck.due + deck.newAvailable;
  const minutes = Math.max(1, Math.round((deck.due * 8 + deck.newAvailable * 20) / 60));
  return (
    <section className={`mk-rise relative overflow-hidden rounded-2xl border p-6 md:p-8 flex flex-col ${t.card}`} style={{ animationDelay: '30ms' }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(90% 90% at 0% 0%, ${accent}${dark ? '1a' : '12'}, transparent 60%)` }} />
      <p className={`relative text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Today</p>
      {total > 0 ? (
        <>
          <div className="relative flex items-baseline gap-3 mt-3">
            <span className={`num-hero text-[84px] md:text-[104px] ${t.heading}`}>{total}</span>
            <span className={`text-[16px] font-semibold ${t.muted}`}>{total === 1 ? 'card' : 'cards'}</span>
          </div>
          <div className="relative flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.new }} /><b className={`num-stat ${t.heading}`}>{deck.newAvailable}</b> new</span>
            <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.due }} /><b className={`num-stat ${t.heading}`}>{deck.due}</b> to review</span>
            {deck.learning > 0 && <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.learning }} /><b className={`num-stat ${t.heading}`}>{deck.learning}</b> learning</span>}
          </div>
          <div className="relative flex-1 min-h-[24px]" />
          <div className="relative flex flex-wrap items-center gap-4 mt-6">
            <button onClick={onReview} className={pill.redLg}>Start review {Icon.arrow}</button>
            <span className={`text-[13px] ${t.faint}`}>about {minutes} min</span>
          </div>
        </>
      ) : (
        <div className="relative flex-1 flex items-center gap-5 mt-5">
          <StackArt dark={dark} accent={deck.total ? c.due : accent} check={!!deck.total} size={96} />
          <div>
            <p className={`font-display text-[26px] leading-tight ${t.heading}`}>{deck.total ? 'Done for today.' : 'No cards yet.'}</p>
            <p className={`text-[14px] mt-1.5 ${t.muted}`}>
              {deck.total
                ? (fmtUntil(deck.nextDue) && fmtUntil(deck.nextDue) !== 'now' ? `Next card ${fmtUntil(deck.nextDue)}.` : 'New cards unlock tomorrow.')
                : 'Make your first card, or import a deck.'}
            </p>
            {!deck.total && onAddCard && <button onClick={onAddCard} className={`mt-4 ${pill.red}`}>{Icon.plus}Add a card</button>}
          </div>
        </div>
      )}
    </section>
  );
};

/* ── Publishing (administrators, Alpha decks) ── */

const PublishStrip: React.FC<{
  status: DeckStatus; collection: DeckCollection; dark: boolean;
  onSetStatus: (s: DeckStatus) => void; onSetCollection: (c: DeckCollection) => void;
}> = ({ status, collection, dark, onSetStatus, onSetCollection }) => {
  const t = tokens(dark);
  const shelf = COLLECTION_COPY[collection].title;
  const copy: Record<DeckStatus, string> = {
    draft: `Only admins can see this deck. Check the cards, then publish it to ${shelf}.`,
    published: `Live in ${shelf} for every student.`,
    archived: 'Hidden from the library. Students who already have it keep studying it.',
  };
  return (
    <section className={`mk-rise rounded-2xl border ${dark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-white/60 border-zinc-200/80'}`}>
      <div className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <StatusPill status={status} dark={dark} />
      <p className={`text-[13px] flex-1 min-w-[220px] ${t.body}`}>{copy[status]}</p>
      <div className="flex items-center gap-2">
        {status === 'draft' && <button onClick={() => onSetStatus('published')} className={`${pill.red} !h-10`}>Publish to everyone</button>}
        {status === 'published' && (
          <>
            <button onClick={() => onSetStatus('archived')} className={pill.quiet(dark)}>Archive</button>
            <button onClick={() => onSetStatus('draft')} className={`${pill.ghost(dark)} !h-10`}>Unpublish</button>
          </>
        )}
        {status === 'archived' && <button onClick={() => onSetStatus('published')} className={`${pill.ghost(dark)} !h-10`}>Publish again</button>}
      </div>
      </div>
      <div className={`px-5 py-3 border-t flex flex-wrap items-center justify-between gap-3 ${dark ? 'border-white/[0.06]' : 'border-zinc-200/70'}`}>
        <p className={`text-[12px] ${t.muted}`}>Students find it in</p>
        <Segmented
          dark={dark}
          label="Shelf"
          value={collection}
          onChange={onSetCollection}
          options={[{ value: 'essentials', label: 'Alpha Essentials' }, { value: 'more', label: 'More from Alpha' }]}
        />
      </div>
    </section>
  );
};

/* ── An empty deck ── */

const SAMPLE: Record<DeckSubject | 'none', string> = {
  Physics: 'The SI unit of magnetic flux is the {{c1::weber}}.',
  Chemistry: 'Aldehydes are reduced to {{c1::primary alcohols}} by LiAlH₄.',
  Maths: 'The derivative of sin x is {{c1::cos x}}.',
  Biology: 'The powerhouse of the cell is the {{c1::mitochondrion}}.',
  none: 'A good card asks for {{c1::one thing}} at a time.',
};

const TIPS = [
  { n: '1', title: 'One idea per card', line: 'Hide one fact. Small cards stick.' },
  { n: '2', title: 'Use your own words', line: 'Write it the way you\'d say it.' },
  { n: '3', title: 'Add a hint if stuck', line: 'Tap a hidden part to add one.' },
];

const EmptyDeck: React.FC<{ deck: DeckSummary; dark: boolean; accent: string; canEdit: boolean; onAddCard: () => void; onImport: () => void }> = ({ deck, dark, accent, canEdit, onAddCard, onImport }) => {
  const t = tokens(dark);
  const [shown, setShown] = useState(false);
  const front = SAMPLE[deck.subject ?? 'none'];
  const cardBg = dark ? '#18181C' : '#FFFFFF';
  const shadow = dark
    ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px -30px rgba(0,0,0,0.9)'
    : '0 0 0 1px rgba(24,24,27,0.06), 0 30px 60px -28px rgba(24,24,27,0.3)';
  return (
    <div className="space-y-4">
      <section className={`mk-rise relative overflow-hidden rounded-2xl border ${t.card}`} style={{ animationDelay: '30ms' }}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 90% at 85% 50%, ${accent}${dark ? '24' : '18'}, transparent 70%)` }} />
        <div className="relative grid md:grid-cols-[1fr_1fr] gap-10 p-8 md:p-12 items-center">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Empty deck</p>
            {canEdit ? (
              <>
                <h2 className={`font-display text-[36px] md:text-[44px] leading-[1.02] mt-4 ${t.heading}`}>
                  Add your <span className="font-accent font-normal">first</span> card.
                </h2>
                <p className={`text-[15px] leading-relaxed mt-4 max-w-[380px] ${t.muted}`}>
                  Write one in seconds, or import a deck file. Alpha brings each card back right before you'd forget it.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-8">
                  <button onClick={onAddCard} className={pill.redLg}>{Icon.plus}Write a card</button>
                  <button onClick={onImport} className={`${pill.ghost(dark)} !h-14 !px-6 !text-[15px]`}>{Icon.upload}Import cards</button>
                </div>
              </>
            ) : (
              <>
                <h2 className={`font-display text-[36px] md:text-[44px] leading-[1.02] mt-4 ${t.heading}`}>Cards are on the way.</h2>
                <p className={`text-[15px] leading-relaxed mt-4 max-w-[380px] ${t.muted}`}>This deck has no cards yet. Check back soon.</p>
              </>
            )}
          </div>

          {/* An example card in this deck's subject and colour. Touch it. */}
          <div className="relative h-[230px] md:h-[260px] flex items-center justify-center select-none">
            <div aria-hidden className="absolute w-[min(300px,78vw)] aspect-[4/3] rounded-[22px]" style={{ background: dark ? '#131317' : '#FAF9F6', boxShadow: shadow, transform: 'translate(18px, 14px) rotate(5deg) scale(0.94)' }} />
            <div
              onMouseEnter={() => setShown(true)}
              onMouseLeave={() => setShown(false)}
              onPointerUp={e => { if (e.pointerType !== 'mouse') setShown(v => !v); }}
              className="relative w-[min(300px,78vw)] aspect-[4/3] rounded-[22px] flex items-center justify-center px-6 text-center cursor-pointer"
              style={{ background: cardBg, boxShadow: shadow, transform: 'rotate(-2deg)' }}
            >
              <span className={`absolute top-4 left-5 text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Example</span>
              <CardFace kind="cloze" front={front} back="" ord={1} revealed={shown} deckId={null} dark={dark} accent={accent} size="medium" />
              <span className={`absolute bottom-4 inset-x-0 text-[11px] font-semibold transition-opacity ${shown ? 'opacity-0' : 'opacity-100'} ${t.faint}`}>Tap to reveal</span>
            </div>
          </div>
        </div>
      </section>

      {canEdit && (
        <div className="grid sm:grid-cols-3 gap-3">
          {TIPS.map((tip, i) => (
            <div key={tip.n} className={`mk-rise rounded-2xl border px-5 py-4 flex gap-3.5 ${t.card}`} style={{ animationDelay: `${90 + i * 40}ms` }}>
              <span className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-[12px] font-bold" style={{ background: `${accent}22`, color: dark ? '#fff' : '#18181b' }}>{tip.n}</span>
              <div>
                <p className={`text-[14px] font-bold ${t.heading}`}>{tip.title}</p>
                <p className={`text-[13px] mt-0.5 ${t.muted}`}>{tip.line}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── The cards ── */

const CardList: React.FC<{
  deck: DeckSummary; dark: boolean; canEdit: boolean; source: DeckSource; version: number; accent: string;
  onEditNote: (n: Note) => void; onDeleteNote: (n: Note) => Promise<void>; onSuspendNote: (n: Note, s: boolean) => Promise<void>;
  onReviewTag: (tag: string) => void; onAddCard: () => void;
}> = ({ deck, dark, canEdit, source, version, accent, onEditNote, onDeleteNote, onSuspendNote, onReviewTag, onAddCard }) => {
  const t = tokens(dark);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paused, setPaused] = useState<Set<string>>(new Set());
  const gen = useRef(0);

  useEffect(() => { const id = window.setTimeout(() => setQuery(search), 250); return () => window.clearTimeout(id); }, [search]);
  useEffect(() => { source.tags(deck.id).then(setTags).catch(() => setTags([])); }, [deck.id, source, version]);

  const load = useCallback(async (p: number) => {
    const g = ++gen.current;
    const res = await source.notes(deck.id, { search: query, tag, page: p });
    if (g !== gen.current) return;
    setNotes(prev => (p === 0 || !prev ? res.notes : [...prev, ...res.notes]));
    setTotal(res.total);
    setPage(p);
    source.suspended(deck.id, res.notes.map(n => n.id)).then(s => {
      if (g === gen.current) setPaused(prev => new Set([...(p === 0 ? [] : prev), ...s]));
    }).catch(() => undefined);
  }, [deck.id, query, tag, source]);

  useEffect(() => { setNotes(null); void load(0).catch(() => setNotes([])); }, [load, version]);

  return (
    <section className="pt-4">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div className="flex items-baseline gap-3">
          <h2 className={`font-display text-[22px] ${t.heading}`}>Cards</h2>
          <span className={`num-stat text-[14px] ${t.faint}`}>{(query || tag) ? `${total} found` : deck.total}</span>
        </div>
        <div className={`flex items-center gap-2 h-10 px-3.5 rounded-full w-full sm:w-[280px] ${dark ? 'bg-white/[0.04] ring-1 ring-inset ring-white/[0.07] text-zinc-500' : 'bg-white ring-1 ring-inset ring-zinc-200 text-zinc-400'}`}>
          {Icon.search}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards" aria-label="Search cards"
            className={`flex-1 bg-transparent outline-none text-[13px] ${t.heading} ${dark ? 'placeholder:text-zinc-600' : 'placeholder:text-zinc-400'}`} />
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto mk-scroll-x pb-3 -mx-1 px-1">
          {tags.slice(0, 16).map(tg => {
            const on = tag === tg;
            return (
              <button key={tg} onClick={() => setTag(on ? null : tg)} aria-pressed={on}
                className={`shrink-0 h-8 px-3 rounded-full text-[12px] font-semibold transition-colors ${
                  on ? (dark ? 'bg-white text-black' : 'bg-zinc-900 text-white') : dark ? 'text-zinc-400 bg-white/[0.04] hover:text-zinc-200' : 'text-zinc-600 bg-white ring-1 ring-inset ring-zinc-200 hover:text-zinc-900'}`}>
                #{tg}
              </button>
            );
          })}
          {tag && (
            <button onClick={() => onReviewTag(tag)} className={`shrink-0 ml-1 h-8 px-3 rounded-full text-[12px] font-bold text-[#E10600] hover:bg-[#E10600]/10`}>
              Review #{tag} only {Icon.arrow}
            </button>
          )}
        </div>
      )}

      <div className={`rounded-2xl border overflow-hidden ${t.card}`}>
        {notes === null ? (
          <div className="divide-y" style={{ borderColor: 'transparent' }}>
            {[0, 1, 2, 3].map(i => <div key={i} className={`h-[72px] ${dark ? 'border-white/[0.05]' : 'border-zinc-100'}`} />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className={`inline-flex w-11 h-11 rounded-full items-center justify-center ${dark ? 'bg-white/[0.05] text-zinc-500' : 'bg-zinc-100 text-zinc-400'}`}>{Icon.search}</span>
            <p className={`text-[15px] font-semibold mt-4 ${t.heading}`}>
              {query ? <>Nothing matches “{query}”{tag ? ` in #${tag}` : ''}.</> : tag ? `No cards tagged #${tag}.` : 'No cards yet.'}
            </p>
            {(query || tag) ? (
              <button onClick={() => { setSearch(''); setQuery(''); setTag(null); }} className={`mt-5 ${pill.ghost(dark)}`}>Clear search</button>
            ) : canEdit && <button onClick={onAddCard} className={`mt-5 ${pill.ghost(dark)}`}>{Icon.plus}Add a card</button>}
          </div>
        ) : (
          <ul className={`divide-y ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
            {notes.map(n => (
              <NoteRow key={n.id} note={n} dark={dark} accent={accent} canEdit={canEdit} paused={paused.has(n.id)}
                onEdit={() => onEditNote(n)}
                onDelete={async () => { await onDeleteNote(n); setNotes(ns => ns?.filter(x => x.id !== n.id) ?? ns); setTotal(x => x - 1); }}
                onPause={async s => { await onSuspendNote(n, s); setPaused(p => { const q = new Set(p); if (s) q.add(n.id); else q.delete(n.id); return q; }); }}
              />
            ))}
          </ul>
        )}
      </div>
      {notes && notes.length < total && (
        <div className="flex justify-center mt-5">
          <button disabled={loadingMore} onClick={async () => { setLoadingMore(true); try { await load(page + 1); } finally { setLoadingMore(false); } }} className={pill.ghost(dark)}>
            {loadingMore ? 'Loading…' : `Show more · ${total - notes.length} left`}
          </button>
        </div>
      )}
    </section>
  );
};

const NoteRow: React.FC<{
  note: Note; dark: boolean; accent: string; canEdit: boolean; paused: boolean;
  onEdit: () => void; onDelete: () => Promise<void>; onPause: (s: boolean) => Promise<void>;
}> = ({ note, dark, accent, canEdit, paused, onEdit, onDelete, onPause }) => {
  const t = tokens(dark);
  const cards = note.kind === 'cloze' ? ordinals(note.front).length : 1;
  return (
    <li className={`group flex items-center gap-4 px-5 md:px-6 py-4 transition-colors ${canEdit ? `cursor-pointer ${t.hover}` : ''}`} onClick={canEdit ? onEdit : undefined}>
      <div className={`flex-1 min-w-0 ${paused ? 'opacity-45' : ''}`}>
        <div className="dk-row text-left">
          <CardFace kind={note.kind} front={note.front} back="" ord={1} revealed={false} browse deckId={note.deckId} dark={dark} accent={accent} size="small" />
        </div>
        {note.kind === 'basic' && note.back && (
          <p className={`text-[13px] mt-1 truncate ${t.muted}`}>→ {note.back.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px]">
          <span className={t.faint}>{note.kind === 'cloze' ? `${cards} ${cards === 1 ? 'card' : 'cards'}` : 'Basic'}</span>
          {note.tags.slice(0, 4).map(tg => <span key={tg} className={t.faint}>#{tg}</span>)}
          {paused && <span className={`font-semibold ${dark ? 'text-amber-400' : 'text-amber-700'}`}>Paused</span>}
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <MoreMenu
          dark={dark}
          quiet
          label="Card actions"
          items={[
            { label: 'Edit card', icon: Icon.pencil, onSelect: onEdit, hidden: !canEdit },
            { label: paused ? 'Unpause' : 'Pause card', icon: Icon.pause, onSelect: () => void onPause(!paused) },
            {
              label: 'Delete card', icon: Icon.trash, danger: true, hidden: !canEdit,
              onSelect: () => { if (window.confirm('Delete this card? Its review history goes with it.')) void onDelete(); },
            },
          ]}
        />
      </div>
    </li>
  );
};

export default DeckView;
