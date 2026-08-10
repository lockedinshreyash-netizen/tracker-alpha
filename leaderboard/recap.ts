/**
 * Yesterday's race, told back to one person.
 *
 * Every number here comes from that device's own RaceDay record, so two users
 * who ran the same race get genuinely different summaries — different
 * headline, different verdict, different stats. There is no shared blurb.
 *
 * Pure and total: give it a RaceDay, get a Recap. No storage, no clock beyond
 * the date passed in, so it can be tested directly.
 */

import { RaceDay } from './raceDay';
import { formatGap } from './engine';

export type RecapTone = 'good' | 'bad' | 'neutral';

export interface RecapLine {
  label: string;
  value: string;
  tone: RecapTone;
}

export interface Recap {
  date: string;
  /** Relative when it is genuinely yesterday, otherwise the date itself. */
  when: string;
  /** The one thing that defined their day. Uppercase, blunt. */
  headline: string;
  /** Why that happened, in their terms. */
  verdict: string;
  /** Sentiment of the HEADLINE, which is not always the sign of `movement` —
      climbing two places while losing the lead is not a good day. */
  tone: RecapTone;
  lines: RecapLine[];
  /** Positions gained across the day. Negative means they slipped. */
  movement: number;
  finishPosition: number | null;
}

const msToLabel = (ms: number): string => {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const dayBefore = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Build the summary. Returns null when the day holds nothing worth reporting —
 * the user never made it onto the board, so there is no race to recap.
 */
export const summariseRaceDay = (day: RaceDay, today: string): Recap | null => {
  const finish = day.position;
  const start = day.startPosition;
  if (start === null || finish === null) return null;

  const movement = start - finish; // positive = climbed
  const ledFor = day.msInFirst;
  const finishedFirst = finish === 1;

  /* Headline: the single most notable fact about THEIR day, checked in order of
     how much it would have dominated their experience of it. */
  let headline: string;
  let verdict: string;
  let tone: RecapTone;

  if (finishedFirst && ledFor > 0) {
    headline = 'YOU FINISHED ON TOP';
    verdict = `You held first for ${msToLabel(ledFor)} and nobody took it back.`;
    tone = 'good';
  } else if (ledFor > 0) {
    headline = `YOU LED FOR ${msToLabel(ledFor).toUpperCase()}, THEN LOST IT`;
    verdict = `You were P1 at some point and finished ${ordinalish(finish)}. ${day.leadChanges > 1 ? `The lead changed hands ${day.leadChanges} times.` : 'It only had to slip once.'}`;
    // Mixed: they may have climbed overall yet still surrendered the lead.
    tone = 'neutral';
  } else if (day.biggestComeback >= 2) {
    headline = `YOU CLAWED BACK ${day.biggestComeback} PLACES`;
    verdict = `Your best run of the day. You finished ${ordinalish(finish)} after starting ${ordinalish(start)}.`;
    tone = 'good';
  } else if (movement > 0) {
    headline = `YOU MOVED UP ${movement}`;
    verdict = `Started ${ordinalish(start)}, finished ${ordinalish(finish)}. ${day.overtakes > 0 ? `${day.overtakes} overtake${day.overtakes === 1 ? '' : 's'} on the day.` : ''}`.trim();
    tone = 'good';
  } else if (movement < 0) {
    headline = `YOU DROPPED ${Math.abs(movement)}`;
    verdict = `Started ${ordinalish(start)}, finished ${ordinalish(finish)}. ${day.timesPassed > 0 ? `You were passed ${day.timesPassed} time${day.timesPassed === 1 ? '' : 's'} while you were away.` : 'Others banked hours and you did not.'}`;
    tone = 'bad';
  } else {
    headline = `YOU HELD ${ordinalish(finish)}`;
    verdict = day.overtakes || day.timesPassed
      ? `Same place you started, but it moved underneath you — ${day.overtakes} up, ${day.timesPassed} down.`
      : 'Flat day. Nobody moved and neither did you.';
    tone = 'neutral';
  }

  const lines: RecapLine[] = [
    {
      label: 'Start → finish',
      value: `${ordinalish(start)} → ${ordinalish(finish)}`,
      tone: movement > 0 ? 'good' : movement < 0 ? 'bad' : 'neutral',
    },
    {
      label: 'Best position',
      value: day.bestPosition !== null ? ordinalish(day.bestPosition) : '—',
      tone: day.bestPosition !== null && day.bestPosition < start ? 'good' : 'neutral',
    },
    {
      label: 'Hours banked',
      value: formatGap(day.myMinutes),
      tone: day.myMinutes > 0 ? 'good' : 'bad',
    },
    {
      label: 'Overtakes',
      value: String(day.overtakes),
      tone: day.overtakes > 0 ? 'good' : 'neutral',
    },
    {
      label: 'Times passed',
      value: String(day.timesPassed),
      tone: day.timesPassed > 0 ? 'bad' : 'neutral',
    },
  ];

  if (ledFor > 0) {
    lines.push({ label: 'Time in first', value: msToLabel(ledFor), tone: 'good' });
  }
  if (day.biggestLeadMin > 0) {
    lines.push({ label: 'Biggest lead', value: formatGap(day.biggestLeadMin), tone: 'good' });
  } else if (day.biggestDeficitMin > 0) {
    lines.push({ label: 'Biggest deficit', value: formatGap(day.biggestDeficitMin), tone: 'bad' });
  }

  return {
    date: day.date,
    when: day.date === dayBefore(today) ? 'Yesterday' : day.date,
    headline,
    verdict,
    tone,
    lines,
    movement,
    finishPosition: finish,
  };
};

const ordinalish = (position: number): string => `P${position}`;
