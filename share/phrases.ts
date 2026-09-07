/**
 * The one small line of copy on a card.
 *
 * Deterministic. The same numbers always produce the same phrase, so a card
 * regenerated tomorrow for the same day is the same card — a caption that
 * reshuffles on every render turns the artifact into a slot machine, and the
 * user notices the second time they open the sheet.
 *
 * The tone is editorial caption, not motivation: the biggest day gets the
 * quietest line, and a thin month says `More in me.` rather than apologising or
 * cheering. Nothing here congratulates the user — the numbers above it already
 * did, and saying it twice is what makes a card read as an advertisement.
 */

import { CardData } from './types';

/** How the period went, measured against what the user asked of themselves. */
const ratioOf = (totalHours: number, goalHours: number, days: number): number => {
  const expected = Math.max(0.1, goalHours) * Math.max(1, days);
  return totalHours / expected;
};

export const phraseFor = (data: CardData, dailyGoalHours: number): string => {
  const goal = dailyGoalHours > 0 ? dailyGoalHours : 8;

  if (data.period === 'daily') {
    const hours = data.duration.totalHours;
    if (hours <= 0) return 'Tomorrow, then.';
    const r = hours / Math.max(0.1, goal);
    if (r >= 1.5) return 'Quiet work.';
    if (r >= 1) return 'Built today.';
    if (r >= 0.5) return 'Good work today.';
    return 'Kept moving.';
  }

  if (data.period === 'weekly') {
    const hours = data.duration.totalHours;
    if (hours <= 0) return 'Still here.';
    // Perfect attendance outranks volume — showing up every day is the harder
    // thing, and it is the thing the weekly card exists to say.
    if (data.daysActive >= data.totalDays && data.totalDays >= 5) return 'Consistency compounds.';
    if (data.change !== null && data.change >= 15) return 'Same effort. Better results.';
    const r = ratioOf(hours, goal, data.totalDays);
    if (r >= 1) return 'Progress looks good on me.';
    if (r >= 0.6) return 'A good week.';
    return 'Kept showing up.';
  }

  const hours = data.duration.totalHours;
  if (hours <= 0) return 'Still here.';
  if (data.change !== null && data.change >= 25) return 'Getting somewhere.';
  const r = ratioOf(hours, goal, data.totalDays);
  if (r >= 1) return 'A month well spent.';
  if (r >= 0.6) return 'The work adds up.';
  return 'More in me.';
};

/** The serif line under the hero. Fixed per period — it names the timeframe. */
export const heroCaption = (period: CardData['period']): string =>
  period === 'daily' ? 'Studied Today.'
    : period === 'weekly' ? 'This Week.'
      : 'A Month of Progress.';
