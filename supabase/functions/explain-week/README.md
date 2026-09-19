# Written notes — deploy runbook

Everything in the Observatory works without this. The day count, the charts, the
best-window finding, the evidence meters and the sleep tracking are all
arithmetic Alpha does on the device, and none of it touches this function.

This runbook adds one optional extra: turning those figures into a few sentences
of plain English, on demand, using Claude.

**Until these steps are run the feature ships dark** — without
`VITE_AI_ENABLED=true` the card does not render at all, `insight/packet.ts` is
never even downloaded, and no request is possible. A control that cannot work is
worse than no control.

---

## What this costs

The model is **Claude Haiku 4.5** — $1 per million input tokens, $5 per million
output.

These are **measured, not estimated**. The request is a frozen system prompt
plus the statistics packet, and the packet was sampled from a real 22-day
experiment (57 sessions, 19 study days, sleep on):

| Part of the request | Tokens |
|---|---:|
| System prompt (frozen) | ~385 |
| Output schema | ~83 |
| Statistics packet | ~104 |
| User framing | ~15 |
| **Total input** | **~587** |
| Output (capped at 600) | ~300 typical |

That is **~$0.0021 a call** at typical output, and **$0.0036** if every call
ran to the 600-token ceiling.

| | Calls / user / month | Cost / user / month |
|---|---:|---:|
| Low | 2 | $0.004 |
| Expected | 5 | $0.011 |
| High | 12 | $0.025 |

At a 10% opt-in rate, 10,000 Alpha users means ~1,000 AI users, or about
**$11/month** — $18 even if every call maxed its output. The other 9,000 cost
exactly **$0.00**: no key reaches them, no background job runs for them, and
`insight/packet.ts` is a dynamic import that is never in their bundle.

**$4 of credit is roughly 1,900 calls.** That funds prompt development, your own
use, and a 20-user beta for the best part of a year.

**The number that can run away is calls per user per month, not tokens per
call.** The packet is a fixed small shape you control — 375 bytes, and it barely
moves. Call frequency is set by where the button is. Never wire this to a timer,
a mount, a sync, or a session ending. It is a button, and it must stay a button.

Defaults, all enforced server-side: **10 calls per user per month**, **2,000
calls total per month**, **600 max output tokens**. That holds the bill under
$5/month even in the high scenario.

---

## 1. Schema

Supabase dashboard → SQL Editor → New query → paste **`supabase/ai.sql`** → Run.
Every statement is idempotent; re-run it any time.

Read its header before running it. The reason there are two narrow tables rather
than the function reading `user_profiles` is the whole security design of this
feature.

## 2. Get an API key

[console.anthropic.com](https://console.anthropic.com) → API keys → Create key.

**The key never enters this repo and never enters the client bundle.** Vite
inlines every `VITE_`-prefixed variable into public JavaScript, so a key shipped
that way is published, not hidden. It exists only as a Supabase function secret,
set in the next step.

## 3. Set the secrets

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
```

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
automatically — do not set them yourself.

Optional overrides, all with sane defaults baked in:

```bash
npx supabase secrets set ANTHROPIC_MODEL=claude-haiku-4-5 AI_USER_CAP=10 AI_GLOBAL_CAP=2000
```

Start `AI_GLOBAL_CAP` low while you are testing. With about $4 of credit, a cap
of 300 is roughly $1 — enough to be sure it works, with the balance intact if
something loops.

## 4. Deploy the function

```bash
npx supabase functions deploy explain-week
```

JWT verification stays **on** for this one — unlike `send-reminders`, the caller
is a signed-in browser, and every row the function touches is keyed to the id
inside that verified token rather than to anything the request body claims.

## 5. Turn it on in the client

```bash
echo 'VITE_AI_ENABLED=true' >> .env.local
```

Rebuild. The card now appears at the bottom of the Observatory, off, with its
consent copy. Nothing is sent until a student turns it on *and* taps the button.

---

## Checking the bill

```sql
select month,
       count(*)   as users,
       sum(calls) as calls,
       round((sum(input_tokens)  / 1e6 * 1.00)::numeric +
             (sum(output_tokens) / 1e6 * 5.00)::numeric, 4) as usd
from public.ai_usage
group by month
order by month desc;
```

## Changing the prompt

The prompt lives in `index.ts` as `SYSTEM`. If you edit it, **raise
`PROMPT_VERSION` in `insight/packet.ts`** in the same change. That constant is
part of the cache key, so bumping it invalidates every stored note at once —
otherwise students keep reading output from the previous prompt with no way to
refresh it.

## Turning it off

Unset `VITE_AI_ENABLED` and rebuild. The card vanishes; everything else in the
Observatory is untouched. To stop spending immediately without a deploy, set
`AI_GLOBAL_CAP=0` — the function then returns `budget_exhausted`, and the client
renders the deterministic page exactly as normal with no error banner.

---

## What is actually sent to Anthropic

`insight/packet.ts` is the entire boundary, and it is a separate file so that
this list can be verified by reading one thing:

**Sent** — counts, means and ratios: sessions, hours, study days, consistency,
average session length, the evidence-gate counts, the confidence tier, and
(where the gates allow it) the best/worst window as clock times with their focus
averages and sample sizes. Sleep appears only once there are 7+ nights, and only
as a count and a mean.

**Never sent** — any log, any chapter, any task, any note, the user's name,
email or id, and any calendar date. Periods travel as relative labels
(`last_30d`), so a packet cannot be pinned to a person or a moment.

The edge function knows who is asking, because it has to count their quota.
Anthropic does not.
