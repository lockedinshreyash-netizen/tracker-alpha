/* ── Staying visible while Alpha is open, and on the icon when it is not ──

   The tab title. A student with thirty tabs open sees their day in the strip:
   "🔥12 · 2.5h/10h · Alpha". Set through ui/tabTitle.ts, so a running
   Pomodoro block still owns the title while it runs.

   The icon badge. On an installed app, a dot on the home-screen icon while
   today has nothing logged. Only for students who opted into nudges: it is the
   same "only on a day you haven't started" rule as reminders/nudges.ts, and a
   badge nobody asked for is the kind of pressure that gets an app deleted.
   Cleared the moment a session is logged. */

import { useEffect } from 'react';
import { setIdleTitle } from '../ui/tabTitle';

const fmt = (h: number): string => {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export const idleTitleFor = (streak: number, todayHours: number, goalHours: number): string => {
  if (streak <= 0 && todayHours <= 0) return 'Tracker Alpha';
  const parts: string[] = [];
  if (streak > 0) parts.push(`🔥${streak}`);
  parts.push(goalHours > 0 ? `${fmt(todayHours)}h/${fmt(goalHours)}h` : `${fmt(todayHours)}h today`);
  return `${parts.join(' · ')} · Alpha`;
};

interface Options {
  /** Off while the landing page or onboarding owns the screen. */
  active: boolean;
  streak: number;
  todayHours: number;
  goalHours: number;
  /** The student opted into daily nudges. */
  nudge: boolean;
}

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export const usePresence = ({ active, streak, todayHours, goalHours, nudge }: Options): void => {
  useEffect(() => {
    if (!active) return;
    setIdleTitle(idleTitleFor(streak, todayHours, goalHours));
  }, [active, streak, todayHours, goalHours]);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as BadgeNavigator;
    if (!nav.setAppBadge || !nav.clearAppBadge) return;
    const show = active && nudge && todayHours <= 0;
    void (show ? nav.setAppBadge() : nav.clearAppBadge()).catch(() => { /* not installed, or not allowed */ });
  }, [active, nudge, todayHours]);
};
