/* ── Reactions, shared by group chat and race chat ──
   Pure. The emoji set is mirrored byte for byte by a CHECK in both
   supabase/groups.sql and supabase/race_chat.sql, so it lives once here. */

/** The fixed set. ❤️ carries U+FE0F, as the CHECKs do. */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;
/** What a double tap on a message means, as on Instagram. */
export const QUICK_REACTION = '❤️';

/** One stored reaction. `emoji` null = taken back, kept rather than deleted. */
export interface ReactionRow {
  message_id: string | number;
  user_id: string;
  emoji: string | null;
  updated_at: string;
}

/** One chip under a bubble: an emoji, how many, whether it is yours, and who. */
export interface ReactionGroup { emoji: string; count: number; mine: boolean; names: string[] }

export const nameList = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/* Compared as instants, not strings: PostgREST and Realtime do not promise
   the same text for one timestamptz ("T" vs space, "+00:00" vs "+00"), and
   Safari's Date.parse accepts only the ISO shape. */
export const stamp = (s: string): number => {
  const t = Date.parse(s.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isNaN(t) ? 0 : t;
};

/** message id → user id → that person's reaction. Newer `updated_at` wins; a tie goes to the incoming copy. */
export const mergeReactions = <R extends ReactionRow>(
  prev: Record<string, Record<string, R>>,
  rows: R[]
): Record<string, Record<string, R>> => {
  if (!rows.length) return prev;
  let next = prev;
  for (const r of rows) {
    const key = String(r.message_id);
    const existing = next[key]?.[r.user_id];
    if (existing) {
      const was = stamp(existing.updated_at);
      const now = stamp(r.updated_at);
      if (was > now || (was === now && existing.emoji === r.emoji)) continue;
    }
    if (next === prev) next = { ...prev };
    next[key] = { ...next[key], [r.user_id]: r };
  }
  return next;
};

/**
 * Chips in the order of the picker, so a message's reactions do not reshuffle
 * every time somebody adds one. `pendingMine` is an in-flight change of yours
 * (undefined = none), drawn as if it had landed.
 */
export const groupReactions = (
  byUser: Record<string, { emoji: string | null }> | undefined,
  pendingMine: string | null | undefined,
  userId: string,
  nameOf: (id: string) => string
): ReactionGroup[] => {
  const picks: Array<[string, string]> = [];
  Object.entries(byUser ?? {}).forEach(([uid, r]) => {
    if (uid !== userId && r.emoji) picks.push([uid, r.emoji]);
  });
  const mineNow = pendingMine !== undefined ? pendingMine : byUser?.[userId]?.emoji ?? null;
  if (mineNow) picks.push([userId, mineNow]);
  if (!picks.length) return [];

  const order = REACTIONS as readonly string[];
  const groups = new Map<string, ReactionGroup>();
  picks.forEach(([uid, emoji]) => {
    const g = groups.get(emoji) ?? { emoji, count: 0, mine: false, names: [] };
    g.count += 1;
    if (uid === userId) g.mine = true;
    else g.names.push(nameOf(uid));
    groups.set(emoji, g);
  });
  groups.forEach(g => { if (g.mine) g.names.push('You'); });
  return Array.from(groups.values()).sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji));
};
