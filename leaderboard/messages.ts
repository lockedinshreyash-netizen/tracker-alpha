/* ── The words ──
   Every string the race speaks is written here, and nowhere else. A card, a
   timeline row and a notification about the same moment must not drift apart,
   and there is exactly one place to argue about the tone.

   Two rules the copy is held to:

   1. Interpret, never report. "Gap: 18 minutes" is a fact about a database.
      "One block puts you in front" is a fact about the user's evening.
   2. Racing feeling, plain words. Someone who has never watched a race should
      read every line without translating anything. "P1" appears only next to
      "first place", never instead of it. */

import { POMODORO_MIN, RaceState, formatGap, pomodorosToClose } from './engine';
import { RaceEvent } from './raceDay';

export type StatusTone =
  /** Out in front, comfortably. */
  | 'lead'
  /** In front, but it is being taken away. */
  | 'threat'
  /** Behind, with the place above in reach. */
  | 'chase'
  /** Behind, but the road above is quiet. */
  | 'open'
  /** A session is running right now and it changes the standings. */
  | 'live'
  /** Nothing to race against yet. */
  | 'empty';

export interface RaceStatus {
  tone: StatusTone;
  icon: string;
  headline: string;
  line: string;
  /** The single thing that would change the picture. */
  cta?: string;
}

/** "#2" — the app's shorthand for a place, kept in one spot. */
export const ordinal = (position: number): string => `#${position}`;

const blocks = (minutes: number): string => {
  const n = pomodorosToClose(minutes);
  return n === 1 ? 'one focus block' : `${n} focus blocks`;
};

/** For the same phrase used at the start of a sentence. */
const sentence = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "One focus block keeps…" / "Three focus blocks keep…" — the verb has to follow. */
const blocksVerb = (minutes: number, singular: string, plural: string): string =>
  `${sentence(blocks(minutes))} ${pomodorosToClose(minutes) === 1 ? singular : plural}`;

/**
 * What is happening in today's race, in one card.
 *
 * Ordered by what the user most needs to know, not by what is most flattering:
 * a session in progress that changes the standings beats everything, then the
 * lead being under attack, then the chase.
 */
export const raceStatus = (race: RaceState): RaceStatus => {
  const { me, position, lead, gapToAhead, gapToLeader } = race;

  if (!me || position === null) {
    return {
      tone: 'empty',
      icon: '🏁',
      headline: 'You’re not on today’s board',
      line: 'The board counts time this app measured — stopwatch sessions and focus blocks. Start one and you’re in the race.',
    };
  }

  /* ── A session in the user's hands right now ──
     Board hours only move when a session ends, so someone 40 minutes into a
     block looks stalled to themselves. Say what the unlogged time is worth. */
  if (race.iAmStudying && race.pendingMinutes >= 1) {
    const pending = formatGap(race.pendingMinutes);
    if (race.pendingWinsLead) {
      return {
        tone: 'live',
        icon: '🔥',
        headline: 'This session takes you to first',
        line: `${pending} on the clock, not on the board yet. End it now and you lead today.`,
        cta: 'Finish the session to bank it',
      };
    }
    if (race.projectedGain > 0 && race.projectedPosition !== null) {
      return {
        tone: 'live',
        icon: '📈',
        headline: `This session moves you to ${ordinal(race.projectedPosition)}`,
        line: `${pending} on the clock. It counts the moment you end the session — not before.`,
        cta: `${race.projectedGain === 1 ? 'One place' : `${race.projectedGain} places`} waiting to be banked`,
      };
    }
    if (position === 1) {
      return {
        tone: 'live',
        icon: '👑',
        headline: 'Leading, and still working',
        line: `${pending} on the clock on top of a ${lead !== null ? formatGap(lead) : ''} lead. This is how it stays yours.`.replace('  ', ' '),
      };
    }
    if (gapToAhead !== null) {
      const short = Math.max(0, gapToAhead - race.pendingMinutes + 1);
      return {
        tone: 'live',
        icon: '⏱️',
        headline: 'You’re on the clock',
        line: `${pending} banked when you stop. ${formatGap(short)} more than that and you take ${ordinal(position - 1)}.`,
      };
    }
  }

  /* ── First place ── */
  if (position === 1) {
    if (race.fieldSize === 1) {
      return {
        tone: 'empty',
        icon: '🏁',
        headline: 'You’re the only one racing today',
        line: 'Nobody else has put a timed minute on the board. Build the gap before they do.',
      };
    }
    /* Level at the top, so there is no margin to report — and this is the most
       urgent version of first place there is, not the safest. */
    if (lead === null || race.tiedAtTop) {
      return {
        tone: 'threat',
        icon: '🏁',
        headline: 'Dead heat at the top',
        line: `You and ${race.entrants.find(r => r.position === 1 && !r.isMe)?.name ?? 'someone else'} are level on today’s board. The next session decides it.`,
        cta: 'One block breaks the tie',
      };
    }
    const margin = lead;
    if (margin <= 15) {
      return {
        tone: 'threat',
        icon: '⚠️',
        headline: 'One block could cost you first place',
        line: `Your lead is down to ${formatGap(margin)}. ${race.runnerUp ? `${race.runnerUp.name} is` : 'Second place is'} one session from the front.`,
        cta: 'Get back on the clock',
      };
    }
    if (margin <= 45) {
      return {
        tone: 'threat',
        icon: '🏁',
        headline: 'Your lead is shrinking',
        line: `${race.runnerUp ? race.runnerUp.name : 'Second place'} is ${formatGap(margin)} behind. Defend first place.`,
        cta: `${blocksVerb(margin, 'keeps', 'keep')} you clear`,
      };
    }
    return {
      tone: 'lead',
      icon: '👑',
      headline: 'You’re leading today',
      line: `You’re ${formatGap(margin)} ahead of ${race.runnerUp ? race.runnerUp.name : 'second place'}. Keep the momentum.`,
    };
  }

  /* ── Everyone else ── */
  const toLead = gapToLeader ?? 0;
  const toNext = gapToAhead ?? 0;

  if (toLead > 0 && toLead <= POMODORO_MIN) {
    return {
      tone: 'chase',
      icon: '🔥',
      headline: 'First place is within reach',
      line: `You’re ${formatGap(toLead)} behind ${race.leader ? race.leader.name : 'the leader'}. One focus block could put you in front.`,
      cta: 'Start a session',
    };
  }

  if (race.quietAbove) {
    const quiet = race.ahead?.quietMinutes ?? 0;
    return {
      tone: 'open',
      icon: '🚀',
      headline: 'Nobody above you has studied in hours',
      line: `${race.ahead ? race.ahead.name : 'The place above'} last banked time ${formatGap(quiet)} ago. ${blocksVerb(toNext, 'takes', 'take')} ${ordinal(position - 1)}.`,
      cta: 'The door is open',
    };
  }

  if (toNext > 0 && toNext <= POMODORO_MIN) {
    return {
      tone: 'chase',
      icon: '⚡',
      headline: `${formatGap(toNext)} from ${ordinal(position - 1)}`,
      line: `That’s all that separates you from ${race.ahead ? race.ahead.name : 'the place above'}. One block settles it.`,
      cta: 'Start a session',
    };
  }

  if (race.withinOnePomodoro >= 2) {
    return {
      tone: 'chase',
      icon: '⚡',
      headline: `${race.withinOnePomodoro} people are within one block of you`,
      line: 'This part of the board is going to move today. The only question is which way.',
      cta: 'Start a session',
    };
  }

  return {
    tone: 'chase',
    icon: '🏁',
    headline: `You’re ${ordinal(position)} of ${race.fieldSize}`,
    line: toNext > 0
      ? `${formatGap(toNext)} to ${race.ahead ? race.ahead.name : ordinal(position - 1)} — ${blocks(toNext)}. ${formatGap(toLead)} to the front.`
      : 'Put a timed session on the board and you start climbing.',
    cta: toNext > 0 ? `${blocksVerb(toNext, 'moves', 'move')} you up` : 'Start a session',
  };
};

export interface EventCopy {
  icon: string;
  /** Short enough for a timeline row. */
  headline: string;
  /** Context. Omitted where the headline says everything. */
  line?: string;
  /** Green-flag moments are styled differently from red-flag ones. */
  good: boolean;
}

const list = (names: string[]): string =>
  names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** One event, in words. Used by the race control cards and the timeline alike. */
export const describeEvent = (e: RaceEvent): EventCopy => {
  switch (e.kind) {
    case 'took_lead':
      return {
        icon: '👑',
        headline: 'You reached first place',
        line: 'Today’s board is yours. Now defend it.',
        good: true,
      };

    case 'lost_lead':
      return {
        icon: '📉',
        headline: `You lost first place to ${e.to}`,
        line: `You’re ${ordinal(e.position)} now. It’s not over.`,
        good: false,
      };

    case 'overtook':
      return {
        icon: '🏁',
        headline: `You passed ${list(e.names)}`,
        line: `That puts you ${ordinal(e.position)}.`,
        good: true,
      };

    case 'passed_by':
      return {
        icon: '📉',
        headline: `${list(e.names)} passed you`,
        line: `You slipped to ${ordinal(e.position)}.`,
        good: false,
      };

    case 'leader_changed':
      return {
        icon: '🔁',
        headline: `${e.name} took the lead`,
        line: 'First place changed hands.',
        good: true,
      };

    case 'defend_gap':
      return {
        icon: e.threshold <= 15 ? '⚠️' : '🏁',
        headline: `Your lead is down to ${formatGap(e.minutes)}`,
        line: e.threshold <= 15
          ? `${e.name ?? 'Second place'} is one block from taking it.`
          : 'Defend first place.',
        good: false,
      };

    case 'chase_gap':
      return {
        icon: e.minutes <= POMODORO_MIN ? '🔥' : '⚡',
        headline: e.forLead
          ? `${formatGap(e.minutes)} from first place`
          : `${formatGap(e.minutes)} from the place above`,
        line: e.minutes <= POMODORO_MIN
          ? 'One focus block could do it.'
          : `${blocksVerb(e.minutes, 'closes', 'close')} it${e.name ? ` on ${e.name}` : ''}.`,
        good: true,
      };

    case 'rival_started':
      return {
        icon: '🔴',
        headline: `${e.name} just started a session`,
        line: e.ahead
          ? `They’re ${formatGap(e.minutes)} ahead and pulling away.`
          : `They’re ${formatGap(e.minutes)} behind you and closing.`,
        good: false,
      };

    case 'best_lead':
      return {
        icon: '🚀',
        headline: `Your biggest lead today: ${formatGap(e.minutes)}`,
        good: true,
      };

    case 'session_banked':
      return {
        icon: '⏱️',
        headline: `You banked ${formatGap(e.minutes)}`,
        line: e.gained > 0
          ? `Up ${e.gained} ${e.gained === 1 ? 'place' : 'places'} to ${ordinal(e.position)}.`
          : `Still ${ordinal(e.position)}.`,
        good: true,
      };

    case 'final_stretch':
      return {
        icon: '🏁',
        headline: `${formatGap(e.minutes)} separates first and second`,
        line: 'Last hour of the day. Today’s winner is still undecided.',
        good: true,
      };
  }
};

export interface NotificationCopy {
  title: string;
  body: string;
}

/**
 * An event as a notification.
 *
 * Deliberately different from the in-app copy: a card is read next to the
 * board, where the standings are visible. A notification arrives on a lock
 * screen with no context, so it has to carry the number *and* what to do
 * about it in two lines.
 */
export const notificationFor = (e: RaceEvent, race: RaceState): NotificationCopy | null => {
  switch (e.kind) {
    case 'took_lead':
      return {
        title: '👑 You’re leading today’s board',
        body: race.lead ? `${formatGap(race.lead)} clear of second place. Now defend it.` : 'First place is yours.',
      };

    case 'lost_lead':
      return {
        title: `📉 You slipped to ${ordinal(e.position)}`,
        body: `${e.to} passed you on today’s board. ${race.gapToAhead !== null ? `${formatGap(race.gapToAhead)} to get it back.` : ''}`.trim(),
      };

    case 'passed_by':
      return {
        title: `📉 ${list(e.names)} passed you`,
        body: `You’re ${ordinal(e.position)}. ${race.gapToAhead !== null ? `${sentence(blocks(race.gapToAhead))} to take it back.` : ''}`.trim(),
      };

    case 'overtook':
      return {
        title: `🏁 You passed ${list(e.names)}`,
        body: `${ordinal(e.position)} on today’s board.`,
      };

    case 'defend_gap':
      return {
        title: `🏁 Your lead is down to ${formatGap(e.minutes)}`,
        body: e.threshold <= 15
          ? 'One focus block could cost you first place. Defend it.'
          : `${e.name ?? 'Second place'} is closing. Defend first place.`,
      };

    case 'chase_gap':
      return {
        title: e.minutes <= POMODORO_MIN
          ? `🔥 ${formatGap(e.minutes)} from ${e.forLead ? 'first place' : 'the place above'}`
          : `⚡ ${formatGap(e.minutes)} to ${e.forLead ? 'first place' : 'the next place'}`,
        body: e.minutes <= POMODORO_MIN
          ? 'One focus block could put you in front.'
          : `${sentence(blocks(e.minutes))} and it’s yours.`,
      };

    case 'final_stretch':
      return {
        title: `🏁 ${formatGap(e.minutes)} separates first and second`,
        body: 'Last hour of the day. Today’s winner is still undecided.',
      };

    default:
      // Everything else is colour for the app, not news for a lock screen.
      return null;
  }
};

/** "11:32" in IST — the timeline reads in the user's own day. */
export const clockLabel = (at: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(at));
