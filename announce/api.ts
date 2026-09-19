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

export type AnnouncementType =
  | 'announcement' | 'update' | 'important' | 'maintenance'
  /* Carries options and collects one vote per user. See supabase/admin.sql §9. */
  | 'poll'
  /* Carries a YouTube id and nothing else. */
  | 'video';

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'announcement', 'update', 'important', 'maintenance', 'poll', 'video',
];

/** 'live' — everyone watches the tally. 'private' — only administrators see it. */
export type PollVisibility = 'private' | 'live';

export interface PollOption {
  id: string;
  idx: number;
  label: string;
}

export interface PollTally {
  optionId: string;
  label: string;
  votes: number;
}

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;

/**
 * The 11-character id out of whatever YouTube link was pasted.
 *
 * Every shape YouTube hands out: `watch?v=`, `youtu.be/`, `/shorts/`,
 * `/embed/`, `/live/`. Returns null rather than guessing, because the value
 * ends up interpolated into an iframe `src` — the database enforces the same
 * shape again (`announcement_video_shape`), so a bad one cannot be stored even
 * if this is bypassed.
 */
export const youTubeId = (raw: string): string | null => {
  const input = raw.trim();
  if (!input) return null;

  /* A bare id, pasted on its own. */
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;

  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /\/shorts\/([A-Za-z0-9_-]{11})/,
    /\/embed\/([A-Za-z0-9_-]{11})/,
    /\/live\/([A-Za-z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const hit = input.match(re);
    if (hit) return hit[1];
  }
  return null;
};

/* youtube-nocookie, not youtube.com. It sets no tracking cookie until the video
   is actually played, and the audience here is largely minors. */
export const embedUrl = (id: string, autoplay: boolean): string =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1${autoplay ? '&autoplay=1' : ''}`;

export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/* hqdefault rather than maxresdefault: every video has one, and a missing
   maxres renders as a grey placeholder rather than falling back. */
export const thumbUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  /** Set only on a poll. */
  poll_visibility: PollVisibility | null;
  /** Set only on a video. */
  video_id: string | null;
  /** Ordered. Empty for everything that is not a poll. */
  options: PollOption[];
}

/** What the console lists: every notice, live or not, plus its reach. */
export interface AdminAnnouncement extends Announcement {
  read_count: number;
  /** Total votes cast, across all options. Zero for everything but a poll. */
  vote_count: number;
}

/* The options ride along as an embedded resource rather than a second query.
   PostgREST applies row-level security to an embed exactly as it would to a
   direct select, so a draft poll's options are no more reachable this way than
   the draft itself is. */
const COLUMNS =
  'id,title,body,type,created_at,published_at,expires_at,poll_visibility,video_id,'
  + 'announcement_poll_options(id,idx,label)';

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
  poll_visibility: row.poll_visibility === 'private' || row.poll_visibility === 'live'
    ? row.poll_visibility
    : null,
  video_id: typeof row.video_id === 'string' ? row.video_id : null,
  /* Sorted here rather than trusted from the wire: PostgREST does not promise
     an order on an embedded resource, and a poll whose options shuffle between
     renders is a poll nobody can answer. */
  options: Array.isArray(row.announcement_poll_options)
    ? (row.announcement_poll_options as any[])
      .map(o => ({ id: String(o.id), idx: Number(o.idx), label: String(o.label ?? '') }))
      .sort((a, b) => a.idx - b.idx)
    : [],
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
  /** Poll only. */
  pollVisibility?: PollVisibility;
  /** Poll only, 2–6 entries, in order. */
  options?: string[];
  /** Video only — the extracted id, never a URL. */
  videoId?: string;
}

/**
 * Every announcement, newest first, with how many people have read each and —
 * for a poll — how many have voted.
 *
 * `asAnnouncement` leaves `options` empty here: the RPC does not return them
 * and the console does not need them, because a poll's tally comes from
 * `pollResults` rather than from counting rows in the browser.
 *
 * Note the explicit `vote_count`. The rows come back as `any` from `rpc`, so
 * TypeScript cannot tell that a field of `AdminAnnouncement` is missing from
 * the mapping — leaving it out compiled cleanly and rendered "undefined votes".
 */
export const listAllAnnouncements = async (): Promise<AdminAnnouncement[]> => {
  const { data, error } = await supabase.rpc('admin_list_announcements');
  if (error) throw error;

  return (data ?? []).map((row: any): AdminAnnouncement => ({
    ...asAnnouncement(row),
    read_count: Number(row.read_count ?? 0),
    vote_count: Number(row.vote_count ?? 0),
  }));
};

/**
 * Create one announcement of any type.
 *
 * An RPC rather than an insert, because a poll is an announcement PLUS its
 * options and the two have to land together. Through PostgREST that is two
 * requests, and the gap between them is a published poll with no options on
 * everybody's Today page. The function does both in one transaction, pins
 * `created_by` to the caller's own verified id, and re-checks `is_admin()`
 * before either write.
 *
 * All six types go through it so there is a single creation path; the INSERT
 * policy on the table stays as the backstop.
 */
export const createAnnouncement = async (draft: DraftInput): Promise<void> => {
  const { error } = await supabase.rpc('admin_create_announcement', {
    p_title: draft.title.trim(),
    p_body: draft.body.trim(),
    p_type: draft.type,
    p_publish: draft.publish,
    p_expires_at: draft.expiresAt,
    p_poll_visibility: draft.type === 'poll' ? (draft.pollVisibility ?? 'live') : null,
    p_video_id: draft.type === 'video' ? (draft.videoId ?? null) : null,
    p_options: draft.type === 'poll'
      ? (draft.options ?? []).map(o => o.trim()).filter(Boolean)
      : null,
  });
  if (error) throw error;
};


/* ══════════════════════════════════════════════════════════════════════════
   Polls
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The tally.
 *
 * `poll_results` is a definer function because it counts rows in a table no
 * client may select — that is the whole mechanism behind aggregate-only
 * results. It refuses a private poll to anybody but an administrator, and
 * refuses an unpublished one to anybody but an administrator, so the caller
 * does not get to decide what it is allowed to see.
 */
export const pollResults = async (announcementId: string): Promise<PollTally[]> => {
  const { data, error } = await supabase.rpc('poll_results', { p_announcement: announcementId });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    optionId: String(r.opt_id),
    label: String(r.opt_label ?? ''),
    votes: Number(r.vote_count ?? 0),
  }));
};

/** Which option this user picked, or null. Their own row is the only one visible. */
export const myVote = async (announcementId: string, userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('announcement_poll_votes')
    .select('option_id')
    .eq('announcement_id', announcementId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data?.option_id ? String(data.option_id) : null;
};

/**
 * Cast or change a vote.
 *
 * An upsert on the composite primary key `(announcement_id, user_id)`, so
 * changing your mind rewrites the one row you already own and a double tap
 * cannot produce two votes. The same structural guarantee `announcement_reads`
 * relies on.
 */
export const castVote = async (
  announcementId: string,
  userId: string,
  optionId: string,
): Promise<boolean> => {
  const { error } = await supabase
    .from('announcement_poll_votes')
    .upsert(
      { announcement_id: announcementId, user_id: userId, option_id: optionId, voted_at: new Date().toISOString() },
      { onConflict: 'announcement_id,user_id' },
    );
  return !error;
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
