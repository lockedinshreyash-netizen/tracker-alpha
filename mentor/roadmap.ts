/* ── The syllabus roadmap ──
   Built here, from parameters. The model chooses the target date and the
   hours; it never writes a week list. That split is the whole design: the
   model is good at talking a student through a trade-off and bad at packing
   300 hours into 11 weeks without losing one.

   Shape of the plan:
   - Subjects run as parallel tracks, so every week touches every subject
     instead of "Physics until October".
   - Within a track: chapters already open first (finish before starting),
     then NCERT order — the catalogue order, which is the dependency order —
     with revision-pending chapters last.
   - Each week's hours are shared between tracks in proportion to what each
     has left, recomputed every week, so a subject that runs out early hands
     its time to the others.

   Re-planning keeps every week already lived exactly as it was planned — the
   same stance `updateRule` takes on the Plan tab: history is not rewritten. */

import { AppState, Roadmap, RoadmapItem, RoadmapWeek, Subject } from '../types';
import { addDays, weekdayOf } from '../utils';
import { EFFORT_VERSION } from '../content/effort';
import { normalizeMentor } from '../state';
import { eachDay, weekMonday } from './dates';
import { isDone, personalFactor, syllabusRows, SyllabusRow } from './syllabus';

export interface RoadmapParams {
  targetDate: string;
  /** Hours per study day. Absent → stated weekly hours, else recent average, else the daily goal. */
  hoursPerDay?: number;
  restDays?: number[];
  /** `classId|subject|chapter` keys to leave out. */
  excluded?: string[];
}

export interface RoadmapBuild {
  roadmap: Roadmap;
  /** Hours of work that did not fit before the target. */
  overflowHours: number;
  /** Chapters (or parts of them) that did not fit, in track order. */
  unscheduled: RoadmapItem[];
  totalHours: number;
  hoursPerDaySource: 'given' | 'stated' | 'history' | 'goal';
}

interface Work {
  row: SyllabusRow;
  action: RoadmapItem['action'];
  hours: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const MIN_SLICE = 0.25;

/** Track order within one subject. */
const trackOrder = (rows: SyllabusRow[]): SyllabusRow[] => {
  const rank = (r: SyllabusRow) =>
    r.status === 'in_progress' ? 0 : r.status === 'not_started' ? 1 : 2;
  return [...rows].sort((a, b) =>
    rank(a) - rank(b) || a.classId - b.classId || a.order - b.order);
};

export const buildRoadmap = (
  state: AppState,
  today: string,
  params: RoadmapParams,
  recentPerDay: number,
): RoadmapBuild => {
  const mentor = normalizeMentor(state.mentor);
  const restDays = params.restDays ?? mentor.prefs.restDays;
  const excluded = new Set(params.excluded ?? []);

  let hoursPerDaySource: RoadmapBuild['hoursPerDaySource'];
  let perDay: (date: string) => number;
  if (params.hoursPerDay !== undefined) {
    hoursPerDaySource = 'given';
    perDay = () => params.hoursPerDay!;
  } else if (mentor.prefs.weeklyHours) {
    hoursPerDaySource = 'stated';
    const wk = mentor.prefs.weeklyHours;
    perDay = d => wk[weekdayOf(d)];
  } else if (recentPerDay > 0.25) {
    hoursPerDaySource = 'history';
    perDay = () => recentPerDay;
  } else {
    hoursPerDaySource = 'goal';
    perDay = () => state.dailyGoalHours;
  }

  const rows = syllabusRows(state);
  const { factor } = personalFactor(state, rows);

  /* Remaining work per subject track. */
  const tracks = new Map<Subject, Work[]>();
  for (const r of trackOrder(rows)) {
    if (excluded.has(r.key) || r.remainingHours <= 0) continue;
    const action: RoadmapItem['action'] =
      r.status === 'in_progress' ? 'finish' : isDone(r.status) ? 'revise' : 'learn';
    const list = tracks.get(r.subject) ?? [];
    list.push({ row: r, action, hours: round1(r.remainingHours * factor) });
    tracks.set(r.subject, list);
  }
  const totalHours = round1([...tracks.values()].flat().reduce((a, w) => a + w.hours, 0));

  /* Weeks from this Monday until the day before the target. */
  const lastDay = addDays(params.targetDate, -1);
  const weeks: RoadmapWeek[] = [];
  for (let start = weekMonday(today); start <= lastDay; start = addDays(start, 7)) {
    const from = start < today ? today : start;
    const to = addDays(start, 6) > lastDay ? lastDay : addDays(start, 6);
    const capacity = round1(
      eachDay(from, to)
        .filter(d => !restDays.includes(weekdayOf(d)))
        .reduce((a, d) => a + perDay(d), 0),
    );
    weeks.push({ start, capacity, items: [] });
    if (weeks.length >= 80) break;
  }

  for (const week of weeks) {
    let budget = week.capacity;
    /* Two passes: proportional shares, then any time a finished track left
       behind goes to whoever still has work. */
    for (let pass = 0; pass < 2 && budget >= MIN_SLICE; pass++) {
      const live = [...tracks.entries()].filter(([, w]) => w.length);
      const left = live.reduce((a, [, w]) => a + w.reduce((x, y) => x + y.hours, 0), 0);
      if (left <= 0) break;
      const passBudget = budget;
      for (const [subject, work] of live) {
        const trackLeft = work.reduce((x, y) => x + y.hours, 0);
        let share = pass === 0 ? passBudget * (trackLeft / left) : budget;
        /* Quarter-hour floor: a roadmap line reading "Sets (Maths, 0.1h)" is
           noise, so a chapter's last sliver rides along with the slice before
           it rather than becoming its own line next week. */
        while (share >= MIN_SLICE && work.length) {
          const w = work[0];
          let take = round1(Math.min(w.hours, share));
          if (w.hours - take < MIN_SLICE) take = w.hours;
          if (take <= 0) break;
          const existing = week.items.find(i => i.subject === subject && i.chapter === w.row.chapter && i.classId === w.row.classId);
          if (existing) existing.hours = round1(existing.hours + take);
          else week.items.push({ classId: w.row.classId, subject, chapter: w.row.chapter, action: w.action, hours: take });
          w.hours = round1(w.hours - take);
          share = round1(share - take);
          budget = round1(budget - take);
          if (w.hours <= 0.05) work.shift();
        }
        if (budget < MIN_SLICE) break;
      }
    }
  }

  const unscheduled: RoadmapItem[] = [...tracks.entries()].flatMap(([subject, work]) =>
    work.map(w => ({ classId: w.row.classId, subject, chapter: w.row.chapter, action: w.action, hours: w.hours })));
  const overflowHours = round1(unscheduled.reduce((a, i) => a + i.hours, 0));

  /* Re-plan: weeks already lived stay as they were. */
  const prev = mentor.roadmap;
  const thisWeek = weekMonday(today);
  const kept = prev ? prev.weeks.filter(w => w.start < thisWeek) : [];

  const avgPerDay = (() => {
    const days = weeks.reduce((a, w) => a + w.capacity, 0);
    const n = eachDay(today, lastDay).filter(d => !restDays.includes(weekdayOf(d))).length;
    return n ? round1(days / n) : 0;
  })();

  return {
    roadmap: {
      revision: (prev?.revision ?? 0) + 1,
      createdOn: today,
      updatedAt: Date.now(),
      targetDate: params.targetDate,
      hoursPerDay: params.hoursPerDay ?? avgPerDay,
      restDays,
      excluded: [...excluded],
      effortVersion: EFFORT_VERSION,
      baselineHours: totalHours,
      weeks: [...kept, ...weeks],
    },
    overflowHours,
    unscheduled,
    totalHours,
    hoursPerDaySource,
  };
};

export interface RoadmapStatus {
  targetDate: string;
  revision: number;
  thisWeek: (RoadmapItem & { done: boolean })[];
  nextWeek: RoadmapItem[];
  /** Chapters scheduled in weeks already over that are still not done. */
  behind: RoadmapItem[];
  behindHours: number;
}

/** Where the student stands against the active roadmap. */
export const roadmapStatus = (state: AppState, today: string): RoadmapStatus | null => {
  const roadmap = normalizeMentor(state.mentor).roadmap;
  if (!roadmap) return null;
  const rows = syllabusRows(state);
  const doneKeys = new Set(rows.filter(r => r.status === 'completed' || r.status === 'revision_pending').map(r => r.key));
  const isItemDone = (i: RoadmapItem) =>
    i.action === 'revise'
      ? rows.some(r => r.classId === i.classId && r.subject === i.subject && r.chapter === i.chapter && r.status === 'completed' && !!r.lastRevisedAt && r.lastRevisedAt >= roadmap.createdOn)
      : doneKeys.has(`${i.classId}|${i.subject}|${i.chapter}`);

  const monday = weekMonday(today);
  const current = roadmap.weeks.find(w => w.start === monday);
  const next = roadmap.weeks.find(w => w.start === addDays(monday, 7));

  /* Behind = a chapter whose LAST scheduled week is over and which is not
     done. A chapter spanning two weeks is not behind after the first. */
  const lastWeekOf = new Map<string, string>();
  for (const w of roadmap.weeks) for (const i of w.items) lastWeekOf.set(`${i.classId}|${i.subject}|${i.chapter}`, w.start);
  const behindByKey = new Map<string, RoadmapItem>();
  for (const w of roadmap.weeks) {
    if (w.start >= monday) continue;
    for (const i of w.items) {
      const key = `${i.classId}|${i.subject}|${i.chapter}`;
      if ((lastWeekOf.get(key) ?? '') >= monday || isItemDone(i)) continue;
      const acc = behindByKey.get(key);
      /* Every week's share of the chapter, not just the first one seen. */
      if (acc) acc.hours = round1(acc.hours + i.hours);
      else behindByKey.set(key, { ...i });
    }
  }
  const behind = [...behindByKey.values()];

  return {
    targetDate: roadmap.targetDate,
    revision: roadmap.revision,
    thisWeek: (current?.items ?? []).map(i => ({ ...i, done: isItemDone(i) })),
    nextWeek: next?.items ?? [],
    behind,
    behindHours: round1(behind.reduce((a, i) => a + i.hours, 0)),
  };
};
