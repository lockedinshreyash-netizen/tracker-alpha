import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { humanError } from '../feedback/api';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
}

interface Row {
  user_id: string;
  email: string | null;
  granted_at: string;
}

/**
 * Who can do all of this, and how somebody else joins them.
 *
 * Appointing is an RPC, not an insert. `user_roles` has no write policy at all,
 * which means no client — not even this one, signed in as an administrator —
 * can write a row to it. `grant_admin` checks `is_admin()` as its first
 * statement and then writes as the definer, so the authorization decision is
 * made in the same transaction as the write and there is no window in which a
 * client's claim about itself is trusted.
 *
 * The first administrator is not appointed here. There is no first-run "claim
 * this app" screen, because a first-run claim screen is a race anybody who
 * finds the deploy can enter. It is one statement in the SQL editor; see
 * supabase/admin.sql §7.
 */
const AdminRoster: React.FC<Props> = ({ adminId, theme }) => {
  const dark = theme === 'dark';

  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data, error: e } = await supabase.rpc('admin_list_admins');
      if (e) throw e;
      setRows((data ?? []) as Row[]);
    } catch (e) {
      setRows([]);
      setError(humanError(e));
    }
  };

  useEffect(() => { load(); }, []);

  /* The two functions raise with their own wording for the two cases that are
     actually about this form — no such account, and last administrator — and
     those sentences are written to be shown. Anything else falls through to the
     generic mapper. */
  const speak = (e: unknown): string => {
    const message = (e as { message?: string })?.message ?? '';
    if (/no account with that email/i.test(message)) {
      return 'No account with that email has signed in yet.';
    }
    if (/last administrator/i.test(message)) {
      return 'You cannot remove the last administrator.';
    }
    return humanError(e);
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await fn();
      setNote(ok);
      await load();
    } catch (e) {
      setError(speak(e));
    } finally {
      setBusy(false);
    }
  };

  const appoint = () => {
    const target = email.trim();
    if (!target) { setError('Enter an email address.'); return; }
    run(async () => {
      const { error: e } = await supabase.rpc('grant_admin', { p_email: target });
      if (e) throw e;
      setEmail('');
    }, `${target} is now an administrator.`);
  };

  const standDown = (row: Row) => {
    const label = row.email ?? row.user_id;
    const self = row.user_id === adminId;
    if (!window.confirm(self
      ? 'Remove your OWN administrator access? You will lose this tab immediately.'
      : `Remove administrator access for ${label}?`)) return;

    run(async () => {
      const { error: e } = await supabase.rpc('revoke_admin', { p_user_id: row.user_id });
      if (e) throw e;
      /* Standing yourself down means this whole tab no longer applies, and
         `useAdmin`'s answer was settled on mount. Reload rather than leave a
         console on screen whose every next query will be refused. */
      if (self) window.location.reload();
    }, `${label} is no longer an administrator.`);
  };

  const card = `p-6 md:p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const ink = dark ? 'text-white' : 'text-[#17150F]';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const field = `w-full rounded-lg border px-3 py-2.5 text-[13px] font-ui outline-none transition-colors ${dark
    ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20'
    : 'bg-[#F7F6F3] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0] focus:border-[#D6D1C5]'}`;

  return (
    <section className={card}>
      <p className={eyebrow}>Administrators</p>
      <p className={`text-[11px] font-ui mt-1 ${muted}`}>
        They must have signed in to LOCK IN at least once before they can be appointed.
      </p>

      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          type="email"
          autoComplete="off"
          placeholder="name@example.com"
          className={field}
        />
        <button
          onClick={appoint}
          disabled={busy}
          className="px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50 whitespace-nowrap"
        >
          Appoint
        </button>
      </div>

      {error && <p className="mt-4 text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}
      {note && <p className={`mt-4 text-[11px] font-bold font-ui ${muted}`}>{note}</p>}

      <div className="mt-5 space-y-2">
        {rows === null && <p className={`text-[11px] font-ui ${muted}`}>Loading…</p>}
        {rows?.map(r => (
          <div
            key={r.user_id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-[#E3E0D9]'}`}
          >
            <span className={`flex-1 min-w-0 text-[12.5px] font-ui truncate ${ink}`}>
              {r.email ?? r.user_id}
              {r.user_id === adminId && (
                <span className={`ml-2 text-[9px] font-bold uppercase tracking-[0.08em] ${muted}`}>you</span>
              )}
            </span>
            <button
              onClick={() => standDown(r)}
              disabled={busy}
              className={`shrink-0 px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-red-500' : 'border-[#E3E0D9] text-zinc-500 hover:text-red-500'}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default AdminRoster;
