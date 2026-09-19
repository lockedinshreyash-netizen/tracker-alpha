# Closed-app reminders — deploy runbook

Everything in the app works without this. Reminders fire as an in-app toast when
a tab is open and as a system notification when one is backgrounded, signed in or
not, with no backend at all. This runbook adds the third delivery channel: a
notification that arrives when **every tab is shut**.

Until these steps are run the feature ships dark — the *When the app is closed*
switch in Review → Deadline Reminders simply does not render, because
`VITE_VAPID_PUBLIC_KEY` is unset and a control that cannot work is worse than no
control.

---

## 1. The VAPID key pair — already generated

A pair has been generated for this project and written to **`vapid.local.json`**
in the repo root. That file is gitignored and must stay that way.

To generate a fresh pair instead (both formats below are base64url, which is what
`npx --yes web-push generate-vapid-keys` also emits):

```bash
node -e "const{webcrypto:c}=require('crypto');(async()=>{const k=await c.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);console.log('public :',Buffer.from(await c.subtle.exportKey('raw',k.publicKey)).toString('base64url'));console.log('private:',(await c.subtle.exportKey('jwk',k.privateKey)).d)})()"
```

**The private key never enters this repo.** It exists only in `vapid.local.json`
locally and as a Supabase function secret (step 4).

> **Format note.** `@negrel/webpush`'s `importVapidKeys` takes `JsonWebKey`
> objects, while every VAPID generator emits base64url strings. The function used
> to hand the raw env strings straight to it, which throws inside
> `crypto.importKey` on the first invocation — `vapidJwks()` in `index.ts` now
> does the conversion, so the base64url values below are the correct thing to set.

## 2. Client env

Already written to `.env.local`:

```
VITE_VAPID_PUBLIC_KEY=<the public key>
```

The public key is public by definition — it is handed to the browser's push
service on every subscribe. Only `VITE_`-prefixed vars reach `import.meta.env`,
and `tsconfig.json` already lists `vite/client` in `types`, so this type-checks
with no config change.

## 3. Schema

Supabase dashboard → SQL Editor → New query → paste **`supabase/reminders.sql`**
→ Run. Every statement is idempotent; re-run it any time.

Read its header before running it. The reason there are two narrow tables rather
than a cron job reading `user_profiles` is the whole security design of this
feature.

## 4. Link the project and set the secrets

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>

# Every value is read out of the gitignored file rather than pasted into a
# shell history. CRON_SECRET is NOT generated inline here on purpose: step 6
# needs the same value again, and `$(openssl rand -hex 32)` inline would set a
# secret nobody ever sees.
npx supabase secrets set \
  VAPID_PUBLIC_KEY="$(node -p "require('./vapid.local.json').publicKey")" \
  VAPID_PRIVATE_KEY="$(node -p "require('./vapid.local.json').privateKey")" \
  VAPID_SUBJECT="$(node -p "require('./vapid.local.json').subject")" \
  CRON_SECRET="$(node -p "require('./vapid.local.json').cronSecret")"
```

`vapid.local.json` holds all four. Print the cron secret when step 6 needs it:

```bash
node -p "require('./vapid.local.json').cronSecret"
``` `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically; do not set them.

## 5. Deploy the function

```bash
npx supabase functions deploy send-reminders --no-verify-jwt
```

`--no-verify-jwt` because the caller is a database job with no user session. The
function authenticates the `CRON_SECRET` in its own first few lines instead —
without that check its URL would be a publicly callable *send everybody their
notifications now* button.

## 6. Schedule it

Dashboard → SQL Editor. The scheduling block is at the bottom of
`supabase/reminders.sql`, commented out; uncomment it, substitute
`<CRON_SECRET>` and `<PROJECT_REF>`, and run.

The secret goes into Vault rather than inline, because `cron.job` is readable in
the dashboard and an inline secret there is exactly the button described above,
sitting in a table waiting to be found.

## 7. Ship the client

```bash
npm run build && ls dist/sw.js
```

`dist/sw.js` **must** exist. Before this change it never did — `sw.js` lived at
the repo root, which Vite does not copy into a build, so the registration in
`index.html` 404'd and no user has ever had a working service worker. Push
cannot work without it.

---

## Verifying

In order, because each step depends on the one above:

1. **Worker.** DevTools → Application → Service Workers shows `/sw.js` activated
   at scope `/`. **Cache Storage must hold exactly one entry, `/offline.html`.**
   The worker's `fetch` handler is navigation-only and network-first, so a
   Network recording of a reload should look as it always did; anything else in
   that cache means somebody has started caching the app shell, which this
   worker deliberately does not do.
2. **Delivery.** DevTools → Application → Service Workers → *Push*, with a
   payload like `{"title":"Test","body":"Hello","key":"t@1"}`. A notification
   appears; clicking it focuses the existing tab rather than opening a second
   window.
3. **Subscription.** Sign in, Review → Deadline Reminders → *When the app is
   closed*. A row appears in `push_subscriptions` for this device's endpoint.
4. **End to end.** Set a task due two minutes out. **Close every tab.** The
   notification arrives about 90 seconds after the due time — that lag is
   `PUSH_LAG_MS` in `reminders/publish.ts`, and it is what stops an open app and
   the cron both announcing the same deadline.
5. **No duplicate.** Reopen the app. The same reminder must **not** fire again.
   Three independent mechanisms should each prevent it: the row was deleted
   locally, `Task.remindedKey` is set and syncs across devices, and the
   IndexedDB ledger in `notify/seen.ts` is shared with the worker.

## iOS

iOS delivers Web Push **only to a PWA installed to the home screen**, and never
fires `beforeinstallprompt`. An iPhone user therefore has to add the app via
Share → Add to Home Screen before any of this reaches them; the app says so
under the toggle rather than leaving them to wonder.
