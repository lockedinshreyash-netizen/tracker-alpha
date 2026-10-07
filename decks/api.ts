/* ── Alpha Decks: the database ──
   Every read and write of supabase/decks.sql goes through here, and rows
   become the camelCase shapes in ./types at this boundary and nowhere else.

   Nothing here is a security boundary. Who may read a deck, edit it, publish
   it or record a review on it is decided by row-level security and by the
   definer functions' own checks; a caller who skips this file and talks to
   PostgREST directly meets exactly the same answers.

   Nothing ever loads a whole deck except export, which pages through it on
   purpose. A review session asks for the next hundred cards; the browser asks
   for fifty notes at a time. */

import { supabase } from '../supabaseClient';
import type {
  ActivityDay, AdminDeckStat, DeckCollection, DeckMeta, DeckScope, DeckStatus, DeckSummary, DraftNote, ExploreDeck, Note, Pack, PackMeta, PreviewCard, Progress, QueueCard,
} from './types';
import { contentHash } from './hash';
import { studyDayBounds } from './day';

export const MEDIA_BUCKET = 'decks';

/* ── Errors ── */

export class DuplicateNoteError extends Error {
  constructor() { super('This card is already in the deck.'); }
}

/** The only thing that reaches the screen. Postgres' wording never does. */
export const humanError = (error: unknown): string => {
  if (error instanceof DuplicateNoteError) return error.message;
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  if (/payment required/i.test(message)) return 'This pack has to be unlocked first.';
  if (code === '42501' || /row-level security|not authorized/i.test(message)) return "You don't have permission to do that.";
  /* PGRST205 is a missing table and PGRST202 a missing function: decks.sql
     has not been run on this project yet. */
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205' || /does not exist|could not find the (table|function)/i.test(message)) {
    return "Decks aren't set up on this server yet.";
  }
  if (/at least one \{\{c1/i.test(message)) return 'A cloze card needs at least one {{c1::…}}.';
  if (code === '23514' || /violates check constraint/i.test(message)) return "That doesn't fit — check the length of what you wrote.";
  if (code === '23505') return 'That already exists.';
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again in a moment.';
};

const fail = (error: unknown) => { if (error) throw error; };

/* ── Mapping ── */
/* eslint-disable @typescript-eslint/no-explicit-any */

const toSummary = (r: any): DeckSummary => ({
  id: r.deck_id,
  scope: r.scope,
  status: r.status,
  collection: r.collection ?? null,
  title: r.title,
  description: r.description ?? null,
  subject: r.subject ?? null,
  classId: r.class_id ?? null,
  chapter: r.chapter ?? null,
  ownerId: r.owner_id ?? null,
  updatedAt: r.updated_at,
  packId: r.pack_id ?? null,
  newPerDay: r.new_per_day,
  maxReviews: r.max_reviews,
  desiredRetention: Number(r.desired_retention),
  total: r.total,
  unseen: r.unseen,
  newAvailable: r.new_available,
  due: r.due,
  learning: r.learning,
  young: r.young,
  mature: r.mature,
  suspended: r.suspended,
  reviewsToday: r.reviews_today,
  nextDue: r.next_due ?? null,
});

const toNote = (r: any): Note => ({
  id: r.id,
  deckId: r.deck_id,
  kind: r.kind,
  front: r.front,
  back: r.back ?? '',
  tags: r.tags ?? [],
  guid: r.guid ?? null,
  version: r.version ?? 1,
  updatedAt: r.updated_at,
});

const toProgress = (r: any): Progress | null =>
  r.state === null || r.state === undefined || r.state === 0 || !r.due
    ? null
    : {
        state: r.state,
        due: r.due,
        stability: Number(r.stability),
        difficulty: Number(r.difficulty),
        scheduledDays: r.scheduled_days,
        learningSteps: r.learning_steps,
        reps: r.reps,
        lapses: r.lapses,
        lastReview: r.last_review ?? null,
      };

const toQueueCard = (r: any): QueueCard => ({
  cardId: r.card_id,
  noteId: r.note_id,
  ord: r.ord,
  kind: r.kind,
  front: r.front,
  back: r.back ?? '',
  tags: r.tags ?? [],
  progress: toProgress(r),
});

/** Progress as the server stores it — the `prev`/`next` of a review. */
export const progressRow = (p: Progress) => ({
  state: p.state,
  due: p.due,
  stability: p.stability,
  difficulty: p.difficulty,
  scheduled_days: p.scheduledDays,
  learning_steps: p.learningSteps,
  reps: p.reps,
  lapses: p.lapses,
  last_review: p.lastReview,
});
export type ProgressRow = ReturnType<typeof progressRow>;

export const progressFromRow = (r: ProgressRow): Progress => ({
  state: r.state,
  due: r.due,
  stability: r.stability,
  difficulty: r.difficulty,
  scheduledDays: r.scheduled_days,
  learningSteps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  lastReview: r.last_review,
});

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Library ── */

export const fetchSummaries = async (): Promise<DeckSummary[]> => {
  const { start, end } = studyDayBounds();
  const { data, error } = await supabase.rpc('deck_summaries', { p_day_start: start.toISOString(), p_day_end: end.toISOString() });
  fail(error);
  return (data ?? []).map(toSummary);
};

export const fetchActivity = async (deckId: string, days = 14): Promise<ActivityDay[]> => {
  const since = new Date(studyDayBounds().start.getTime() - (days - 1) * 86_400_000);
  const { data, error } = await supabase.rpc('deck_activity', { p_deck: deckId, p_since: since.toISOString() });
  fail(error);
  return (data ?? []).map((r: { day: string; reviews: number; again: number }) => ({ day: r.day, reviews: r.reviews, again: r.again }));
};

export const exploreDecks = async (search = ''): Promise<ExploreDeck[]> => {
  const { data, error } = await supabase.rpc('explore_decks', { p_search: search.trim() || null });
  fail(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.deck_id, title: r.title, description: r.description ?? null, subject: r.subject ?? null,
    classId: r.class_id ?? null, chapter: r.chapter ?? null, collection: r.collection ?? 'more', publishedAt: r.published_at ?? null,
    cards: r.cards, inLibrary: r.in_library,
  }));
};

export const addToLibrary = async (deckId: string): Promise<void> => {
  const { error } = await supabase.from('user_decks').upsert({ deck_id: deckId }, { onConflict: 'user_id,deck_id', ignoreDuplicates: true });
  fail(error);
};

export const removeFromLibrary = async (deckId: string): Promise<void> => {
  const { error } = await supabase.from('user_decks').delete().eq('deck_id', deckId);
  fail(error);
};

export const updateDeckSettings = async (
  deckId: string,
  s: { newPerDay: number; maxReviews: number; desiredRetention: number },
): Promise<void> => {
  const { error } = await supabase.from('user_decks')
    .update({ new_per_day: s.newPerDay, max_reviews: s.maxReviews, desired_retention: s.desiredRetention })
    .eq('deck_id', deckId);
  fail(error);
};

/* ── Decks ── */

const metaRow = (m: Partial<DeckMeta>) => ({
  ...(m.title !== undefined ? { title: m.title.trim().slice(0, 120) } : {}),
  ...(m.description !== undefined ? { description: m.description?.trim() ? m.description.trim().slice(0, 600) : null } : {}),
  ...(m.subject !== undefined ? { subject: m.subject } : {}),
  ...(m.classId !== undefined ? { class_id: m.classId } : {}),
  ...(m.chapter !== undefined ? { chapter: m.chapter } : {}),
});

/**
 * A new deck. A global one always starts as a draft — the insert policy
 * refuses anything else — so an empty deck never lands on every student's
 * screen by accident — and on the shelf the administrator chose ("more"
 * when none was given; the database fills that in too).
 */
export const createDeck = async (ownerId: string, scope: DeckScope, meta: DeckMeta, collection: DeckCollection = 'more'): Promise<string> => {
  const { data, error } = await supabase.from('decks')
    .insert({
      owner_id: ownerId,
      scope,
      status: scope === 'global' ? 'draft' : 'published',
      ...(scope === 'global' ? { collection } : {}),
      ...metaRow(meta),
    })
    .select('id')
    .single();
  fail(error);
  return (data as { id: string }).id;
};

export const updateDeck = async (deckId: string, meta: Partial<DeckMeta>): Promise<void> => {
  const { error } = await supabase.from('decks').update(metaRow(meta)).eq('id', deckId);
  fail(error);
};

export const setDeckStatus = async (deckId: string, status: DeckStatus): Promise<void> => {
  const { data, error } = await supabase.from('decks').update({ status }).eq('id', deckId).select('id');
  fail(error);
  if (!data?.length) throw Object.assign(new Error('not authorized'), { code: '42501' });
};

/** Move an Alpha deck between Alpha Essentials and More from Alpha. Administrators only (RLS). */
export const setDeckCollection = async (deckId: string, collection: DeckCollection): Promise<void> => {
  const { data, error } = await supabase.from('decks').update({ collection }).eq('id', deckId).select('id');
  fail(error);
  if (!data?.length) throw Object.assign(new Error('not authorized'), { code: '42501' });
};

/** Delete a deck and its images. Storage has no cascade, so the folder is cleared here. */
export const deleteDeck = async (deckId: string): Promise<void> => {
  await clearMedia(deckId).catch(() => { /* orphaned images are untidy, not wrong */ });
  const { data, error } = await supabase.from('decks').delete().eq('id', deckId).select('id');
  fail(error);
  if (!data?.length) throw Object.assign(new Error('not authorized'), { code: '42501' });
};

export const resetDeckProgress = async (deckId: string): Promise<void> => {
  const { error } = await supabase.rpc('reset_deck_progress', { p_deck: deckId });
  fail(error);
};

export const fetchAdminStats = async (): Promise<AdminDeckStat[]> => {
  const { data, error } = await supabase.rpc('admin_deck_stats');
  fail(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => ({
    id: r.deck_id, title: r.title, status: r.status, collection: r.collection ?? 'more', subject: r.subject ?? null, chapter: r.chapter ?? null,
    updatedAt: r.updated_at, publishedAt: r.published_at ?? null, cards: r.cards, students: r.students,
    active7d: r.active_7d, reviews7d: r.reviews_7d, againRate: r.again_rate === null ? null : Number(r.again_rate),
    packId: r.pack_id ?? null, packTitle: r.pack_title ?? null,
  }));
};

/* ── Packs ──
   A pack is a set of Alpha decks. Students add or remove a whole pack;
   administrators make one, choose its decks and publish it. Which decks are
   in a pack, and publishing, go through functions so a pack is never half
   built. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toPack = (r: any, at: string | null): Pack => ({
  id: r.pack_id,
  title: r.title,
  description: r.description ?? null,
  subject: r.subject ?? null,
  finish: r.finish === 'paper' ? 'paper' : 'ink',
  status: r.status,
  sortOrder: r.sort_order ?? 0,
  at,
  inLibrary: !!r.in_library,
  students: r.students ?? 0,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decks: (r.decks ?? []).map((d: any) => ({ id: d.id, title: d.title, subject: d.subject ?? null, status: d.status, cards: Number(d.cards ?? 0) })),
  packNo: r.pack_no ?? 0,
  access: r.access ?? 'free',
  priceInr: r.price_inr ?? null,
  examLine: r.exam_line ?? null,
  unlocked: r.unlocked ?? true,
});

/** Three cards from a pack, for the store. */
export const packPreview = async (packId: string): Promise<PreviewCard[]> => {
  const { data, error } = await supabase.rpc('pack_preview', { p_pack: packId });
  fail(error);
  return (data ?? []).map((r: { deck_id: string; kind: PreviewCard['kind']; front: string; back: string | null }) => ({
    deckId: r.deck_id, kind: r.kind, front: r.front, back: r.back ?? '',
  }));
};

/** Published packs, plus any the caller added (and drafts, for administrators). */
export const explorePacks = async (): Promise<Pack[]> => {
  const { data, error } = await supabase.rpc('explore_packs');
  fail(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => toPack(r, r.published_at ?? null));
};

/** Put a pack and every deck in it on your shelf. Returns how many decks were added. */
export const addPack = async (packId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('add_pack', { p_pack: packId });
  fail(error);
  return Number(data ?? 0);
};

/** Take a pack and its decks off your shelf. Progress is kept. */
export const removePack = async (packId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_pack', { p_pack: packId });
  fail(error);
};

const packRow = (m: Partial<PackMeta>) => ({
  ...(m.title !== undefined ? { title: m.title.trim().slice(0, 120) } : {}),
  ...(m.description !== undefined ? { description: m.description?.trim() ? m.description.trim().slice(0, 600) : null } : {}),
  ...(m.subject !== undefined ? { subject: m.subject } : {}),
  ...(m.finish !== undefined ? { finish: m.finish } : {}),
  // Access and price travel together: the table refuses one without the other.
  ...(m.access !== undefined ? { access: m.access, price_inr: m.access === 'paid' ? m.priceInr : null } : {}),
  ...(m.examLine !== undefined ? { exam_line: m.examLine?.trim() ? m.examLine.trim().slice(0, 60) : null } : {}),
});

/** A new pack, always a draft — the insert policy refuses anything else. */
export const createPack = async (meta: PackMeta): Promise<string> => {
  const { data, error } = await supabase.from('deck_packs').insert({ status: 'draft', ...packRow(meta) }).select('id').single();
  fail(error);
  return (data as { id: string }).id;
};

export const updatePack = async (packId: string, meta: Partial<PackMeta>): Promise<void> => {
  const { data, error } = await supabase.from('deck_packs').update(packRow(meta)).eq('id', packId).select('id');
  fail(error);
  if (!data?.length) throw Object.assign(new Error('not authorized'), { code: '42501' });
};

/** Delete a pack. Its decks stay, as loose Alpha decks. */
export const deletePack = async (packId: string): Promise<void> => {
  const { data, error } = await supabase.from('deck_packs').delete().eq('id', packId).select('id');
  fail(error);
  if (!data?.length) throw Object.assign(new Error('not authorized'), { code: '42501' });
};

/** Which decks are in a pack, in this order. A deck listed here leaves any other pack. */
export const setPackDecks = async (packId: string, deckIds: string[]): Promise<void> => {
  const { error } = await supabase.rpc('set_pack_decks', { p_pack: packId, p_decks: deckIds });
  fail(error);
};

/** Publishing a pack publishes its draft decks too, unless told not to. */
export const setPackStatus = async (packId: string, status: DeckStatus, withDecks = true): Promise<void> => {
  const { error } = await supabase.rpc('set_pack_status', { p_pack: packId, p_status: status, p_with_decks: withDecks });
  fail(error);
};

export const fetchAdminPacks = async (): Promise<Pack[]> => {
  const { data, error } = await supabase.rpc('admin_pack_stats');
  fail(error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((r: any) => toPack(r, r.updated_at ?? null));
};

/* ── Notes ── */

const NOTE_COLUMNS = 'id,deck_id,kind,front,back,tags,guid,version,updated_at';

export const addNote = async (deckId: string, draft: DraftNote): Promise<Note> => {
  const { data, error } = await supabase.from('deck_notes').insert({
    deck_id: deckId,
    kind: draft.kind,
    front: draft.front,
    back: draft.back,
    tags: draft.tags,
    content_hash: await contentHash(draft.front, draft.back),
    // New cards are introduced in the order they were written.
    position: Date.now(),
  }).select(NOTE_COLUMNS).single();
  if ((error as { code?: string } | null)?.code === '23505') throw new DuplicateNoteError();
  fail(error);
  return toNote(data);
};

export const updateNote = async (noteId: string, draft: DraftNote): Promise<Note> => {
  const { data, error } = await supabase.from('deck_notes').update({
    kind: draft.kind,
    front: draft.front,
    back: draft.back,
    tags: draft.tags,
    content_hash: await contentHash(draft.front, draft.back),
  }).eq('id', noteId).select(NOTE_COLUMNS).single();
  if ((error as { code?: string } | null)?.code === '23505') throw new DuplicateNoteError();
  fail(error);
  return toNote(data);
};

export const deleteNotes = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from('deck_notes').delete().in('id', ids);
  fail(error);
};

export const fetchNote = async (noteId: string): Promise<Note> => {
  const { data, error } = await supabase.from('deck_notes').select(NOTE_COLUMNS).eq('id', noteId).single();
  fail(error);
  return toNote(data);
};

export const PAGE = 50;

/** One page of a deck's notes, for the browser. Search is over the raw text. */
export const listNotes = async (
  deckId: string,
  opts: { search?: string; tag?: string | null; page?: number } = {},
): Promise<{ notes: Note[]; total: number }> => {
  const page = opts.page ?? 0;
  let q = supabase.from('deck_notes').select(NOTE_COLUMNS, { count: 'exact' }).eq('deck_id', deckId);
  const s = opts.search?.trim();
  if (s) {
    const pat = `%${s.replace(/[\\%_]/g, c => `\\${c}`)}%`;
    q = q.or(`front.ilike.${JSON.stringify(pat)},back.ilike.${JSON.stringify(pat)}`);
  }
  if (opts.tag) q = q.contains('tags', [opts.tag]);
  const { data, error, count } = await q.order('position').order('id').range(page * PAGE, page * PAGE + PAGE - 1);
  fail(error);
  return { notes: (data ?? []).map(toNote), total: count ?? 0 };
};

/** The tags in use in a deck, most common first — the editor's suggestions. */
export const deckTags = async (deckId: string): Promise<string[]> => {
  const { data, error } = await supabase.from('deck_notes').select('tags').eq('deck_id', deckId).order('updated_at', { ascending: false }).limit(1000);
  fail(error);
  const counts = new Map<string, number>();
  (data ?? []).forEach((r: { tags: string[] }) => r.tags.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 60);
};

/** Every note, paged — export only. */
export const fetchAllNotes = async (deckId: string): Promise<Note[]> => {
  const out: Note[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('deck_notes').select(NOTE_COLUMNS).eq('deck_id', deckId)
      .order('position').order('id').range(from, from + 999);
    fail(error);
    out.push(...(data ?? []).map(toNote));
    if (!data || data.length < 1000) return out;
  }
};

/* ── Import ── */

export interface HashedNote extends DraftNote {
  contentHash: string;
}

export const hashNotes = (notes: DraftNote[]): Promise<HashedNote[]> =>
  Promise.all(notes.map(async n => ({ ...n, contentHash: await contentHash(n.front, n.back) })));

/** Which hashes and guids already exist in the deck. */
export const existingKeys = async (deckId: string, notes: HashedNote[]): Promise<{ hashes: Set<string>; guids: Set<string> }> => {
  const hashes = new Set<string>();
  const guids = new Set<string>();
  for (let i = 0; i < notes.length; i += 1000) {
    const chunk = notes.slice(i, i + 1000);
    const { data, error } = await supabase.rpc('existing_note_keys', {
      p_deck: deckId,
      p_hashes: chunk.map(n => n.contentHash),
      p_guids: chunk.flatMap(n => (n.guid ? [n.guid] : [])),
    });
    fail(error);
    (data ?? []).forEach((r: { content_hash: string; guid: string | null }) => {
      hashes.add(r.content_hash);
      if (r.guid) guids.add(r.guid);
    });
  }
  return { hashes, guids };
};

export interface ImportTotals {
  inserted: number;
  duplicates: number;
  failed: number;
}

/**
 * Insert in chunks of 500. Duplicates are skipped by the database itself
 * (`on conflict do nothing`), so two tabs importing the same file at once
 * still end with one copy of each card.
 */
export const importNotes = async (
  deckId: string,
  notes: HashedNote[],
  onProgress?: (done: number) => void,
): Promise<ImportTotals> => {
  const totals: ImportTotals = { inserted: 0, duplicates: 0, failed: 0 };
  for (let i = 0; i < notes.length; i += 500) {
    const chunk = notes.slice(i, i + 500).map(n => ({
      kind: n.kind, front: n.front, back: n.back, tags: n.tags, guid: n.guid ?? null, content_hash: n.contentHash,
    }));
    const { data, error } = await supabase.rpc('import_deck_notes', { p_deck: deckId, p_notes: chunk });
    fail(error);
    const r = data as ImportTotals;
    totals.inserted += r.inserted;
    totals.duplicates += r.duplicates;
    totals.failed += r.failed;
    onProgress?.(Math.min(notes.length, i + 500));
  }
  return totals;
};

/* ── Review ── */

export const fetchQueue = async (
  deckId: string,
  opts: { limit?: number; exclude?: string[]; tags?: string[] | null } = {},
): Promise<QueueCard[]> => {
  const { start, end } = studyDayBounds();
  const { data, error } = await supabase.rpc('review_queue', {
    p_deck: deckId,
    p_day_start: start.toISOString(),
    p_day_end: end.toISOString(),
    p_limit: opts.limit ?? 100,
    p_tags: opts.tags?.length ? opts.tags : null,
    p_exclude: opts.exclude ?? [],
  });
  fail(error);
  return (data ?? []).map((r: unknown) => ({ ...toQueueCard(r), deckId }));
};

export interface ReviewEntry {
  client_id: string;
  card_id: string;
  rating: number;
  reviewed_at: string;
  duration_ms: number;
  prev: ProgressRow | null;
  next: ProgressRow;
}

export const recordReviews = async (entries: ReviewEntry[]): Promise<number> => {
  const { data, error } = await supabase.rpc('record_reviews', { p_reviews: entries });
  fail(error);
  return Number(data ?? 0);
};

export const undoReview = async (clientId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('undo_review', { p_client_id: clientId });
  fail(error);
  return data === true;
};

/** Suspend (or bring back) every card of a note, for yourself. */
export const setNoteSuspended = async (noteId: string, suspended: boolean): Promise<void> => {
  const { data, error } = await supabase.from('deck_cards').select('id').eq('note_id', noteId);
  fail(error);
  for (const c of data ?? []) {
    const { error: e } = await supabase.rpc('set_card_suspended', { p_card: c.id, p_suspended: suspended });
    fail(e);
  }
};

/** Which of these notes the caller has suspended. */
export const suspendedNotes = async (deckId: string, noteIds: string[]): Promise<Set<string>> => {
  if (!noteIds.length) return new Set();
  const { data: cards, error } = await supabase.from('deck_cards').select('id,note_id').eq('deck_id', deckId).in('note_id', noteIds);
  fail(error);
  const byCard = new Map((cards ?? []).map((c: { id: string; note_id: string }) => [c.id, c.note_id]));
  if (!byCard.size) return new Set();
  const { data, error: e } = await supabase.from('user_card_progress').select('card_id').eq('suspended', true).in('card_id', Array.from(byCard.keys()));
  fail(e);
  return new Set((data ?? []).map((r: { card_id: string }) => byCard.get(r.card_id)!).filter(Boolean));
};

/* ── Media ── */

export const signMedia = async (paths: string[]): Promise<Record<string, string>> => {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 60 * 60 * 6);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  data.forEach(d => { if (d.signedUrl && d.path && !d.error) out[d.path] = d.signedUrl; });
  return out;
};

export const uploadMedia = async (path: string, blob: Blob): Promise<void> => {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, { contentType: blob.type, upsert: true, cacheControl: '31536000' });
  fail(error);
};

export const listMedia = async (deckId: string): Promise<string[]> => {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).list(deckId, { limit: 1000, offset });
    fail(error);
    names.push(...(data ?? []).map(f => f.name));
    if (!data || data.length < 1000) return names;
  }
};

const clearMedia = async (deckId: string): Promise<void> => {
  const names = await listMedia(deckId);
  for (let i = 0; i < names.length; i += 100) {
    await supabase.storage.from(MEDIA_BUCKET).remove(names.slice(i, i + 100).map(n => `${deckId}/${n}`));
  }
};
