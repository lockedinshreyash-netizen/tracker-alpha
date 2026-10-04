/* ── CBT: the database ──
   Every read and write of supabase/cbt.sql goes through here. Rows are mapped
   to the camelCase shapes in ./types at this boundary and nowhere else.

   Nothing here is a security boundary: every call is re-checked by RLS against
   `has_feature('cbt')`, so a caller without the feature gets empty lists and
   refused writes whatever this file does. */

import { supabase } from '../supabaseClient';
import { BankQuestion, BankSource, Blueprint, CbtPaper, PaperKind, PaperScore, QAnswer, QStatus, Resp } from './types';

export const BUCKET = 'qbank';

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

const toPaper = (r: any): CbtPaper => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  blueprint: r.blueprint as Blueprint,
  seed: Number(r.seed),
  questionIds: r.question_ids ?? [],
  responses: (r.responses ?? {}) as Record<string, Resp>,
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

export const signFigures = async (paths: string[]): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 6);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach(d => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
  return out;
};

/* ── Papers ── */

const PAPER_COLUMNS = 'id,name,kind,blueprint,seed,question_ids,responses,started_at,submitted_at,score,mock_id,created_at';

export const fetchPapers = async (limit = 60): Promise<CbtPaper[]> => {
  const { data, error } = await supabase.from('cbt_papers').select(PAPER_COLUMNS).order('created_at', { ascending: false }).limit(limit);
  fail(error, 'Loading papers');
  return (data ?? []).map(toPaper);
};

export const fetchPaper = async (id: string): Promise<CbtPaper | null> => {
  const { data, error } = await supabase.from('cbt_papers').select(PAPER_COLUMNS).eq('id', id).maybeSingle();
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
  startedAt?: string;
  submittedAt?: string;
  score?: PaperScore;
  mockId?: string | null;
}): Promise<void> => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.responses) row.responses = p.responses;
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
