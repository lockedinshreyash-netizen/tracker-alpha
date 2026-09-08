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

## 1. Generate a VAPID key pair

```bash
npx --yes web-push generate-vapid-keys
```

`npx`, not an install — nothing lands in `package.json`. Keep both values.

**The private key never enters this repo.** It exists only as a Supabase function
secret (step 4). `.gitignore` covers `.env` and `.env.*` as a guard, but the rule
is the habit, not the file.

## 2. Client env

```bash
echo 'VITE_VAPID_PUBLIC_KEY=BJ…' >> .env.local
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

npx supabase secrets set \
  VAPID_PUBLIC_KEY=BJ… \
  VAPID_PRIVATE_KEY=k7… \
  VAPID_SUBJECT=mailto:you@example.com \
  CRON_SECRET=$(openssl rand -hex 32)
```

Keep the `CRON_SECRET` value — step 6 needs it. `SUPABASE_URL` and
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
   at scope `/`. **Cache Storage must be empty** — this worker is push-only and
   installs no `fetch` handler, so it must be invisible to page loads. A Network
   recording of a reload should look exactly as it did before.
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
