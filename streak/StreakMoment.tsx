import React, { useEffect, useState } from 'react';
import type { DailyLog } from '../types';
import type { RewardProgress } from '../rewards/engine';
import { addDays, getISTDateString, weekdayOf } from '../utils';
import * as sfx from '../audio';
import { STREAK_MILESTONES, streakCue } from '../sound/cues';

/* ── The streak moment ──
   Once a day, the first time a session is logged on this device, the app
   stops and says so. It is the one daily ritual: the streak was a number on
   the Streak tab before this, and a number you have to go and look at is not
   a reason to come back tomorrow.

   It shares UnlockModal's shell — same scrim, radius, entrance and footer —
   because the two are the only things allowed to stop you on arrival, and two
   interruptions that look different are two interruptions. When both are due
   (day 30), this one goes first and the reward follows. */

const STORE_KEY = 'streak_moment_v1';

const storeKey = (uid: string | null) => `${STORE_KEY}:${uid ?? 'local'}`;

/** Not yet shown today on this device. */
export const streakMomentDue = (uid: string | null, today: string): boolean => {
  try {
    return window.localStorage.getItem(storeKey(uid)) !== today;
  } catch {
    return true;
  }
};

export const markStreakMoment = (uid: string | null, today: string) => {
  try {
    window.localStorage.setItem(storeKey(uid), today);
  } catch {
    /* shown once in memory; a refusal to store only means it could show again */
  }
};

/* Short and plain on purpose: most readers are sixteen, reading it in one
   glance before going back to work. Picked from the number itself, never at
   random — a line that changes each time you see it is a slot machine. */
const MILESTONE_LINES: Record<number, string> = {
  7: 'One full week. Locked in.',
  30: 'Thirty days. A whole month.',
  50: 'Fifty days. Most people quit by now.',
  100: 'A hundred days. Almost nobody gets here.',
  200: 'Two hundred days. This is who you are now.',
  365: 'One full year. Unreal.',
};

const TIER_LINES: [number, string[]][] = [
  [100, ['Still here. Still working.', 'The streak is the easy part now. Keep going.']],
  [30, ['This is discipline.', 'Your competition took a day off. You did not.', 'Keep the run alive.']],
  [7, ['The habit is forming.', 'Your competition missed a day. You did not.', 'Show up again tomorrow.']],
  [2, ["Don't stop now.", 'Make it one more tomorrow.', 'The chain is getting longer.']],
];

export const streakLine = (n: number): string => {
  if (n <= 1) return 'Every streak starts with day one.';
  const milestone = MILESTONE_LINES[n];
  if (milestone) return milestone;
  const tier = TIER_LINES.find(([min]) => n >= min)?.[1] ?? TIER_LINES[TIER_LINES.length - 1][1];
  return tier[n % tier.length];
};

const DAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  streak: number;
  logs: DailyLog[];
  /** The next reward still to earn, if any. */
  next?: RewardProgress;
  theme: 'dark' | 'light';
  onClose: () => void;
}

const StreakMoment: React.FC<Props> = ({ streak, logs, next, theme, onClose }) => {
  const dark = theme === 'dark';
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [rolled, setRolled] = useState(!!reduced);
  const milestone = (STREAK_MILESTONES as readonly number[]).includes(streak);

  /* The number rolls from yesterday's count to today's, and the sound lands
     with it. A moment that opens behind a hidden tab (a Pomodoro bell in the
     background) waits to be seen before it makes a sound. */
  useEffect(() => {
    let timer = 0;
    let done = false;
    const fire = () => {
      if (done || document.hidden) return;
      done = true;
      timer = window.setTimeout(() => {
        setRolled(true);
        sfx.play(streakCue(streak), { late: 1500 });
      }, reduced ? 0 : 380);
    };
    fire();
    document.addEventListener('visibilitychange', fire);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', fire);
    };
  }, [streak, reduced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = getISTDateString();
  const studied = new Set(logs.map(l => l.date));
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const ink = dark ? 'text-white' : 'text-black';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-600';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Streak: ${streak} ${streak === 1 ? 'day' : 'days'}`}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      >
        <div
          className="px-8 pt-10 pb-8 text-center"
          style={{
            background: dark
              ? 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.22) 0%, transparent 65%)'
              : 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.10) 0%, transparent 65%)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#E10600] mb-6 font-ui">
            {milestone ? 'Milestone' : 'Streak extended'}
          </p>

          {/* Yesterday's count above today's, in a window one line tall. */}
          <div className="relative mx-auto overflow-hidden" style={{ height: 88 }} aria-hidden="true">
            <div
              style={{
                transform: rolled ? 'translateY(-88px)' : 'translateY(0)',
                transition: reduced ? 'none' : 'transform 560ms cubic-bezier(0.2, 0.9, 0.25, 1.15)',
              }}
            >
              {[Math.max(0, streak - 1), streak].map((n, i) => (
                <p key={i} className={`num-hero tracking-tighter leading-none ${ink}`} style={{ fontSize: 88, height: 88, lineHeight: '88px' }}>
                  {n}
                </p>
              ))}
            </div>
          </div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mt-2 font-ui ${faint}`}>
            {streak === 1 ? 'day' : 'days'} in a row
          </p>

          <div className="accent-line mt-5 mb-6" />

          <h2 className={`text-xl font-black tracking-tight leading-snug mb-6 ${ink}`}>{streakLine(streak)}</h2>

          <div className="flex justify-center gap-2.5" aria-label="The last seven days">
            {week.map(d => {
              const isToday = d === today;
              const on = studied.has(d);
              return (
                <div key={d} className="flex flex-col items-center gap-1.5">
                  <span
                    className="block rounded-full"
                    style={{
                      width: 22,
                      height: 22,
                      background: isToday ? '#E10600' : on ? (dark ? '#F4F4F5' : '#18181B') : 'transparent',
                      border: on || isToday ? 'none' : `1.5px solid ${dark ? 'rgba(255,255,255,0.14)' : '#D4D4D8'}`,
                      transform: isToday && rolled && !reduced ? 'scale(1)' : isToday && !reduced ? 'scale(0.4)' : 'scale(1)',
                      transition: reduced ? 'none' : 'transform 420ms cubic-bezier(0.3, 1.6, 0.5, 1) 120ms',
                    }}
                  />
                  <span className={`text-[10px] font-bold font-ui ${isToday ? 'text-[#E10600]' : faint}`}>{DAY_INITIAL[weekdayOf(d)]}</span>
                </div>
              );
            })}
          </div>

          <p className={`text-[13px] leading-relaxed font-ui mt-6 ${muted}`}>
            {next
              ? next.daysLeft === 1
                ? `One more day to ${next.def.title}.`
                : `${next.daysLeft} days to ${next.def.title}.`
              : 'Every reward is yours. Keep the run alive anyway.'}
          </p>
        </div>

        <div className={`px-8 py-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button
            autoFocus
            onClick={onClose}
            className="w-full px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
          >
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
};

export default StreakMoment;
