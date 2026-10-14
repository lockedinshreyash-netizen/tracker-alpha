/* ── Firewood, on screen ──
   The icon (two logs and a flame) and the Streak tab's card: how many are in
   the bank, whether the streak is on firewood right now, and whether this
   week's three have been earned. The rules live in streak/firewood.ts.

   Firewood is amber, never the accent red: red is for actions and progress,
   and firewood is neither. It is what keeps the fire going while you are
   away. */

import React from 'react';
import { Card, Eyebrow, tokens } from '../ui/kit';
import { addDays, getISTDateString, weekdayOf } from '../utils';
import type { DailyLog } from '../types';
import { FIREWOOD_PER_WEEK, type StreakLedger } from './firewood';

export const FIREWOOD = '#F59F00';

export const FirewoodIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = FIREWOOD }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2.8c1.9 2.1 3.1 3.8 3.1 5.6a3.1 3.1 0 0 1-6.2 0c0-1.4.8-2.5 1.7-3.3.2 1 .7 1.6 1.4 1.8-.4-1.4-.4-2.8 0-4.1z" />
    <rect x="3" y="14.2" width="18" height="4.4" rx="2.2" transform="rotate(-12 12 16.4)" />
    <rect x="3" y="14.2" width="18" height="4.4" rx="2.2" transform="rotate(12 12 16.4)" />
  </svg>
);

/** Has the student studied yet in this Monday-to-Sunday week? */
const studiedThisWeek = (logs: DailyLog[], today: string): boolean => {
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  return logs.some(l => l.date >= monday && l.date <= today);
};


export const FirewoodCard: React.FC<{ ledger: StreakLedger; logs: DailyLog[]; dark: boolean; delay?: number }> = ({ ledger, logs, dark, delay = 0 }) => {
  const t = tokens(dark);
  const today = getISTDateString();
  const earned = studiedThisWeek(logs, today);
  const { bank, holding } = ledger;

  const line = holding
    ? `Your streak is on firewood. Study today and it burns on its own again.`
    : ledger.streak > 0
      ? 'Miss a day and one log keeps your streak alive. It holds your streak. It never adds to it.'
      : 'Firewood keeps a streak alive on days you miss. Start a streak and it starts working.';

  return (
    <Card dark={dark} delay={delay} className="relative overflow-hidden">
      {holding && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(90% 120% at 0% 0%, ${FIREWOOD}${dark ? '29' : '1a'}, transparent 60%)` }} />
      )}
      <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${FIREWOOD}1f` }}>
            <FirewoodIcon size={28} />
          </span>
          <div>
            <Eyebrow dark={dark}>Firewood</Eyebrow>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`num-stat text-[40px] leading-none ${t.heading}`}>{bank}</span>
              <span className={`text-[13px] font-ui ${t.muted}`}>in the bank</span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-ui leading-relaxed ${t.heading}`}>{line}</p>
          <p className={`text-[12px] font-ui mt-1.5 ${t.muted}`}>
            {earned
              ? `This week's ${FIREWOOD_PER_WEEK} are in your bank. Unused ones stay in your bank.`
              : `Study once this week to earn ${FIREWOOD_PER_WEEK} more. Unused ones stay in your bank.`}
          </p>
        </div>
      </div>
    </Card>
  );
};
