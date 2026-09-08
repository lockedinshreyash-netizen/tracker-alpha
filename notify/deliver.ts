/* ── The router ──
   One event, one place. On screen if the user is here to read it, on the lock
   screen if they are not — never both. Every feature that wants to say
   something goes through here rather than deciding for itself. */

import { Channel, NotificationCopy } from './channels';
import { showSystem } from './system';
import { ToastSpec, pushToast } from './toastBus';
import { hasSeen, markSeen } from './seen';

export interface Dispatch {
  channel: Channel;
  copy: NotificationCopy;
  /** Stable identity for this exact fire — the dedup key across local and push. */
  key: string;
  /** Rides into the notification's `data` for notificationclick to route on. */
  data?: Record<string, unknown>;
  /* What to say on screen instead, when the tab is visible. Omitted derives a
     toast from `copy`; `false` says nothing on screen at all. */
  toast?: ToastSpec | false;
  /** Shown beside the toast title. Never in the system notification. */
  icon?: string;
}

export type Outcome = 'toast' | 'system' | 'dropped';

export const deliver = async (d: Dispatch): Promise<Outcome> => {
  /* Gate 4. A push may already have shown this while the tab was closed, and
     the user reopening the app must not be told again. */
  if (await hasSeen(d.key)) return 'dropped';

  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    if (d.toast !== false) {
      pushToast(
        d.toast ?? {
          id: d.key,
          title: d.copy.title,
          body: d.copy.body,
          icon: d.icon,
          tone: d.channel === 'reminder' ? 'alert' : 'neutral',
        }
      );
    }
    /* Marked even when `toast: false`: the caller said this event was handled
       on screen by something else it owns, and a push arriving later must not
       repeat it. */
    await markSeen(d.key);
    return 'toast';
  }

  if (await showSystem({ channel: d.channel, copy: d.copy, key: d.key, data: d.data })) {
    await markSeen(d.key);
    return 'system';
  }

  /* Nothing was shown — no permission, or the browser refused. Deliberately
     NOT marked seen, so a later push for the same key can still land it. */
  return 'dropped';
};
