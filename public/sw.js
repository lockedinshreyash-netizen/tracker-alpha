/* ── Service worker ──
   One job: receive pushes when no tab of this app exists at all.

   Deliberately NO `fetch` handler and NO caches. That is the whole design
   decision worth recording here, because the obvious instinct is to make a
   service worker do offline caching too, and doing that here would be a
   mistake with nothing to gain.

   A `fetch` handler sits in front of every request the app makes, forever. The
   app currently loads fine, and there has never been a working service worker
   in production to load it any differently — the previous version of this file
   lived at the repo root, which Vite does not copy into a build, so the
   registration 404'd and every user has always been served straight from the
   network. Introducing a caching layer would therefore not be an optimisation
   of existing behaviour; it would be a brand-new, app-wide change to how every
   page load works, shipped as a side effect of adding deadline reminders. That
   is not a trade worth making. Offline shell caching may well be worth doing
   one day, but it is its own decision about an app that already works.

   So: push, notification clicks, subscription renewal. Nothing else. This
   worker is invisible to loading, which is exactly what it should be.

   (For the record, so it is not rebuilt: the previous file precached
   './index.tsx', './App.tsx' and './types.ts' — source paths that do not exist
   in a build — and `cache.addAll` rejects as a unit, so install could never
   complete even in dev. Its fetch handler was cache-first over everything with
   no `activate` step, so anything that ever did land would have been pinned
   permanently with no way out.) */

/* Bumped only when this file's behaviour changes. Not a cache version — there
   are no caches — but it makes "which worker is running" answerable in
   DevTools without diffing source. */
const VERSION = 'push-v1';

/* The cache the old root-level sw.js would have created. It never populated in
   production because that file was never served, but a dev machine that ran
   `npm run dev` may hold one. Swept once on activate so no device is left
   carrying a stale shell from a worker we have deleted. */
const LEGACY_CACHES = ['lockin-cache-v1'];

const ICON = '/icon-192.png';

self.addEventListener('install', () => {
  /* Nothing to precache, so there is nothing to wait for. Taking over
     immediately means a user who enables reminders is not told to reload
     before the first one can arrive. */
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => LEGACY_CACHES.includes(n)).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* ── Seen ledger ──
   Shared with the page (notify/seen.ts) — same database, same store. This is
   the reason it is IndexedDB and not localStorage, which is the obvious choice
   and simply does not exist in a service worker. The worker is the context
   that most needs to ask "has the page already said this?", because a push and
   a local fire can carry the same key.

   Raw IDB rather than a wrapper: one store, two operations. Every failure path
   resolves rather than rejects — a ledger that cannot be read must never stop
   a notification being shown, because Chrome revokes push permission from an
   origin whose push events show nothing. */
const DB_NAME = 'tracker-alpha-notify';
const STORE = 'seen';

const openDb = () => new Promise(resolve => {
  try {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch {
    resolve(null);
  }
});

const hasSeen = async key => {
  if (!key) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

const markSeen = async key => {
  if (!key) return;
  const db = await openDb();
  if (!db) return;
  await new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

/* ── Push ──
   A push event that shows no notification costs the origin its push permission
   in Chrome — the browser enforces a "visible on every push" contract. So every
   path through here ends in showNotification, including an unparseable payload
   and a failed ledger read. There is no early return.

   Dedup against a fire the page already delivered leans on the tag rather than
   on silence: a notification sharing a tag REPLACES the unread one instead of
   stacking beside it, so the worst observable outcome of a race is one
   notification that looks slightly late, never two. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      /* Not JSON. Fall through to the generic notification below rather than
         returning — see above. */
    }

    const title = payload.title || 'Tracker Alpha';
    const key = payload.key || '';
    const tag = payload.tag || 'tracker-alpha-reminder';

    if (key && await hasSeen(key)) {
      /* The page already said this. Still must show something, so show it
         under the same tag: it replaces the notification already on screen
         rather than adding a second one. */
      return self.registration.showNotification(title, {
        body: payload.body || '',
        tag,
        icon: ICON,
        badge: ICON,
        renotify: false,
        silent: true,
        data: { url: payload.url || '/', key, taskId: payload.taskId },
      });
    }

    if (key) await markSeen(key);

    return self.registration.showNotification(title, {
      body: payload.body || '',
      tag,
      icon: ICON,
      badge: ICON,
      /* A deadline that auto-dismissed while the user was away is the whole
         feature failing. The sender only sets this for reminders. */
      requireInteraction: payload.requireInteraction !== false,
      data: { url: payload.url || '/', key, taskId: payload.taskId },
    });
  })());
});

/* ── Click ──
   Focus the tab that already exists rather than opening a second copy of the
   app. Opening a duplicate window is the classic bug here, and this app keeps a
   running timer in the tab it opened — a second copy would show a stale one. */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      /* The page decides what to do with it — open the task, switch tab. The
         worker does not route; it has no idea what the app is showing. */
      client.postMessage({ type: 'notification-click', data });
      return;
    }
    await self.clients.openWindow(data.url || '/');
  })());
});

/* ── Subscription renewal ──
   The browser can retire an endpoint on its own. Re-subscribe with the key it
   was created from and tell any open client so it can republish. If nothing is
   open, the page's own ensurePushSubscription() fixes it on next load — this
   handler is the fast path, not the only one. */
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const old = event.oldSubscription || await self.registration.pushManager.getSubscription();
      const key = event.newSubscription
        ? null
        : (old && old.options && old.options.applicationServerKey) || null;
      const sub = event.newSubscription || (key
        ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        : null);
      if (!sub) return;
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: 'push-subscription-changed', subscription: sub.toJSON() });
      }
    } catch {
      /* Nothing useful to do. The next load re-subscribes. */
    }
  })());
});

/* Lets the page ask which worker it is talking to without a version endpoint. */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'version') {
    event.source && event.source.postMessage({ type: 'version', version: VERSION });
  }
});
