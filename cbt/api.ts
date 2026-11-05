/* ── CBT: the database ──
   Every read and write of supabase/cbt.sql goes through here. Rows are mapped
   to the camelCase shapes in ./types at this boundary and nowhere else.

   Nothing here is a security boundary: every call is re-checked by RLS against
   `has_feature('cbt')`, so a caller without the feature gets empty lists and
   refused writes whatever this file does.

   The shared NTA bank (supabase/pyq.sql) is read only through definer RPCs:
   an index without the questions, the images of your own paper's questions,
   and its answers once it is submitted. Its figures are `pyq:<paper>/<file>`
   here, and are signed from the `pyq` bucket. */

import { supabase } from '../supabaseClient';
import { BankQuestion, BankSource, Blueprint, CbtPaper, PaperBank, PaperKind, PaperScore, QAnswer, QStatus, Resp } from './types';

export const BUCKET = 'qbank';
export const PYQ_BUCKET = 'pyq';
/** Marks a figure path as the shared bank's, so it is signed from `pyq`. */
export const PYQ_PREFIX = 'pyq:';

/* ── Access ── */

/** Whether the signed-in account holds a feature. Any error (no migration, no session) is "no". */
export const hasFeature = async (feature: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('has_feature', { p_feature: feature });
  return !error && data === true;
};

/* ── Mapping ── */

/* eslint-disable @typescript-eslint/no-explicit-any */
const toQuestion = (r: any): BankQuestion => ({
  id: r.id,
  sourceId: r.source_id,
  number: r.number ?? null,
  kind: r.kind,
  body: r.body,
  options: Array.isArray(r.options) ? r.options.map(String) : null,
  answer: (r.answer ?? null) as QAnswer | null,
  figures: Array.isArray(r.figures) ? r.figures : [],
  subject: r.subject,
  classId: r.class_id ?? null,
  chapter: r.chapter ?? null,
  topic: r.topic ?? null,
  year: r.year ?? null,
  shift: r.shift ?? null,
  difficulty: r.difficulty ?? null,
  confidence: r.confidence ?? null,
  status: r.status,
  textHash: r.text_hash,
});

const toSource = (r: any): BankSource => ({
  id: r.id, name: r.name, fileHash: r.file_hash, pages: r.pages ?? null, extractor: r.extractor ?? null, createdAt: r.created_at,
});

/* The clock's used time rides in `responses` under CLOCK_KEY, so it needs no
   new column (and works on every database this client may meet). It is
   lifted out here and put back by savePaperProgress; nothing else sees it. */
const CLOCK_KEY = '__clock';
const splitResponses = (raw: any): { responses: Record<string, Resp>; usedMs: number | null } => {
  const all = { ...(raw ?? {}) };
  const clock = all[CLOCK_KEY];
  delete all[CLOCK_KEY];
  return { responses: all as Record<string, Resp>, usedMs: clock && Number.isFinite(clock.ms) ? Math.max(0, clock.ms) : null };
};

const toPaper = (r: any): CbtPaper => ({
  id: r.id,
  bank: r.bank === 'pyq' ? 'pyq' : 'private',
  name: r.name,
  kind: r.kind,
  blueprint: r.blueprint as Blueprint,
  seed: Number(r.seed),
  questionIds: r.question_ids ?? [],
  ...splitResponses(r.responses),
  startedAt: r.started_at ?? null,
  submittedAt: r.submitted_at ?? null,
  score: (r.score ?? null) as PaperScore | null,
  mockId: r.mock_id ?? null,
  createdAt: r.created_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const fail = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

/* ── Bank ── */

const QUESTION_COLUMNS = 'id,source_id,number,kind,body,options,answer,figures,subject,class_id,chapter,topic,year,shift,difficulty,confidence,status,text_hash';

/** The whole bank, paged past PostgREST's 1,000-row default. */
export const fetchQuestions = async (): Promise<BankQuestion[]> => {
  const out: BankQuestion[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from('qbank_questions').select(QUESTION_COLUMNS).order('created_at').range(from, from + page - 1);
    fail(error, 'Loading the bank');
    out.push(...(data ?? []).map(toQuestion));
    if (!data || data.length < page) break;
  }
  return out;
};

export const fetchQuestionsById = async (ids: string[]): Promise<BankQuestion[]> => {
  if (!ids.length) return [];
  const out: BankQuestion[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from('qbank_questions').select(QUESTION_COLUMNS).in('id', ids.slice(i, i + 150));
    fail(error, 'Loading questions');
    out.push(...(data ?? []).map(toQuestion));
  }
  return out;
};

export const fetchSources = async (): Promise<BankSource[]> => {
  const { data, error } = await supabase.from('qbank_sources').select('id,name,file_hash,pages,extractor,created_at').order('created_at', { ascending: false });
  fail(error, 'Loading sources');
  return (data ?? []).map(toSource);
};

export interface QuestionPatch {
  body?: string;
  answer?: QAnswer | null;
  classId?: 11 | 12;
  chapter?: string;
  status?: QStatus;
}

export const updateQuestion = async (id: string, p: QuestionPatch): Promise<BankQuestion> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.body !== undefined) row.body = p.body;
  if (p.answer !== undefined) row.answer = p.answer;
  if (p.classId !== undefined) row.class_id = p.classId;
  if (p.chapter !== undefined) row.chapter = p.chapter;
  if (p.status !== undefined) row.status = p.status;
  const { data, error } = await supabase.from('qbank_questions').update(row).eq('id', id).select(QUESTION_COLUMNS).single();
  fail(error, 'Saving the question');
  return toQuestion(data);
};

/** Deletes the source, its questions (cascade) and its figures. */
export const deleteSource = async (userId: string, sourceId: string): Promise<void> => {
  const folder = `${userId}/${sourceId}`;
  // Listing is paged at 1,000; a chapter-wise book can carry more figures than that.
  for (let round = 0; round < 50; round++) {
    const { data: files } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
    if (!files?.length) break;
    const { error } = await supabase.storage.from(BUCKET).remove(files.map(f => `${folder}/${f.name}`));
    if (error || files.length < 1000) break;
  }
  const { error } = await supabase.from('qbank_sources').delete().eq('id', sourceId);
  fail(error, 'Deleting the source');
};

/* ── Import ── */

export const createSource = async (s: { name: string; fileHash: string; pages: number | null; exam: string; extractor: string | null }): Promise<BankSource> => {
  const { data, error } = await supabase
    .from('qbank_sources')
    .insert({ name: s.name, file_hash: s.fileHash, pages: s.pages, exam: s.exam, extractor: s.extractor })
    .select('id,name,file_hash,pages,extractor,created_at')
    .single();
  if (error?.code === '23505') throw new Error('This PDF is already in your bank.');
  fail(error, 'Creating the source');
  return toSource(data);
};

export const uploadFigure = async (path: string, blob: Blob): Promise<void> => {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: true });
  fail(error, 'Uploading a figure');
};

export interface NewQuestionRow {
  source_id: string;
  number: string | null;
  kind: string;
  body: string;
  options: string[] | null;
  answer: QAnswer | null;
  figures: string[];
  subject: string;
  class_id: number | null;
  chapter: string | null;
  topic: string | null;
  year: number | null;
  shift: string | null;
  difficulty: number | null;
  confidence: number | null;
  status: QStatus;
  text_hash: string;
}

/** Inserts in chunks; a question already in the bank (same text hash) is skipped. Returns how many landed. */
export const insertQuestions = async (rows: NewQuestionRow[]): Promise<number> => {
  let landed = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await supabase
      .from('qbank_questions')
      .upsert(rows.slice(i, i + 100), { onConflict: 'user_id,text_hash', ignoreDuplicates: true })
      .select('id');
    fail(error, 'Saving questions');
    landed += data?.length ?? 0;
  }
  return landed;
};

/* ── Figures ── */

const signFrom = async (bucket: string, paths: string[], prefix: string): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, 60 * 60 * 6);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach(d => { if (d.signedUrl && d.path) out[prefix + d.path] = d.signedUrl; });
  return out;
};

/** Path → signed URL. `pyq:`-prefixed paths come from the shared bucket, keyed back by the prefixed path. */
export const signFigures = async (paths: string[]): Promise<Record<string, string>> => {
  const shared = paths.filter(p => p.startsWith(PYQ_PREFIX)).map(p => p.slice(PYQ_PREFIX.length));
  const own = paths.filter(p => !p.startsWith(PYQ_PREFIX));
  const [a, b] = await Promise.all([signFrom(BUCKET, own, ''), signFrom(PYQ_BUCKET, shared, PYQ_PREFIX)]);
  return { ...a, ...b };
};

/* ── Papers ── */

const PAPER_COLUMNS_V1 = 'id,name,kind,blueprint,seed,question_ids,responses,started_at,submitted_at,score,mock_id,created_at';
const PAPER_COLUMNS = `${PAPER_COLUMNS_V1},bank`;
/** Postgres' "column does not exist": pyq.sql has not been run, so every paper is private. */
const NO_COLUMN = '42703';

/** One bank's papers, newest first. Before pyq.sql there is no `bank` column, and every paper is the private bank's. */
export const fetchPapers = async (bank: PaperBank = 'private', limit = 60): Promise<CbtPaper[]> => {
  const { data, error } = await supabase.from('cbt_papers').select(PAPER_COLUMNS).eq('bank', bank).order('created_at', { ascending: false }).limit(limit);
  if (error?.code === NO_COLUMN) {
    if (bank === 'pyq') return [];
    const old = await supabase.from('cbt_papers').select(PAPER_COLUMNS_V1).order('created_at', { ascending: false }).limit(limit);
    fail(old.error, 'Loading papers');
    return (old.data ?? []).map(toPaper);
  }
  fail(error, 'Loading papers');
  return (data ?? []).map(toPaper);
};

export const fetchPaper = async (id: string): Promise<CbtPaper | null> => {
  let { data, error } = await supabase.from('cbt_papers').select(PAPER_COLUMNS).eq('id', id).maybeSingle();
  if (error?.code === NO_COLUMN) ({ data, error } = await supabase.from('cbt_papers').select(PAPER_COLUMNS_V1).eq('id', id).maybeSingle());
  fail(error, 'Loading the paper');
  return data ? toPaper(data) : null;
};

export const createPaper = async (p: { name: string; kind: PaperKind; blueprint: Blueprint; seed: number; questionIds: string[] }): Promise<CbtPaper> => {
  const { data, error } = await supabase
    .from('cbt_papers')
    .insert({ name: p.name, kind: p.kind, blueprint: p.blueprint, seed: p.seed, question_ids: p.questionIds })
    .select(PAPER_COLUMNS)
    .single();
  fail(error, 'Creating the paper');
  return toPaper(data);
};

export const savePaperProgress = async (id: string, p: {
  responses?: Record<string, Resp>;
  /** Saved with the responses (it lives inside them). */
  usedMs?: number;
  startedAt?: string;
  submittedAt?: string;
  score?: PaperScore;
  mockId?: string | null;
}): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.responses) row.responses = p.usedMs === undefined ? p.responses : { ...p.responses, [CLOCK_KEY]: { ms: Math.round(p.usedMs) } };
  if (p.startedAt) row.started_at = p.startedAt;
  if (p.submittedAt) row.submitted_at = p.submittedAt;
  if (p.score) row.score = p.score;
  if (p.mockId !== undefined) row.mock_id = p.mockId;
  const { error } = await supabase.from('cbt_papers').update(row).eq('id', id);
  fail(error, 'Saving the paper');
};

export const deletePaper = async (id: string): Promise<void> => {
  const { error } = await supabase.from('cbt_papers').delete().eq('id', id);
  fail(error, 'Deleting the paper');
};

/** When each question last appeared in a submitted paper — the generator's freshness input. */
export const lastSeenFrom = (papers: CbtPaper[]): Map<string, number> => {
  const m = new Map<string, number>();
  papers.forEach(p => {
    const at = Date.parse(p.submittedAt ?? p.startedAt ?? '');
    if (!Number.isFinite(at)) return;
    p.questionIds.forEach(id => { if ((m.get(id) ?? 0) < at) m.set(id, at); });
  });
  return m;
};

/* ── The shared NTA bank (pyq.sql) ── */

/** Whether this account may sit papers from the shared bank. Any error (no migration, no session) is "no". */
export const hasPyq = async (): Promise<boolean> => {
  const { data, error } = await supabase.rpc('pyq_open');
  return !error && data === true;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A pyq row as a bank question. `answer` stays null until the paper is submitted. */
const fromPyq = (r: any): BankQuestion => ({
  id: r.id,
  sourceId: 'pyq',
  number: r.number === null || r.number === undefined ? null : String(r.number),
  kind: r.kind,
  body: r.body ?? '',
  options: Array.isArray(r.options) ? r.options.map(String) : null,
  answer: null,
  figures: Array.isArray(r.figures) ? r.figures.map((f: string) => PYQ_PREFIX + f) : [],
  subject: r.subject,
  classId: r.class_id ?? null,
  chapter: r.chapter ?? null,
  topic: null,
  year: r.exam_date ? Number(String(r.exam_date).slice(0, 4)) : null,
  shift: r.paper ?? null,
  difficulty: null,
  confidence: null,
  status: 'ready',
  textHash: r.id,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Every answerable question's metadata (no images, no answers): what the generator builds from. */
export const fetchPyqIndex = async (): Promise<BankQuestion[]> => {
  const out: BankQuestion[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.rpc('pyq_index').range(from, from + page - 1);
    fail(error, 'Loading the bank');
    const rows = (data ?? []) as unknown[];
    out.push(...rows.map(fromPyq));
    if (rows.length < page) break;
  }
  return out;
};

/** A sitting is made by the server, which checks the questions and the daily limit. */
export const createPyqPaper = async (p: { name: string; kind: PaperKind; blueprint: Blueprint; seed: number; questionIds: string[] }): Promise<CbtPaper> => {
  const { data, error } = await supabase.rpc('pyq_create_paper', {
    p_name: p.name, p_kind: p.kind, p_blueprint: p.blueprint, p_seed: p.seed, p_question_ids: p.questionIds,
  });
  if (error?.code === '54000') throw new Error('That’s 12 papers today. Come back tomorrow.');
  fail(error, 'Creating the paper');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Creating the paper: no paper came back.');
  return toPaper(row);
};

/** The images of one of your own pyq papers' questions, without answers. */
export const fetchPaperQuestions = async (paperId: string): Promise<BankQuestion[]> => {
  const { data, error } = await supabase.rpc('pyq_paper_questions', { p_paper: paperId });
  fail(error, 'Loading the questions');
  return ((data ?? []) as unknown[]).map(fromPyq);
};

export interface PaperAnswer { answer: QAnswer | null; searchText: string | null }

/** Question id → NTA's answer and its search words. Given once the paper is submitted, or at once for practice. */
export const fetchPaperAnswers = async (paperId: string): Promise<Map<string, PaperAnswer>> => {
  const { data, error } = await supabase.rpc('pyq_paper_answers', { p_paper: paperId });
  fail(error, 'Loading the answers');
  return new Map(((data ?? []) as { id: string; answer: QAnswer | null; search_text?: string | null }[])
    .map(r => [r.id, { answer: r.answer ?? null, searchText: r.search_text ?? null }]));
};

/** Merges answers (and search words) into a paper's questions. */
export const withAnswers = (qs: BankQuestion[], answers: Map<string, PaperAnswer>): BankQuestion[] =>
  qs.map(q => {
    const a = answers.get(q.id);
    return { ...q, answer: a?.answer ?? null, searchText: a?.searchText ?? null };
  });

/** A pyq paper's questions, with answers merged in when it has been submitted. */
export const loadPyqPaper = async (paper: CbtPaper): Promise<BankQuestion[]> => {
  const qs = await fetchPaperQuestions(paper.id);
  if (!paper.submittedAt) return qs;
  return withAnswers(qs, await fetchPaperAnswers(paper.id));
};
