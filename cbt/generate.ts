/* ── Building a paper ──
   Pure and React-free, the contract schedule/schedule.ts and mocks/insights.ts
   keep: the components ask, this answers, and nothing here touches the
   network or the clock it was not handed.

   Not "pick 25 at random". Two stages per section:

   1. Split the section's slots across chapters by JEE weightage, scaled by how
      many questions the bank actually holds for each chapter, with a cap per
      chapter so one fat PDF chapter cannot take over a paper.
   2. Inside each chapter, draw without replacement, weighted by freshness
      (never-seen first, recently-seen out), by the error notebook (a question
      you got wrong comes back after a gap), by difficulty mix and by spread
      across years.

   When the bank is too thin, rules relax in a fixed order — recency, then the
   chapter cap — and every relaxation is written into `notes`, which the
   student reads before starting. A paper is never silently short.

   Seeded (mulberry32), so a seed and a bank reproduce the same paper. */

import { BankQuestion, Blueprint, ChapterRef, CbtSubject, PaperSpec, QKind, Section } from './types';

export const JEE_MAIN = {
  subjects: ['Physics', 'Chemistry', 'Maths'] as CbtSubject[],
  perSubject: { mcq: 20, numerical: 5 } as Record<QKind, number>,
  marking: { right: 4, wrong: -1 },
  minutesPerSubject: 60,
};

/** Seen this recently and the question stays out of a paper unless the bank runs dry. */
export const RECENT_DAYS = 21;
/** A question still open in the error notebook comes back after this long. */
export const RETRY_AFTER_DAYS = 7;
const DAY = 86_400_000;

/* ── Randomness ── */

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

const shuffle = <T,>(xs: T[], rand: () => number): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickWeighted = <T,>(items: T[], weights: number[], rand: () => number): number => {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return Math.floor(rand() * items.length);
  let r = rand() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return items.length - 1;
};

/* ── Inputs ── */

export const chapterOf = (q: Pick<BankQuestion, 'classId' | 'subject' | 'chapter'>): string =>
  `${q.classId}|${q.subject}|${q.chapter}`;
export const refKey = (c: ChapterRef): string => `${c.classId}|${c.subject}|${c.chapter}`;

export interface GenInput {
  /** Every `ready` question in the bank. */
  questions: BankQuestion[];
  spec: PaperSpec;
  /** Question id → when it last appeared in a paper (epoch ms). */
  lastSeen: Map<string, number>;
  /** Bank ids still open in the error notebook. */
  openErrors: Set<string>;
  /** Chapter keys (`11|Physics|Gravitation`) the mock insights call weak. */
  weakChapters: Set<string>;
  /** Restrict to these chapter keys (the "only what I've started" switch). */
  allowedChapters: Set<string> | null;
  /** A chapter's share of its subject in JEE Main, in percent. */
  weightOf: (q: Pick<BankQuestion, 'classId' | 'subject' | 'chapter'>) => number;
  now: number;
  seed: number;
}

/* ── Stage 1: slots per chapter ──
   Largest remainder over weight × availability, then capped, with whatever the
   cap or availability refuses handed to the next chapters in line. */

interface Bucket { key: string; weight: number; available: number; cap: number }

export const allocate = (quota: number, buckets: Bucket[]): Map<string, number> => {
  const out = new Map<string, number>(buckets.map(b => [b.key, 0]));
  let left = quota;
  let open = buckets.filter(b => b.available > 0 && b.cap > 0 && b.weight > 0);
  while (left > 0 && open.length) {
    const total = open.reduce((a, b) => a + b.weight, 0);
    const shares = open.map(b => ({ b, exact: (left * b.weight) / total }));
    let given = 0;
    shares.forEach(s => {
      const room = Math.min(s.b.available, s.b.cap) - (out.get(s.b.key) ?? 0);
      const n = Math.min(Math.floor(s.exact), room);
      out.set(s.b.key, (out.get(s.b.key) ?? 0) + n);
      given += n;
    });
    // Remainders, largest first; ties broken by weight, then key, so it is deterministic.
    const rest = shares
      .filter(s => (out.get(s.b.key) ?? 0) < Math.min(s.b.available, s.b.cap))
      .sort((a, b) => (b.exact % 1) - (a.exact % 1) || b.b.weight - a.b.weight || (a.b.key < b.b.key ? -1 : 1));
    for (const s of rest) {
      if (given >= left) break;
      out.set(s.b.key, (out.get(s.b.key) ?? 0) + 1);
      given += 1;
    }
    if (given === 0) break;
    left -= given;
    open = open.filter(b => (out.get(b.key) ?? 0) < Math.min(b.available, b.cap));
  }
  return out;
};

/* ── Stage 2: questions inside a chapter ── */

const band = (d: number | null): 'easy' | 'medium' | 'hard' | null =>
  d === null ? null : d <= 2 ? 'easy' : d === 3 ? 'medium' : 'hard';
const TARGET_MIX = { easy: 0.3, medium: 0.5, hard: 0.2 };

const freshness = (q: BankQuestion, input: GenInput): number => {
  const seen = input.lastSeen.get(q.id);
  const age = seen === undefined ? Infinity : (input.now - seen) / DAY;
  if (input.openErrors.has(q.id)) return age >= RETRY_AFTER_DAYS ? 2.5 : 0.05;
  if (seen === undefined) return 1;
  return age >= RECENT_DAYS ? 0.35 : 0.05;
};

const isRecent = (q: BankQuestion, input: GenInput): boolean => {
  const seen = input.lastSeen.get(q.id);
  if (seen === undefined) return false;
  const age = (input.now - seen) / DAY;
  return input.openErrors.has(q.id) ? age < RETRY_AFTER_DAYS : age < RECENT_DAYS;
};

interface Tally { bands: Record<'easy' | 'medium' | 'hard', number>; years: Map<number, number>; total: number }

const drawFrom = (pool: BankQuestion[], n: number, tally: Tally, sectionSize: number, input: GenInput, rand: () => number): BankQuestion[] => {
  const left = [...pool];
  const out: BankQuestion[] = [];
  while (out.length < n && left.length) {
    const weights = left.map(q => {
      let w = freshness(q, input);
      const b = band(q.difficulty);
      if (b) w *= tally.bands[b] < TARGET_MIX[b] * sectionSize ? 1.5 : 0.6;
      if (q.year !== null) w /= 1 + (tally.years.get(q.year) ?? 0) * 0.5;
      return w;
    });
    const i = pickWeighted(left, weights, rand);
    const q = left.splice(i, 1)[0];
    out.push(q);
    const b = band(q.difficulty);
    if (b) tally.bands[b] += 1;
    if (q.year !== null) tally.years.set(q.year, (tally.years.get(q.year) ?? 0) + 1);
    tally.total += 1;
  }
  return out;
};

/* ── One section ── */

const SUBJECT_NOUN: Record<QKind, string> = { mcq: 'MCQs', numerical: 'numericals' };

const fillSection = (
  subject: CbtSubject, kind: QKind, want: number, candidates: BankQuestion[],
  input: GenInput, rand: () => number, notes: string[], equalWeights: boolean,
): string[] => {
  const picked: BankQuestion[] = [];
  const perChapter = new Map<string, number>();
  const tally: Tally = { bands: { easy: 0, medium: 0, hard: 0 }, years: new Map(), total: 0 };
  // Chosen chapters are the paper, so they are not capped against each other.
  const baseCap = equalWeights ? Infinity : kind === 'mcq' ? 3 : 1;
  // Levels: 0 strict · 1 recent questions allowed · 2 no chapter cap.
  for (let level = 0; level < 3 && picked.length < want; level++) {
    const taken = new Set(picked.map(q => q.id));
    const eligible = candidates.filter(q => !taken.has(q.id) && (level >= 1 || !isRecent(q, input)));
    if (!eligible.length) continue;
    const byChapter = new Map<string, BankQuestion[]>();
    eligible.forEach(q => {
      const k = chapterOf(q);
      byChapter.set(k, [...(byChapter.get(k) ?? []), q]);
    });
    const buckets: Bucket[] = Array.from(byChapter.entries()).map(([key, qs]) => {
      const w = equalWeights ? 1 : Math.max(0.5, input.weightOf(qs[0]));
      return {
        key,
        weight: w * (input.weakChapters.has(key) ? 1.4 : 1),
        available: qs.length,
        cap: level >= 2 ? qs.length : Math.max(0, baseCap - (perChapter.get(key) ?? 0)),
      };
    });
    const before = picked.length;
    const slots = allocate(want - picked.length, buckets);
    // Chapters in a stable order so the seed alone decides the draw.
    Array.from(slots.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).forEach(([key, n]) => {
      if (!n) return;
      const got = drawFrom(byChapter.get(key) ?? [], n, tally, want, input, rand);
      picked.push(...got);
      perChapter.set(key, (perChapter.get(key) ?? 0) + got.length);
    });
    const added = picked.length - before;
    if (level === 1 && added > 0) {
      notes.push(`${added} ${subject} ${SUBJECT_NOUN[kind]} were seen in the last ${RECENT_DAYS} days — not enough fresh ones.`);
    }
    if (level === 2 && added > 0) {
      notes.push(`${subject} ${SUBJECT_NOUN[kind]} lean on a few chapters — the bank is thin elsewhere.`);
    }
  }
  if (picked.length < want) {
    notes.push(`Only ${picked.length} of ${want} ${subject} ${SUBJECT_NOUN[kind]} in your bank. The paper is shorter.`);
  }
  return shuffle(picked.map(q => q.id), rand);
};

/* ── The paper ── */

export interface Generated { blueprint: Blueprint; questionIds: string[] }

export const generatePaper = (input: GenInput): Generated => {
  const rand = mulberry32(input.seed);
  const notes: string[] = [];
  const pool = input.questions.filter(q =>
    q.status === 'ready' && q.chapter && q.classId && q.answer
    && (!input.allowedChapters || input.allowedChapters.has(chapterOf(q))),
  );
  const { spec } = input;
  const sections: Section[] = [];

  if (spec.kind === 'full' || spec.kind === 'subject') {
    const subjects = spec.kind === 'full' ? JEE_MAIN.subjects : [spec.subject];
    subjects.forEach(subject => {
      (['mcq', 'numerical'] as QKind[]).forEach(kind => {
        const want = JEE_MAIN.perSubject[kind];
        const ids = fillSection(subject, kind, want, pool.filter(q => q.subject === subject && q.kind === kind), input, rand, notes, false);
        sections.push({ subject, kind, want, ids });
      });
    });
  } else {
    /* Chosen chapters: the count is split across the chapters evenly (the
       student picked them, so weightage does not get a vote), about four MCQs
       to every numerical, then grouped into sections by subject. */
    const chosen = new Set(spec.chapters.map(refKey));
    const inScope = pool.filter(q => chosen.has(chapterOf(q)));
    const subjects = JEE_MAIN.subjects.filter(s => spec.chapters.some(c => c.subject === s));
    const bySubject = subjects.map(s => ({ s, n: spec.chapters.filter(c => c.subject === s).length }));
    const split = allocate(spec.count, bySubject.map(x => ({ key: x.s, weight: x.n, available: spec.count, cap: spec.count })));
    subjects.forEach(subject => {
      const n = split.get(subject) ?? 0;
      if (!n) return;
      const nums = inScope.filter(q => q.subject === subject && q.kind === 'numerical').length;
      const wantNum = Math.min(nums, Math.round(n / 5));
      const kinds: [QKind, number][] = [['mcq', n - wantNum], ['numerical', wantNum]];
      kinds.forEach(([kind, want]) => {
        if (!want) return;
        const ids = fillSection(subject, kind, want, inScope.filter(q => q.subject === subject && q.kind === kind), input, rand, notes, true);
        sections.push({ subject, kind, want, ids });
      });
    });
  }

  const questionIds = sections.flatMap(s => s.ids);
  const durationMins = spec.kind === 'full'
    ? JEE_MAIN.minutesPerSubject * JEE_MAIN.subjects.length
    : spec.kind === 'subject'
      ? JEE_MAIN.minutesPerSubject
      // Main's own pace: 180 minutes for 75 questions.
      : Math.max(10, Math.round(questionIds.length * 2.4));

  return {
    blueprint: { exam: 'mains', spec, durationMins, marking: JEE_MAIN.marking, sections, notes },
    questionIds,
  };
};

/** "JEE Main · Full paper", "Physics paper", "3 chapters · 30 Qs". */
export const paperTitle = (spec: PaperSpec): string =>
  spec.kind === 'full' ? 'JEE Main full paper'
    : spec.kind === 'subject' ? `${spec.subject} paper`
      : `${spec.chapters.length === 1 ? spec.chapters[0].chapter : `${spec.chapters.length} chapters`} · ${spec.count} Qs`;
