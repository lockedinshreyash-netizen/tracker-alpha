/* ── Scheduling ──
   FSRS, through ts-fsrs — the reference implementation by the people who
   designed the algorithm, and the one Anki itself now ships. Writing our own
   would be inventing a scheduler, which is the one thing a study tool must not
   get wrong quietly. Everything else in the app talks to this file, never to
   ts-fsrs directly, so the library can be swapped or upgraded in one place.

   Settings follow Anki's defaults: learning steps 1m and 10m, relearning 10m,
   fuzz on (so 200 cards learned together do not all fall due on the same
   morning), desired retention per deck.

   Day-length intervals are pinned to the start of the study day (04:00 IST):
   FSRS says "5 days", and the card is waiting from 04:00 on that day. */

import { Card, Grade, State, createEmptyCard, fsrs, generatorParameters } from 'ts-fsrs';
import type { CardState, Progress, Rating } from './types';
import { studyDayAfter } from './day';

const DAY_MS = 86_400_000;

const schedulers = new Map<number, ReturnType<typeof fsrs>>();
const scheduler = (retention: number) => {
  const r = Math.min(0.99, Math.max(0.7, retention || 0.9));
  let s = schedulers.get(r);
  if (!s) {
    s = fsrs(generatorParameters({
      request_retention: r,
      maximum_interval: 36500,
      enable_fuzz: true,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
    }));
    schedulers.set(r, s);
  }
  return s;
};

const toCard = (p: Progress | null, now: Date): Card => {
  if (!p || p.state === 0) return createEmptyCard(now);
  return {
    due: new Date(p.due),
    stability: p.stability,
    difficulty: p.difficulty,
    elapsed_days: 0,
    scheduled_days: p.scheduledDays,
    learning_steps: p.learningSteps,
    reps: p.reps,
    lapses: p.lapses,
    state: p.state as unknown as State,
    last_review: p.lastReview ? new Date(p.lastReview) : undefined,
  };
};

const fromCard = (c: Card, now: Date): Progress => {
  const state = c.state as unknown as CardState;
  // A review-state card due in whole days waits from the start of that study day.
  const due = state === 2 && c.scheduled_days >= 1 ? studyDayAfter(now, c.scheduled_days) : c.due;
  return {
    state,
    due: due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduledDays: c.scheduled_days,
    learningSteps: c.learning_steps,
    reps: c.reps,
    lapses: c.lapses,
    lastReview: now.toISOString(),
  };
};

/** "<1m", "10m", "3h", "5d", "1.4mo", "2.1y" — the interval under each button. */
export const intervalLabel = (next: Progress, now: Date): string => {
  if (next.state === 2 && next.scheduledDays >= 1) {
    const d = next.scheduledDays;
    if (d < 30) return `${d}d`;
    if (d < 365) return `${(d / 30).toFixed(d < 300 ? 1 : 0).replace(/\.0$/, '')}mo`;
    return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`;
  }
  const ms = Math.max(0, new Date(next.due).getTime() - now.getTime());
  if (ms < 60_000) return '<1m';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(ms / DAY_MS)}d`;
};

export interface Choice {
  next: Progress;
  label: string;
}

/**
 * What each button would do, computed once when the answer is shown. The
 * state the user then commits is exactly the one they were shown — computing
 * it again on the press would roll the fuzz again and the card could land a
 * day away from what the button said.
 */
export const preview = (p: Progress | null, now: Date, retention = 0.9): Record<Rating, Choice> => {
  const s = scheduler(retention);
  const card = toCard(p, now);
  const out = {} as Record<Rating, Choice>;
  ([1, 2, 3, 4] as Rating[]).forEach(r => {
    const next = fromCard(s.next(card, now, r as unknown as Grade).card, now);
    out[r] = { next, label: intervalLabel(next, now) };
  });
  return out;
};

export const RATING_LABEL: Record<Rating, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
