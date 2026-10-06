/* ── A review session ──
   Pure and immutable: every step returns a new state, so undo is "go back to
   the previous one" and React never sees a mutation.

   Order, as Anki does it: learning cards whose time has come go first (they
   are mid-lesson), then reviews with new cards spread evenly through them —
   not every new card at the end, where a tired student meets the hardest
   ones. A card answered "Again" comes back in this same session once its
   step has elapsed; if nothing else is left, a learning card due within the
   learn-ahead window (20 minutes) is shown early rather than ending the
   session on a spinner. */

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

/** Spread new cards evenly among reviews. */
export const interleave = (cards: QueueCard[]): QueueCard[] => {
  const learning = cards.filter(c => !isNew(c) && (c.progress!.state === 1 || c.progress!.state === 3))
    .sort((a, b) => a.progress!.due.localeCompare(b.progress!.due));
  const reviews = cards.filter(c => !isNew(c) && c.progress!.state === 2);
  const fresh = cards.filter(isNew);
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

export const startSession = (cards: QueueCard[]): Session => ({
  queue: interleave(cards),
  learning: [],
  answered: { 1: 0, 2: 0, 3: 0, 4: 0 },
  done: 0,
  seen: cards.map(c => c.cardId),
});

/** Add a prefetched page, skipping anything already held. */
export const appendCards = (s: Session, cards: QueueCard[]): Session => {
  const fresh = cards.filter(c => !s.seen.includes(c.cardId));
  if (!fresh.length) return s;
  return { ...s, queue: [...s.queue, ...interleave(fresh)], seen: [...s.seen, ...fresh.map(c => c.cardId)] };
};

export interface Pick {
  card: QueueCard;
  from: 'learning' | 'queue';
}

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
  const queue = pick.from === 'queue' ? s.queue.slice(1) : s.queue;
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
