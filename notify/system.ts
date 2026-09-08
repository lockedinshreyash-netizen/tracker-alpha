/* ── System notifications ──
   The only place in the app that shows one. Both previous call sites
   (leaderboard/notify.ts and a private copy inside today/usePomodoro.ts) are
   gone; this replaces them. */

import { CHANNELS, Channel, NotificationCopy } from './channels';

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

const ICON = '/icon-192.png';

export const notificationPermission = (): PermissionState => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionState;
};

/** Asks once. A browser that has already refused is never asked again. */
export const requestNotificationPermission = async (): Promise<PermissionState> => {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission as PermissionState;
  try {
    return (await Notification.requestPermission()) as PermissionState;
  } catch {
    return 'denied';
  }
};

export interface SystemRequest {
  channel: Channel;
  copy: NotificationCopy;
  /** Stable identity for this fire. Feeds the tag and travels in `data`. */
  key: string;
  data?: Record<string, unknown>;
}

/**
 * Show one system notification. Returns false if nothing was shown, so a
 * caller can keep its cooldown unspent rather than sit silent for 45 minutes
 * on a send that never landed.
 *
 * Prefers the service worker registration's `showNotification` over the
 * `Notification` constructor. This is not a stylistic preference, it is a
 * correctness fix: **Android Chrome throws on the constructor outright**, so
 * every notification this app has ever tried to show on a phone has failed —
 * and a phone is the only device where a bell in a backgrounded tab actually
 * matters. The constructor stays as the desktop fallback, and for the case
 * where the worker failed to register.
 */
export const showSystem = async (req: SystemRequest): Promise<boolean> => {
  if (notificationPermission() !== 'granted') return false;

  const def = CHANNELS[req.channel];
  const options: NotificationOptions = {
    body: req.copy.body,
    tag: def.tag(req.key),
    icon: ICON,
    badge: ICON,
    requireInteraction: def.requireInteraction,
    /* What notificationclick in public/sw.js reads to focus the right tab and
       tell the page what was clicked. */
    data: { url: '/', key: req.key, channel: req.channel, ...(req.data ?? {}) },
  };

  try {
    const reg = typeof navigator !== 'undefined' && navigator.serviceWorker
      ? await navigator.serviceWorker.getRegistration()
      : null;
    if (reg) {
      await reg.showNotification(req.copy.title, options);
      return true;
    }
  } catch {
    /* Fall through to the constructor. */
  }

  try {
    const n = new Notification(req.copy.title, options);
    n.onclick = () => {
      window.focus();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
};
