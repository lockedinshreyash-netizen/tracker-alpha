/* ── Web Push subscription ──
   Everything here is dynamically imported, only when a signed-in user actually
   turns closed-app reminders on. A user who never touches the switch downloads
   none of it, and it never runs during boot.

   Push is strictly additive. The local engine in reminders/useReminders.ts is
   the whole feature on its own — it works signed out, offline, and with no
   backend at all. Nothing below is a dependency of it. */

import { supabase } from '../supabaseClient';

/* The public half of the VAPID pair. Public by definition — it is handed to the
   browser's push service on every subscribe. The PRIVATE key exists only as a
   Supabase function secret and must never appear in this repo. */
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const pushSupported = (): boolean =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && !!VAPID_PUBLIC_KEY;

/* PushManager wants the key as raw bytes; VAPID keys travel as base64url. The
   two differ in alphabet and padding, so this is a conversion rather than an
   atob. */
const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const keyOf = (sub: PushSubscription, name: 'p256dh' | 'auth'): string => {
  const key = sub.getKey(name);
  if (!key) return '';
  return btoa(String.fromCharCode(...new Uint8Array(key)));
};

/** Store this device's endpoint against the signed-in user. */
export const publishSubscription = async (sub: PushSubscription): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const json = sub.toJSON();
  if (!json.endpoint) return false;

  /* The endpoint is the primary key, so re-subscribing on this device replaces
     this device's row rather than adding a fourth one for a user with three
     phones. */
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    user_id: user.id,
    p256dh: keyOf(sub, 'p256dh'),
    auth: keyOf(sub, 'auth'),
    user_agent: navigator.userAgent.slice(0, 300),
    last_seen_at: new Date().toISOString(),
    failure_count: 0,
  }, { onConflict: 'endpoint' });

  return !error;
};

/**
 * Subscribe this device, and record it.
 *
 * Returns false rather than throwing on every failure path — the caller uses it
 * to decide whether to leave the switch on, and a switch that stays on after a
 * failed subscribe is a promise the app cannot keep.
 */
export const enablePush = async (): Promise<boolean> => {
  if (!pushSupported()) return false;

  try {
    if (Notification.permission === 'default') {
      const granted = await Notification.requestPermission();
      if (granted !== 'granted') return false;
    }
    if (Notification.permission !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      /* Required by Chrome, and it is also the honest declaration: every push
         this app sends shows a notification. */
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });

    return await publishSubscription(sub);
  } catch {
    return false;
  }
};

export const disablePush = async (): Promise<void> => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.toJSON().endpoint;
    await sub.unsubscribe();
    /* Delete the row too. An endpoint left behind is a server that keeps trying
       to reach a browser that has thrown the subscription away. */
    if (endpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  } catch {
    /* Nothing useful to do; the sender drops endpoints that 410. */
  }
};
