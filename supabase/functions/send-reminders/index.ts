/* ── The reminder sender ──
   Invoked by pg_cron every minute via pg_net. Reads what is due, sends it as a
   Web Push, marks it sent.

   Deployed with --no-verify-jwt, because the caller is a database job with no
   user session. Authentication is therefore a shared secret in the
   Authorization header, checked below. Without that check the function URL is a
   publicly callable "send everybody their notifications now" button.

   It never reads user_profiles. See the header of supabase/reminders.sql for
   why that is the point rather than an oversight: this process runs as the
   service role and bypasses RLS, so the only safe design is one where it has
   nothing interesting to bypass RLS *for*. */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as webpush from 'jsr:@negrel/webpush@0.3';

/* Deno-native and pure Web Crypto. Deliberately NOT the `web-push` npm package,
   which reaches for Node's crypto for the EC operations and is unreliable on
   Deno Deploy even though `npm:` specifiers resolve. None of this touches the
   app's package.json — edge functions have their own dependency graph. */

const BATCH = 500;

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/* Length-independent compare. A timing oracle on a shared secret is cheap to
   avoid and unpleasant to have. */
const secretMatches = (given: string, expected: string): boolean => {
  if (!expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
};

/* ── VAPID keys: base64url in, JWK out ──
   `importVapidKeys` takes `JsonWebKey` objects, and every VAPID generator in
   existence — `npx web-push generate-vapid-keys`, and the snippet in this
   function's README — emits two base64url strings instead. Handing those
   strings straight to it (which is what this function used to do) throws
   inside `crypto.importKey` on the very first invocation.

   The conversion is mechanical. A VAPID public key is the uncompressed P-256
   point `0x04 || X(32) || Y(32)`; the private key is the 32-byte scalar `d`.
   A JWK wants those three coordinates separately, still base64url, and the
   private JWK needs X and Y alongside `d`. */

const b64urlToBytes = (s: string): Uint8Array => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const bytesToB64url = (b: Uint8Array): string =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const vapidJwks = (publicKey: string, privateKey: string) => {
  const pub = b64urlToBytes(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(`VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point, got ${pub.length} bytes`);
  }
  const d = b64urlToBytes(privateKey);
  if (d.length !== 32) {
    throw new Error(`VAPID_PRIVATE_KEY must be 32 bytes, got ${d.length}`);
  }

  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));

  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true } as JsonWebKey,
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d: bytesToB64url(d), ext: true } as JsonWebKey,
  };
};

Deno.serve(async req => {
  const expected = Deno.env.get('CRON_SECRET') ?? '';
  const given = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secretMatches(given, expected)) return ok({ error: 'unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let server: webpush.ApplicationServer;
  try {
    server = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com',
      vapidKeys: await webpush.importVapidKeys(
        vapidJwks(Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!),
        { extractable: false },
      ),
    });
  } catch (e) {
    /* Bad or missing keys. Said plainly and once, rather than throwing a raw
       WebCrypto error into the cron's logs every single minute forever. */
    return ok({ error: 'vapid_misconfigured', detail: String(e) }, 503);
  }

  const { data: due, error: dueError } = await supabase
    .from('due_reminders')
    .select('id')
    .is('sent_at', null)
    .lte('fire_at', new Date().toISOString())
    .order('fire_at')
    .limit(BATCH);

  if (dueError) return ok({ error: dueError.message }, 500);
  if (!due?.length) return ok({ sent: 0 });

  /* ── Claim before send ──
     Two overlapping runs must not both send the same reminder. The trade-off is
     real and worth stating: claiming first means a crash between the claim and
     the send loses a reminder, while sending first means a crash between the
     send and the mark duplicates one.

     The product rule is "never twice", so it claims first. A lost reminder is a
     disappointment; a duplicated one is why people turn notifications off. */
  const { data: claimed, error: claimError } = await supabase
    .from('due_reminders')
    .update({ sent_at: new Date().toISOString() })
    .in('id', due.map(r => r.id))
    .is('sent_at', null)
    .select('id, user_id, title, body');

  if (claimError) return ok({ error: claimError.message }, 500);
  if (!claimed?.length) return ok({ sent: 0 });

  /* One query per user rather than one per reminder — a user with five
     deadlines due at 9am has the same three devices for all five. */
  const byUser = new Map<string, typeof claimed>();
  for (const row of claimed) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  let sent = 0;
  const dead: string[] = [];

  for (const [userId, rows] of byUser) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, failure_count')
      .eq('user_id', userId);
    if (!subs?.length) continue;

    for (const row of rows) {
      const payload = JSON.stringify({
        title: row.title,
        body: row.body,
        key: row.id,
        /* Matches CHANNELS.reminder.tag in notify/channels.ts, so a push and a
           local fire for the same task replace rather than stack. */
        tag: `tracker-alpha-reminder:${row.id.split('@')[0]}`,
        taskId: row.id.split('@')[0],
        url: '/',
        requireInteraction: true,
      });

      for (const sub of subs) {
        try {
          const subscriber = server.subscribe({
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          });
          await subscriber.pushTextMessage(payload, {});
          sent++;
        } catch (err) {
          const status = (err as { statusCode?: number; status?: number })?.statusCode
            ?? (err as { status?: number })?.status ?? 0;
          /* The browser has thrown this endpoint away and it will never work
             again. Keeping it means retrying a dead address forever. */
          if (status === 404 || status === 410) {
            dead.push(sub.endpoint);
          } else {
            /* Rate limited or the push service is having a bad day. Left alone;
               dropped only once it has failed five times. One bad endpoint must
               never stop the batch. */
            await supabase
              .from('push_subscriptions')
              .update({ failure_count: (sub.failure_count ?? 0) + 1 })
              .eq('endpoint', sub.endpoint);
          }
        }
      }
    }
  }

  if (dead.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', dead);
  }
  await supabase
    .from('push_subscriptions')
    .delete()
    .gte('failure_count', 5);

  /* Retention, in the same run. The table is bounded by design rather than by a
     separate job somebody has to remember to schedule. */
  await supabase
    .from('due_reminders')
    .delete()
    .lt('fire_at', new Date(Date.now() - 7 * 86_400_000).toISOString());

  return ok({ sent, claimed: claimed.length, dropped: dead.length });
});
