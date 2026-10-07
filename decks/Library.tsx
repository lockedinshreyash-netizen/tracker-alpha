/* ── The shelf ──
   What the Decks tab opens on. Every state is designed, not just the full one:

   - Nothing yet: say what this is in one line and show it — a fan of real
     cards (CardFace, the renderer the review uses) whose top card reveals its
     answer when touched. Then Alpha Essentials, big, if there are any; then
     three steps of how it works, so even a brand-new app with no Alpha decks
     published reads as a complete page; then More from Alpha.
   - Something due: the day's number, big, and the deck to start with.
   - Nothing due: not an empty box — what you did today, when the next card
     comes, and from which deck.
   - The decks: drawn as decks. "Your decks" appears only once the student has
     one of their own, and a short row is finished by an "add another" tile
     that spans the gap instead of leaving a hole.
   - My Alpha: what you got from Alpha. A pack is one item, drawn as a
     digital deck (AlphaLibraryItem), never as the packaging it came in.
   - The store: a sign with a short rack on it, leading to Alpha Packs.
   - Discovering: Alpha Essentials as featured cards, More from Alpha as a
     compact grid — the administrator's choice of shelf is what puts a deck in
     one or the other.

   Presentational only: DecksTab owns every fetch; this file lays out what it
   is handed. */

import React, { useMemo, useState } from 'react';
import { PageHeader, tokens } from '../ui/kit';
import { CardFace } from './CardFace';
import { MASTERY_RAMP, STATE_COLOR, deckAccent, fmtUntil, room } from './theme';
import { AlphaBadge, Icon, MasteryBar, StackArt, SubjectEyebrow, masteryOf, masteryPct, pill } from './ui';
import { AlphaLibraryItem, packTotals } from './Packs';
import { StoreEntry } from './store/StoreEntry';
import type { DeckSubject, DeckSummary, ExploreDeck, Pack } from './types';

interface Props {
  dark: boolean;
  isAdmin: boolean;
  signedIn: boolean;
  /** Null while loading. */
  summaries: DeckSummary[] | null;
  explore: ExploreDeck[] | null;
  error: string | null;
  onOpenDeck: (id: string) => void;
  onReview: (id: string) => void;
  onNewDeck: () => void;
  onImport: () => void;
  onAddExplore: (id: string) => Promise<void>;
  onStudyExplore: (id: string) => void;
  onOpenAuth: () => void;
  onRetry: () => void;
  /** Alpha packs: the store's stock and the ones you have. Null while loading. */
  packs?: Pack[] | null;
  onOpenStore?: () => void;
  onOpenPack?: (id: string) => void;
  onReviewPack?: (id: string) => void;
}

const todayCount = (d: DeckSummary) => d.due + d.newAvailable;
const essentialsFirst = (a: DeckSummary, b: DeckSummary) => Number(b.collection === 'essentials') - Number(a.collection === 'essentials');

const Library: React.FC<Props> = props => {
  const { dark, isAdmin, signedIn, summaries, explore, error, onOpenDeck, onReview, onNewDeck, onImport, onOpenAuth, onRetry } = props;
  const { packs = null, onOpenStore, onOpenPack = () => undefined, onReviewPack = () => undefined } = props;
  const t = tokens(dark);

  const groups = useMemo(() => {
    const all = summaries ?? [];
    // A pack you have is one item; its decks are not listed again beside it.
    const owned = (packs ?? []).filter(p => p.inLibrary || all.some(d => d.packId === p.id));
    const ownedIds = new Set(owned.map(p => p.id));
    const inPack = (d: DeckSummary) => !!d.packId && ownedIds.has(d.packId);
    return {
      mine: all.filter(d => d.scope === 'personal'),
      packs: owned.map(p => ({ pack: p, decks: all.filter(d => d.packId === p.id) })),
      alpha: all.filter(d => d.scope === 'global' && d.status !== 'draft' && !inPack(d)).sort(essentialsFirst),
      drafts: all.filter(d => d.scope === 'global' && d.status === 'draft' && !inPack(d)).sort(essentialsFirst),
    };
  }, [summaries, packs]);
  const stocked = (packs ?? []).filter(p => p.status === 'published' || (isAdmin && p.status === 'draft'));

  const discover = useMemo(() => {
    const out = (explore ?? []).filter(e => !e.inLibrary);
    return { essentials: out.filter(e => e.collection === 'essentials'), more: out.filter(e => e.collection !== 'essentials') };
  }, [explore]);

  if (!signedIn) {
    return <Welcome {...props} primary={{ label: 'Sign in to start', onClick: onOpenAuth }} note="Your cards sync to every device you sign in on." essentials={[]} more={[]} />;
  }
  if (error && !summaries) {
    return (
      <div className="space-y-8">
        <PageHeader dark={dark} title="Decks" />
        <div className={`mk-rise rounded-2xl border p-10 md:p-14 text-center ${t.card}`}>
          <div className="flex justify-center mb-6"><StackArt dark={dark} accent={dark ? '#52525b' : '#a1a1aa'} check={false} size={96} /></div>
          <p className={`font-display text-[24px] ${t.heading}`}>Couldn't load your decks.</p>
          <p className={`text-[14px] mt-2 ${t.muted}`}>{error}</p>
          <button onClick={onRetry} className={`mt-7 ${pill.ghost(dark)}`}>Try again</button>
        </div>
      </div>
    );
  }
  if (!summaries) return <LibrarySkeleton dark={dark} />;
  if (!summaries.length) {
    return (
      <Welcome
        {...props}
        primary={{ label: 'Import a deck', onClick: onImport, icon: Icon.upload }}
        secondary={{ label: 'Create your own deck', onClick: onNewDeck }}
        note="Have a deck file? Import it in one step."
        essentials={discover.essentials}
        more={discover.more}
        store={stocked.length && onOpenStore ? <StoreEntry packs={stocked} dark={dark} onOpen={onOpenStore} /> : null}
      />
    );
  }

  const live = summaries.filter(d => d.status !== 'draft');
  const totalToday = live.reduce((n, d) => n + todayCount(d), 0);
  const deckCount = live.filter(d => todayCount(d) > 0).length;
  const subtitle = totalToday
    ? `${totalToday.toLocaleString()} ${totalToday === 1 ? 'card' : 'cards'} to study today${deckCount > 1 ? `, across ${deckCount} decks` : ''}.`
    : live.some(d => d.total > 0) ? 'All caught up. Nothing is due right now.' : 'Add a few cards to start.';

  return (
    <div className="space-y-12 font-ui">
      <PageHeader
        dark={dark}
        title="Decks"
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-2">
            <button onClick={onImport} className={pill.ghost(dark)}>{Icon.upload}<span className="hidden sm:inline">Import a deck</span><span className="sm:hidden">Import</span></button>
            <button onClick={onNewDeck} className={pill.red}>{Icon.plus}Create deck</button>
          </div>
        }
      />

      <TodayHero dark={dark} decks={summaries} packs={groups.packs} onReview={onReview} onReviewPack={onReviewPack} onOpenDeck={onOpenDeck} />

      {stocked.length > 0 && onOpenStore && <StoreEntry packs={stocked} dark={dark} onOpen={onOpenStore} delay={60} />}

      {/* Hidden until the student has a deck of their own: someone studying
          only Alpha decks has nothing to put here, and an empty shelf with a
          "create" tile reads as a chore. The header keeps both ways in. */}
      {groups.mine.length > 0 && (
        <Shelf title="Your decks" count={groups.mine.length} dark={dark}>
          {groups.mine.map((d, i) => <DeckTile key={d.id} deck={d} dark={dark} delay={i * 40} onOpen={() => onOpenDeck(d.id)} onReview={() => onReview(d.id)} />)}
          <AddTile dark={dark} count={groups.mine.length} delay={groups.mine.length * 40} onNewDeck={onNewDeck} onImport={onImport} />
        </Shelf>
      )}

      {groups.packs.length + groups.alpha.length > 0 && (
        <Shelf title="My Alpha" line="Your packs and decks from Alpha." count={groups.packs.length + groups.alpha.length} dark={dark}>
          {groups.packs.map(({ pack, decks }, i) => (
            <AlphaLibraryItem key={pack.id} pack={pack} decks={decks} dark={dark} delay={i * 40} onOpen={() => onOpenPack(pack.id)} onContinue={() => onReviewPack(pack.id)} />
          ))}
          {groups.alpha.map((d, i) => <DeckTile key={d.id} deck={d} dark={dark} delay={(groups.packs.length + i) * 40} onOpen={() => onOpenDeck(d.id)} onReview={() => onReview(d.id)} />)}
          {/* A short row ends in the decks still waiting below, not in a hole. */}
          {(groups.packs.length + groups.alpha.length) % 3 !== 0 && discover.essentials.length + discover.more.length > 0 && (
            <FindMoreTile dark={dark} count={groups.packs.length + groups.alpha.length} waiting={discover.essentials.length + discover.more.length} delay={(groups.packs.length + groups.alpha.length) * 40} />
          )}
        </Shelf>
      )}

      {isAdmin && groups.drafts.length > 0 && (
        <Shelf title="Alpha drafts" line="Only admins can see these until you publish them." count={groups.drafts.length} dark={dark}>
          {groups.drafts.map((d, i) => <DeckTile key={d.id} deck={d} dark={dark} delay={i * 40} onOpen={() => onOpenDeck(d.id)} onReview={() => onReview(d.id)} />)}
        </Shelf>
      )}

      <div id="dk-discover" className="space-y-12 scroll-mt-24">
      {discover.essentials.length > 0 && (
        <EssentialsShelf decks={discover.essentials} dark={dark} title="Alpha Essentials" line="The must-have decks. Add one in a tap." onAdd={props.onAddExplore} onStudy={props.onStudyExplore} />
      )}
      {discover.more.length > 0 && <MoreShelf decks={discover.more} dark={dark} onAdd={props.onAddExplore} onStudy={props.onStudyExplore} />}
      </div>
    </div>
  );
};

/* ── Today ── */

const TodayHero: React.FC<{
  dark: boolean; decks: DeckSummary[]; packs: { pack: Pack; decks: DeckSummary[] }[];
  onReview: (id: string) => void; onReviewPack: (id: string) => void; onOpenDeck: (id: string) => void;
}> = ({ dark, decks, packs, onReview, onReviewPack, onOpenDeck }) => {
  const t = tokens(dark);
  const c = STATE_COLOR(dark);
  const live = decks.filter(d => d.status !== 'draft');
  const fresh = live.reduce((n, d) => n + d.newAvailable, 0);
  const due = live.reduce((n, d) => n + d.due, 0);
  const total = fresh + due;
  // What to start with: the biggest pile today, a whole pack counting as one.
  const packed = new Set(packs.flatMap(p => p.decks.map(d => d.id)));
  const next = [
    ...packs.map(p => ({ id: p.pack.id, title: p.pack.title, count: packTotals(p.decks).today, subject: p.pack.subject, start: () => onReviewPack(p.pack.id) })),
    ...live.filter(d => !packed.has(d.id)).map(d => ({ id: d.id, title: d.title, count: todayCount(d), subject: d.subject, start: () => onReview(d.id) })),
  ].sort((a, b) => b.count - a.count)[0];
  const minutes = Math.max(1, Math.round((due * 8 + fresh * 20) / 60));

  if (!total) {
    const reviewed = decks.reduce((n, d) => n + d.reviewsToday, 0);
    const soonest = [...live].filter(d => d.nextDue).sort((a, b) => a.nextDue!.localeCompare(b.nextDue!))[0] ?? null;
    const when = soonest ? fmtUntil(soonest.nextDue) : null;
    const empty = !decks.some(d => d.total > 0);
    const firstEmpty = decks.find(d => d.total === 0) ?? null;
    const accent = empty ? deckAccent(firstEmpty?.subject ?? null, dark) : c.due;
    return (
      <section className={`mk-rise relative overflow-hidden rounded-2xl border ${t.card}`}>
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(60% 120% at 0% 50%, ${accent}${dark ? '1c' : '14'}, transparent 65%)` }} />
        <div className="relative grid md:grid-cols-[auto_1fr_auto] items-center gap-6 md:gap-9 p-7 md:p-10">
          <StackArt dark={dark} accent={accent} check={!empty} size={120} />
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Today</p>
            <p className={`font-display text-[30px] md:text-[38px] leading-[1.05] mt-2 ${t.heading}`}>
              {empty ? (decks.length > 1 ? 'Your decks are ready for cards.' : 'Your deck is ready for cards.') : reviewed ? <>Done. <span className="font-accent font-normal">Locked in.</span></> : 'All caught up.'}
            </p>
            <p className={`text-[15px] mt-2.5 ${t.muted}`}>
              {empty
                ? 'Add a few cards and your first review starts today.'
                : reviewed
                  ? `You reviewed ${reviewed.toLocaleString()} ${reviewed === 1 ? 'card' : 'cards'} today.${when && when !== 'now' ? ` Next one ${when}.` : ''}`
                  : when && when !== 'now' ? `Nothing is due. Your next card comes ${when}.` : 'Nothing is due right now.'}
            </p>
          </div>
          {empty && firstEmpty ? (
            <button onClick={() => onOpenDeck(firstEmpty.id)} className={pill.redLg}>{Icon.plus}Add cards</button>
          ) : soonest && when && when !== 'now' ? (
            <button onClick={() => onOpenDeck(soonest.id)} className={`hidden md:block text-right rounded-xl px-5 py-4 transition-colors ${dark ? 'bg-white/[0.03] hover:bg-white/[0.06] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 hover:bg-zinc-100 ring-1 ring-inset ring-zinc-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Next up</p>
              <p className={`text-[15px] font-bold mt-1.5 max-w-[220px] truncate ${t.heading}`}>{soonest.title}</p>
              <p className={`text-[12px] mt-0.5 ${t.muted}`}>{when}</p>
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const accent = next ? deckAccent(next.subject, dark) : '#E10600';
  return (
    <section className={`mk-rise relative overflow-hidden rounded-2xl border ${t.card}`} style={{ animationDelay: '40ms' }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(80% 120% at 100% 0%, ${accent}${dark ? '1f' : '14'}, transparent 60%)` }} />
      <div className="relative grid md:grid-cols-[1fr_auto] gap-8 p-7 md:p-10 items-end">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Today</p>
          <div className="flex items-baseline gap-3 mt-3">
            <span className={`num-hero text-[76px] md:text-[96px] ${t.heading}`}>{total.toLocaleString()}</span>
            <span className={`text-[16px] md:text-[18px] font-semibold ${t.muted}`}>{total === 1 ? 'card' : 'cards'}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[13px]">
            <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.new }} /><b className={`num-stat ${t.heading}`}>{fresh}</b> new</span>
            <span className={`inline-flex items-center gap-1.5 ${t.body}`}><span className="w-1.5 h-1.5 rounded-full" style={{ background: c.due }} /><b className={`num-stat ${t.heading}`}>{due}</b> to review</span>
            <span className={t.faint}>about {minutes} min</span>
          </div>
        </div>
        {next && (
          <div className="md:text-right md:min-w-[260px]">
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Start with</p>
            <p className={`font-display text-[22px] leading-tight mt-2 max-w-[320px] md:ml-auto ${t.heading}`}>{next.title}</p>
            <p className={`text-[13px] mt-1 ${t.muted}`}>{next.count} {next.count === 1 ? 'card' : 'cards'} waiting</p>
            <button onClick={next.start} className={`mt-5 ${pill.redLg}`}>Start review {Icon.arrow}</button>
          </div>
        )}
      </div>
    </section>
  );
};

/* ── Shelves ── */

const Shelf: React.FC<{ title: string; line?: string; count: number; dark: boolean; children: React.ReactNode }> = ({ title, line, count, dark, children }) => {
  const t = tokens(dark);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className={`font-display text-[22px] ${t.heading}`}>{title}</h2>
          <span className={`num-stat text-[14px] ${t.faint}`}>{count}</span>
        </div>
        {line && <p className={`text-[13px] truncate hidden sm:block ${t.muted}`}>{line}</p>}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-7 pt-3">{children}</div>
    </section>
  );
};

/** A deck, drawn as a deck. */
export const DeckTile: React.FC<{ deck: DeckSummary; dark: boolean; delay?: number; onOpen: () => void; onReview: () => void }> = ({ deck, dark, delay = 0, onOpen, onReview }) => {
  const t = tokens(dark);
  const accent = deckAccent(deck.subject, dark);
  const today = todayCount(deck);
  const m = masteryOf(deck);
  const layer = dark ? 'bg-[#0f0f12] border-white/[0.06]' : 'bg-[#f7f6f3] border-zinc-200/70';
  return (
    <div className="mk-rise relative" style={{ animationDelay: `${delay}ms` }}>
      <div className="dk-tile relative group h-full">
        {/* The rest of the deck, peeking above the top card. */}
        <div aria-hidden className={`dk-peek dk-peek-2 absolute inset-x-6 -top-[10px] h-8 rounded-t-2xl border ${layer}`} />
        <div aria-hidden className={`dk-peek dk-peek-1 absolute inset-x-3 -top-[5px] h-8 rounded-t-2xl border ${dark ? 'bg-[#131317] border-white/[0.07]' : 'bg-[#fbfaf8] border-zinc-200/80'}`} />

        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          className={`relative h-full rounded-2xl border p-5 md:p-6 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${t.card}`}
          aria-label={`${deck.title}: ${today} to study today`}
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{ background: `linear-gradient(180deg, ${accent}${dark ? '14' : '0f'}, transparent)` }} />

          <div className="relative flex items-start justify-between gap-3">
            <SubjectEyebrow subject={deck.subject} classId={deck.classId} chapter={null} dark={dark} fallback={deck.scope === 'global' ? 'Alpha deck' : 'Your deck'} />
            {deck.scope === 'global' && <AlphaBadge dark={dark} status={deck.status} collection={deck.collection} />}
          </div>

          <h3 className={`relative font-display text-[20px] leading-[1.15] mt-3 line-clamp-2 min-h-[46px] ${t.heading}`}>{deck.title}</h3>

          <div className="relative flex items-end justify-between gap-3 mt-6">
            {today > 0 ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`num-hero text-[44px] ${t.heading}`}>{today}</span>
                  <span className={`text-[13px] font-semibold ${t.muted}`}>today</span>
                </div>
                <p className={`text-[12px] mt-1.5 ${t.faint}`}>
                  {deck.newAvailable > 0 && `${deck.newAvailable} new`}
                  {deck.newAvailable > 0 && deck.due > 0 && ' · '}
                  {deck.due > 0 && `${deck.due} to review`}
                </p>
              </div>
            ) : deck.total ? (
              <div className="flex items-center gap-2 h-[62px]">
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${STATE_COLOR(dark).due}22`, color: STATE_COLOR(dark).due }}>{Icon.check}</span>
                <span className={`text-[14px] font-semibold ${t.body}`}>Done for today</span>
              </div>
            ) : (
              /* An empty deck says what to do, not what is missing. */
              <div className="flex items-center gap-2.5 h-[62px]">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center ${dark ? 'bg-white/[0.06] text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>{Icon.plus}</span>
                <span className={`text-[14px] font-semibold ${t.body}`}>Add your first card</span>
              </div>
            )}
            {today > 0 && (
              <button
                onClick={e => { e.stopPropagation(); onReview(); }}
                aria-label={`Review ${deck.title}`}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-[#E10600] text-white shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform hover:scale-105 active:scale-95"
              >
                <span className="translate-x-[1px]">{Icon.play}</span>
              </button>
            )}
          </div>

          <div className="relative mt-5">
            <MasteryBar m={m} dark={dark} />
            <div className={`flex justify-between mt-2 text-[11px] ${t.faint}`}>
              <span>{deck.total.toLocaleString()} {deck.total === 1 ? 'card' : 'cards'}</span>
              <span>{deck.total ? `${masteryPct(m)}% mastered` : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* Finishes the row of "Your decks": it spans whatever the last row has left,
   so one or two decks never sit beside a hole. Literal class strings, because
   CDN Tailwind only sees classes that appear whole. */
const SPAN_SM = ['sm:col-span-2', 'sm:col-span-1'];
const SPAN_LG = ['lg:col-span-3', 'lg:col-span-2', 'lg:col-span-1'];

const AddTile: React.FC<{ dark: boolean; count: number; delay: number; onNewDeck: () => void; onImport: () => void }> = ({ dark, count, delay, onNewDeck, onImport }) => {
  const t = tokens(dark);
  const span = `${SPAN_SM[count % 2]} ${SPAN_LG[count % 3]}`;
  return (
    <div className={`mk-rise ${span}`} style={{ animationDelay: `${delay}ms` }}>
      <div className={`h-full min-h-[228px] rounded-2xl border-2 border-dashed px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 text-center ${
        dark ? 'border-white/[0.08]' : 'border-zinc-300/70'}`}>
        <StackArt dark={dark} accent={dark ? '#e4e4e7' : '#27272a'} plus size={88} />
        <div className="min-w-[180px] max-w-[300px] flex-1 sm:flex-none">
          <p className={`text-[16px] font-bold ${t.heading}`}>Add another deck</p>
          <p className={`text-[13px] mt-1 ${t.muted}`}>One deck per chapter keeps each review short.</p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
            <button onClick={onNewDeck} className={`${pill.ghost(dark)} !h-10 !px-4 !text-[13px]`}>{Icon.plus}Create a deck</button>
            <button onClick={onImport} className={pill.quiet(dark)}>{Icon.upload}Import</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FindMoreTile: React.FC<{ dark: boolean; count: number; waiting: number; delay: number }> = ({ dark, count, waiting, delay }) => {
  const t = tokens(dark);
  const span = `${SPAN_SM[count % 2]} ${SPAN_LG[count % 3]}`;
  return (
    <div className={`mk-rise ${span}`} style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={() => document.getElementById('dk-discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className={`group w-full h-full min-h-[228px] rounded-2xl px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-center transition-colors ${
          dark ? 'bg-white/[0.02] hover:bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]' : 'bg-white/50 hover:bg-white ring-1 ring-inset ring-zinc-200/80'}`}
      >
        <span className={`w-14 h-14 rounded-full flex items-center justify-center font-accent italic text-[26px] leading-none ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>α</span>
        <span className="min-w-[170px]">
          <span className={`block text-[16px] font-bold ${t.heading}`}>{waiting} more {waiting === 1 ? 'deck' : 'decks'} from Alpha</span>
          <span className={`block text-[13px] mt-1 ${t.muted}`}>Ready to add. No setup.</span>
          <span className={`inline-flex items-center gap-1.5 mt-3 text-[13px] font-bold ${t.heading}`}>Browse <span className="transition-transform group-hover:translate-y-0.5 rotate-90">{Icon.arrow}</span></span>
        </span>
      </button>
    </div>
  );
};

/* ── Alpha Essentials: featured ── */

const MiniStack: React.FC<{ dark: boolean; accent: string; title: string; small?: boolean }> = ({ dark, accent, title, small }) => {
  const r = room(dark);
  return (
    <div aria-hidden className={`relative shrink-0 mr-3 ${small ? 'w-[132px] h-[100px]' : 'w-[168px] h-[126px]'}`}>
      {/* Fanned, not stacked flush: the layers have to show to read as a deck. */}
      <div className="absolute inset-0 rounded-[16px]" style={{ background: r.layer2, boxShadow: r.layerShadow, transform: 'translate(16px, 8px) rotate(9deg)' }} />
      <div className="absolute inset-0 rounded-[16px]" style={{ background: r.layer, boxShadow: r.layerShadow, transform: 'translate(7px, 3px) rotate(4deg)' }} />
      <div className="absolute inset-0 rounded-[16px] p-4 flex flex-col justify-between overflow-hidden" style={{ background: r.card, boxShadow: r.cardShadow, transform: 'rotate(-3deg)' }}>
        <div className="h-1.5 w-10 rounded-full" style={{ background: accent }} />
        <p className={`font-display leading-tight line-clamp-2 ${small ? 'text-[11px]' : 'text-[13px]'}`} style={{ color: r.ink }}>{title}</p>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-9 rounded-full" style={{ background: r.rule }} />
          <span className="h-3 w-10 rounded-[4px]" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.05)', boxShadow: `inset 0 -2px 0 ${accent}` }} />
          <span className="h-1.5 flex-1 rounded-full" style={{ background: r.rule }} />
        </div>
      </div>
    </div>
  );
};

const EssentialsShelf: React.FC<{
  decks: ExploreDeck[]; dark: boolean; title: string; line: string;
  onAdd: (id: string) => Promise<void>; onStudy: (id: string) => void;
}> = ({ decks, dark, title, line, onAdd, onStudy }) => {
  const t = tokens(dark);
  const [busy, setBusy] = useState<string | null>(null);
  const one = decks.length === 1;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <span className={`w-7 h-7 rounded-full flex items-center justify-center font-accent italic text-[17px] leading-none ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>α</span>
          <h2 className={`font-display text-[22px] ${t.heading}`}>{title}</h2>
        </div>
        <p className={`text-[13px] hidden sm:block ${t.muted}`}>{line}</p>
      </div>
      <div className={`grid gap-4 ${one ? '' : 'md:grid-cols-2'}`}>
        {decks.map((d, i) => {
          const accent = deckAccent(d.subject, dark);
          return (
            <div key={d.id} className={`mk-rise relative overflow-hidden rounded-2xl border ${t.card}`} style={{ animationDelay: `${i * 50}ms` }}>
              <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 100% at 100% 0%, ${accent}${dark ? '22' : '16'}, transparent 65%)` }} />
              <div className={`relative flex items-center gap-6 p-6 ${one ? 'md:p-9' : 'md:p-7'}`}>
                <div className="flex-1 min-w-0">
                  <SubjectEyebrow subject={d.subject} classId={d.classId} chapter={d.chapter} dark={dark} fallback="Alpha Essentials" />
                  <h3 className={`font-display leading-[1.08] mt-3 ${one ? 'text-[30px] md:text-[36px]' : 'text-[24px]'} ${t.heading}`}>{d.title}</h3>
                  {d.description && <p className={`text-[14px] leading-relaxed mt-2.5 line-clamp-2 max-w-[460px] ${t.muted}`}>{d.description}</p>}
                  <p className={`text-[12px] mt-3 ${t.faint}`}>{d.cards.toLocaleString()} cards</p>
                  <div className="flex items-center gap-1.5 mt-5 whitespace-nowrap">
                    {/* Ink, not red: red is the Today hero's. This is the strongest
                        thing on the shelf, not on the page. */}
                    <button onClick={() => onStudy(d.id)} className={`inline-flex items-center gap-2 h-11 px-5 rounded-full text-[14px] font-bold transition-all active:scale-[0.97] ${dark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
                      Start studying {Icon.arrow}
                    </button>
                    <button
                      disabled={busy === d.id}
                      onClick={async () => { setBusy(d.id); try { await onAdd(d.id); } finally { setBusy(null); } }}
                      className={pill.quiet(dark)}
                    >
                      {busy === d.id ? 'Adding…' : <>{Icon.plus}Add</>}
                    </button>
                  </div>
                </div>
                <div className="hidden sm:block"><MiniStack dark={dark} accent={accent} title={d.title} small={!one} /></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/* ── More from Alpha: compact ── */

const MoreShelf: React.FC<{ decks: ExploreDeck[]; dark: boolean; onAdd: (id: string) => Promise<void>; onStudy: (id: string) => void }> = ({ decks, dark, onAdd, onStudy }) => {
  const t = tokens(dark);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2 className={`font-display text-[22px] ${t.heading}`}>More from Alpha</h2>
        <p className={`text-[13px] hidden sm:block ${t.muted}`}>Ready-made decks. Add one in a tap.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map((d, i) => (
          <div key={d.id} className={`mk-rise rounded-2xl border p-5 flex flex-col ${t.card}`} style={{ animationDelay: `${i * 40}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <SubjectEyebrow subject={d.subject} classId={d.classId} chapter={null} dark={dark} fallback="Alpha deck" />
              <AlphaBadge dark={dark} />
            </div>
            <h3 className={`font-display text-[18px] leading-tight mt-3 ${t.heading}`}>{d.title}</h3>
            {d.description && <p className={`text-[13px] mt-1.5 line-clamp-2 ${t.muted}`}>{d.description}</p>}
            <div className="flex-1" />
            <div className="flex items-center justify-between gap-2 mt-5 pt-4 border-t" style={{ borderColor: dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5' }}>
              <span className={`text-[12px] ${t.faint}`}>{d.cards.toLocaleString()} cards</span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={busy === d.id}
                  onClick={async () => { setBusy(d.id); try { await onAdd(d.id); } finally { setBusy(null); } }}
                  className={pill.quiet(dark)}
                >
                  {busy === d.id ? 'Adding…' : <>{Icon.plus}Add</>}
                </button>
                <button onClick={() => onStudy(d.id)} className={`${pill.ghost(dark)} !h-9 !px-4 !text-[13px]`}>Study {Icon.arrow}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* ── How it works: three steps, each with its own small picture ── */

/* Review days drawn to scale-ish: today, then 1, 3, 9 and ~30 days on. */
const GAPS = [{ x: 0, label: 'today' }, { x: 10, label: '' }, { x: 28, label: '3d' }, { x: 56, label: '9d' }, { x: 100, label: '1mo' }];

const HowItWorks: React.FC<{ dark: boolean }> = ({ dark }) => {
  const t = tokens(dark);
  const r = room(dark);
  const ramp = MASTERY_RAMP(dark);
  const chem = deckAccent('Chemistry', dark);
  const phys = deckAccent('Physics', dark);
  const step = `mk-rise rounded-2xl border p-6 flex flex-col ${t.card}`;
  const pic = `h-[118px] rounded-xl mb-5 flex items-center justify-center overflow-hidden ${dark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`;
  const R = 26;
  const C = 2 * Math.PI * R;
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2 className={`font-display text-[22px] ${t.heading}`}>How it works</h2>
        <p className={`text-[13px] hidden sm:block ${t.muted}`}>A few minutes a day. That's it.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className={step}>
          <div className={pic}>
            <div className="w-[190px] rounded-xl px-4 py-3.5 text-[13px] font-semibold text-center" style={{ background: r.card, boxShadow: r.layerShadow, color: r.ink }}>
              Ozone is made of
              <span className="inline-block align-[-3px] mx-1 w-12 h-[16px] rounded-[4px]" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.05)', boxShadow: `inset 0 -2px 0 ${chem}` }} />
              atoms.
            </div>
          </div>
          <p className={`text-[11px] font-bold ${t.faint}`}>1</p>
          <p className={`text-[17px] font-bold mt-1 ${t.heading}`}>Add your cards</p>
          <p className={`text-[14px] mt-1.5 ${t.muted}`}>Import a deck, or write your own. Hide the words you want to remember.</p>
        </div>

        <div className={step} style={{ animationDelay: '50ms' }}>
          <div className={pic}>
            {/* The gaps between reviews grow as a card sticks. */}
            <div className="w-[200px]">
              <div className="relative h-8">
                <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: r.rule }} />
                {GAPS.map((g, i) => (
                  <span key={g.x} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full" style={{ left: `${g.x}%`, width: 10 + i * 2, height: 10 + i * 2, background: phys, opacity: 0.45 + i * 0.13 }} />
                ))}
              </div>
              {/* Each label sits under its own dot; the ends are pinned so nothing hangs off. */}
              <div className={`relative h-4 mt-2 text-[10px] font-semibold ${t.faint}`}>
                {GAPS.filter(g => g.label).map((g, i, all) => (
                  <span key={g.x} className="absolute top-0 whitespace-nowrap" style={{ left: `${g.x}%`, transform: i === 0 ? 'none' : i === all.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{g.label}</span>
                ))}
              </div>
            </div>
          </div>
          <p className={`text-[11px] font-bold ${t.faint}`}>2</p>
          <p className={`text-[17px] font-bold mt-1 ${t.heading}`}>Review a little each day</p>
          <p className={`text-[14px] mt-1.5 ${t.muted}`}>Alpha shows each card right before you'd forget it. The gaps grow as you learn.</p>
        </div>

        <div className={step} style={{ animationDelay: '100ms' }}>
          <div className={pic}>
            <div className="relative" style={{ width: 70, height: 70 }}>
              <svg viewBox="0 0 64 64" width="70" height="70" className="-rotate-90">
                <circle cx="32" cy="32" r={R} fill="none" stroke={ramp.track} strokeWidth="7" />
                <circle cx="32" cy="32" r={R} fill="none" stroke={ramp.mature} strokeWidth="7" strokeDasharray={`${C * 0.62} ${C}`} strokeLinecap="round" />
                <circle cx="32" cy="32" r={R} fill="none" stroke={ramp.young} strokeWidth="7" strokeDasharray={`${C * 0.16} ${C}`} strokeDashoffset={-(C * 0.62 + 3)} strokeLinecap="round" />
              </svg>
              <span className={`absolute inset-0 flex items-center justify-center num-stat text-[15px] ${t.heading}`}>78%</span>
            </div>
          </div>
          <p className={`text-[11px] font-bold ${t.faint}`}>3</p>
          <p className={`text-[17px] font-bold mt-1 ${t.heading}`}>Remember it in the exam</p>
          <p className={`text-[14px] mt-1.5 ${t.muted}`}>Cards you know come back less. The hard ones come back more.</p>
        </div>
      </div>
    </section>
  );
};

/* ── First run ── */

const SAMPLES: { front: string; subject: DeckSubject; rot: number; x: number; y: number }[] = [
  { front: 'The SI unit of magnetic flux is the {{c1::weber}}.', subject: 'Physics', rot: -9, x: -86, y: 22 },
  { front: 'The derivative of sin x is {{c1::cos x}}.', subject: 'Maths', rot: 7, x: 92, y: 30 },
  { front: 'Aldehydes are reduced to {{c1::primary alcohols}} by LiAlH₄.', subject: 'Chemistry', rot: -1.5, x: 0, y: 0 },
];

const Welcome: React.FC<Props & {
  primary: { label: string; onClick: () => void; icon?: React.ReactNode };
  secondary?: { label: string; onClick: () => void };
  note: string;
  essentials: ExploreDeck[];
  more: ExploreDeck[];
  store?: React.ReactNode;
}> = ({ dark, primary, secondary, note, essentials, more, store, onAddExplore, onStudyExplore }) => {
  const t = tokens(dark);
  const [shown, setShown] = useState(false);
  return (
    <div className="space-y-16 font-ui">
      <section className="mk-rise grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-6 items-center pt-4 md:pt-10">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Alpha Decks</p>
          <h1 className={`font-display text-[44px] md:text-[64px] leading-[0.98] mt-4 ${t.heading}`}>
            Remember<br />everything<br />you <span className="font-accent font-normal">study.</span>
          </h1>
          <p className={`text-[16px] md:text-[17px] leading-relaxed mt-6 max-w-[440px] ${t.muted}`}>
            Flashcards that come back right before you forget them. Import a deck, or make your own in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <button onClick={primary.onClick} className={pill.redLg}>{primary.icon}{primary.label}</button>
            {secondary && <button onClick={secondary.onClick} className={`${pill.ghost(dark)} !h-14 !px-7 !text-[15px]`}>{secondary.label}</button>}
          </div>
          <p className={`text-[13px] mt-5 ${t.faint}`}>{note}</p>
        </div>

        {/* A fan of real cards. Touch the top one. */}
        <div className="relative h-[300px] sm:h-[340px] md:h-[400px] flex items-center justify-center select-none scale-[0.82] sm:scale-100">
          {SAMPLES.map((s, i) => {
            const top = i === SAMPLES.length - 1;
            return (
              <div
                key={s.subject}
                onMouseEnter={top ? () => setShown(true) : undefined}
                onMouseLeave={top ? () => setShown(false) : undefined}
                // A mouse reveals on hover; a finger toggles on tap. Both on a click would cancel out.
                onPointerUp={top ? e => { if (e.pointerType !== 'mouse') setShown(v => !v); } : undefined}
                className={`absolute w-[min(330px,82vw)] aspect-[4/3] rounded-[24px] flex items-center justify-center px-7 text-center transition-transform duration-500 ${top ? 'cursor-pointer' : ''}`}
                style={{
                  transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg) scale(${top ? 1 : 0.93})`,
                  background: dark ? (top ? '#1a1a1f' : '#141418') : '#fff',
                  boxShadow: dark
                    ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px -30px rgba(0,0,0,0.9)'
                    : '0 0 0 1px rgba(24,24,27,0.06), 0 30px 60px -28px rgba(24,24,27,0.3)',
                  zIndex: i,
                }}
              >
                <span className="absolute top-4 left-5"><SubjectEyebrow subject={s.subject} dark={dark} /></span>
                {/* Only the top card speaks; the ones under it are depth. */}
                <div style={{ opacity: top ? 1 : 0.22, filter: top ? undefined : 'blur(1.5px)' }}>
                  <CardFace kind="cloze" front={s.front} back="" ord={1} revealed={top && shown} deckId={null} dark={dark} accent={deckAccent(s.subject, dark)} size="medium" />
                </div>
                {top && (
                  <span className={`absolute bottom-4 inset-x-0 text-[11px] font-semibold transition-opacity ${shown ? 'opacity-0' : 'opacity-100'} ${t.faint}`}>
                    Tap to reveal
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {store}
      {essentials.length > 0 && (
        <EssentialsShelf decks={essentials} dark={dark} title="Start with Alpha Essentials" line="Ready to study. No setup." onAdd={onAddExplore} onStudy={onStudyExplore} />
      )}
      <HowItWorks dark={dark} />
      {more.length > 0 && <MoreShelf decks={more} dark={dark} onAdd={onAddExplore} onStudy={onStudyExplore} />}
    </div>
  );
};

const LibrarySkeleton: React.FC<{ dark: boolean }> = ({ dark }) => {
  const t = tokens(dark);
  const block = dark ? 'bg-white/[0.04]' : 'bg-zinc-200/60';
  return (
    <div className="space-y-10" aria-label="Loading decks">
      <div className={`h-10 w-40 rounded-lg ${block}`} />
      <div className={`h-[210px] rounded-2xl border ${t.card}`} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className={`h-[228px] rounded-2xl border ${t.card}`} />)}
      </div>
    </div>
  );
};

export default Library;
