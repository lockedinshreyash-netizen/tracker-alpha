/* ── When the app is allowed to speak ──

   The old rule, which lived at the top of leaderboard/notify.ts, was absolute:
   a notification reports a race that is actually happening, or it is nothing.
   No daily reminder, no "time to study", no nudge fired because the app noticed
   you were idle. Deadlines move where that line sits, so it is worth restating
   exactly — the line is the product, and it is the thing that gets eroded one
   reasonable-sounding feature at a time.

   The app never invents a reason to interrupt you. What it may now do is hold
   you to something you wrote down yourself.

   A deadline reminder is not the app having an opinion about your evening. It
   is a commitment you typed, on a date you chose, read back at an hour you set.
   If you never set a due date, nothing here ever fires. Nothing is scheduled on
   your behalf, nothing is inferred from a gap in the logs, and there is still
   no daily digest, no streak-at-risk warning, no "you haven't opened the app in
   three days". The day this app sends something the user did not author is the
   day it gets muted, and every one of the channels below stops working at once.
   There is no way to earn that permission back.

   Four channels, four identities, each traceable to a user action:
     race     — a place changing hands, on a board you asked to join.
     pomodoro — a bell for a block you started. Asked for, by starting it.
     reminder — a due date you wrote, on a task you wrote.
     plan     — a block you put on your own timeline, about to begin.

   Four gates, in order:
     1. Never while a session is running. Focus is the product; interrupting it
        to talk about anything else is self-defeating. The Pomodoro bell is the
        one exception, because it *is* the end of the session.
     2. Never twice for the same thing. Race events are keyed by rung and gap
        (see raceDay.ts); a reminder is keyed by task and due instant, so moving
        a deadline re-arms it and nothing else can.
     3. Never as a burst. Several things landing together are merged into one
        message rather than queued — an app that fires six notifications at once
        has already lost the argument.
     4. Never a fire the user has already been shown, wherever it was shown. A
        local fire and a push carrying the same key are one notification; see
        seen.ts, the per-task tag below, and PUSH_LAG_MS in reminders/publish.ts.

   Delivery is split by where the user is looking: a visible tab gets a toast, a
   hidden one gets a system notification, a closed app gets a push. Exactly one
   of the three. Never two. */

export type Channel = 'race' | 'pomodoro' | 'reminder' | 'plan';

export interface ChannelDef {
  /** Notifications sharing a tag replace one another instead of stacking. */
  tag: (key: string) => string;
  /* A deadline that auto-dismissed after five seconds while the user was away
     is the whole feature failing. A bell you missed is a block you already
     finished. */
  requireInteraction: boolean;
}

export const CHANNELS: Record<Channel, ChannelDef> = {
  /* Tags unchanged from the strings the two old call sites used, so an unread
     notification written by the previous build is REPLACED by the next one
     rather than joined by a second copy of itself. */
  race: { tag: () => 'tracker-alpha-race', requireInteraction: false },
  pomodoro: { tag: () => 'tracker-alpha-pomodoro', requireInteraction: false },
  plan: { tag: () => 'tracker-alpha-plan', requireInteraction: false },

  /* Per task, not per channel. Two deadlines are two different commitments;
     collapsing them under one tag would silently eat one of them, and the one
     eaten is invisible — there is no "you missed a notification" surface to
     find it in afterwards. The key is `taskId@instant`, so the tag is stable
     across a local fire and a push for the same task. */
  reminder: {
    tag: key => `tracker-alpha-reminder:${key.split('@')[0]}`,
    requireInteraction: true,
  },
};

/** Title and body. Same shape leaderboard/messages.ts already produces. */
export interface NotificationCopy {
  title: string;
  body: string;
}
