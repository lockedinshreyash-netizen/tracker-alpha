/* ── The only way the Mentor changes anything ──
   Deterministic by construction: every id an op needs is minted when the
   proposal is built, never inside the reducer. React (StrictMode, and any
   concurrent re-render) may run a state updater twice, and a reducer that
   called generateId() would create a different block on each run.

   A proposal the student accepts becomes a list of ops, and `applyOps` is a
   pure reducer over AppState that returns the new state AND the exact inverse
   list, so UNDO is the same function run backwards.

   It reuses the app's own write rules rather than restating them:
   completion goes through `moveCard` (the single path that keeps `completed`,
   `completedAt` and `column` in lockstep), new cards get `nextOrder`, and a
   chapter status change stamps `completedAt`/`lastRevisedAt` exactly the way
   `toggleChapterStatus` does.

   Every op re-checks the CURRENT state. A card deleted on another device
   between the proposal and the tap is skipped and reported, not resurrected. */

import { AppState, ChapterProgress, ExamPreference, MentorPrefs, MentorState, Roadmap, RoadmapRevision, ScheduleBlock, Subject, SyllabusStatus, Task } from '../types';
import { generateId } from '../utils';
import { moveCard, nextOrder } from '../board/board';
import { firstFreeSlot, materializeDay, SNAP_MINS } from '../schedule/schedule';
import { normalizeMentor, normalizeSchedule } from '../state';

export type MentorOp =
  | { t: 'addTask'; task: Task }
  | { t: 'patchTask'; id: string; patch: Pick<Partial<Task>, 'text' | 'dueAt' | 'estMins' | 'subject'> }
  | { t: 'completeTask'; id: string }
  | { t: 'deleteTask'; id: string }
  | { t: 'restoreTask'; task: Task }
  | { t: 'removeTask'; id: string }
  | { t: 'placeTask'; blockId: string; taskId: string; date: string; durationMins: number; fromMinute: number }
  | { t: 'removeBlock'; id: string }
  | { t: 'setChapter'; classId: 11 | 12; subject: Subject; chapter: string; status: SyllabusStatus }
  | { t: 'restoreChapter'; classId: 11 | 12; subject: Subject; chapter: string; prev: ChapterProgress | null }
  | { t: 'setPrefs'; prefs: Partial<MentorPrefs> }
  | { t: 'setRoadmap'; roadmap: Roadmap }
  | { t: 'restoreMentor'; mentor: MentorState }
  | { t: 'setExamDate'; exam: ExamPreference; date: string | null }
  | { t: 'restoreExamDates'; examDates: Partial<Record<ExamPreference, string>> };

export interface ApplyResult {
  state: AppState;
  /** Run these through applyOps to put everything back. */
  inverse: MentorOp[];
  applied: number;
  skipped: string[];
}

const sameChapter = (p: ChapterProgress, classId: number, subject: string, chapter: string) =>
  p.classId === classId && p.subject === subject && p.chapter === chapter;

/** A brand-new Mentor card, ready for an `addTask` op. Order is assigned at apply time. */
export const newMentorTask = (input: {
  text: string; subject: Subject; chapter?: string; estMins: number; dueAt: string;
}): Task => ({
  id: generateId(),
  text: input.text.slice(0, 140),
  completed: false,
  subject: input.subject,
  column: 'todo',
  dueAt: input.dueAt,
  estMins: input.estMins,
  chapter: input.chapter,
  origin: 'mentor',
});

export const applyOps = (state: AppState, ops: MentorOp[], today: string): ApplyResult => {
  let s = state;
  const inverse: MentorOp[] = [];
  const skipped: string[] = [];
  let applied = 0;

  const findTask = (id: string) => s.tasks.find(t => t.id === id);
  const mentorOf = () => normalizeMentor(s.mentor);

  for (const op of ops) {
    switch (op.t) {
      case 'addTask': {
        if (findTask(op.task.id)) { skipped.push(`Already added: ${op.task.text}`); break; }
        const task = { ...op.task, order: nextOrder(s.tasks, op.task.column ?? 'todo') };
        s = { ...s, tasks: [...s.tasks, task] };
        inverse.push({ t: 'removeTask', id: task.id });
        applied++;
        break;
      }
      case 'patchTask': {
        const before = findTask(op.id);
        if (!before) { skipped.push('A card that no longer exists'); break; }
        /* A new due date re-arms its reminder by itself — the fire key
           contains the due instant (see Task.remindedKey). */
        s = { ...s, tasks: s.tasks.map(t => (t.id === op.id ? { ...t, ...op.patch } : t)) };
        inverse.push({ t: 'restoreTask', task: before });
        applied++;
        break;
      }
      case 'completeTask': {
        const before = findTask(op.id);
        if (!before) { skipped.push('A card that no longer exists'); break; }
        if (before.completed) { skipped.push(`Already done: ${before.text}`); break; }
        s = { ...s, tasks: moveCard(s.tasks, op.id, 'done', 0, today) };
        inverse.push({ t: 'restoreTask', task: before });
        applied++;
        break;
      }
      case 'deleteTask': {
        const before = findTask(op.id);
        if (!before) { skipped.push('A card that no longer exists'); break; }
        s = { ...s, tasks: s.tasks.filter(t => t.id !== op.id) };
        inverse.push({ t: 'restoreTask', task: before });
        applied++;
        break;
      }
      case 'restoreTask': {
        const exists = !!findTask(op.task.id);
        s = {
          ...s,
          tasks: exists ? s.tasks.map(t => (t.id === op.task.id ? op.task : t)) : [...s.tasks, op.task],
        };
        applied++;
        break;
      }
      case 'removeTask': {
        if (!findTask(op.id)) break;
        s = { ...s, tasks: s.tasks.filter(t => t.id !== op.id) };
        applied++;
        break;
      }
      case 'placeTask': {
        const task = findTask(op.taskId);
        if (!task) { skipped.push('A card that no longer exists'); break; }
        const schedule = normalizeSchedule(s.schedule);
        const from = Math.ceil(op.fromMinute / SNAP_MINS) * SNAP_MINS;
        const start = firstFreeSlot(materializeDay(schedule, op.date), from, op.durationMins);
        if (schedule.blocks.some(b => b.id === op.blockId)) { skipped.push('Already on the timeline'); break; }
        const block: ScheduleBlock = {
          id: op.blockId,
          date: op.date,
          subject: task.subject,
          chapter: task.chapter,
          start,
          durationMins: op.durationMins,
          kind: 'study',
          taskId: task.id,
        };
        s = { ...s, schedule: { ...schedule, blocks: [...schedule.blocks, block] } };
        inverse.push({ t: 'removeBlock', id: block.id });
        applied++;
        break;
      }
      case 'removeBlock': {
        const schedule = normalizeSchedule(s.schedule);
        s = { ...s, schedule: { ...schedule, blocks: schedule.blocks.filter(b => b.id !== op.id) } };
        applied++;
        break;
      }
      case 'setChapter': {
        const prev = s.progress.find(p => sameChapter(p, op.classId, op.subject, op.chapter)) ?? null;
        if ((prev?.status ?? 'not_started') === op.status) { skipped.push(`${op.chapter} is already ${op.status.replace('_', ' ')}`); break; }
        const rest = s.progress.filter(p => !sameChapter(p, op.classId, op.subject, op.chapter));
        const next: ChapterProgress = {
          classId: op.classId, subject: op.subject, chapter: op.chapter, status: op.status,
          notes: prev?.notes,
          completedAt: op.status === 'completed' ? today : prev?.completedAt,
          lastRevisedAt: op.status === 'revision_pending' ? today : prev?.lastRevisedAt,
        };
        s = { ...s, progress: [...rest, next] };
        inverse.push({ t: 'restoreChapter', classId: op.classId, subject: op.subject, chapter: op.chapter, prev });
        applied++;
        break;
      }
      case 'restoreChapter': {
        const rest = s.progress.filter(p => !sameChapter(p, op.classId, op.subject, op.chapter));
        s = { ...s, progress: op.prev ? [...rest, op.prev] : rest };
        applied++;
        break;
      }
      case 'setPrefs': {
        const m = mentorOf();
        inverse.push({ t: 'restoreMentor', mentor: m });
        s = { ...s, mentor: { ...m, prefs: { ...m.prefs, ...op.prefs } } };
        applied++;
        break;
      }
      case 'setRoadmap': {
        const m = mentorOf();
        inverse.push({ t: 'restoreMentor', mentor: m });
        const line: RoadmapRevision = {
          revision: op.roadmap.revision,
          createdOn: op.roadmap.createdOn,
          targetDate: op.roadmap.targetDate,
          baselineHours: op.roadmap.baselineHours,
        };
        s = {
          ...s,
          mentor: {
            ...m,
            roadmap: op.roadmap,
            roadmapHistory: [...m.roadmapHistory.filter(h => h.revision !== line.revision), line].slice(-10),
          },
        };
        applied++;
        break;
      }
      case 'restoreMentor': {
        s = { ...s, mentor: op.mentor };
        applied++;
        break;
      }
      case 'setExamDate': {
        const before = { ...(s.examDates ?? {}) };
        const next = { ...before };
        if (op.date) next[op.exam] = op.date;
        else delete next[op.exam];
        s = { ...s, examDates: next };
        inverse.push({ t: 'restoreExamDates', examDates: before });
        applied++;
        break;
      }
      case 'restoreExamDates': {
        s = { ...s, examDates: op.examDates };
        applied++;
        break;
      }
    }
  }

  if (applied > 0) s = { ...s, lastUpdated: Date.now() };
  return { state: s, inverse: inverse.reverse(), applied, skipped };
};
