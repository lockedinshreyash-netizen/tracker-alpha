/* ── The day's race, remembered ──
   `engine.ts` says what the race looks like *now*. This says what has happened
   since midnight: who was passed, when the lead changed hands, how long it was
   held, and which gap warnings have already been given.

   The board only ever stores today's totals, so none of this can be recovered
   from the server — it exists because someone watched it happen. It is kept in
   localStorage and is deliberately per-device: it is a record of what this app
   saw, not a second source of truth about the race.

   Pure except for the two storage helpers at the bottom. `advanceRaceDay` takes
   the previous day-record and the current race and returns the next record plus
   the events that fell out of the difference. Everything downstream —
   notifications, race control cards, the timeline, the metric strip — reads
   those events rather than diffing anything itself. */

import { GAP_THRESHOLDS, POMODORO_MIN, RaceState, isFinalHour } from './engine';
import { getISTDateString } from '../utils';

export type RaceEvent =
  /** Reached P1. */
  | { kind: 'took_lead'; id: string; at: number; from: number | null }
  /** Was P1, no longer. */
  | { kind: 'lost_lead'; id: string; at: number; to: string; position: number }
  /** Moved up past someone. */
  | { kind: 'overtook'; id: string; at: number; names: string[]; position: number }
  /** Someone moved up past me. */
  | { kind: 'passed_by'; id: string; at: number; names: string[]; position: number }
  /** P1 changed hands between two other people. */
  | { kind: 'leader_changed'; id: string; at: number; name: string }
  /** My lead shrank through a threshold. */
  | { kind: 'defend_gap'; id: string; at: number; minutes: number; threshold: number; name: string | null }
  /** The gap to the place above shrank through a threshold. */
  | { kind: 'chase_gap'; id: string; at: number; minutes: number; threshold: number; name: string | null; forLead: boolean }
  /** A neighbour started a session. */
  | { kind: 'rival_started'; id: string; at: number; name: string; minutes: number; ahead: boolean }
  /** A new best lead for the day. */
  | { kind: 'best_lead'; id: string; at: number; minutes: number }
  /** My own total moved — a session landed on the board. */
  | { kind: 'session_banked'; id: string; at: number; minutes: number; position: number; gained: number }
  /** Last hour of the day and the top two are still level. */
  | { kind: 'final_stretch'; id: string; at: number; minutes: number };

export type RaceEventKind = RaceEvent['kind'];

/* How loudly each event wants to be heard. Used to pick one when several land
   together, and to decide what is worth a notification at all. */
const PRIORITY: Record<RaceEventKind, number> = {
  took_lead: 95,
  lost_lead: 90,
  passed_by: 80,
  overtook: 70,
  defend_gap: 60,
  chase_gap: 55,
  final_stretch: 50,
  leader_changed: 30,
  rival_started: 20,
  best_lead: 10,
  session_banked: 0,
};

/* Events that may leave the app. The rest are in-app only: either the user did
   it themselves and is already looking at the screen, or it is colour rather
   than news. */
const NOTIFIABLE: ReadonlySet<RaceEventKind> = new Set<RaceEventKind>([
  'took_lead', 'lost_lead', 'passed_by', 'overtook', 'defend_gap', 'chase_gap', 'final_stretch',
]);

export const priorityOf = (e: RaceEvent): number => PRIORITY[e.kind];
export const isNotifiable = (e: RaceEvent): boolean => NOTIFIABLE.has(e.kind);

export interface RaceDay {
  date: string;
  /** Last time the race was observed, for accumulating time-in-position. */
  lastSeenAt: number;
  /** Whether a baseline has been taken. Before it, nothing counts as a change. */
  seeded: boolean;

  /* ── Last observation, for the diff ── */
  position: number | null;
  myMinutes: number;
  leaderId: string | null;
  /** Everyone on the board last time, and their totals. */
  minutesById: Record<string, number>;
  namesById: Record<string, string>;
  studyingIds: string[];
  /* Where each entrant stood when this device first saw them today — their
     grid slot. Movement on the board is shown against this rather than against
     the previous poll, which is almost always "no change" and says nothing. */
  openingPositionById: Record<string, number>;

  /* ── Metrics ── */
  startPosition: number | null;
  bestPosition: number | null;
  worstPosition: number | null;
  overtakes: number;
  timesPassed: number;
  msInFirst: number;
  /** When the current spell in P1 began, or null if not leading. */
  firstSince: number | null;
  leadChanges: number;
  biggestLeadMin: number;
  biggestDeficitMin: number;
  /** Best positions-recovered run of the day. */
  biggestComeback: number;

  /* ── Notification bookkeeping ── */
  firedDefend: number[];
  firedChase: number[];
  finalStretchDone: boolean;
  /** Per rival, when their session start was last announced. */
  rivalAnnounced: Record<string, number>;

  timeline: RaceEvent[];
}

export const emptyRaceDay = (date: string = getISTDateString()): RaceDay => ({
  date,
  lastSeenAt: 0,
  seeded: false,
  position: null,
  myMinutes: 0,
  leaderId: null,
  minutesById: {},
  namesById: {},
  studyingIds: [],
  openingPositionById: {},
  startPosition: null,
  bestPosition: null,
  worstPosition: null,
  overtakes: 0,
  timesPassed: 0,
  msInFirst: 0,
  firstSince: null,
  leadChanges: 0,
  biggestLeadMin: 0,
  biggestDeficitMin: 0,
  biggestComeback: 0,
  firedDefend: [],
  firedChase: [],
  finalStretchDone: false,
  rivalAnnounced: {},
  timeline: [],
});

/* A gap has to open back up past a threshold by this much before it can warn
   again, so a total sitting exactly on 30 minutes doesn't fire every poll. */
const REARM_MARGIN_MIN = 5;

/* Time between two observations is only credited to a position up to this
   much. A laptop shut at 22:00 and opened at 08:00 did not spend ten hours
   defending anything. */
const MAX_CREDIT_MS = 5 * 60 * 1000;

/** A rival's session start is worth mentioning once, then not again for a while. */
const RIVAL_REANNOUNCE_MS = 60 * 60 * 1000;

/** Top-two gap that counts as undecided in the last hour. */
const FINAL_STRETCH_MIN = 20;

const TIMELINE_CAP = 60;

let seq = 0;
const eventId = (at: number): string => `${at}-${(seq = (seq + 1) % 100000)}`;

/** Thresholds a gap is already under — treated as fired without announcing. */
const alreadyInside = (gap: number | null): number[] =>
  gap === null ? [] : GAP_THRESHOLDS.filter(t => gap <= t);

/**
 * Fold the current race into the day's record.
 *
 * The first observation of a day only seeds the baseline: opening the app
 * already in P1 is not "reaching first place", and a board that has been
 * running for six hours must not fire six hours of history at once.
 */
export const advanceRaceDay = (
  prev: RaceDay,
  race: RaceState,
  now: number = Date.now()
): { day: RaceDay; events: RaceEvent[] } => {
  const day: RaceDay = prev.date === race.date ? { ...prev } : emptyRaceDay(race.date);
  const events: RaceEvent[] = [];

  const me = race.me;
  const position = race.position;

  /* Snapshot of the field, taken whether or not anything is emitted. */
  const minutesById: Record<string, number> = {};
  const namesById: Record<string, string> = {};
  race.entrants.forEach(r => {
    minutesById[r.userId] = r.minutes;
    namesById[r.userId] = r.name;
  });
  const studyingIds = race.entrants.filter(r => r.studying && !r.isMe).map(r => r.userId);

  const commit = (): { day: RaceDay; events: RaceEvent[] } => {
    day.lastSeenAt = now;
    day.position = position;
    day.myMinutes = me?.minutes ?? day.myMinutes;
    day.leaderId = race.leader?.userId ?? null;
    day.minutesById = minutesById;
    day.namesById = { ...day.namesById, ...namesById };
    day.studyingIds = studyingIds;
    // A grid slot is claimed once and never rewritten.
    race.entrants.forEach(r => {
      if (day.openingPositionById[r.userId] === undefined) {
        day.openingPositionById = { ...day.openingPositionById, [r.userId]: r.position };
      }
    });
    day.seeded = true;
    if (events.length) {
      day.timeline = [...day.timeline, ...events].slice(-TIMELINE_CAP);
    }
    return { day, events };
  };

  if (!me || position === null) {
    // Not on the board (yet). Nothing to narrate, but keep the clock honest.
    day.firstSince = null;
    return commit();
  }

  /* ── Time in first ── credited for the interval just ended, not the one
     starting, so a poll that arrives late doesn't award time in advance. */
  if (day.seeded && day.position === 1 && day.lastSeenAt) {
    day.msInFirst += Math.min(MAX_CREDIT_MS, Math.max(0, now - day.lastSeenAt));
  }
  day.firstSince = position === 1 ? (day.position === 1 ? day.firstSince ?? now : now) : null;

  /* ── The two gaps everything else is measured against ──
     Read before the seed check, because a record set at the moment the app
     opens is still today's record. Skipping it made a two-hour lead already on
     screen invisible, and then announced a later one-hour lead as the biggest
     of the day. */
  const defendGap = position === 1 ? race.lead : null;
  const chaseGap = race.gapToAhead;

  if (!day.seeded) {
    day.startPosition = position;
    day.bestPosition = position;
    day.worstPosition = position;
    day.biggestLeadMin = defendGap ?? 0;
    day.biggestDeficitMin = race.gapToLeader ?? 0;
    /* Thresholds the race is already inside are counted as spent. A gap of 10
       minutes at the moment the app opens is a fact about the board, not
       something that just happened — warning about it would make the very first
       poll of every session shout. */
    day.firedDefend = alreadyInside(defendGap);
    day.firedChase = alreadyInside(chaseGap);
    return commit();
  }

  const before = day.position;
  const wasLeading = before === 1;
  const isLeading = position === 1;

  /* ── Who changed sides ──
     Only people on the board both then and now: someone who joined or left is
     not an overtake, and treating them as one would be the most obvious way to
     make the whole feature feel fake. */
  const shared = race.entrants.filter(r => !r.isMe && day.minutesById[r.userId] !== undefined);
  const wasAbove = (id: string) => day.minutesById[id] > day.myMinutes;
  const passedByMe = shared.filter(r => wasAbove(r.userId) && r.minutes < me.minutes).map(r => r.name);
  const passedMe = shared.filter(r => !wasAbove(r.userId) && r.minutes > me.minutes).map(r => r.name);

  if (passedByMe.length) {
    day.overtakes += passedByMe.length;
    events.push({ kind: 'overtook', id: eventId(now), at: now, names: passedByMe, position });
  }
  if (passedMe.length) {
    day.timesPassed += passedMe.length;
    events.push({ kind: 'passed_by', id: eventId(now), at: now, names: passedMe, position });
  }

  if (!wasLeading && isLeading) {
    day.leadChanges += 1;
    events.push({ kind: 'took_lead', id: eventId(now), at: now, from: before });
  } else if (wasLeading && !isLeading) {
    day.leadChanges += 1;
    events.push({
      kind: 'lost_lead',
      id: eventId(now),
      at: now,
      to: race.leader?.name ?? 'someone',
      position,
    });
  } else if (
    !isLeading &&
    race.leader &&
    day.leaderId &&
    race.leader.userId !== day.leaderId &&
    race.leader.userId !== me.userId
  ) {
    // P1 changed hands above me — context, not something that happened to me.
    events.push({ kind: 'leader_changed', id: eventId(now), at: now, name: race.leader.name });
  }

  /* ── My own total moving ── which only ever happens by logging a session. */
  const gainedMinutes = me.minutes - day.myMinutes;
  if (gainedMinutes >= 1) {
    events.push({
      kind: 'session_banked',
      id: eventId(now),
      at: now,
      minutes: gainedMinutes,
      position,
      gained: before !== null ? Math.max(0, before - position) : 0,
    });
  }

  /* ── Gap thresholds ──
     Two independent ladders: the lead being eaten into, and the gap ahead
     closing. Each rung fires once, and re-arms only once the gap has opened
     back past it with room to spare. */
  const ladder = (
    gap: number | null,
    fired: number[],
    make: (threshold: number, minutes: number) => RaceEvent
  ): number[] => {
    if (gap === null) return fired;
    let next = fired.filter(t => gap <= t + REARM_MARGIN_MIN);
    for (const t of GAP_THRESHOLDS) {
      if (gap <= t && !next.includes(t)) {
        // Only the tightest newly-crossed rung is worth saying out loud.
        const tighter = GAP_THRESHOLDS.filter(o => o < t && gap <= o && !next.includes(o));
        next = [...next, t];
        if (!tighter.length) events.push(make(t, gap));
      }
    }
    return next;
  };

  day.firedDefend = ladder(defendGap, day.firedDefend, (threshold, minutes) => ({
    kind: 'defend_gap',
    id: eventId(now),
    at: now,
    minutes,
    threshold,
    name: race.runnerUp?.name ?? null,
  }));

  day.firedChase = ladder(chaseGap, day.firedChase, (threshold, minutes) => ({
    kind: 'chase_gap',
    id: eventId(now),
    at: now,
    minutes,
    threshold,
    name: race.ahead?.name ?? null,
    forLead: (race.ahead?.position ?? 0) === 1,
  }));

  /* ── A neighbour going on the clock ──
     Only the people either side of me, and only once an hour each: this is the
     one signal that can arrive without anything having changed on the board,
     so it has to stay rare to stay meaningful. */
  const neighbours = [race.ahead, race.behind].filter(Boolean) as NonNullable<typeof race.ahead>[];
  neighbours.forEach(r => {
    if (!r.studying || day.studyingIds.includes(r.userId)) return;
    const last = day.rivalAnnounced[r.userId] ?? 0;
    if (now - last < RIVAL_REANNOUNCE_MS) return;
    day.rivalAnnounced = { ...day.rivalAnnounced, [r.userId]: now };
    events.push({
      kind: 'rival_started',
      id: eventId(now),
      at: now,
      name: r.name,
      minutes: Math.abs(r.minutes - me.minutes),
      ahead: r.minutes > me.minutes,
    });
  });

  /* ── Records ── */
  if (defendGap !== null && defendGap > day.biggestLeadMin) {
    const previous = day.biggestLeadMin;
    day.biggestLeadMin = defendGap;
    /* Only worth announcing once it is a real cushion and a real improvement,
       otherwise every logged minute sets a new record while leading. */
    if (defendGap >= 30 && defendGap - previous >= 15) {
      events.push({ kind: 'best_lead', id: eventId(now), at: now, minutes: defendGap });
    }
  }
  if (race.gapToLeader !== null && race.gapToLeader > day.biggestDeficitMin) {
    day.biggestDeficitMin = race.gapToLeader;
  }
  day.bestPosition = day.bestPosition === null ? position : Math.min(day.bestPosition, position);
  day.worstPosition = day.worstPosition === null ? position : Math.max(day.worstPosition, position);
  if (day.worstPosition !== null) {
    day.biggestComeback = Math.max(day.biggestComeback, day.worstPosition - position);
  }

  /* ── Final stretch ── one line, once, and only if it is genuinely close. */
  if (
    !day.finalStretchDone &&
    isFinalHour(now) &&
    race.fieldSize >= 2 &&
    race.leader &&
    race.runnerUp
  ) {
    const top2 = race.leader.minutes - race.runnerUp.minutes;
    if (top2 <= FINAL_STRETCH_MIN && (position === 1 || position === race.runnerUp.position)) {
      day.finalStretchDone = true;
      events.push({ kind: 'final_stretch', id: eventId(now), at: now, minutes: top2 });
    }
  }

  return commit();
};

/** Minutes still to find to take the place above. */
export const minutesToNextPlace = (race: RaceState): number | null =>
  race.gapToAhead === null ? null : race.gapToAhead + 1;

/** Whether the gap is inside a single focus block. */
export const withinOneBlock = (minutes: number): boolean => minutes <= POMODORO_MIN;

/* ── Persistence ──
   Device-local on purpose. This is a viewing record, and syncing it would mean
   two devices arguing about who saw what. */

const DAY_KEY = 'race_day_v1';
/* The last COMPLETED day, kept so the recap has something to report. Only one
   day is retained — a recap is about yesterday, and an archive of every race
   the user has ever run is a different feature with a different cost. */
const PREV_KEY = 'race_day_prev_v1';

export const loadRaceDay = (date: string = getISTDateString()): RaceDay => {
  try {
    const raw = localStorage.getItem(DAY_KEY);
    if (!raw) return emptyRaceDay(date);
    const parsed = JSON.parse(raw) as RaceDay;
    // A record from yesterday is not a record of today's race — but it is
    // exactly what the recap wants, so retire it rather than dropping it.
    if (parsed.date !== date) {
      if (parsed.seeded) {
        try { localStorage.setItem(PREV_KEY, raw); } catch { /* not worth failing over */ }
      }
      return emptyRaceDay(date);
    }
    return { ...emptyRaceDay(date), ...parsed };
  } catch {
    return emptyRaceDay(date);
  }
};

/**
 * The last completed race day, or null if there isn't one worth showing.
 *
 * Returns null for today's own record (the race is still running) and for any
 * day the user never actually appeared on the board — a recap of a race you
 * did not enter is noise.
 */
export const loadPreviousRaceDay = (today: string = getISTDateString()): RaceDay | null => {
  try {
    const raw = localStorage.getItem(PREV_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RaceDay;
    if (!parsed.date || parsed.date === today) return null;
    if (!parsed.seeded || parsed.startPosition === null) return null;
    return { ...emptyRaceDay(parsed.date), ...parsed };
  } catch {
    return null;
  }
};

export const saveRaceDay = (day: RaceDay): void => {
  try {
    localStorage.setItem(DAY_KEY, JSON.stringify(day));
  } catch {
    // Nothing here is worth failing a render over.
  }
};
