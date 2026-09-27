/* ── A realistic day ──
   The deterministic draft behind PLAN MY DAY. The model receives it and may
   swap, reorder or resize within the same capacity; if the model is down,
   this draft IS the plan the student sees. So it has to be good on its own:

   1. Capacity first (mentor/capacity.ts), minus what is already due that day.
   2. A candidate pool, most urgent first: roadmap chapters that are behind,
      this week's roadmap chapters, the coach's top picks (which already know
      about spaced revision and chapter-test gaps), then any subject untouched
      for three days.
   3. Greedy packing into ~90% of capacity, sessions of 20–90 minutes, no
      subject taking more than 60% of the day when there is a choice, at most
      six cards. A day of eleven cards is a list, not a plan. */

import { AppState, ExamPreference, Subject } from '../types';
import { getCoreSubjects } from '../constants';
import { buildRecommendations } from '../today/recommend';
import { roadmapStatus } from './roadmap';
import { dayCapacity, DayCapacity, PLAN_FILL } from './capacity';
import { countDays, daysBetween, weekMonday } from './dates';
import { syllabusRows } from './syllabus';
import { addDays } from '../utils';
import { normalizeMentor } from '../state';

export type DraftSource = 'behind' | 'roadmap' | 'coach' | 'neglect';

export interface DraftItem {
  text: string;
  subject: Subject;
  chapter?: string;
  estMins: number;
  source: DraftSource;
  reason: string;
}

export interface DayPlanDraft {
  date: string;
  capacity: DayCapacity;
  /** Minutes of open cards already due on this date. */
  alreadyDueMins: number;
  /** What the draft may fill. */
  availableMins: number;
  items: DraftItem[];
  /** Candidates that did not make the cut — the model may swap these in. */
  alternatives: DraftItem[];
}

const MAX_ITEMS = 6;
const MIN_ITEM = 20;
const MAX_ITEM = 90;
const SUBJECT_SHARE = 0.6;
const DEFAULT_CARD_MINS = 45;

const snap5 = (m: number) => Math.max(5, Math.round(m / 5) * 5);

const textFor = (action: 'learn' | 'finish' | 'revise', chapter: string): string =>
  action === 'learn'
    ? `${chapter} — first pass: theory + solved examples`
    : action === 'finish'
      ? `${chapter} — close it out: remaining sections + 15 PYQs`
      : `Revise ${chapter} — recall from memory, then 15 PYQs`;

export const buildDayPlan = (state: AppState, date: string, today: string, now?: number): DayPlanDraft => {
  const exam: ExamPreference = state.examPreference || 'JEE';
  const capacity = dayCapacity(state, date, today, date === today ? now : undefined);

  const dueThatDay = state.tasks.filter(t => !t.completed && t.dueAt === date);
  const alreadyDueMins = dueThatDay.reduce((a, t) => a + (t.estMins || DEFAULT_CARD_MINS), 0);
  const availableMins = Math.max(0, Math.round(capacity.minutes * PLAN_FILL) - alreadyDueMins);

  const pool: DraftItem[] = [];
  const taken = new Set(dueThatDay.map(t => `${t.subject}|${t.chapter ?? t.text}`));
  const push = (item: DraftItem) => {
    const key = `${item.subject}|${item.chapter ?? item.text}`;
    if (taken.has(key)) return;
    taken.add(key);
    pool.push(item);
  };

  /* Roadmap: what is behind, then the week this date falls in. */
  const status = roadmapStatus(state, today);
  const roadmap = normalizeMentor(state.mentor).roadmap;
  if (status && roadmap) {
    for (const i of status.behind) {
      push({
        text: textFor(i.action, i.chapter), subject: i.subject, chapter: i.chapter,
        estMins: snap5(Math.min(MAX_ITEM, Math.max(45, i.hours * 60))),
        source: 'behind', reason: 'Behind on your roadmap',
      });
    }
    const week = roadmap.weeks.find(w => w.start === weekMonday(date));
    if (week) {
      /* Spread each chapter's weekly hours over the study days left in the week. */
      const daysLeft = Math.max(1, countDays(date, addDays(week.start, 6), roadmap.restDays).studyDays);
      const doneKeys = new Set(status.thisWeek.filter(i => i.done).map(i => `${i.classId}|${i.subject}|${i.chapter}`));
      for (const i of week.items) {
        if (doneKeys.has(`${i.classId}|${i.subject}|${i.chapter}`)) continue;
        push({
          text: textFor(i.action, i.chapter), subject: i.subject, chapter: i.chapter,
          estMins: snap5(Math.min(MAX_ITEM, Math.max(30, (i.hours * 60) / daysLeft))),
          source: 'roadmap', reason: "This week's roadmap",
        });
      }
    }
  }

  /* The coach's picks: it already weighs spaced revision, open chapters and
     chapter-test gaps, so the planner does not reimplement any of that. */
  for (const r of buildRecommendations({ state, exam, activeSubjects: getCoreSubjects(exam) })) {
    push({
      text: r.headline, subject: r.subject, chapter: r.chapter,
      estMins: snap5(Math.min(MAX_ITEM, Math.max(MIN_ITEM, r.minutes))),
      source: 'coach', reason: r.reason,
    });
  }

  /* Every core subject gets a candidate. Neglected ones (three idle days) are
     urgent; the rest are fillers that keep the day from being one subject —
     the coach's top three can easily all be Physics. Fillers go last. */
  const rows = syllabusRows(state);
  const fillers: DraftItem[] = [];
  for (const subject of getCoreSubjects(exam)) {
    if (pool.some(p => p.subject === subject)) continue;
    const last = state.logs.filter(l => l.subject === subject).map(l => l.date).sort().pop();
    const idle = last ? daysBetween(last, today) : Infinity;
    const next = rows.find(r => r.subject === subject && r.classId === state.currentClass && r.status === 'in_progress')
      ?? rows.find(r => r.subject === subject && r.status === 'in_progress')
      ?? rows.find(r => r.subject === subject && r.classId === state.currentClass && r.status === 'not_started')
      ?? rows.find(r => r.subject === subject && r.status === 'not_started');
    if (!next) continue;
    const item: DraftItem = {
      text: textFor(next.status === 'in_progress' ? 'finish' : 'learn', next.chapter),
      subject, chapter: next.chapter, estMins: 45,
      source: 'neglect',
      reason: idle === Infinity ? `No ${subject} logged yet`
        : idle >= 3 ? `${subject} untouched for ${idle} days`
        : `Keeps ${subject} moving`,
    };
    if (idle >= 3) push(item); else fillers.push(item);
  }
  fillers.forEach(push);

  /* Pack. */
  const items: DraftItem[] = [];
  const alternatives: DraftItem[] = [];
  let left = availableMins;
  const subjects = new Set(pool.map(p => p.subject));
  const cap = subjects.size >= 2 ? availableMins * SUBJECT_SHARE : Infinity;
  const used: Partial<Record<Subject, number>> = {};

  for (const p of pool) {
    if (items.length >= MAX_ITEMS || left < MIN_ITEM) { alternatives.push(p); continue; }
    const room = Math.min(left, cap - (used[p.subject] || 0));
    if (room < MIN_ITEM) { alternatives.push(p); continue; }
    const mins = snap5(Math.min(p.estMins, room));
    if (mins < MIN_ITEM) { alternatives.push(p); continue; }
    items.push({ ...p, estMins: mins });
    used[p.subject] = (used[p.subject] || 0) + mins;
    left -= mins;
  }

  return { date, capacity, alreadyDueMins, availableMins, items, alternatives: alternatives.slice(0, 8) };
};
