/* ── Console → Analytics: the one request ──
   `admin_analytics(days)` (supabase/analytics.sql §6) returns the whole
   dashboard as one jsonb document. The shapes below mirror it field for field;
   definitions of every figure live in that file's §6 header, not here. */

import { supabase } from '../supabaseClient';

export interface SeriesDay {
  day: string;
  dau: number;
  wau: number;
  mau: number;
  /** Of `dau`, how many were reported live (the rest are reconstructed). */
  live: number;
  studiers: number;
  hours: number;
  tracked: number;
  sessions: number;
  visits: number;
  signups: number;
  /** Accounts in existence at the end of the day. */
  accounts: number;
}

export interface Cohort {
  week: string;
  size: number;
  /** active[k] = members active in week k after their own sign-up day. */
  active: number[];
}

export interface GrowthWeek {
  week: string;
  new: number;
  retained: number;
  resurrected: number;
  churned: number;
}

export interface Analytics {
  generated_at: string;
  today: string;
  days: number;
  start: string;
  /** First day the app reported itself (null until the first ping arrives). */
  tracking_since: string | null;
  week_now: string;
  accounts: {
    total: number; confirmed: number; synced: number;
    new_today: number; new_7: number; new_prev_7: number; new_30: number; new_prev_30: number;
    new_range: number; new_prev_range: number;
  };
  active: {
    dau: number; dau_prev: number; wau: number; wau_prev: number; mau: number; mau_prev: number;
    user_days_30: number; mau_complete: number; days_per_mau: number; visits_7: number; live_days_7: number;
  };
  study: {
    hours_today: number; hours_7: number; hours_prev_7: number; tracked_7: number; sessions_7: number;
    studiers_today: number; studiers_7: number; student_days_7: number;
  };
  series: SeriesDay[];
  retention: Array<{ n: number; eligible: number; retained: number }>;
  cohorts: Cohort[];
  growth: GrowthWeek[];
  frequency: Array<{ days: number; users: number }>;
  funnel: { signed_up: number; confirmed: number; signed_in: number; studied: number; returned: number; habit: number };
  devices: { platforms: Partial<Record<'ios' | 'android' | 'desktop' | 'other', number>>; installed: number; reporting: number };
  setup: {
    reporting: number;
    exam: { JEE: number; NEET: number };
    class: { '11': number; '12': number };
    timer: { stopwatch: number; pomodoro: number };
    theme: { dark: number; light: number };
    streaks: { '0': number; '1-2': number; '3-6': number; '7-29': number; '30+': number };
    goal_avg: number | null;
    chapters_done_avg: number | null;
    adoption: {
      plan: number; tasks: number; mocks: number; errors: number; syllabus: number;
      rewards: number; race: number; reminders: number; pomodoro: number;
    };
  };
  /** Each key present only when its feature's tables exist on this project. */
  features: Partial<{
    groups: number; group_members: number; groups_active_7: number; group_messages_7: number; group_chatters_30: number;
    race_today: number; race_30: number;
    reviews_today: number; reviews_7: number; reviewers_7: number; reviewers_30: number; deck_students: number;
    push_users: number;
    profiles: number;
    feedback_open: number; feedback_7: number;
    announcement: { title: string; published_at: string; reads: number } | null;
    ai_users_month: number;
  }>;
}

export type Range = 30 | 90 | 180 | 365;

export const fetchAnalytics = async (days: Range): Promise<Analytics> => {
  const { data, error } = await supabase.rpc('admin_analytics', { p_days: days });
  if (error) throw error;
  /* numeric sums arrive as JSON numbers already; nothing to coerce. */
  return data as Analytics;
};

/** True when the console is talking to a project that has not run analytics.sql. */
export const isAnalyticsMissing = (e: unknown): boolean => {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'PGRST202' || err?.code === '42883' || /could not find the function/i.test(err?.message ?? '');
};
