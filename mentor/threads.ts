/* ── Conversations: on this device, and nowhere else ──
   A deliberate product decision, not a v1 shortcut. Mentor chats are stored
   in localStorage, keyed by account, bounded, and wiped on sign-out. They are
   never written to Supabase and never ride the synced blob:

   - most users are minors, and a server-side archive of what they tell a
     study mentor is a liability with no feature attached to it;
   - chat is not the record — anything durable the student accepts lands in
     tasks, the syllabus, preferences or the roadmap, which DO sync;
   - putting chat in AppState would fire a full-blob upsert per message.

   The cost is that a conversation started on the laptop is not on the phone.
   That is the intended trade. */

import { WireMessage } from '../supabase/functions/_shared/mentor-protocol';
import { Handles } from './brief';
import { Pace } from './pace';
import { Proposal } from './proposals';
import { WeekReview } from './review';
import { MentorIntent } from '../supabase/functions/_shared/mentor-protocol';

export type Entry =
  | { kind: 'user'; id: string; at: number; text: string }
  | { kind: 'assistant'; id: string; at: number; text: string; model?: string }
  | { kind: 'proposal'; id: string; at: number; proposal: Proposal; toolCallId?: string }
  | { kind: 'pace'; id: string; at: number; pace: Pace }
  | { kind: 'week'; id: string; at: number; review: WeekReview }
  | { kind: 'notice'; id: string; at: number; tone: 'error' | 'info'; text: string; retry?: { text: string; intent: MentorIntent } };

export interface Thread {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  entries: Entry[];
  /** What the model has been told — kept separately from what is drawn. */
  wire: WireMessage[];
  handles: Handles;
}

const PREFIX = 'mentor_threads_v1:';
const MAX_THREADS = 10;
const MAX_ENTRIES = 120;
const MAX_WIRE = 80;

const keyFor = (userId: string) => `${PREFIX}${userId}`;

export const loadThreads = (userId: string): Thread[] => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((t: Thread) => t && typeof t.id === 'string' && Array.isArray(t.entries) && Array.isArray(t.wire))
      : [];
  } catch {
    return [];
  }
};

export const saveThreads = (userId: string, threads: Thread[]): void => {
  const bounded = [...threads]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_THREADS)
    .map(t => ({ ...t, entries: t.entries.slice(-MAX_ENTRIES), wire: t.wire.slice(-MAX_WIRE) }));
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(bounded));
  } catch {
    /* Quota or a hardened browser. The conversation still works for this
       session; it simply is not kept, which is the safe failure here. */
  }
};

/** Every Mentor conversation on this device, for every account. Sign-out calls this. */
export const forgetMentorOnDevice = (): void => {
  try {
    Object.keys(localStorage).forEach(k => { if (k.startsWith(PREFIX)) localStorage.removeItem(k); });
  } catch {
    /* Nothing to do. */
  }
};

export const forgetThreadsFor = (userId: string): void => {
  try { localStorage.removeItem(keyFor(userId)); } catch { /* Nothing to do. */ }
};
