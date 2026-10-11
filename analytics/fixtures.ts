/* ── Fixture dashboards for `?analytics=debug` ──
   Deterministic (seeded) so two looks at the board compare like for like.
   Shaped like a real project rather than random noise: a growing base, a
   weekday rhythm, a sign-up spike, decaying cohorts, and live tracking that
   began partway through the range so the "rebuilt from history" note shows. */

import type { Analytics, Range, SeriesDay } from './api';
import { addDays, getISTDateString, weekdayOf } from '../utils';

const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const mondayOf = (day: string): string => addDays(day, -((weekdayOf(day) + 6) % 7));

export type FixtureKind = 'full' | 'fresh';

export const fixtureAnalytics = (days: Range, kind: FixtureKind = 'full'): Analytics => {
  const r = rng(days * 7 + (kind === 'full' ? 1 : 2));
  const today = getISTDateString();
  const start = addDays(today, -(days - 1));
  const scale = kind === 'full' ? 1 : 0.012;
  const trackingSince = kind === 'full' ? addDays(today, -16) : today;

  const series: SeriesDay[] = [];
  let accounts = kind === 'full' ? 2600 : 0;
  for (let i = 0; i < days; i++) {
    const day = addDays(start, i);
    const t = i / Math.max(1, days - 1);
    const weekday = weekdayOf(day);
    const rhythm = weekday === 0 ? 0.78 : weekday === 6 ? 0.9 : 1;
    const spike = Math.abs(i - Math.floor(days * 0.62)) < 3 ? 2.6 : 1;
    const signups = Math.max(0, Math.round((22 + 26 * t) * spike * (0.75 + r() * 0.5) * scale * (kind === 'fresh' ? 25 : 1)));
    accounts += signups;
    const dau = Math.max(0, Math.round((310 + 260 * t) * rhythm * (0.92 + r() * 0.16) * scale));
    /* Rolling counts move slowly; derive them from the trend, not the day. */
    const trend = (310 + 260 * t) * scale;
    const wau = Math.round(trend * (2.5 + r() * 0.04));
    const mau = Math.round(trend * (4.3 + 0.2 * t + r() * 0.03));
    const studiers = Math.round(dau * (0.74 + r() * 0.08));
    const hours = Math.round(studiers * (2.7 + r() * 0.9) * 10) / 10;
    const tracked = Math.round(hours * (0.58 + r() * 0.12) * 10) / 10;
    const live = day >= trackingSince ? dau : 0;
    series.push({
      day, dau, wau, mau, live, studiers, hours, tracked,
      sessions: Math.round(studiers * (2.1 + r() * 0.5)),
      visits: Math.round(live * (1.6 + r() * 0.4)),
      signups, accounts,
    });
  }
  const last = series[series.length - 1];
  const sum = (from: number, to: number, f: (s: SeriesDay) => number) =>
    series.slice(Math.max(0, series.length - to), series.length - from).reduce((n, s) => n + f(s), 0);

  const weekNow = mondayOf(today);
  const growth = Array.from({ length: 12 }, (_, k) => {
    const week = addDays(weekNow, -7 * (11 - k));
    const g = (0.8 + (k / 11) * 0.4) * scale * (kind === 'fresh' ? 0 : 1);
    const partial = week === weekNow ? 0.55 : 1;
    return {
      week,
      retained: Math.round(1080 * g * partial * (0.95 + r() * 0.1)),
      new: Math.round(190 * g * partial * (0.8 + r() * 0.4)),
      resurrected: Math.round(85 * g * partial * (0.8 + r() * 0.4)),
      churned: Math.round(240 * g * (week === weekNow ? 1.8 : 1) * (0.8 + r() * 0.4)),
    };
  });
  if (kind === 'fresh') growth[11] = { ...growth[11], new: last.dau };

  const curve = [0.94, 0.47, 0.37, 0.32, 0.29, 0.27, 0.25, 0.24, 0.23, 0.22, 0.21, 0.2];
  const cohorts = kind === 'fresh'
    ? [{ week: weekNow, size: accounts, active: [last.dau] }]
    : Array.from({ length: 12 }, (_, k) => {
      const week = addDays(weekNow, -7 * (11 - k));
      const size = Math.round((150 + 12 * k) * (0.85 + r() * 0.3));
      const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${week}T00:00:00Z`)) / (7 * 86_400_000));
      return { week, size, active: Array.from({ length: elapsed + 1 }, (_, w) => Math.min(size, Math.round(size * curve[w] * (0.9 + r() * 0.2)))) };
    });

  const mau = last.mau;
  const frequency = Array.from({ length: 30 }, (_, i) => {
    const d = i + 1;
    const users = Math.round(mau * (0.16 / d ** 0.85 + (d >= 26 ? 0.012 * (d - 25) : 0)) * (0.85 + r() * 0.3));
    return { days: d, users };
  });

  const reporting = Math.round(mau * 0.82);
  const pick = (f: number) => Math.round(reporting * f);
  const newRange = series.reduce((n, s) => n + s.signups, 0);

  return {
    generated_at: new Date().toISOString(),
    today,
    days,
    start,
    tracking_since: trackingSince,
    week_now: weekNow,
    accounts: {
      total: accounts,
      confirmed: Math.round(accounts * 0.86),
      synced: Math.round(accounts * 0.78),
      new_today: last.signups,
      new_7: sum(0, 7, s => s.signups),
      new_prev_7: sum(7, 14, s => s.signups),
      new_30: sum(0, 30, s => s.signups),
      new_prev_30: sum(30, 60, s => s.signups),
      new_range: newRange,
      new_prev_range: kind === 'full' ? Math.round(newRange * 0.81) : 0,
    },
    active: {
      dau: last.dau,
      dau_prev: series[series.length - 2]?.dau ?? 0,
      wau: last.wau,
      wau_prev: series[series.length - 8]?.wau ?? 0,
      mau: last.mau,
      mau_prev: series[Math.max(0, series.length - 31)]?.mau ?? 0,
      user_days_30: sum(1, 31, s => s.dau),
      mau_complete: Math.round(last.mau * 0.98),
      days_per_mau: sum(0, 30, s => s.dau),
      visits_7: sum(0, 7, s => s.visits),
      live_days_7: sum(0, 7, s => s.live),
    },
    study: {
      hours_today: last.hours,
      hours_7: sum(0, 7, s => s.hours),
      hours_prev_7: sum(7, 14, s => s.hours),
      tracked_7: sum(0, 7, s => s.tracked),
      sessions_7: sum(0, 7, s => s.sessions),
      studiers_today: last.studiers,
      studiers_7: Math.round(last.wau * 0.81),
      student_days_7: sum(0, 7, s => s.studiers),
    },
    series,
    retention: kind === 'fresh' ? [] : [
      { n: 1, eligible: 2140, retained: 902 },
      { n: 7, eligible: 1980, retained: 541 },
      { n: 30, eligible: 1410, retained: 228 },
    ],
    cohorts,
    growth,
    frequency: frequency.filter(f => f.users > 0),
    funnel: kind === 'fresh'
      ? { signed_up: accounts, confirmed: accounts - 3, signed_in: accounts - 5, studied: accounts - 9, returned: 0, habit: 0 }
      : { signed_up: newRange, confirmed: Math.round(newRange * 0.87), signed_in: Math.round(newRange * 0.79), studied: Math.round(newRange * 0.64), returned: Math.round(newRange * 0.43), habit: Math.round(newRange * 0.19) },
    devices: {
      platforms: { android: pick(0.63), ios: pick(0.14), desktop: pick(0.21), other: pick(0.02) },
      installed: pick(0.31),
      reporting,
    },
    setup: {
      reporting,
      exam: { JEE: pick(0.83), NEET: pick(0.17) },
      class: { '11': pick(0.44), '12': pick(0.56) },
      timer: { stopwatch: pick(0.71), pomodoro: pick(0.29) },
      theme: { dark: pick(0.88), light: pick(0.12) },
      streaks: { '0': pick(0.31), '1-2': pick(0.27), '3-6': pick(0.2), '7-29': pick(0.17), '30+': pick(0.05) },
      goal_avg: 7.4,
      chapters_done_avg: 11.2,
      adoption: {
        plan: pick(0.34), tasks: pick(0.72), mocks: pick(0.21), errors: pick(0.12), syllabus: pick(0.66),
        rewards: pick(0.08), race: pick(0.27), reminders: pick(0.06), pomodoro: pick(0.29),
      },
    },
    features: {
      groups: Math.round(310 * scale), group_members: Math.round(1240 * scale), groups_active_7: Math.round(140 * scale),
      group_messages_7: Math.round(9800 * scale), group_chatters_30: Math.round(690 * scale),
      race_today: Math.round(210 * scale), race_30: Math.round(780 * scale),
      reviews_today: Math.round(4100 * scale), reviews_7: Math.round(26500 * scale), reviewers_7: Math.round(380 * scale),
      reviewers_30: Math.round(620 * scale), deck_students: Math.round(910 * scale),
      push_users: Math.round(240 * scale), profiles: Math.round(accounts * 0.7),
      feedback_open: 7, feedback_7: 12,
      announcement: { title: 'Mock series opens Sunday', published_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), reads: Math.round(1310 * scale) },
      ai_users_month: Math.round(160 * scale),
    },
  };
};
