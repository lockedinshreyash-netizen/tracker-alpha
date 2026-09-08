/* ── When the RACE is allowed to speak ──
   The app-wide rule — what may interrupt at all, and why a deadline reminder is
   allowed to when "you haven't studied today" still is not — now lives at the
   top of notify/channels.ts. Read that first; this file only decides what the
   race has to say.

   Three gates, in order:
     1. Never while a session is running. Focus is the product; interrupting it
        to talk about a leaderboard would be self-defeating.
     2. Never twice for the same rung of the same gap — see the threshold ladder
        in raceDay.ts.
     3. Never inside the cooldown. Several events landing together are merged
        into one message rather than queued.

   Delivery is not decided here. `selectAnnouncement` returns the one thing
   worth saying, and notify/deliver.ts decides where it goes. */

import { RaceState } from './engine';
import { RaceEvent, isNotifiable, priorityOf } from './raceDay';
import { NotificationCopy, notificationFor } from './messages';
import { getISTDateString } from '../utils';

/* Gap warnings are the ones that could nag, so they get the long cooldown.
   Losing a place is rare and is the single thing a competitor most wants to
   know, so it gets a short floor instead — enough to stop a flapping board
   from firing twice, not enough to sit on real news. */
export const GAP_COOLDOWN_MS = 45 * 60 * 1000;
export const POSITION_COOLDOWN_MS = 10 * 60 * 1000;

const POSITION_KINDS = new Set(['took_lead', 'lost_lead', 'passed_by', 'overtook']);

export interface NotifyMemory {
  date: string;
  lastNotifiedAt: number;
}

const MEMORY_KEY = 'race_notify_v1';

export const loadNotifyMemory = (date: string = getISTDateString()): NotifyMemory => {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as NotifyMemory) : null;
    if (!parsed || parsed.date !== date) return { date, lastNotifiedAt: 0 };
    return parsed;
  } catch {
    return { date, lastNotifiedAt: 0 };
  }
};

export const saveNotifyMemory = (memory: NotifyMemory): void => {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Not worth failing anything over.
  }
};

export interface Announcement {
  copy: NotificationCopy;
  event: RaceEvent;
  memory: NotifyMemory;
}

/**
 * The one thing worth saying out of everything that just happened, or nothing.
 *
 * `busy` is true whenever a stopwatch or any Pomodoro phase is running — the
 * user is mid-session and is not to be spoken to.
 */
export const selectAnnouncement = (
  events: RaceEvent[],
  race: RaceState,
  memory: NotifyMemory,
  busy: boolean,
  now: number = Date.now()
): Announcement | null => {
  if (busy) return null;

  const candidates = events
    .filter(isNotifiable)
    .map(event => ({ event, copy: notificationFor(event, race) }))
    .filter((c): c is { event: RaceEvent; copy: NotificationCopy } => c.copy !== null)
    .sort((a, b) => priorityOf(b.event) - priorityOf(a.event));

  if (!candidates.length) return null;

  const top = candidates[0];
  const cooldown = POSITION_KINDS.has(top.event.kind) ? POSITION_COOLDOWN_MS : GAP_COOLDOWN_MS;
  if (memory.lastNotifiedAt && now - memory.lastNotifiedAt < cooldown) return null;

  /* Merged rather than queued: two things happening at once is one moment in
     the race, and sending it as two notifications is how an app gets muted.
     Only across families, and never under a lead change — "you reached first
     place" already contains "you passed Aryan", and stapling the second one on
     reads like the app can't tell they're the same event. */
  const second = TERMINAL_KINDS.has(top.event.kind)
    ? undefined
    : candidates.find(c => familyOf(c.event.kind) !== familyOf(top.event.kind));
  const copy: NotificationCopy = second
    ? { title: top.copy.title, body: `${top.copy.body} Also: ${stripIcon(second.copy.title)}.` }
    : top.copy;

  return {
    copy,
    event: top.event,
    memory: { date: memory.date, lastNotifiedAt: now },
  };
};

/* Titles lead with an emoji; a merged clause sits mid-sentence and shouldn't.
   Case is left alone — half these lines start with somebody's name. */
const stripIcon = (text: string): string => text.replace(/^\P{L}+/u, '').replace(/\.$/, '');

/* Two events from the same family are two views of one moment. Merging only
   ever happens across families. */
const familyOf = (kind: string): string =>
  POSITION_KINDS.has(kind) ? 'position' : kind === 'final_stretch' ? 'clock' : 'gap';

/** Events that say everything about the moment they describe. Never merged. */
const TERMINAL_KINDS = new Set(['took_lead', 'lost_lead']);
