/* ── The Alpha Store: the database ──
   Every read and write of the store's sheets and kits (supabase/decks.sql
   §1c, §11) goes through here, and rows become the shapes in ./types at this
   boundary and nowhere else. Packs keep their calls in decks/api.ts, where
   the rack store and My Alpha already read them.

   Nothing here is a security boundary. Who may read a sheet, open a kit or
   add one is decided by the unlock predicates and the definer functions; a
   caller who skips this file meets exactly the same answers. */

import { supabase } from '../supabaseClient';
import type { DeckStatus, PreviewCard } from '../decks/types';
import type { Kit, KitItem, KitItemKind, KitMeta, Sheet, SheetEntry, SheetMeta } from './types';

export { humanError } from '../decks/api';

const fail = (error: unknown) => { if (error) throw error; };
const refused = () => Object.assign(new Error('not authorized'), { code: '42501' });

/* eslint-disable @typescript-eslint/no-explicit-any */

const toSheet = (r: any, at: string | null): Sheet => ({
  id: r.sheet_id,
  title: r.title,
  description: r.description ?? null,
  subject: r.subject ?? null,
  examLine: r.exam_line ?? null,
  access: r.access ?? 'free',
  priceInr: r.price_inr ?? null,
  status: r.status,
  sortOrder: r.sort_order ?? 0,
  sheetNo: r.sheet_no ?? 0,
  at,
  inLibrary: !!r.in_library,
  unlocked: r.unlocked ?? true,
  students: r.students ?? 0,
  decks: (r.decks ?? []).map((d: any) => ({ id: d.id, title: d.title, subject: d.subject ?? null, status: d.status, entries: Number(d.entries ?? 0) })),
  entries: Number(r.entries ?? 0),
});

const toItem = (i: any): KitItem => ({
  kind: i.kind as KitItemKind,
  id: i.id,
  title: i.title,
  subject: i.subject ?? null,
  status: i.status,
  count: Number(i.count ?? 0),
  ...(i.kind === 'pack' ? { decks: Number(i.decks ?? 0), finish: i.finish === 'paper' ? 'paper' as const : 'ink' as const, packNo: i.pack_no ?? 0 } : {}),
});

const toKit = (r: any, at: string | null): Kit => ({
  id: r.kit_id,
  title: r.title,
  tagline: r.tagline ?? null,
  description: r.description ?? null,
  subject: r.subject ?? null,
  examLine: r.exam_line ?? null,
  finish: r.finish === 'black' ? 'black' : 'white',
  access: r.access ?? 'free',
  priceInr: r.price_inr ?? null,
  status: r.status,
  sortOrder: r.sort_order ?? 0,
  kitNo: r.kit_no ?? 0,
  at,
  inLibrary: !!r.in_library,
  unlocked: r.unlocked ?? true,
  students: r.students ?? 0,
  items: (r.items ?? []).map(toItem),
});

/* ── Students ── */

/** Published sheets, plus any on the caller's shelf (and drafts, for administrators). */
export const exploreSheets = async (): Promise<Sheet[]> => {
  const { data, error } = await supabase.rpc('explore_sheets');
  fail(error);
  return (data ?? []).map((r: any) => toSheet(r, r.published_at ?? null));
};

export const exploreKits = async (): Promise<Kit[]> => {
  const { data, error } = await supabase.rpc('explore_kits');
  fail(error);
  return (data ?? []).map((r: any) => toKit(r, r.published_at ?? null));
};

/** The first eight formulas of a sheet, for the store's teaser. */
export const sheetPreview = async (sheetId: string): Promise<PreviewCard[]> => {
  const { data, error } = await supabase.rpc('sheet_preview', { p_sheet: sheetId });
  fail(error);
  return (data ?? []).map((r: any) => ({ deckId: r.deck_id, kind: r.kind, front: r.front, back: r.back ?? '' }));
};

/** Every formula on a sheet the caller has unlocked, in reading order. */
export const sheetNotes = async (sheetId: string): Promise<SheetEntry[]> => {
  const { data, error } = await supabase.rpc('sheet_notes', { p_sheet: sheetId });
  fail(error);
  return (data ?? []).map((r: any) => ({
    deckId: r.deck_id, deckTitle: r.deck_title, noteId: r.note_id, kind: r.kind, front: r.front, back: r.back ?? '', tags: r.tags ?? [],
  }));
};

export const addSheet = async (sheetId: string): Promise<void> => {
  const { error } = await supabase.rpc('add_sheet', { p_sheet: sheetId });
  fail(error);
};

export const removeSheet = async (sheetId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_sheet', { p_sheet: sheetId });
  fail(error);
};

/** Put a kit and everything in it on your shelf. */
export const addKit = async (kitId: string): Promise<void> => {
  const { error } = await supabase.rpc('add_kit', { p_kit: kitId });
  fail(error);
};

export const removeKit = async (kitId: string): Promise<void> => {
  const { error } = await supabase.rpc('remove_kit', { p_kit: kitId });
  fail(error);
};

/* ── Administrators ── */

const commerce = (m: { access?: SheetMeta['access']; priceInr?: number | null }) =>
  // Access and price travel together: the table refuses one without the other.
  m.access !== undefined ? { access: m.access, price_inr: m.access === 'paid' ? m.priceInr : null } : {};
const text = (v: string | null | undefined, max: number) => (v?.trim() ? v.trim().slice(0, max) : null);

const sheetRow = (m: Partial<SheetMeta>) => ({
  ...(m.title !== undefined ? { title: m.title.trim().slice(0, 120) } : {}),
  ...(m.description !== undefined ? { description: text(m.description, 600) } : {}),
  ...(m.subject !== undefined ? { subject: m.subject } : {}),
  ...(m.examLine !== undefined ? { exam_line: text(m.examLine, 60) } : {}),
  ...commerce(m),
});

const kitRow = (m: Partial<KitMeta>) => ({
  ...(m.title !== undefined ? { title: m.title.trim().slice(0, 120) } : {}),
  ...(m.tagline !== undefined ? { tagline: text(m.tagline, 120) } : {}),
  ...(m.description !== undefined ? { description: text(m.description, 600) } : {}),
  ...(m.subject !== undefined ? { subject: m.subject } : {}),
  ...(m.examLine !== undefined ? { exam_line: text(m.examLine, 60) } : {}),
  ...(m.finish !== undefined ? { finish: m.finish } : {}),
  ...commerce(m),
});

export const fetchAdminSheets = async (): Promise<Sheet[]> => {
  const { data, error } = await supabase.rpc('admin_sheet_stats');
  fail(error);
  return (data ?? []).map((r: any) => toSheet({ ...r, in_library: false, unlocked: true }, r.updated_at ?? null));
};

export const fetchAdminKits = async (): Promise<Kit[]> => {
  const { data, error } = await supabase.rpc('admin_kit_stats');
  fail(error);
  return (data ?? []).map((r: any) => toKit({ ...r, in_library: false, unlocked: true }, r.updated_at ?? null));
};

/** A new sheet, always a draft — the insert policy refuses anything else. */
export const createSheet = async (meta: SheetMeta): Promise<string> => {
  const { data, error } = await supabase.from('store_sheets').insert({ status: 'draft', ...sheetRow(meta) }).select('id').single();
  fail(error);
  return (data as { id: string }).id;
};

export const updateSheet = async (id: string, meta: Partial<SheetMeta>): Promise<void> => {
  const { data, error } = await supabase.from('store_sheets').update(sheetRow(meta)).eq('id', id).select('id');
  fail(error);
  if (!data?.length) throw refused();
};

/** Delete a sheet. Formula sets that were only on it go with it; shelf decks stay. */
export const deleteSheet = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('store_sheets').delete().eq('id', id).select('id');
  fail(error);
  if (!data?.length) throw refused();
};

/** The sheet's sections, in this order. A formula set left out is deleted with its formulas. */
export const setSheetDecks = async (id: string, deckIds: string[]): Promise<void> => {
  const { error } = await supabase.rpc('set_sheet_decks', { p_sheet: id, p_decks: deckIds });
  fail(error);
};

/** Publishing a sheet publishes its draft sections too. */
export const setSheetStatus = async (id: string, status: DeckStatus): Promise<void> => {
  const { error } = await supabase.rpc('set_sheet_status', { p_sheet: id, p_status: status, p_with_items: true });
  fail(error);
};

export const createKit = async (meta: KitMeta): Promise<string> => {
  const { data, error } = await supabase.from('store_kits').insert({ status: 'draft', ...kitRow(meta) }).select('id').single();
  fail(error);
  return (data as { id: string }).id;
};

export const updateKit = async (id: string, meta: Partial<KitMeta>): Promise<void> => {
  const { data, error } = await supabase.from('store_kits').update(kitRow(meta)).eq('id', id).select('id');
  fail(error);
  if (!data?.length) throw refused();
};

/** Delete a kit. What was in it stays, on its own. */
export const deleteKit = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('store_kits').delete().eq('id', id).select('id');
  fail(error);
  if (!data?.length) throw refused();
};

export const setKitItems = async (id: string, items: { kind: KitItemKind; id: string }[]): Promise<void> => {
  const { error } = await supabase.rpc('set_kit_items', { p_kit: id, p_items: items.map(i => ({ kind: i.kind, id: i.id })) });
  fail(error);
};

/** Publishing a kit publishes its draft packs, sheets and decks too. */
export const setKitStatus = async (id: string, status: DeckStatus): Promise<void> => {
  const { error } = await supabase.rpc('set_kit_status', { p_kit: id, p_status: status, p_with_items: true });
  fail(error);
};
