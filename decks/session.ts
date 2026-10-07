/* ── A review session ──
   Pure and immutable: every step returns a new state, so undo is "go back to
   the previous one" and React never sees a mutation.

   Order, as Anki does it: learning cards whose time has come go first (they
   are mid-lesson), then reviews with new cards spread evenly through them —
   not every new card at the end, where a tired student meets the hardest
   ones. A card answered "Again" comes back in this same session once its
   step has elapsed; if nothing else is left, a learning card due within the
   learn-ahead window (20 minutes) is shown early rather than ending the
   session on a spinner.

   Leaving mid-session must never mean starting over. A learning card that
   arrives from the server with a due time still ahead (answered a minute ago,
   then the student left and came back) waits out its step like one answered
   in this session — it does not jump to the front of the queue. And answers
   still sitting in the outbox are laid over what the server returns
   (`applyPending`), so a card answered seconds before leaving is never asked
   again just because the upload had not landed yet. */

import type { Progress, QueueCard, Rating } from './types';

export const LEARN_AHEAD_MS = 20 * 60_000;

export interface Waiting {
  card: QueueCard;
  at: number;
}

export interface Session {
  /** Not yet shown, in order. */
  queue: QueueCard[];
  /** Answered, coming back later in the session. */
  learning: Waiting[];
  /** Answers given this session, per rating. */
  answered: Record<Rating, number>;
  done: number;
  /** Cards the session has ever held, so a prefetch never adds one twice. */
  seen: string[];
}

const isNew = (c: QueueCard) => !c.progress || c.progress.state === 0;

/**
 * New cards from several decks (an Alpha pack) take turns, one from each, so
 * a pack session is not all of Organic and then all of Inorganic. Each deck
 * keeps its own order. With one deck this changes nothing.
 */
const takeTurns = (cards: QueueCard[]): QueueCard[] => {
  const byDeck = new Map<string, QueueCard[]>();
  cards.forEach(c => {
    const k = c.deckId ?? '';
    const list = byDeck.get(k);
    if (list) list.push(c); else byDeck.set(k, [c]);
  });
  if (byDeck.size < 2) return cards;
  const lists = Array.from(byDeck.values());
  const out: QueueCard[] = [];
  for (let i = 0; out.length < cards.length; i += 1) lists.forEach(l => { if (l[i]) out.push(l[i]); });
  return out;
};

/** Spread new cards evenly among reviews; reviews go oldest-due first, across decks. */
export const interleave = (cards: QueueCard[]): QueueCard[] => {
  const learning = cards.filter(c => !isNew(c) && (c.progress!.state === 1 || c.progress!.state === 3))
    .sort((a, b) => a.progress!.due.localeCompare(b.progress!.due));
  const reviews = cards.filter(c => !isNew(c) && c.progress!.state === 2)
    .sort((a, b) => a.progress!.due.localeCompare(b.progress!.due));
  const fresh = takeTurns(cards.filter(isNew));
  if (!fresh.length) return [...learning, ...reviews];
  if (!reviews.length) return [...learning, ...fresh];
  const out: QueueCard[] = [...learning];
  const every = (reviews.length + fresh.length) / fresh.length;
  let r = 0;
  let n = 0;
  for (let i = 0; r < reviews.length || n < fresh.length; i += 1) {
    const wantNew = n < fresh.length && (r >= reviews.length || i + 1 >= Math.round((n + 1) * every));
    if (wantNew) out.push(fresh[n++]);
    else out.push(reviews[r++]);
  }
  return out;
};

/** A learning card whose step has not elapsed waits; everything else is shown in order. */
const split = (cards: QueueCard[], now: number): { show: QueueCard[]; wait: Waiting[] } => {
  const show: QueueCard[] = [];
  const wait: Waiting[] = [];
  for (const c of cards) {
    const p = c.progress;
    const at = p ? new Date(p.due).getTime() : 0;
    if (p && (p.state === 1 || p.state === 3) && at > now) wait.push({ card: c, at });
    else show.push(c);
  }
  return { show, wait };
};

export const startSession = (cards: QueueCard[], now = Date.now()): Session => {
  const { show, wait } = split(cards, now);
  return {
    queue: interleave(show),
    learning: wait,
    answered: { 1: 0, 2: 0, 3: 0, 4: 0 },
    done: 0,
    seen: cards.map(c => c.cardId),
  };
};

/** Add a prefetched page, skipping anything already held. */
export const appendCards = (s: Session, cards: QueueCard[], now = Date.now()): Session => {
  const fresh = cards.filter(c => !s.seen.includes(c.cardId));
  if (!fresh.length) return s;
  const { show, wait } = split(fresh, now);
  return {
    ...s,
    queue: [...s.queue, ...interleave(show)],
    learning: [...s.learning, ...wait],
    seen: [...s.seen, ...fresh.map(c => c.cardId)],
  };
};

/**
 * Lay answers that have not reached the server yet over what it returned.
 * A card whose pending answer put it beyond today is dropped; any other takes
 * the pending progress (and so waits out its learning step if it has one).
 */
export const applyPending = (cards: QueueCard[], pending: Map<string, Progress>, dayEnd: number): QueueCard[] =>
  cards.flatMap(c => {
    const p = pending.get(c.cardId);
    if (!p) return [c];
    if (new Date(p.due).getTime() >= dayEnd) return [];
    return [{ ...c, progress: p }];
  });

export interface Pick {
  card: QueueCard;
  from: 'learning' | 'queue';
}

/** One card in one state: a card answered again is a different `Pick`. */
const cardKey = (c: QueueCard) => `${c.cardId}|${c.progress?.lastReview ?? ''}`;

/**
 * The card on screen stays on screen until it is answered.
 *
 * `current` is a question about *now*, and now keeps moving: a learning card
 * whose one-minute step runs out becomes due while another card is being
 * looked at. Re-asking it on every render swapped the card under the student,
 * mid-thought and even with its answer showing, and the rating they pressed
 * then landed on the card that had slid in. This answers the only question the
 * screen should ask: is the card I am showing still waiting for an answer? If
 * so, it returns it as the session now holds it (an edit may have changed its
 * text). Once it has been answered it returns null, and only then is
 * `current` asked again.
 */
export const holding = (s: Session, p: Pick): Pick | null => {
  const k = cardKey(p.card);
  const card = p.from === 'queue'
    ? s.queue.find(c => cardKey(c) === k)
    : s.learning.find(w => cardKey(w.card) === k)?.card;
  return card ? { card, from: p.from } : null;
};

/** The card to show now, or null when the session is over (for now). */
export const current = (s: Session, now: number): Pick | null => {
  const ready = [...s.learning].sort((a, b) => a.at - b.at);
  if (ready[0] && ready[0].at <= now) return { card: ready[0].card, from: 'learning' };
  if (s.queue[0]) return { card: s.queue[0], from: 'queue' };
  if (ready[0] && ready[0].at <= now + LEARN_AHEAD_MS) return { card: ready[0].card, from: 'learning' };
  return null;
};

/**
 * Record an answer to the card `current` returned. A card that is still
 * learning and due before the study day ends comes back in this session.
 */
export const answer = (s: Session, pick: Pick, rating: Rating, next: Progress, dayEnd: number): Session => {
  const card: QueueCard = { ...pick.card, progress: next };
  // By id, not position: the answered card leaves wherever it was.
  const queue = s.queue.filter(c => c.cardId !== pick.card.cardId);
  const learning = s.learning.filter(w => w.card.cardId !== pick.card.cardId);
  const at = new Date(next.due).getTime();
  if ((next.state === 1 || next.state === 3) && at < dayEnd) learning.push({ card, at });
  return {
    ...s,
    queue,
    learning,
    answered: { ...s.answered, [rating]: s.answered[rating] + 1 },
    done: s.done + 1,
  };
};

/** Cards still to see, counting each learning card once. */
export const remaining = (s: Session): number => s.queue.length + s.learning.length;

/** Learning cards that come back later today, after the session ends. */
export const laterToday = (s: Session, now: number): number =>
  s.learning.filter(w => w.at > now + LEARN_AHEAD_MS).length;
