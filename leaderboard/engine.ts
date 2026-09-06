/* ── Race Control ──
   Turns a list of rows into the state of a race: who is where, how far apart
   they are, who is on the clock, and what the user could still do about it.

   Everything here is pure. The board arrives from the network, the running
   session comes from local state, and this file does nothing but arithmetic —
   so every message, card and notification downstream is derived from one
   agreed picture of the race rather than each recomputing its own.

   Gaps are in minutes throughout. The board stores hours because that is what
   people compare, but every interesting gap is a session length, and "0.4h
   behind" means nothing to anyone. */

import { LeaderboardRow } from './api';
import { toStudyDayInstant } from '../utils';

/** The unit the whole app measures a gap in: one focus block. */
export const POMODORO_MIN = 25;

/* Gap sizes worth telling someone about, largest first. Each one fires at most
   once per direction per day, and only re-arms if the gap opens back up past
   it — see raceDay.ts. */
export const GAP_THRESHOLDS: readonly number[] = [45, 30, 15, 5];

/* A row is only refreshed while the app is open, so `is_studying` is a claim
   with a shelf life. Past this, the light goes out no matter what the flag says
   — a closed laptop must not read as a rival grinding away. */
export const STALE_ACTIVITY_MS = 6 * 60 * 1000;

/** Long enough without banking any time to count as "gone quiet". */
export const QUIET_MS = 90 * 60 * 1000;

export interface Racer {
  userId: string;
  name: string;
  hours: number;
  /** Ranked minutes on the board. The only figure positions are decided on. */
  minutes: number;
  /** 1-based. Equal totals share a position, so 1, 2, 2, 4. */
  position: number;
  isMe: boolean;
  /** On the clock right now, and recently enough to believe it. */
  studying: boolean;
  /** How long they've been in the current session, or null if not studying. */
  sessionMinutes: number | null;
  /** Since they last banked time. Null when the board can't say. */
  quietMinutes: number | null;
}

export interface RaceState {
  /** IST date this race belongs to. Everything resets when it changes. */
  date: string;
  entrants: Racer[];
  fieldSize: number;

  me: Racer | null;
  position: number | null;
  leader: Racer | null;
  /** P2 — who the leader is actually defending against. */
  runnerUp: Racer | null;
  /** Nearest entrant strictly above me, and strictly below. */
  ahead: Racer | null;
  behind: Racer | null;
  /** Whoever is closest in either direction — the person to watch. */
  rival: Racer | null;

  /** Minutes. Null when the question doesn't apply (no field, no rival). */
  gapToLeader: number | null;
  gapToAhead: number | null;
  gapToBehind: number | null;
  /* My margin over the next total down, when I'm leading. Null when there is
     nothing to measure against: an empty board, or a dead heat where everyone
     on it has exactly the same total. */
  lead: number | null;

  isLeading: boolean;
  /** More than one entrant is level at the top, mine among them. */
  tiedAtTop: boolean;
  /** Others (not me) within one Pomodoro of my total, either side. */
  withinOnePomodoro: number;
  /** Others on the clock right now. */
  studyingNow: number;
  /** Nobody above me has banked time in a long while. */
  quietAbove: boolean;

  /* ── The session in my hands right now ──
     Board hours only move when a session is logged, so someone 40 minutes into
     a block looks stalled to everyone including themselves. These say what the
     unlogged time would be worth if it landed now. */
  iAmStudying: boolean;
  pendingMinutes: number;
  projectedPosition: number | null;
  projectedGain: number;
  /** True when banking the running session would take P1. */
  pendingWinsLead: boolean;

  /** The board came back without its activity columns — see fetchBoard. */
  degraded: boolean;
}

export const minutesOf = (hours: number): number => Math.round(hours * 60);

/** "1h 24m" / "48m". The one place a gap becomes words. */
export const formatGap = (minutes: number): string => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
};

const parseTime = (value?: string | null): number | null => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : t;
};

/** Standard competition ranking: equal totals share a position. */
const positionsFor = (sorted: { minutes: number }[]): number[] => {
  const out: number[] = [];
  sorted.forEach((row, i) => {
    out.push(i > 0 && row.minutes === sorted[i - 1].minutes ? out[i - 1] : i + 1);
  });
  return out;
};

interface BuildOptions {
  myUserId: string | null;
  /** My own total, from local logs — always fresher than my published row. */
  myMinutes: number;
  myName: string;
  /** Unlogged minutes sitting in a running stopwatch or Pomodoro block. */
  pendingMinutes: number;
  iAmStudying: boolean;
  date: string;
  degraded?: boolean;
  now?: number;
}

/**
 * The race, as of now.
 *
 * My own row is taken from local state rather than from the board: publishing
 * is debounced, and a user who has just ended a session must not be told they
 * are still behind by the time they can read it. Everyone else's row is
 * whatever the board last said.
 */
export const buildRaceState = (rows: LeaderboardRow[], opts: BuildOptions): RaceState => {
  const now = opts.now ?? Date.now();
  const { myUserId } = opts;

  const others = rows
    .filter(r => r.user_id !== myUserId)
    .map(r => {
      const updatedAt = parseTime(r.updated_at);
      const activeSince = parseTime(r.active_since);
      const lastGain = parseTime(r.last_gain_at);
      /* Without updated_at there is no way to date the claim, so it isn't
         believed at all. Better a board with no lights than a board of ghosts. */
      const fresh = updatedAt !== null && now - updatedAt < STALE_ACTIVITY_MS;
      const studying = Boolean(r.is_studying) && fresh;
      return {
        userId: r.user_id,
        name: r.display_name,
        hours: Number(r.hours) || 0,
        minutes: minutesOf(Number(r.hours) || 0),
        isMe: false,
        studying,
        sessionMinutes: studying && activeSince ? Math.max(0, Math.round((now - activeSince) / 60000)) : null,
        quietMinutes: lastGain === null ? null : Math.max(0, Math.round((now - lastGain) / 60000)),
      };
    });

  const mine = myUserId
    ? {
      userId: myUserId,
      name: opts.myName || 'You',
      hours: opts.myMinutes / 60,
      minutes: opts.myMinutes,
      isMe: true,
      studying: opts.iAmStudying,
      sessionMinutes: opts.iAmStudying ? opts.pendingMinutes : null,
      quietMinutes: null,
    }
    : null;

  const field = mine ? [...others, mine] : others;
  /* Name as the tiebreak, so a board of equal totals doesn't reshuffle between
     polls and manufacture overtakes out of nothing. */
  field.sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name));

  const positions = positionsFor(field);
  const entrants: Racer[] = field.map((r, i) => ({ ...r, position: positions[i] }));

  const me = entrants.find(r => r.isMe) ?? null;
  const leader = entrants[0] ?? null;
  const runnerUp = entrants.find(r => leader && r.minutes < leader.minutes) ?? null;

  const ahead = me ? [...entrants].reverse().find(r => r.minutes > me.minutes) ?? null : null;
  const behind = me ? entrants.find(r => r.minutes < me.minutes) ?? null : null;

  const gapToAhead = me && ahead ? ahead.minutes - me.minutes : null;
  const gapToBehind = me && behind ? me.minutes - behind.minutes : null;
  // Position, not identity: a dead heat at the top means both of them lead.
  const isLeading = me?.position === 1;
  const gapToLeader = me && leader ? Math.max(0, leader.minutes - me.minutes) : null;
  /* Strictly a margin over someone. Leading a board of one is not a two-hour
     lead, and being level at the top is not a lead at all — both would
     otherwise report the user's own total as their advantage. */
  const lead = isLeading && me && runnerUp ? me.minutes - runnerUp.minutes : null;

  const withinOnePomodoro = me
    ? entrants.filter(r => !r.isMe && Math.abs(r.minutes - me.minutes) <= POMODORO_MIN).length
    : 0;

  /* "Nobody above you has studied recently" — only claimed when every single
     person above has a datable last gain. One unknown and the app says nothing,
     because the whole point of the line is that the door is open. */
  const above = me ? entrants.filter(r => r.minutes > me.minutes) : [];
  const quietAbove =
    above.length > 0 &&
    above.every(r => !r.studying && r.quietMinutes !== null && r.quietMinutes >= QUIET_MS / 60000);

  /* Where banking the running session right now would put me. Ties go to the
     incumbent: matching someone's total does not pass them. */
  let projectedPosition: number | null = null;
  if (me) {
    const projected = me.minutes + opts.pendingMinutes;
    projectedPosition = entrants.filter(r => !r.isMe && r.minutes > projected).length + 1;
  }
  const projectedGain = me && projectedPosition !== null ? Math.max(0, me.position - projectedPosition) : 0;

  return {
    date: opts.date,
    entrants,
    fieldSize: entrants.length,
    me,
    position: me?.position ?? null,
    leader,
    runnerUp,
    ahead,
    behind,
    rival:
      gapToAhead !== null && (gapToBehind === null || gapToAhead <= gapToBehind) ? ahead : behind,
    gapToLeader,
    gapToAhead,
    gapToBehind,
    lead,
    isLeading,
    tiedAtTop: isLeading && entrants.filter(r => r.position === 1).length > 1,
    withinOnePomodoro,
    studyingNow: entrants.filter(r => !r.isMe && r.studying).length,
    quietAbove,
    iAmStudying: opts.iAmStudying,
    pendingMinutes: opts.pendingMinutes,
    projectedPosition,
    projectedGain,
    pendingWinsLead: Boolean(me && !isLeading && projectedPosition === 1 && opts.pendingMinutes > 0),
    degraded: Boolean(opts.degraded),
  };
};

/** How many Pomodoros would close this gap. Always at least one. */
export const pomodorosToClose = (minutes: number): number =>
  Math.max(1, Math.ceil(minutes / POMODORO_MIN));

/** True while the day is close enough to over that the gaps stop being theoretical.
 *  Measured against the study day, so this is 03:00–03:59 IST, not 23:00. */
export const isFinalHour = (now: number = Date.now()): boolean => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hour12: false,
    }).format(toStudyDayInstant(new Date(now)))
  );
  return hour === 23;
};
