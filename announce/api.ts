/* ── App-wide announcements ──
   Talks to `announcements` and `announcement_reads` (see supabase/admin.sql).

   Nothing in this file is a security boundary, and it is worth being explicit
   about why it still filters:

   Row-level security is what stops a student reading a draft and what stops
   anybody but an administrator writing one. The `published_at`/`expires_at`
   clauses below are NOT that check repeated — they exist because an
   administrator's own SELECT policy deliberately returns everything, drafts
   included, so that the console can list them. Without these clauses an admin
   would be shown their own unpublished drafts as if they were live notices.

   Every call here returns a value rather than throwing. An announcement is the
   least important thing on the screen it appears on; a failed fetch must cost
   the student nothing at all, and certainly must not take Today down with it. */

import { supabase } from '../supabaseClient';

export type AnnouncementType = 'announcement' | 'update' | 'important' | 'maintenance';

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'announcement', 'update', 'important', 'maintenance',
];

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
}

/** What the console lists: every notice, live or not, plus its reach. */
export interface AdminAnnouncement extends Announcement {
  read_count: number;
}

const COLUMNS = 'id,title,body,type,created_at,published_at,expires_at';

/* The type column is constrained in the database, but a row written before a
   type was added — or by a later migration — must not render as a blank
   eyebrow. Anything unrecognised reads as a plain announcement. */
const asType = (raw: unknown): AnnouncementType =>
  ANNOUNCEMENT_TYPES.includes(raw as AnnouncementType)
    ? (raw as AnnouncementType)
    : 'announcement';

const asAnnouncement = (row: any): Announcement => ({
  id: String(row.id),
  title: String(row.title ?? ''),
  body: String(row.body ?? ''),
  type: asType(row.type),
  created_at: String(row.created_at ?? ''),
  published_at: row.published_at ?? null,
  expires_at: row.expires_at ?? null,
});

/* A student who has been away for a term should not be walked through forty
   modals. The modal offers "mark all read" the moment there is more than one;
   this cap is the backstop on how much is ever pulled at once. */
export const MAX_UNREAD = 20;

/**
 * Live announcements this user has not yet acknowledged, oldest first.
 *
 * Two queries rather than a join: PostgREST can express "not in a subquery"
 * only through an embedded resource, and an embed across two tables with
 * separate policies is a much harder thing to reason about than a set
 * difference of at most twenty ids. Returns `[]` on any failure.
 */
export const fetchUnread = async (userId: string): Promise<Announcement[]> => {
  const now = new Date().toISOString();

  const { data: live, error: liveError } = await supabase
    .from('announcements')
    .select(COLUMNS)
    .not('published_at', 'is', null)
    .lte('published_at', now)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('published_at', { ascending: true })
    .limit(MAX_UNREAD);

  /* The commonest error here by far is "relation does not exist" — the
     migration has not been run yet. There is nothing to report and nothing the
     student could do about it, so the feature is simply absent. */
  if (liveError || !live?.length) return [];

  const { data: reads, error: readsError } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('user_id', userId);

  /* A failed reads query must not be read as "nothing is acknowledged" — that
     would re-show every notice the user has already dealt with, which is the
     one failure this feature is judged on. Show nothing instead and try again
     on the next visit. */
  if (readsError) return [];

  const seen = new Set((reads ?? []).map(r => String(r.announcement_id)));
  return live.map(asAnnouncement).filter(a => !seen.has(a.id));
};

/**
 * Mark one or more announcements read for this user.
 *
 * An upsert against the composite primary key, so a double tap, a retry after a
 * dropped connection, and a second device all land on the same row. There is no
 * path here that creates a duplicate.
 *
 * Returns true only when the write is known to have landed: the caller keeps
 * the modal up and offers a retry otherwise, because a silent failure here
 * means the same notice greets them again tomorrow.
 */
export const acknowledge = async (userId: string, ids: string[]): Promise<boolean> => {
  if (!ids.length) return true;

  const { error } = await supabase
    .from('announcement_reads')
    .upsert(
      ids.map(announcement_id => ({ announcement_id, user_id: userId })),
      { onConflict: 'announcement_id,user_id', ignoreDuplicates: true },
    );

  return !error;
};


/* ══════════════════════════════════════════════════════════════════════════
   Administration
   Every one of these fails closed at the database for a non-admin. The console
   that calls them is a convenience, not a gate.
   ══════════════════════════════════════════════════════════════════════════ */

export interface DraftInput {
  title: string;
  body: string;
  type: AnnouncementType;
  /** ISO instant, or null for no expiry. */
  expiresAt: string | null;
  /** Save as a draft, or put it in front of every user now. */
  publish: boolean;
}

/** Every announcement, newest first, with how many people have read each. */
export const listAllAnnouncements = async (): Promise<AdminAnnouncement[]> => {
  const { data, error } = await supabase.rpc('admin_list_announcements');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...asAnnouncement(row),
    read_count: Number(row.read_count ?? 0),
  }));
};

export const createAnnouncement = async (
  userId: string,
  draft: DraftInput,
): Promise<void> => {
  const { error } = await supabase.from('announcements').insert({
    title: draft.title.trim(),
    body: draft.body.trim(),
    type: draft.type,
    /* Pinned to the caller here and pinned again by the insert policy's WITH
       CHECK, which is the one that actually matters. */
    created_by: userId,
    published_at: draft.publish ? new Date().toISOString() : null,
    expires_at: draft.expiresAt,
  });
  if (error) throw error;
};

/** Publish now, or pull a live notice back to a draft. */
export const setPublished = async (id: string, live: boolean): Promise<void> => {
  const { error } = await supabase
    .from('announcements')
    .update({ published_at: live ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
};

/** Live, scheduled, expired or draft — one word for the console's row. */
export const lifecycle = (a: Announcement): 'draft' | 'scheduled' | 'live' | 'expired' => {
  if (!a.published_at) return 'draft';
  const now = Date.now();
  if (Date.parse(a.published_at) > now) return 'scheduled';
  if (a.expires_at && Date.parse(a.expires_at) <= now) return 'expired';
  return 'live';
};
