import { useEffect, useState } from 'react';
import {
  accessOverview, admitNext, admitUsers, fetchWaitlist, grantAccessByEmail,
  type AccessOverview, type WaitlistRow,
} from '../access/api';
import { btn, Card, Eyebrow, StatTile, tokens } from '../ui/kit';

interface Props {
  theme: 'dark' | 'light';
}

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

const CLASS_LABEL: Record<number, string> = { 11: 'Class 11', 12: 'Class 12', 13: 'Dropper' };

/**
 * Who is in, who is waiting, and the door (supabase/access.sql).
 *
 * Invite-only exists because the backend is not ready for a spike, so the one
 * decision here is how many people to let in and when: Admit one, or the next
 * N in line. The queue shows what the applicant told us (exam, class, hours,
 * one line, whether they would buy the Pass) and their public name, never an
 * email. Grant by email is for the Play reviewer's account and the odd friend.
 * Device claims are founding access claimed from a device's local history
 * rather than an account's age; they are counted so a spike of them is seen.
 */
const AccessAdmin = ({ theme }: Props) => {
  const dark = theme === 'dark';
  const t = tokens(dark);

  const [overview, setOverview] = useState<AccessOverview | null>(null);
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(25);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [o, w] = await Promise.all([accessOverview(), fetchWaitlist(null)]);
      setOverview(o);
      setRows(w);
      setMore(w.length === 50);
    } catch (e) {
      if (e instanceof Error && e.message === 'missing') setMissing(true);
      else setError('Could not load. Try again in a moment.');
      setRows([]);
    }
  };
  useEffect(() => { void load(); }, []);

  const loadMore = async () => {
    if (!rows?.length || busy) return;
    setBusy(true);
    try {
      const page = await fetchWaitlist(rows[rows.length - 1].place);
      setRows(prev => [...(prev ?? []), ...page]);
      setMore(page.length === 50);
    } catch {
      setError('Could not load more.');
    } finally {
      setBusy(false);
    }
  };

  const run = async (what: () => Promise<number | { status: string }>, done: (r: number | { status: string }) => string) => {
    setBusy(true);
    setNote(null);
    try {
      const r = await what();
      setNote(done(r));
      await load();
    } catch {
      setNote('That did not go through. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (missing) {
    return (
      <Card dark={dark} className="p-8 md:p-10">
        <Eyebrow dark={dark}>Access</Eyebrow>
        <p className={`mt-3 text-sm font-ui ${t.body}`}>
          Invite-only is not switched on for this project. Run <code>supabase/access.sql</code> in the SQL editor, then <code>select public.access_backfill();</code>
        </p>
      </Card>
    );
  }

  const by = overview?.by_source ?? {};
  const members = Object.values(by).reduce((a, b) => a + (b ?? 0), 0) + (overview?.founding_unnumbered ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile dark={dark} label="Members" value={members.toLocaleString('en-IN')} sub={`${((by.founding ?? 0) + (overview?.founding_unnumbered ?? 0)).toLocaleString('en-IN')} founding`} />
        <StatTile dark={dark} label="Waiting" value={(overview?.waiting ?? 0).toLocaleString('en-IN')} sub={`${overview?.waiting_wants_pass ?? 0} reserved a Pass · ${overview?.waiting_used_before ?? 0} used Alpha before`} />
        <StatTile dark={dark} label="Passes gifted" value={(overview?.invites_redeemed ?? 0).toLocaleString('en-IN')} sub={`${(overview?.invites_open ?? 0).toLocaleString('en-IN')} still open`} />
        <StatTile dark={dark} label="Let in" value={((by.waitlist ?? 0) + (by.admin ?? 0) + (by.pass ?? 0)).toLocaleString('en-IN')} sub={`${by.pass ?? 0} Pass · ${overview?.device_claims ?? 0} device claims`} />
      </div>

      <Card dark={dark} className="p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow dark={dark}>Let people in</Eyebrow>
            <p className={`mt-2 text-sm font-ui ${t.muted}`}>Oldest in line first. They get in on their next visit, with their own pass to gift.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number" min={1} max={1000} value={n}
              onChange={e => setN(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              className={`${t.input} w-24`} aria-label="How many to admit"
            />
            <button
              className={`${btn} h-10 px-4 whitespace-nowrap ${t.primary}`}
              disabled={busy || !overview?.waiting}
              onClick={() => run(() => admitNext(n), r => `Let in ${r as number}.`)}
            >
              Admit next {n}
            </button>
          </div>
        </div>
        {note && <p className={`mt-3 text-[12px] font-ui ${t.muted}`}>{note}</p>}
        {error && <p className="mt-3 text-[12px] font-ui text-[#E10600]">{error}</p>}

        <div className={`mt-6 border-t ${t.rule}`}>
          {rows === null && <p className={`py-6 text-sm font-ui ${t.muted}`}>Loading…</p>}
          {rows?.length === 0 && !error && <p className={`py-6 text-sm font-ui ${t.muted}`}>Nobody is waiting.</p>}
          {rows?.map(r => (
            <div key={r.user_id} className={`grid grid-cols-[48px_1fr_auto] gap-3 items-start py-4 border-b ${t.rule}`}>
              <span className={`num-stat text-sm tabular-nums ${t.faint}`}>{r.place}</span>
              <div className="min-w-0">
                <p className={`text-sm font-bold font-ui truncate ${t.heading}`}>{r.name ?? 'No name yet'}
                  {r.device_since && (
                    <span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded bg-[#F59F00]/15 text-[#B76E00]">
                      Used Alpha since {new Date(`${r.device_since}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </p>
                <p className={`text-[12px] font-ui ${t.muted}`}>
                  {[r.exam, r.class ? CLASS_LABEL[r.class] : null, r.goal_hours != null ? `${r.goal_hours}h a day` : null, r.wants_pass ? 'Reserved a Pass' : null]
                    .filter(Boolean).join(' · ') || 'No answers'}
                  <span className={t.faint}> · {when(r.joined_at)}</span>
                </p>
                {r.why && <p className={`mt-1.5 text-[13px] font-ui ${t.body}`}>“{r.why}”</p>}
              </div>
              <button
                className={`${btn} h-8 px-3 ${t.ghost}`}
                disabled={busy}
                onClick={() => run(() => admitUsers([r.user_id]), () => `Let in ${r.name ?? 'them'}.`)}
              >
                Admit
              </button>
            </div>
          ))}
          {more && (
            <button className={`${btn} mt-4 h-9 px-4 ${t.ghost}`} disabled={busy} onClick={loadMore}>Load more</button>
          )}
        </div>
      </Card>

      <Card dark={dark} className="p-6 md:p-8">
        <Eyebrow dark={dark}>Let someone in by email</Eyebrow>
        <p className={`mt-2 text-sm font-ui ${t.muted}`}>They must have signed in with Google once. Use this for the Play reviewer's account.</p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            const v = email.trim();
            if (!v) return;
            void run(() => grantAccessByEmail(v), r => {
              const s = (r as { status: string }).status;
              if (s === 'granted') { setEmail(''); return `${v} is in.`; }
              return s === 'already' ? `${v} is already a member.` : `No account for ${v}. They need to sign in once first.`;
            });
          }}
        >
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@gmail.com" className={t.input} aria-label="Email" />
          <button className={`${btn} h-[42px] px-4 whitespace-nowrap shrink-0 ${t.primary}`} disabled={busy || !email.trim()} type="submit">Let in</button>
        </form>
      </Card>
    </div>
  );
};

export default AccessAdmin;
