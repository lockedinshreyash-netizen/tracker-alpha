/* ── Importing a bundle ──
   PDFs are read on the laptop (scripts/qbank/), not here: OCR runs locally
   and the app never holds an API key. What arrives is one JSON file per PDF —
   `alpha-qbank/1` — with figures inlined as data URIs. This file checks it
   field by field, decides each question's status, uploads the figures to the
   private bucket under the signed-in user's own folder, and inserts the rows.

   Status is decided here, not by the extractor:
   · no answer                         → ungraded (can never be in a paper)
   · answer + a chapter from our syllabus + confidence ≥ 0.85 → ready
   · anything else                     → needs_review
   An extractor that guesses a chapter name we do not have gets it cleared and
   the question sent to review, rather than a chapter that matches nothing in
   Syllabus or Mocks. */

import { getChaptersFor } from '../constants';
import { CbtSubject, QAnswer, QKind, QStatus } from './types';
import { NewQuestionRow, createSource, deleteSource, insertQuestions, uploadFigure } from './api';

export const BUNDLE_FORMAT = 'alpha-qbank/1';
export const READY_CONFIDENCE = 0.85;

const SUBJECTS: CbtSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];
const DATA_URI = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;
const MAX_FIGURE_BYTES = 2 * 1024 * 1024;

interface RawQuestion {
  number?: unknown; kind?: unknown; body?: unknown; options?: unknown; answer?: unknown; figures?: unknown;
  subject?: unknown; classId?: unknown; chapter?: unknown; topic?: unknown; year?: unknown; shift?: unknown;
  difficulty?: unknown; confidence?: unknown;
}

export interface ParsedQuestion {
  number: string | null;
  kind: QKind;
  body: string;
  options: string[] | null;
  answer: QAnswer | null;
  figures: { mime: string; data: string }[];
  subject: CbtSubject;
  classId: 11 | 12 | null;
  chapter: string | null;
  topic: string | null;
  year: number | null;
  shift: string | null;
  difficulty: number | null;
  confidence: number | null;
  status: QStatus;
}

export interface ParsedBundle {
  source: { name: string; fileHash: string; pages: number | null; exam: string; extractor: string | null };
  questions: ParsedQuestion[];
  /** Questions dropped as unusable, with why — shown before importing. */
  dropped: { at: number; why: string }[];
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
};
const int = (v: unknown, lo: number, hi: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/** Chapters as the Syllabus tab names them, across both exams' lists. */
const knownChapter = (classId: 11 | 12, subject: CbtSubject, chapter: string): string | null => {
  const all = new Set([...getChaptersFor('JEE', classId, subject), ...getChaptersFor('NEET', classId, subject)]);
  if (all.has(chapter)) return chapter;
  const lower = chapter.toLowerCase();
  return Array.from(all).find(c => c.toLowerCase() === lower) ?? null;
};

export const parseBundle = (raw: unknown): ParsedBundle => {
  const b = raw as { format?: unknown; source?: Record<string, unknown>; questions?: unknown } | null;
  if (!b || b.format !== BUNDLE_FORMAT) throw new Error(`Not a question bundle (expected format "${BUNDLE_FORMAT}").`);
  const s = b.source ?? {};
  const name = str(s.name, 120);
  const fileHash = typeof s.fileHash === 'string' && /^[0-9a-f]{64}$/.test(s.fileHash) ? s.fileHash : null;
  if (!name || !fileHash) throw new Error('The bundle has no source name or file hash.');
  if (!Array.isArray(b.questions) || !b.questions.length) throw new Error('The bundle has no questions.');

  const dropped: ParsedBundle['dropped'] = [];
  const questions: ParsedQuestion[] = [];
  (b.questions as RawQuestion[]).forEach((q, at) => {
    const kind = q.kind === 'mcq' || q.kind === 'numerical' ? q.kind : null;
    const body = str(q.body, 8000);
    const subject = SUBJECTS.includes(q.subject as CbtSubject) ? (q.subject as CbtSubject) : null;
    if (!kind || !body || !subject) { dropped.push({ at, why: 'missing kind, text or subject' }); return; }

    let options: string[] | null = null;
    if (kind === 'mcq') {
      const opts = Array.isArray(q.options) ? q.options.map(o => str(o, 2000)) : [];
      if (opts.length !== 4 || opts.some(o => !o)) { dropped.push({ at, why: 'an MCQ without four options' }); return; }
      options = opts as string[];
    }

    let answer: QAnswer | null = null;
    const a = q.answer as Record<string, unknown> | null | undefined;
    if (a && kind === 'mcq' && (a.option === 0 || a.option === 1 || a.option === 2 || a.option === 3)) answer = { option: a.option };
    if (a && kind === 'numerical' && typeof a.value === 'number' && Number.isFinite(a.value)) answer = { value: a.value };

    const figures: ParsedQuestion['figures'] = [];
    (Array.isArray(q.figures) ? q.figures : []).slice(0, 12).forEach(f => {
      const m = typeof f === 'string' ? DATA_URI.exec(f) : null;
      if (m && m[2].length * 0.75 <= MAX_FIGURE_BYTES) figures.push({ mime: m[1], data: m[2] });
    });

    const classId = q.classId === 11 || q.classId === 12 ? q.classId : null;
    const rawChapter = str(q.chapter, 120);
    const chapter = classId && rawChapter ? knownChapter(classId, subject, rawChapter) : null;
    const confidence = typeof q.confidence === 'number' && q.confidence >= 0 && q.confidence <= 1 ? q.confidence : null;

    const status: QStatus = !answer ? 'ungraded'
      : chapter && classId && (confidence ?? 0) >= READY_CONFIDENCE ? 'ready'
        : 'needs_review';

    questions.push({
      number: str(q.number, 20),
      kind, body, options, answer, figures, subject,
      classId,
      chapter,
      topic: str(q.topic, 60),
      year: int(q.year, 1978, 2100),
      shift: str(q.shift, 40),
      difficulty: int(q.difficulty, 1, 5),
      confidence,
      status,
    });
  });

  return {
    source: { name, fileHash, pages: int(s.pages, 0, 5000), exam: 'mains', extractor: str(s.extractor, 120) },
    questions,
    dropped,
  };
};

/* ── Hashing ── the same PYQ in two PDFs must hash the same, so whitespace,
   case and LaTeX spacing are flattened before hashing. Figures are not part
   of the hash: two scans of one figure never match byte for byte. */
export const normalizeForHash = (body: string, options: string[] | null): string =>
  [body, ...(options ?? [])]
    .join('␞')
    .replace(/\[\[fig:\d+\]\]/g, '')
    .replace(/\\[,;:! ]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

export const sha256 = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const toBlob = (mime: string, b64: string): Blob => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export interface ImportReport { added: number; duplicates: number; ready: number; review: number; ungraded: number }

export const importBundle = async (
  userId: string,
  bundle: ParsedBundle,
  onStep: (done: number, total: number) => void,
): Promise<ImportReport> => {
  const source = await createSource(bundle.source);
  try {
    return await fill(userId, source.id, bundle, onStep);
  } catch (e) {
    /* A half-imported source would block importing the same PDF again (its
       hash is unique), so a failed import takes itself back out. */
    await deleteSource(userId, source.id).catch(() => { /* best effort */ });
    throw e;
  }
};

const fill = async (
  userId: string,
  sourceId: string,
  bundle: ParsedBundle,
  onStep: (done: number, total: number) => void,
): Promise<ImportReport> => {
  const source = { id: sourceId };
  const rows: NewQuestionRow[] = [];
  const total = bundle.questions.length;
  let done = 0;

  // Figures four at a time: enough to be quick, few enough not to trip rate limits.
  const queue = [...bundle.questions.entries()];
  const work = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [, q] = next;
      const hash = await sha256(normalizeForHash(q.body, q.options));
      const figures: string[] = [];
      for (let i = 0; i < q.figures.length; i++) {
        const f = q.figures[i];
        const path = `${userId}/${source.id}/${hash.slice(0, 16)}-${i}.${EXT[f.mime]}`;
        await uploadFigure(path, toBlob(f.mime, f.data));
        figures.push(path);
      }
      rows.push({
        source_id: source.id, number: q.number, kind: q.kind, body: q.body, options: q.options, answer: q.answer, figures,
        subject: q.subject, class_id: q.classId, chapter: q.chapter, topic: q.topic, year: q.year, shift: q.shift,
        difficulty: q.difficulty, confidence: q.confidence, status: q.status, text_hash: hash,
      });
      done += 1;
      onStep(done, total);
    }
  };
  await Promise.all([work(), work(), work(), work()]);

  // Two questions inside one bundle can hash the same (a PYQ repeated in an index); keep the first.
  const seen = new Set<string>();
  const unique = rows.filter(r => (seen.has(r.text_hash) ? false : (seen.add(r.text_hash), true)));
  const added = await insertQuestions(unique);
  return {
    added,
    duplicates: rows.length - added,
    ready: unique.filter(r => r.status === 'ready').length,
    review: unique.filter(r => r.status === 'needs_review').length,
    ungraded: unique.filter(r => r.status === 'ungraded').length,
  };
};
