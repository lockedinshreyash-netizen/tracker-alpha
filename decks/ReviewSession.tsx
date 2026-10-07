/* ── Review ──
   The room you study in. One card on the desk, the rest of the deck stacked
   under it and thinning as you go, the deck's colour as a faint light behind
   it — and nothing else. Session order lives in decks/session.ts, scheduling
   in decks/srs.ts, upload in decks/outbox.ts; this file is only the room.

   Rules about the hand:
   - Ratings are ignored for 300ms after the answer appears, and the answer
     button for 300ms after a rating: they share one place on screen, so a
     double-tap must never reveal and rate in one go.
   - No swipe-to-rate. A swipe that misfires as Again costs days of schedule
     and nothing on screen would say it happened.
   - What a button says is what it does: the intervals are computed once,
     when the answer appears, and the state committed is that one. The
     interval is the biggest thing on each button, because it is the
     consequence of pressing it.
   - Every press is acknowledged — the rating floats up off the dock — because
     an answer that leaves no trace is indistinguishable from a missed tap.

   Anki users get Anki's three counters (new · learning · due), with the
   current card's kind marked, and Anki's keys.

   Leaving is never losing. Every answer is in the outbox before the screen
   moves on; the session itself (what is left, the count, the answers so far)
   is remembered after every answer (decks/resume.ts), so coming back to the
   same deck the same day resumes at "13 / 34". A fresh session lays answers
   still waiting to upload over what the server returns, so nothing answered
   is ever asked twice. One room serves a single deck or a whole Alpha pack:
   `deckIds` lists the decks, and each card carries its own. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Overlay } from '../ui/kit';
import { CardFace } from './CardFace';
import { answersFor } from './cloze';
import { toPlain } from './html';
import { fetchQueue, humanError, progressFromRow, progressRow, type ReviewEntry } from './api';
import { enqueue, flush, pendingCount, pendingProgress, subscribe, undo as undoOutbox } from './outbox';
import { Pick, Session, answer, appendCards, applyPending, current, holding, laterToday, remaining, startSession } from './session';
import { clearSnapshot, loadSnapshot, saveSnapshot } from './resume';
import { getISTDateString } from '../utils';
import { pushToast } from '../notify/toastBus';
import { Choice, RATING_LABEL, preview } from './srs';
import { studyDayBounds } from './day';
import { RATING_RAMP, STATE_COLOR, STATE_LABEL, deckAccent, fmtDuration, fmtUntil, room, stateKey } from './theme';
import type { DeckSubject, Note, QueueCard, Rating } from './types';
import { Key, StackArt } from './ui';

const GUARD_MS = 300;
const PREFETCH_AT = 10;

interface Props {
  uid: string;
  deck: { id: string; title: string; desiredRetention: number; subject?: DeckSubject | null; chapter?: string | null; nextDue?: string | null };
  dark: boolean;
  /** Only study cards carrying one of these tags. */
  tags?: string[] | null;
  /** Several decks studied as one session (an Alpha pack). Defaults to the one deck. */
  deckIds?: string[];
  /** Per-deck settings and colour when the session spans decks. */
  deckInfo?: Record<string, { title: string; desiredRetention: number; subject: DeckSubject | null }>;
  /** Where the remembered session lives. Defaults to the deck (and tag filter). */
  resumeKey?: string;
  /** Present when the caller may edit cards: E opens the editor on the current card. */
  onEdit?: (noteId: string, deckId: string, done: (note: Note | null) => void) => void;
  onExit: (reviewed: number) => void;
  /** The dev harness: start from these cards instead of the server, write nothing. */
  initialCards?: QueueCard[];
}

interface Step {
  before: Session;
  clientId: string;
  /** The card that was answered, so undo puts that card back on screen. */
  pick: Pick;
}

const isNew = (c: QueueCard) => !c.progress || c.progress.state === 0;

const PAGE = 100;

const ReviewSession: React.FC<Props> = ({ uid, deck, dark, tags = null, deckIds, deckInfo, resumeKey, onEdit, onExit, initialCards }) => {
  const r = room(dark);
  const states = STATE_COLOR(dark);
  const local = !!initialCards;
  const ids = useMemo(() => deckIds?.length ? deckIds : [deck.id], [deckIds, deck.id]);
  const scope = resumeKey ?? `${deck.id}${tags?.length ? `#${[...tags].sort().join(',')}` : ''}`;
  const today = useMemo(() => getISTDateString(), []);
  const dayEnd = useMemo(() => studyDayBounds().end.getTime(), []);
  // A session left earlier today on this device: resume it, no network needed.
  const [snap] = useState(() => loadSnapshot(uid, scope, today));
  const [session, setSession] = useState<Session | null>(() => (snap ? snap.session : initialCards ? startSession(initialCards) : null));
  const [resumedNote, setResumedNote] = useState(!!snap && snap.session.done > 0);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [choices, setChoices] = useState<Record<Rating, Choice> | null>(null);
  const [history, setHistory] = useState<Step[]>([]);
  const [pending, setPending] = useState(() => pendingCount(uid));
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [flash, setFlash] = useState<{ id: number; rating: Rating; label: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [, tick] = useState(0);

  const shownAt = useRef(Date.now());
  const revealedAt = useRef(0);
  const ratedAt = useRef(0);
  const startedAt = useRef(snap?.startedAt ?? Date.now());
  // Decks with nothing more to fetch. A local session never fetches.
  const exhausted = useRef<Set<string>>(new Set(local ? ids : []));
  const fetching = useRef(false);

  /* Answers still waiting to upload, as progress — never ask them again. */
  const pendingMap = useCallback(() => {
    const out = new Map<string, ReturnType<typeof progressFromRow>>();
    if (local) return out;
    pendingProgress(uid).forEach((row, id) => out.set(id, progressFromRow(row)));
    return out;
  }, [uid, local]);

  const fetchPage = useCallback(async (exclude: string[]) => {
    const want = ids.filter(id => !exhausted.current.has(id));
    const pages = await Promise.all(want.map(id => fetchQueue(id, { limit: PAGE, exclude, tags })));
    pages.forEach((p, i) => { if (p.length < PAGE) exhausted.current.add(want[i]); });
    return applyPending(pages.flat(), pendingMap(), dayEnd);
  }, [ids, tags, pendingMap, dayEnd]);

  /* ── Load ── */
  useEffect(() => {
    if (local) return;
    if (snap) { void flush(uid); return; }
    let live = true;
    // Give a pending upload a moment to land, but never let it hold the room shut.
    Promise.race([flush(uid), new Promise(res => window.setTimeout(res, 4000))])
      .finally(() => {
        fetchPage([])
          .then(cards => { if (live) setSession(startSession(cards)); })
          .catch(e => { if (live) setError(humanError(e)); });
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Remember the session after every change ── */
  useEffect(() => {
    if (!session) return;
    if (remaining(session) === 0) { clearSnapshot(uid, scope); return; }
    if (session.done === 0 && !snap) return;
    saveSnapshot(uid, scope, { day: today, startedAt: startedAt.current, session });
  }, [session, uid, scope, today, snap]);

  useEffect(() => {
    if (!resumedNote) return;
    const id = window.setTimeout(() => setResumedNote(false), 3800);
    return () => window.clearTimeout(id);
  }, [resumedNote]);

  useEffect(() => subscribe(() => setPending(pendingCount(uid))), [uid]);
  useEffect(() => {
    const on = () => { setOnline(true); if (!local) void flush(uid); };
    const off = () => setOnline(false);
    const hide = () => { if (document.visibilityState === 'hidden' && !local) void flush(uid); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    document.addEventListener('visibilitychange', hide);
    const iv = window.setInterval(() => { if (!local) void flush(uid); }, 20_000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      document.removeEventListener('visibilitychange', hide);
      window.clearInterval(iv);
    };
  }, [uid, local]);

  /* ── The card on screen ──
     Pinned until it is answered (see `holding`). Only then is the session
     asked which card comes next. Before this, a learning card coming due
     during any re-render (a save finishing, the rating chip, going online)
     replaced the card being studied, and a rating could land on the wrong
     card. Updated during render rather than in an effect, so there is never a
     frame without a card. */
  const now = Date.now();
  const [pinned, setPinned] = useState<Pick | null>(null);
  const held = session && pinned ? holding(session, pinned) : null;
  const pick: Pick | null = held ?? (session ? current(session, now) : null);
  if (!held && pick?.card !== pinned?.card) setPinned(pick);
  const cardDeck = pick?.card.deckId ? deckInfo?.[pick.card.deckId] : undefined;
  const accent = deckAccent(cardDeck ? cardDeck.subject : deck.subject, dark);

  /* A learning card waiting out its step with nothing else to show: wake when it is due. */
  useEffect(() => {
    if (!session || pick || !session.learning.length) return;
    const next = Math.min(...session.learning.map(w => w.at)) - now;
    if (next > 20 * 60_000) return;
    const id = window.setTimeout(() => tick(x => x + 1), Math.max(500, next));
    return () => window.clearTimeout(id);
  }, [session, pick, now]);

  /* ── Prefetch the next page while the last few cards are answered ── */
  useEffect(() => {
    if (!session || local || ids.every(id => exhausted.current.has(id)) || fetching.current || session.queue.length > PREFETCH_AT) return;
    fetching.current = true;
    flush(uid)
      .then(() => fetchPage(session.seen))
      .then(cards => setSession(s => (s ? appendCards(s, cards) : s)))
      .catch(() => { /* offline: finish what is here; the next answer tries again */ })
      .finally(() => { fetching.current = false; });
  }, [session, uid, ids, local, fetchPage]);

  useEffect(() => { shownAt.current = Date.now(); }, [pick?.card.cardId, pick?.card.progress?.lastReview]);

  /* ── Actions ── */
  const reveal = useCallback(() => {
    if (!pick || revealed) return;
    if (Date.now() - ratedAt.current < GUARD_MS) return;
    setChoices(preview(pick.card.progress, new Date(), cardDeck?.desiredRetention ?? deck.desiredRetention));
    setRevealed(true);
    revealedAt.current = Date.now();
  }, [pick, revealed, deck.desiredRetention, cardDeck]);

  const rate = useCallback((rating: Rating) => {
    if (!pick || !revealed || !choices || !session) return;
    if (Date.now() - revealedAt.current < GUARD_MS) return;
    const choice = choices[rating];
    const clientId = crypto.randomUUID();
    const entry: ReviewEntry = {
      client_id: clientId,
      card_id: pick.card.cardId,
      rating,
      reviewed_at: choice.next.lastReview ?? new Date().toISOString(),
      duration_ms: Math.min(Date.now() - shownAt.current, 3_600_000),
      prev: pick.card.progress ? progressRow(pick.card.progress) : null,
      next: progressRow(choice.next),
    };
    if (!local) enqueue(uid, entry);
    setHistory(h => [...h.slice(-19), { before: session, clientId, pick }]);
    const nextSession = answer(session, pick, rating, choice.next, dayEnd);
    setSession(nextSession);
    setRevealed(false);
    setChoices(null);
    setFlash({ id: Date.now(), rating, label: choice.label });
    ratedAt.current = Date.now();
    if (!local && nextSession.done % 10 === 0) void flush(uid);
  }, [pick, revealed, choices, session, uid, dayEnd, local]);

  const undo = useCallback(async () => {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory(h => h.slice(0, -1));
    setSession(last.before);
    // The undone card comes back, not whatever happens to be due now.
    setPinned(last.pick);
    setRevealed(false);
    setChoices(null);
    setFlash(null);
    if (!local) await undoOutbox(uid, last.clientId);
  }, [history, uid, local]);

  const exit = useCallback(() => {
    if (!local) void flush(uid);
    // Leaving with cards still to go: say plainly that nothing was lost.
    if (session && session.done > 0 && current(session, Date.now())) {
      pushToast({ id: 'dk-saved', title: 'Progress saved.', body: 'Open it again any time today to pick up where you left off.', tone: 'good' });
    }
    onExit(session?.done ?? 0);
  }, [onExit, session, uid, local]);

  const edit = useCallback(() => {
    if (!pick || !onEdit) return;
    setEditing(true);
    onEdit(pick.card.noteId, pick.card.deckId ?? deck.id, note => {
      setEditing(false);
      if (!note) return;
      // The fix shows at once, on every card of that note still in the session.
      const patch = (c: QueueCard) => (c.noteId === note.id ? { ...c, front: note.front, back: note.back, kind: note.kind, tags: note.tags } : c);
      setSession(s => s && ({ ...s, queue: s.queue.map(patch), learning: s.learning.map(w => ({ ...w, card: patch(w.card) })) }));
    });
  }, [pick, onEdit, deck.id]);

  /* ── Keys ── */
  const keys = useRef({ reveal, rate, undo, exit, edit, revealed });
  keys.current = { reveal, rate, undo, exit, edit, revealed };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const k = keys.current;
      if (e.key === 'Escape') { e.preventDefault(); k.exit(); return; }
      if ((e.key === 'z' || e.key === 'Z') && !e.altKey) { e.preventDefault(); void k.undo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (k.revealed) k.rate(3); else k.reveal();
        return;
      }
      if (k.revealed && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); k.rate(Number(e.key) as Rating); return; }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); k.edit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  /* ── Derived ── */
  const done = session?.done ?? 0;
  const left = session ? remaining(session) : 0;
  const total = done + left;
  const finished = !!session && !pick;
  const counts = session ? {
    new: session.queue.filter(isNew).length,
    learning: session.learning.length + session.queue.filter(c => !isNew(c) && c.progress!.state !== 2).length,
    due: session.queue.filter(c => !isNew(c) && c.progress!.state === 2).length,
  } : { new: 0, learning: 0, due: 0 };
  const currentKind = pick ? (pick.from === 'learning' ? 'learning' : stateKey(pick.card.progress?.state)) : null;
  const layers = Math.min(2, Math.max(0, left - 1));
  const answers = pick && revealed && pick.card.kind === 'cloze' ? answersFor(pick.card.front, pick.card.ord).map(toPlain).join(', ') : '';
  const syncText = local ? '' : pending > 0 ? (online ? 'Saving…' : `${pending} saved on this device`) : 'All saved';
  const syncColor = pending > 0 && !online ? '#f59e0b' : pending > 0 ? r.faint : states.due;
  const ink = dark ? 'bg-[#FAFAFA] text-[#09090B]' : 'bg-[#09090B] text-white';
  const inkShadow = dark ? '0 10px 30px -12px rgba(255,255,255,0.22)' : '0 12px 28px -14px rgba(9,9,11,0.55)';

  return (
    <Overlay>
      <div
        className="fixed inset-0 z-[110] flex flex-col font-ui select-none"
        style={{ background: r.page, color: r.ink }}
        role="dialog"
        aria-modal="true"
        aria-label={`Reviewing ${deck.title}`}
      >
        {/* The deck's colour as light from above — the only colour in the room. */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{
          background: `radial-gradient(60% 50% at 50% 0%, ${accent}${dark ? '1c' : '14'}, transparent 70%)`,
        }} />

        {/* ── Top bar ── */}
        <header className="relative shrink-0 pt-[max(10px,env(safe-area-inset-top))]">
          <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-14 flex items-center gap-3">
            <button
              onClick={exit}
              className="group h-9 pl-2.5 pr-3.5 -ml-1 rounded-full flex items-center gap-1.5 text-[13px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: r.muted }}
              aria-label="End review"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="transition-transform group-hover:-rotate-90"><path d="M18 6 6 18M6 6l12 12" /></svg>
              <span className="hidden sm:inline">End</span>
            </button>

            <div className="flex-1 min-w-0 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] flex items-center justify-center gap-1.5" style={{ color: r.faint }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                <span className="truncate">{ids.length > 1 ? `Alpha pack · ${ids.length} decks` : deck.subject ? `${deck.subject}${deck.chapter ? ` · ${deck.chapter}` : ''}` : 'Deck'}</span>
              </p>
              <p className="text-[14px] font-bold truncate mt-0.5" style={{ color: r.ink }}>{deck.title}</p>
            </div>

            {/* Anki's three counters. The kind of the card in front of you is underlined. */}
            <div className="flex items-center gap-3 md:gap-4" aria-label={`${counts.new} new, ${counts.learning} learning, ${counts.due} to review`}>
              {(['new', 'learning', 'due'] as const).map(k => (
                <div key={k} className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: states[k] }} />
                    <span className="num-stat text-[15px] tabular-nums" style={{ color: counts[k] ? r.ink : r.faint }}>{counts[k]}</span>
                  </div>
                  <span
                    className="hidden md:block text-[10px] font-semibold mt-0.5 pb-0.5 border-b-[1.5px] transition-colors"
                    style={{ color: r.muted, borderColor: currentKind === k && !finished ? states[k] : 'transparent' }}
                  >
                    {k}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Progress: the one red line in the room. */}
          <div className="h-[2px] w-full" style={{ background: r.rule }}>
            <div className="h-full bg-[#E10600] transition-[width] duration-500 ease-out" style={{ width: `${total ? (done / total) * 100 : finished ? 100 : 0}%` }} />
          </div>
        </header>

        {/* ── Stage ── */}
        <main className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {resumedNote && session && pick && (
            <div className="dk-in absolute left-1/2 -translate-x-1/2 top-4 z-10 px-3.5 h-8 rounded-full flex items-center gap-2 text-[12px] font-semibold whitespace-nowrap"
              style={{ background: r.card, boxShadow: r.layerShadow, color: r.ink }} role="status">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: states.due }} />
              Picked up where you left off
              <span style={{ color: r.muted }}>· {session.done} done</span>
            </div>
          )}
          <div className="min-h-full flex items-center justify-center px-4 md:px-8 py-8 md:py-12">
            {error ? (
              <Empty dark={dark} title="Couldn't open this deck." line={error} action="Back" onAction={() => onExit(0)} />
            ) : !session ? (
              <Skeleton dark={dark} />
            ) : finished ? (
              <Summary session={session} startedAt={startedAt.current} dark={dark} accent={accent} onDone={exit} laterToday={laterToday(session, now)} nextDue={deck.nextDue ?? null} />
            ) : pick && (
              <div className="relative w-full max-w-[760px]">
                {/* The rest of the deck, under the card. */}
                {layers >= 2 && (
                  <div aria-hidden className="absolute inset-x-9 md:inset-x-14 -bottom-[24px] top-8 rounded-[28px] transition-all duration-300" style={{ background: r.layer2, boxShadow: r.layerShadow }} />
                )}
                {layers >= 1 && (
                  <div aria-hidden className="absolute inset-x-4 md:inset-x-7 -bottom-[12px] top-4 rounded-[28px] transition-all duration-300" style={{ background: r.layer, boxShadow: r.layerShadow }} />
                )}

                {/* The card. Tap anywhere on it to reveal. Not a <button>: that
                    would replace the question with its label for a screen
                    reader; the Show answer button covers keys and AT. */}
                <article
                  key={`${pick.card.cardId}:${done}`}
                  onClick={reveal}
                  className={`dk-deal relative rounded-[28px] flex flex-col ${revealed ? '' : 'cursor-pointer'}`}
                  style={{ background: r.card, boxShadow: r.cardShadow, minHeight: 'clamp(300px, 52vh, 540px)' }}
                >
                  <div className="flex items-center justify-between gap-3 px-5 md:px-8 pt-5 md:pt-6">
                    {currentKind && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: r.faint }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: states[currentKind] }} />
                        {STATE_LABEL[currentKind]}
                      </span>
                    )}
                    <span className="text-[11px] truncate" style={{ color: r.faint }}>
                      {/* In a pack, which deck this card is from matters more than its tags. */}
                      {cardDeck && ids.length > 1 ? cardDeck.title : pick.card.tags.slice(0, 3).map(t => `#${t}`).join('   ')}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center px-6 md:px-14 py-10 md:py-14 text-center select-text">
                    <div className="w-full">
                      <CardFace
                        kind={pick.card.kind}
                        front={pick.card.front}
                        back={pick.card.back}
                        ord={pick.card.ord}
                        revealed={revealed}
                        deckId={local ? null : pick.card.deckId ?? deck.id}
                        dark={dark}
                        accent={accent}
                      />
                    </div>
                  </div>
                </article>
              </div>
            )}
          </div>
          <div aria-live="polite" className="sr-only">{answers ? `Answer: ${answers}` : ''}</div>
        </main>

        {/* ── Dock ── */}
        {session && pick && !error && (
          <footer className="relative shrink-0 px-4 md:px-8 pt-2 pb-[max(14px,env(safe-area-inset-bottom))]">
            <div className="relative max-w-[760px] mx-auto">
              {flash && (
                <div
                  key={flash.id}
                  className="dk-flash absolute left-1/2 -top-11 px-3.5 h-8 rounded-full flex items-center gap-2 text-[12px] font-semibold whitespace-nowrap pointer-events-none"
                  style={{ background: r.card, boxShadow: r.layerShadow, color: r.ink }}
                  onAnimationEnd={() => setFlash(f => (f?.id === flash.id ? null : f))}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: RATING_RAMP(dark)[flash.rating] }} />
                  {RATING_LABEL[flash.rating]}
                  <span style={{ color: r.muted }}>· next in {flash.label}</span>
                </div>
              )}

              {!revealed ? (
                /* The card's own surface, not a solid slab: the card stays the
                   brightest thing in the room, and ink is saved for Good. */
                <button
                  onClick={reveal}
                  className="relative w-full h-[60px] md:h-[66px] rounded-2xl text-[15px] font-bold tracking-[-0.005em] transition-all active:scale-[0.985] md:hover:-translate-y-px"
                  style={{ background: r.card, boxShadow: r.layerShadow, color: r.ink }}
                >
                  Show answer
                  <span className="hidden md:inline-flex absolute right-5 top-1/2 -translate-y-1/2"><Key dark={dark}>Space</Key></span>
                </button>
              ) : choices && (
                <div className="grid grid-cols-4 gap-2 md:gap-2.5" role="group" aria-label="How well did you know it?">
                  {([1, 2, 3, 4] as Rating[]).map(rt => {
                    const strong = rt === 3;
                    return (
                      <button
                        key={rt}
                        onClick={() => rate(rt)}
                        aria-label={`${RATING_LABEL[rt]} — next in ${choices[rt].label}`}
                        className={`dk-in relative h-[60px] md:h-[66px] rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97] md:hover:-translate-y-px ${strong ? ink : ''}`}
                        style={strong
                          ? { boxShadow: inkShadow, animationDelay: `${(rt - 1) * 25}ms` }
                          : { background: r.card, boxShadow: r.layerShadow, color: r.ink, animationDelay: `${(rt - 1) * 25}ms` }}
                      >
                        <span className="hidden md:inline-flex absolute left-2.5 top-2.5"><Key dark={dark} onInk={strong}>{rt}</Key></span>
                        <span className="num-stat text-[18px] md:text-[21px] leading-none">{choices[rt].label}</span>
                        <span className="text-[11px] md:text-[12px] font-semibold" style={{ opacity: strong ? 0.65 : 1, color: strong ? undefined : r.muted }}>{RATING_LABEL[rt]}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-2.5 h-6 flex items-center justify-between text-[12px]" style={{ color: r.muted }}>
                <div className="flex items-center gap-1">
                  <button onClick={() => void undo()} disabled={!history.length} className="h-7 px-2 -ml-2 rounded-md flex items-center gap-1.5 transition-opacity disabled:opacity-30 hover:opacity-70">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
                    Undo <span className="hidden md:inline-flex"><Key dark={dark}>Z</Key></span>
                  </button>
                  {onEdit && (
                    <button onClick={edit} className="h-7 px-2 rounded-md flex items-center gap-1.5 hover:opacity-70">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Edit <span className="hidden md:inline-flex"><Key dark={dark}>E</Key></span>
                    </button>
                  )}
                </div>
                {syncText && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: syncColor }} />
                    {syncText}
                  </span>
                )}
              </div>
            </div>
          </footer>
        )}
      </div>
    </Overlay>
  );
};

/* ── While the first cards load: the card's own shape, breathing. ── */
const Skeleton: React.FC<{ dark: boolean }> = ({ dark }) => {
  const r = room(dark);
  return (
    <div className="w-full max-w-[760px] rounded-[28px] flex flex-col items-center justify-center gap-4 px-10" style={{ background: r.card, boxShadow: r.cardShadow, minHeight: 'clamp(300px, 52vh, 540px)', ['--dk-shimmer' as string]: dark ? 'rgba(255,255,255,0.05)' : 'rgba(24,24,27,0.05)' }} aria-label="Loading cards">
      {[78, 64, 40].map((w, i) => (
        <div key={i} className="h-5 rounded-full overflow-hidden" style={{ width: `${w}%`, background: dark ? 'rgba(255,255,255,0.04)' : '#f4f4f5' }}>
          <div className="dk-shimmer h-full w-full" />
        </div>
      ))}
    </div>
  );
};

const redPill = 'h-12 px-9 rounded-full text-[14px] font-bold bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_6px_20px_-8px_rgba(225,6,0,0.6)] transition-all active:scale-[0.97]';

const Empty: React.FC<{ dark: boolean; title: string; line: string; action: string; onAction: () => void }> = ({ dark, title, line, action, onAction }) => {
  const r = room(dark);
  return (
    <div className="mk-rise text-center max-w-sm">
      <div className="flex justify-center mb-7"><StackArt dark={dark} accent={r.faint} check={false} /></div>
      <h2 className="font-display text-[30px] leading-tight" style={{ color: r.ink }}>{title}</h2>
      <p className="text-[14px] mt-3" style={{ color: r.muted }}>{line}</p>
      <button onClick={onAction} className={`mt-8 ${redPill}`}>{action}</button>
    </div>
  );
};

/* ── The end of a session ── */
const Summary: React.FC<{
  session: Session; startedAt: number; dark: boolean; accent: string; onDone: () => void; laterToday: number; nextDue: string | null;
}> = ({ session, startedAt, dark, accent, onDone, laterToday: later, nextDue }) => {
  const r = room(dark);
  const ramp = RATING_RAMP(dark);
  const total = session.done;
  const [hover, setHover] = useState<Rating | null>(null);
  const recalled = session.answered[2] + session.answered[3] + session.answered[4];
  const recall = total ? Math.round((recalled / total) * 100) : 0;
  const elapsed = fmtDuration(Date.now() - startedAt);

  if (total === 0) {
    const when = fmtUntil(nextDue);
    return (
      <div className="mk-rise text-center max-w-md">
        <div className="flex justify-center mb-8"><StackArt dark={dark} accent={accent} /></div>
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: r.faint }}>Nothing due</p>
        <h2 className="font-display text-[40px] md:text-[48px] leading-[1.02] mt-3" style={{ color: r.ink }}>All caught up.</h2>
        <p className="text-[15px] mt-4" style={{ color: r.muted }}>
          {when && when !== 'now' ? `Your next card is due ${when}.` : 'Come back tomorrow, or add new cards.'}
        </p>
        <button onClick={onDone} className={`mt-9 ${redPill}`}>Back to deck</button>
      </div>
    );
  }

  return (
    <div className="mk-rise w-full max-w-[560px] text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: r.faint }}>Session complete</p>
      <h2 className="font-display text-[44px] md:text-[60px] leading-[1] mt-4" style={{ color: r.ink }}>
        {total} {total === 1 ? 'card' : 'cards'}.{' '}
        <span className="font-accent font-normal" style={{ letterSpacing: 0 }}>Locked in.</span>
      </h2>

      <div className="mt-10 grid grid-cols-3 rounded-2xl overflow-hidden" style={{ background: r.card, boxShadow: r.layerShadow }}>
        {[
          { label: 'Time', value: elapsed },
          { label: 'Recalled', value: `${recall}%` },
          { label: 'Again', value: String(session.answered[1]) },
        ].map((s, i) => (
          <div key={s.label} className="py-5 px-3" style={{ borderLeft: i ? `1px solid ${r.rule}` : undefined }}>
            <p className="num-hero text-[28px] md:text-[34px]" style={{ color: r.ink }}>{s.value}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] mt-2.5" style={{ color: r.faint }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* How each card went: one bar, Again → Easy, labelled below. */}
      <div className="mt-8 text-left">
        <div className="relative flex h-3 gap-[2px]" role="img" aria-label={([1, 2, 3, 4] as Rating[]).map(k => `${RATING_LABEL[k]} ${session.answered[k]}`).join(', ')}>
          {([1, 2, 3, 4] as Rating[]).filter(k => session.answered[k] > 0).map(k => (
            <div
              key={k}
              className="mk-grow-x h-full first:rounded-l-full last:rounded-r-full transition-opacity"
              style={{ flexGrow: session.answered[k], background: ramp[k], opacity: hover && hover !== k ? 0.3 : 1 }}
              onMouseEnter={() => setHover(k)}
              onMouseLeave={() => setHover(null)}
              title={`${RATING_LABEL[k]}: ${session.answered[k]}`}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {([1, 2, 3, 4] as Rating[]).map(k => (
            <div key={k} className="flex items-center gap-2 text-[12px] transition-opacity" style={{ opacity: hover && hover !== k ? 0.45 : 1 }} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ramp[k] }} />
              <span style={{ color: r.muted }}>{RATING_LABEL[k]}</span>
              <span className="num-stat tabular-nums ml-auto" style={{ color: r.ink }}>{session.answered[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {later > 0 && (
        <p className="text-[13px] mt-8" style={{ color: r.muted }}>
          {later} {later === 1 ? 'card is' : 'cards are'} still being learned and will come back later today.
        </p>
      )}
      <button onClick={onDone} className={`mt-9 ${redPill}`}>Back to deck</button>
    </div>
  );
};

export default ReviewSession;
