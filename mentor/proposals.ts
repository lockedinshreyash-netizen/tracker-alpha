/* ── Review cards ──
   Everything the Mentor wants to change arrives here first, as a Proposal:
   a list of lines the student can tick, untick and resize, and nothing
   happens until they press the commit button. This is where the model's
   arguments are checked against the CURRENT record — the server has already
   checked their shape; this checks their meaning:

   - dates inside [today, today + 14] for cards
   - subjects in the student's exam track, chapters that actually exist
   - handles that point at cards that still exist
   - a day plan that fits the day: over-capacity lines arrive UNTICKED
   - deletions always arrive UNTICKED — removing work needs a deliberate tap
   - never a foundational chapter in a roadmap's exclusions */

import { AppState, ExamPreference, MentorPrefs, Subject, SyllabusStatus } from '../types';
import { addDays, generateId } from '../utils';
import { getActiveSubjects } from '../constants';
import { MENTOR_LIMITS } from '../supabase/functions/_shared/mentor-protocol';
import { MentorOp, newMentorTask } from './ops';
import { formatDay, daysBetween, isDate, DAY_NAMES } from './dates';
import { dayCapacity, PLAN_FILL } from './capacity';
import { DayPlanDraft } from './planDay';
import { Replan } from './replan';
import { buildRoadmap, RoadmapBuild } from './roadmap';
import { findRow, syllabusRows, chapterKey } from './syllabus';
import { Handles, taskIdOf } from './brief';

export type ProposalKind = 'tasks' | 'task_changes' | 'roadmap' | 'chapters' | 'prefs' | 'replan';

export interface ProposalLine {
  id: string;
  label: string;
  meta?: string;
  checked: boolean;
  destructive?: boolean;
  /** Present on new cards: the minutes, editable on the card before committing. */
  mins?: number;
  ops: MentorOp[];
}

export interface RoadmapPreview {
  targetDate: string;
  weeks: number;
  totalHours: number;
  overflowHours: number;
  hoursPerDay: number;
  hoursPerDaySource: RoadmapBuild['hoursPerDaySource'];
  firstWeeks: { start: string; items: string[] }[];
  unscheduled: string[];
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  title: string;
  summary: string;
  lines: ProposalLine[];
  notes: string[];
  commitLabel: string;
  source: 'model' | 'engine';
  status: 'pending' | 'applied' | 'dismissed';
  roadmap?: RoadmapPreview;
  /** Filled on apply, so the card can undo itself. */
  inverse?: MentorOp[];
  appliedCount?: number;
}

export interface ProposalContext {
  state: AppState;
  today: string;
  now: number;
  handles: Handles;
  /** The student's recent hours per study day, for roadmap defaults. */
  recentPerDay: number;
}

type Built = { ok: true; proposal: Proposal } | { ok: false; error: string };

const line = (label: string, ops: MentorOp[], extra: Partial<ProposalLine> = {}): ProposalLine => ({
  id: generateId(), label, checked: true, ops, ...extra,
});

const clipSummary = (s: unknown): string => (typeof s === 'string' ? s.trim().slice(0, 600) : '');

const fmtMins = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
export { fmtMins };

const subjectFor = (state: AppState, s: unknown): Subject => {
  const active = getActiveSubjects(state.examPreference || 'JEE');
  return typeof s === 'string' && active.includes(s as Subject) ? (s as Subject) : 'General';
};

/* ── Cards for one day ── */

interface NewCard { text: string; subject: Subject; chapter?: string; estMins: number }

const tasksProposal = (
  ctx: ProposalContext,
  date: string,
  cards: NewCard[],
  summary: string,
  placeOnTimeline: boolean,
  source: Proposal['source'],
): Built => {
  const { state, today, now } = ctx;
  if (!isDate(date) || date < today || daysBetween(today, date) > 14) {
    return { ok: false, error: 'Cards can only be planned for today or the next 14 days.' };
  }
  const rows = syllabusRows(state);
  const cap = dayCapacity(state, date, today, date === today ? now : undefined);
  const alreadyDue = state.tasks.filter(t => !t.completed && t.dueAt === date)
    .reduce((a, t) => a + (t.estMins || 45), 0);
  const room = Math.max(0, Math.round(cap.minutes * PLAN_FILL) - alreadyDue);

  const notes: string[] = [];
  let used = 0;
  let unticked = 0;
  const lines = cards.slice(0, MENTOR_LIMITS.maxTasksPerProposal).map(c => {
    const subject = subjectFor(state, c.subject);
    /* A chapter name the syllabus does not know is dropped rather than stored:
       the card still works, and nothing downstream matches on a phantom. */
    const row = c.chapter ? rows.find(r => r.subject === subject && r.chapter.toLowerCase() === c.chapter!.trim().toLowerCase()) : undefined;
    const mins = Math.max(10, Math.min(240, Math.round(c.estMins / 5) * 5));
    const fits = used + mins <= room * 1.1;
    if (fits) used += mins; else unticked++;
    const task = newMentorTask({ text: c.text, subject, chapter: row?.chapter, estMins: mins, dueAt: date });
    const ops: MentorOp[] = [{ t: 'addTask', task }];
    if (placeOnTimeline) {
      ops.push({ t: 'placeTask', blockId: generateId(), taskId: task.id, date, durationMins: mins, fromMinute: date === today ? now : 120 });
    }
    return line(c.text, ops, { meta: subject, mins, checked: fits });
  });

  if (unticked) notes.push(`${unticked} left unticked — they would take the day past what it can hold (${fmtMins(room)} free).`);
  if (cap.notes.length) notes.push(...cap.notes);
  if (alreadyDue) notes.push(`${fmtMins(alreadyDue)} of cards are already due that day and count against it.`);

  return {
    ok: true,
    proposal: {
      id: generateId(),
      kind: 'tasks',
      title: `${formatDay(date).toUpperCase()}${date === today ? ' · TODAY' : date === addDays(today, 1) ? ' · TOMORROW' : ''}`,
      summary,
      lines,
      notes,
      commitLabel: 'ADD TO BOARD',
      source,
      status: 'pending',
    },
  };
};

export const proposalFromDayPlan = (ctx: ProposalContext, draft: DayPlanDraft): Built =>
  draft.items.length
    ? tasksProposal(
      ctx,
      draft.date,
      draft.items.map(i => ({ text: i.text, subject: i.subject, chapter: i.chapter, estMins: i.estMins })),
      `Built from your capacity (${fmtMins(draft.availableMins)} to fill), your roadmap and what the coach flags as due.`,
      false,
      'engine',
    )
    : {
      ok: false,
      error: draft.capacity.minutes < 20
        ? draft.capacity.basis === 'rest_day' ? `${formatDay(draft.date)} is a rest day. Nothing planned.` : `There's no study time left on ${formatDay(draft.date)}.`
        : draft.availableMins < 20
          ? `${formatDay(draft.date)} is already full — ${fmtMins(draft.alreadyDueMins)} of cards are due that day.`
          : 'Nothing to plan — no roadmap, recommendations or open chapters to suggest.',
    };

/* ── Edits to existing cards ── */

const changesProposal = (ctx: ProposalContext, changes: Record<string, unknown>[], summary: string): Built => {
  const { state, today, handles } = ctx;
  const notes: string[] = [];
  const lines: ProposalLine[] = [];
  for (const c of changes.slice(0, MENTOR_LIMITS.maxChangesPerProposal)) {
    const id = typeof c.task === 'string' ? taskIdOf(handles, c.task) : undefined;
    const task = id ? state.tasks.find(t => t.id === id) : undefined;
    if (!task) { notes.push(`Skipped ${String(c.task)}: no such card.`); continue; }
    switch (c.action) {
      case 'reschedule': {
        if (!isDate(c.dueAt) || c.dueAt < today || daysBetween(today, c.dueAt) > 60) {
          notes.push(`Skipped moving "${task.text}": the new date is not valid.`);
          break;
        }
        lines.push(line(task.text, [{ t: 'patchTask', id: task.id, patch: { dueAt: c.dueAt } }], {
          meta: `${task.dueAt ? formatDay(task.dueAt) : 'No date'} → ${formatDay(c.dueAt)}`,
        }));
        break;
      }
      case 'edit': {
        const patch: { text?: string; estMins?: number; subject?: Subject } = {};
        if (typeof c.text === 'string' && c.text.trim()) patch.text = c.text.trim().slice(0, 140);
        if (typeof c.estMins === 'number') patch.estMins = Math.round(c.estMins);
        if (typeof c.subject === 'string') patch.subject = subjectFor(state, c.subject);
        if (!Object.keys(patch).length) { notes.push(`Skipped editing "${task.text}": nothing to change.`); break; }
        lines.push(line(patch.text ?? task.text, [{ t: 'patchTask', id: task.id, patch }], {
          meta: [patch.text ? `was "${task.text}"` : '', patch.estMins ? fmtMins(patch.estMins) : '', patch.subject ?? ''].filter(Boolean).join(' · '),
        }));
        break;
      }
      case 'complete':
        if (task.completed) { notes.push(`"${task.text}" is already done.`); break; }
        lines.push(line(task.text, [{ t: 'completeTask', id: task.id }], { meta: 'Mark done' }));
        break;
      case 'delete':
        lines.push(line(task.text, [{ t: 'deleteTask', id: task.id }], { meta: 'Delete', destructive: true, checked: false }));
        break;
    }
  }
  if (!lines.length) return { ok: false, error: notes.join(' ') || 'No valid changes.' };
  if (lines.some(l => l.destructive)) notes.push('Deletions are unticked — tick them only if you mean it.');
  return {
    ok: true,
    proposal: {
      id: generateId(), kind: 'task_changes', title: `${lines.length} CHANGE${lines.length === 1 ? '' : 'S'} TO YOUR BOARD`,
      summary, lines, notes, commitLabel: 'APPLY', source: 'model', status: 'pending',
    },
  };
};

/* ── Roadmap ── */

export const roadmapProposal = (
  ctx: ProposalContext,
  params: { targetDate: string; hoursPerDay?: number; restDays?: number[]; exclude?: { classId: number; subject: string; chapter: string }[] },
  summary: string,
  source: Proposal['source'],
): Built => {
  const { state, today } = ctx;
  if (!isDate(params.targetDate) || daysBetween(today, params.targetDate) < 7) {
    return { ok: false, error: 'The target date must be at least a week away.' };
  }
  if (daysBetween(today, params.targetDate) > 730) return { ok: false, error: 'The target is more than two years away.' };

  const rows = syllabusRows(state);
  const notes: string[] = [];
  const excluded: string[] = [];
  for (const e of params.exclude ?? []) {
    const row = findRow(rows, e.classId, e.subject, e.chapter);
    if (!row) { notes.push(`Ignored "${e.chapter}": not in your syllabus.`); continue; }
    if (row.foundational) { notes.push(`Kept ${row.chapter}: other chapters depend on it, so it cannot be dropped.`); continue; }
    excluded.push(chapterKey(row.classId, row.subject, row.chapter));
  }

  const build = buildRoadmap(state, today, {
    targetDate: params.targetDate,
    hoursPerDay: params.hoursPerDay,
    restDays: params.restDays,
    excluded,
  }, ctx.recentPerDay);

  const upcoming = build.roadmap.weeks.filter(w => w.start >= addDays(today, -6));
  if (build.overflowHours > 0) {
    notes.push(`${Math.round(build.overflowHours)}h of work does not fit before ${formatDay(params.targetDate)} at this pace. Accepting still saves the plan, but it is not enough — raise the hours, move the date, or drop low-yield chapters.`);
  }
  const src = { given: 'the hours you agreed', stated: 'the hours you set per weekday', history: 'your average over the last 14 days', goal: 'your daily goal (not enough history yet)' }[build.hoursPerDaySource];
  notes.push(`Paced on ${src}. Chapter hours are estimates.`);
  if (excluded.length) notes.push(`${excluded.length} chapter${excluded.length === 1 ? '' : 's'} left out at your request.`);

  const preview: RoadmapPreview = {
    targetDate: params.targetDate,
    weeks: upcoming.length,
    totalHours: Math.round(build.totalHours),
    overflowHours: Math.round(build.overflowHours),
    hoursPerDay: build.roadmap.hoursPerDay,
    hoursPerDaySource: build.hoursPerDaySource,
    firstWeeks: upcoming.slice(0, 3).map(w => ({
      start: w.start,
      items: w.items.map(i => `${i.action === 'revise' ? 'Revise ' : i.action === 'finish' ? 'Finish ' : ''}${i.chapter} (${i.subject}, ${i.hours}h)`),
    })),
    unscheduled: build.unscheduled.slice(0, 8).map(i => `${i.chapter} (${i.subject})`),
  };

  const ops: MentorOp[] = [{ t: 'setRoadmap', roadmap: build.roadmap }];
  if (params.restDays) ops.push({ t: 'setPrefs', prefs: { restDays: params.restDays } });

  return {
    ok: true,
    proposal: {
      id: generateId(),
      kind: 'roadmap',
      title: `ROADMAP TO ${formatDay(params.targetDate).toUpperCase()}`,
      summary,
      lines: [line(`${upcoming.length} weeks · ~${Math.round(build.totalHours)}h of chapters`, ops, { meta: build.roadmap.revision > 1 ? `Replaces revision ${build.roadmap.revision - 1}; past weeks stay as they were` : undefined })],
      notes,
      commitLabel: build.roadmap.revision > 1 ? 'REPLACE ROADMAP' : 'LOCK IT IN',
      source,
      status: 'pending',
      roadmap: preview,
    },
  };
};

/* ── Syllabus status ── */

const STATUS_WORD: Record<SyllabusStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', revision_pending: 'Revision',
};

const chaptersProposal = (ctx: ProposalContext, items: Record<string, unknown>[], summary: string): Built => {
  const rows = syllabusRows(ctx.state);
  const notes: string[] = [];
  const lines: ProposalLine[] = [];
  for (const i of items.slice(0, MENTOR_LIMITS.maxChapterItems)) {
    const row = findRow(rows, Number(i.classId), String(i.subject), String(i.chapter));
    if (!row) { notes.push(`Skipped "${String(i.chapter)}": not in your ${ctx.state.examPreference || 'JEE'} syllabus.`); continue; }
    const status = i.status as SyllabusStatus;
    if (row.status === status) continue;
    lines.push(line(row.chapter, [{ t: 'setChapter', classId: row.classId, subject: row.subject, chapter: row.chapter, status }], {
      meta: `Class ${row.classId} ${row.subject} · ${STATUS_WORD[row.status]} → ${STATUS_WORD[status]}`,
    }));
  }
  if (!lines.length) return { ok: false, error: notes.join(' ') || 'Those chapters are already marked that way.' };
  return {
    ok: true,
    proposal: {
      id: generateId(), kind: 'chapters', title: `UPDATE ${lines.length} CHAPTER${lines.length === 1 ? '' : 'S'}`,
      summary, lines, notes, commitLabel: 'UPDATE SYLLABUS', source: 'model', status: 'pending',
    },
  };
};

/* ── Preferences and dates ── */

const prefsProposal = (ctx: ProposalContext, args: Record<string, unknown>, summary: string): Built => {
  const exam: ExamPreference = ctx.state.examPreference || 'JEE';
  const lines: ProposalLine[] = [];
  const notes: string[] = [];
  if (Array.isArray(args.weeklyHours) && args.weeklyHours.length === 7) {
    const wk = (args.weeklyHours as number[]).map(h => Math.max(0, Math.min(14, Math.round(h * 4) / 4)));
    lines.push(line('Study hours per day', [{ t: 'setPrefs', prefs: { weeklyHours: wk } as Partial<MentorPrefs> }], {
      meta: wk.map((h, d) => `${DAY_NAMES[d]} ${h}h`).join(' · '),
    }));
  }
  if (Array.isArray(args.restDays)) {
    const rd = [...new Set(args.restDays as number[])].sort();
    lines.push(line('Rest days', [{ t: 'setPrefs', prefs: { restDays: rd } }], {
      meta: rd.length ? rd.map(d => DAY_NAMES[d]).join(', ') : 'None',
    }));
  }
  if (isDate(args.syllabusBy)) {
    if (args.syllabusBy <= ctx.today) notes.push('Ignored the syllabus deadline: it is not in the future.');
    else lines.push(line('Finish the syllabus by', [{ t: 'setPrefs', prefs: { syllabusBy: args.syllabusBy } }], { meta: formatDay(args.syllabusBy) }));
  }
  if (isDate(args.examDate)) {
    if (args.examDate <= ctx.today) notes.push('Ignored the exam date: it is not in the future.');
    else lines.push(line(`${exam} exam date`, [{ t: 'setExamDate', exam, date: args.examDate }], { meta: formatDay(args.examDate) }));
  }
  if (!lines.length) return { ok: false, error: notes.join(' ') || 'Nothing to save.' };
  return {
    ok: true,
    proposal: {
      id: generateId(), kind: 'prefs', title: 'SAVE YOUR SETTINGS', summary, lines, notes,
      commitLabel: 'SAVE', source: 'model', status: 'pending',
    },
  };
};

/* ── Replan ── */

export const replanProposal = (plan: Replan, summary: string, source: Proposal['source']): Built => {
  if (!plan.moves.length && !plan.unplaced.length) return { ok: false, error: 'Nothing has slipped — no planned cards are overdue.' };
  const lines = plan.moves.map(m => line(m.text, [{ t: 'patchTask', id: m.taskId, patch: { dueAt: m.to } }], {
    meta: `${formatDay(m.from)} → ${formatDay(m.to)} · ${fmtMins(m.estMins)}`,
  }));
  const notes: string[] = [];
  if (plan.unplaced.length) {
    notes.push(`${plan.unplaced.length} card${plan.unplaced.length === 1 ? '' : 's'} (${fmtMins(plan.unplaced.reduce((a, u) => a + u.estMins, 0))}) fit nowhere in the next ${plan.horizon} days without overloading them. That is a roadmap problem, not a scheduling one — ask the Mentor to re-plan the roadmap.`);
    for (const u of plan.unplaced) {
      lines.push(line(u.text, [{ t: 'deleteTask', id: u.taskId }], { meta: `Doesn't fit · drop it`, destructive: true, checked: false }));
    }
  }
  return {
    ok: true,
    proposal: {
      id: generateId(), kind: 'replan', title: `REPLAN ${plan.moves.length + plan.unplaced.length} SLIPPED CARD${plan.moves.length + plan.unplaced.length === 1 ? '' : 'S'}`,
      summary, lines, notes, commitLabel: 'REPLAN', source, status: 'pending',
    },
  };
};

/* ── From a model tool call ── */

export const proposalFromTool = (
  name: string,
  args: Record<string, unknown>,
  ctx: ProposalContext,
  deps: { redistribute: (horizon: number) => Replan },
): Built => {
  const summary = clipSummary(args.summary);
  switch (name) {
    case 'propose_tasks':
      return tasksProposal(
        ctx,
        String(args.date),
        (args.items as Record<string, unknown>[]).map(i => ({
          text: String(i.text).slice(0, 140),
          subject: i.subject as Subject,
          chapter: typeof i.chapter === 'string' ? i.chapter : undefined,
          estMins: Number(i.estMins),
        })),
        summary,
        args.placeOnTimeline === true,
        'model',
      );
    case 'propose_task_changes':
      return changesProposal(ctx, args.changes as Record<string, unknown>[], summary);
    case 'propose_roadmap':
      return roadmapProposal(ctx, {
        targetDate: String(args.targetDate),
        hoursPerDay: typeof args.hoursPerDay === 'number' ? args.hoursPerDay : undefined,
        restDays: Array.isArray(args.restDays) ? (args.restDays as number[]) : undefined,
        exclude: Array.isArray(args.exclude) ? (args.exclude as { classId: number; subject: string; chapter: string }[]) : undefined,
      }, summary, 'model');
    case 'propose_chapter_status':
      return chaptersProposal(ctx, args.items as Record<string, unknown>[], summary);
    case 'propose_preferences':
      return prefsProposal(ctx, args, summary);
    case 'propose_replan':
      return replanProposal(deps.redistribute(typeof args.horizonDays === 'number' ? args.horizonDays : 7), summary, 'model');
    default:
      return { ok: false, error: `Unknown proposal ${name}.` };
  }
};

/** The ops a card would apply right now, with the student's ticks and minute edits. */
export const opsFor = (p: Proposal): MentorOp[] =>
  p.lines.filter(l => l.checked).flatMap(l => l.ops.map(op => {
    if (l.mins === undefined) return op;
    if (op.t === 'addTask') return { ...op, task: { ...op.task, estMins: l.mins } };
    if (op.t === 'placeTask') return { ...op, durationMins: l.mins };
    return op;
  }));
