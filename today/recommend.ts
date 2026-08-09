/**
 * The coach: "I don't know what to study" -> one specific, timed instruction.
 *
 * Design rules this file is built around:
 *
 *  1. Recommend an ACTION, not a subject. "Study Physics" is not executable at
 *     9pm with 40 minutes left.
 *  2. Every recommendation carries its reason. If it cannot explain itself in
 *     one line it does not deserve first place — and a visible reason is what
 *     makes an override feel informed rather than defiant.
 *  3. Degrade, never go silent. No logs, no topics authored, no timestamps —
 *     each of those weakens the ranking but must still produce something.
 *  4. Never recommend abandoning a foundational chapter, and never let raw
 *     weightage override "finish what you already opened".
 */

import { AppState, ChapterProgress, DailyLog, ExamPreference, Subject } from '../types';
import { getISTDateString } from '../utils';
import { getChaptersFor } from '../constants';
import { getWeight, TIER_ORDER } from '../content';
import { Topic, TopicKind, topicsForChapter } from '../content/topics';

export type CoachAction = 'revise' | 'finish' | 'start' | 'drill';

export interface Recommendation {
  id: string;
  action: CoachAction;
  /** Imperative instruction, already phrased for the method. */
  headline: string;
  /** What to actually do with the time — the Feynman prompt, or equivalent. */
  method: string;
  subject: Subject;
  chapter: string;
  topic?: string;
  minutes: number;
  /** Why this, now. Shown verbatim. */
  reason: string;
  score: number;
}

/* Spaced repetition schedule, in days after completion. A chapter is "due"
   once it passes the next unmet checkpoint. */
const REVISION_CHECKPOINTS = [3, 7, 21, 45];

const daysBetween = (fromISO: string, toISO: string): number =>
  Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000);

/** Minutes of study still expected today, floored so a finished day still
    yields a short suggestion rather than nothing. */
export const minutesLeftToday = (state: AppState, today: string): number => {
  const done = state.logs.filter((l) => l.date === today).reduce((a, l) => a + l.hours, 0);
  return Math.max(20, Math.round((state.dailyGoalHours - done) * 60));
};

/** Days since a subject was last logged. `Infinity` when never logged. */
const staleness = (logs: DailyLog[], subject: Subject, today: string): number => {
  const last = logs.filter((l) => l.subject === subject).map((l) => l.date).sort().pop();
  return last ? daysBetween(last, today) : Infinity;
};

/** Hours already sunk into a chapter, from chapter-tagged logs only. Zero for
    everyone until session tagging has been in use for a while. */
const hoursOnChapter = (logs: DailyLog[], chapter: string): number =>
  logs.filter((l) => l.chapter === chapter).reduce((a, l) => a + l.hours, 0);

/**
 * Wording per topic kind. This is where the Feynman framing lives: for concepts
 * the instruction is to explain aloud without notes, because the point of the
 * technique is that stalling localises the gap.
 */
const methodFor = (kind: TopicKind, action: CoachAction, topic: string): string => {
  if (action === 'start') {
    return kind === 'numerical' || kind === 'derivation'
      ? `First pass on ${topic}. Read it once, then work two examples with the book shut.`
      : `First pass on ${topic}. Build the picture before the formulas.`;
  }
  switch (kind) {
    case 'concept':
      return `Explain ${topic} out loud, in plain words, no notes. Wherever you stall is the gap — go back only for that bit, then explain it again.`;
    case 'derivation':
      return `Derive ${topic} on blank paper from scratch. No peeking. If you get stuck, mark the line and restart from the top.`;
    case 'numerical':
      return `Work problems on ${topic} cold. Understanding it and being fast at it are different things.`;
    case 'recall':
      return `Dump everything you know about ${topic} from memory onto paper, then check it against the source and mark only what you missed.`;
  }
};

const fallbackMethod = (action: CoachAction, chapter: string): string =>
  action === 'start'
    ? `Open ${chapter} and get through the first section properly.`
    : action === 'finish'
      ? `Pick up ${chapter} where you stopped and close it out.`
      : `Explain the core ideas of ${chapter} out loud without notes. Where you stall is the gap.`;

/**
 * Choose which topic within a chapter to serve, rotating on `served` so the
 * same one is not offered every day. Falls back to undefined for chapters with
 * no authored topics, which the caller handles.
 */
const pickTopic = (
  topics: Topic[],
  served: Record<string, string>,
  today: string,
): Topic | undefined => {
  if (!topics.length) return undefined;
  const unserved = topics.filter((t) => !served[t.id]);
  if (unserved.length) return unserved[0];
  // All seen before: take the one served longest ago.
  return [...topics].sort((a, b) => (served[a.id] || '').localeCompare(served[b.id] || ''))[0];
};

export interface CoachInput {
  state: AppState;
  exam: ExamPreference;
  activeSubjects: Subject[];
  /** Injected so this stays pure and testable. */
  now?: Date;
}

export const buildRecommendations = ({ state, exam, activeSubjects, now = new Date() }: CoachInput): Recommendation[] => {
  const today = getISTDateString(now);
  const budget = minutesLeftToday(state, today);
  // 'General' has no syllabus, so it can never be recommended against.
  const subjects = activeSubjects.filter(
    (s): s is Exclude<Subject, 'General'> => s !== 'General',
  );
  const served = state.coach?.served || {};
  const dismissed = state.coach?.dismissedOn === today ? (state.coach?.dismissed || []) : [];

  const progressOf = (subject: Subject, chapter: string): ChapterProgress | undefined =>
    state.progress.find((p) => p.classId === state.currentClass && p.subject === subject && p.chapter === chapter);

  // How many chapters are already open. Sprawl is the real failure mode, so
  // starting anything new gets expensive past a small number.
  const openCount = state.progress.filter(
    (p) => p.classId === state.currentClass && p.status === 'in_progress' && subjects.some((s) => s === p.subject),
  ).length;

  const out: Recommendation[] = [];

  for (const subject of subjects) {
    const stale = staleness(state.logs, subject, today);
    // Neglect matters, but it saturates — 30 days away and 60 days away are the
    // same emergency.
    const neglectBoost = Math.min(stale === Infinity ? 25 : stale * 3, 30);

    for (const chapter of getChaptersFor(exam, state.currentClass, subject)) {
      const weight = getWeight(exam, state.currentClass, subject, chapter);
      const prog = progressOf(subject, chapter);
      const status = prog?.status || 'not_started';
      const topics = topicsForChapter(state.currentClass, subject, chapter);

      // Weight contribution: tier drives it, because the absolute percentages
      // are not reliable enough to rank on directly (see content/SOURCES.md).
      const tierScore = weight ? [40, 28, 16, 6][TIER_ORDER[weight.tier]] : 12;

      let action: CoachAction;
      let score = tierScore + neglectBoost;
      let reason: string;

      if (status === 'completed' || status === 'revision_pending') {
        const since = prog?.lastRevisedAt || prog?.completedAt;
        if (!since) {
          // No timestamp: pre-existing entry. Still offer revision, but weakly —
          // guessing at decay we cannot measure would be worse than under-ranking.
          action = 'revise';
          score = tierScore * 0.5;
          reason = `Marked done, but the app doesn’t know when — worth a check`;
        } else {
          const age = daysBetween(since, today);
          const due = REVISION_CHECKPOINTS.find((c) => age >= c);
          if (due === undefined) continue; // too fresh to revisit
          action = 'revise';
          score = tierScore + Math.min(age * 1.5, 45);
          reason = `${age} days cold${weight ? ` · ${weight.tier === 'critical' ? 'max damage' : weight.tier} chapter` : ''}`;
        }
      } else if (status === 'in_progress') {
        action = 'finish';
        const sunk = hoursOnChapter(state.logs, chapter);
        // Finishing what is open beats opening more, always.
        score += 25 + Math.min(sunk * 2, 20);
        reason = sunk >= 4
          ? `${sunk.toFixed(1)}h in and still open — close it out`
          : `Already open — finish it before starting anything new`;
      } else {
        action = 'start';
        // Each already-open chapter makes a new one less appealing.
        score += Math.max(0, 18 - openCount * 12);
        if (openCount >= 3) score -= 20;
        reason = weight?.foundational
          ? `Everything else in ${subject} leans on this`
          : `Heaviest chapter you haven’t opened${stale > 5 && stale !== Infinity ? ` · ${subject} untouched ${stale} days` : ''}`;
      }

      /* A topic the mastery test just caught outranks everything else in this
         chapter — it is the one place the app has direct evidence of a gap
         rather than an inference from dates and weightage. A `shaky` result
         counts too: the answer landed but the student said they guessed. */
      const failed = topics.filter((t) => {
        const r = state.topicMastery?.[t.id]?.result;
        return r === 'gap' || r === 'shaky';
      });
      const topic = failed.length
        ? pickTopic(failed, served, today)
        : pickTopic(topics, served, today);

      if (topic && failed.some((f) => f.id === topic.id)) {
        const r = state.topicMastery?.[topic.id]?.result;
        score += r === 'gap' ? 60 : 35;
        action = 'revise';
        reason = r === 'gap'
          ? `You got this wrong in the chapter test`
          : `You got this right but flagged it a guess`;
      }

      // Slot fit: a topic that does not fit the remaining time is a bad call
      // right now even if it is the most valuable thing overall.
      const minutes = topic ? (action === 'start' ? Math.round(topic.minutes * 1.4) : topic.minutes) : Math.min(45, budget);
      if (minutes > budget) score -= 15;

      const id = topic ? `${action}:${topic.id}` : `${action}:${state.currentClass}:${subject}:${chapter}`;
      if (dismissed.includes(id)) continue;

      out.push({
        id,
        action,
        subject,
        chapter,
        topic: topic?.name,
        minutes,
        score,
        headline: topic
          ? `${action === 'revise' ? 'Revise' : action === 'start' ? 'Start' : 'Finish'} ${topic.name}`
          : `${action === 'revise' ? 'Revise' : action === 'start' ? 'Start' : 'Finish'} ${chapter}`,
        method: topic ? methodFor(topic.kind, action, topic.name) : fallbackMethod(action, chapter),
        reason: `${chapter} · ${reason}`,
      });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 3);
};
