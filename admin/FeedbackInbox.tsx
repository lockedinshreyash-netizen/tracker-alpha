import React, { useEffect, useState } from 'react';
import {
  AdminTicket, STATUS_LABEL, TicketStatus, categoryLabel, humanError,
  listAllTickets, respond, setStatus,
} from '../feedback/api';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
}

const FILTERS: Array<{ id: TicketStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
];

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/**
 * Everything users have sent, oldest problem first.
 *
 * Triage is two buttons and a reply box, and that is the ceiling. This is not a
 * helpdesk: there is no assignment, no priority, no SLA and no thread. A
 * conversation that needs more than one exchange has an email address sitting
 * right there in the row.
 *
 * Abuse reports are marked and nothing more. They are read by the same person
 * in the same list, because a separate queue is a queue that gets checked less
 * often.
 */
const FeedbackInbox: React.FC<Props> = ({ adminId, theme }) => {
  const dark = theme === 'dark';

  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');
  const [rows, setRows] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = async (status: TicketStatus | 'all') => {
    setError(null);
    try {
      setRows(await listAllTickets(status === 'all' ? null : status));
    } catch (e) {
      setRows([]);
      setError(humanError(e));
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load(filter);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const card = `p-6 md:p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const ink = dark ? 'text-white' : 'text-[#17150F]';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const field = `w-full rounded-lg border px-3 py-2.5 text-[13px] font-ui outline-none transition-colors ${dark
    ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20'
    : 'bg-[#F7F6F3] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0] focus:border-[#D6D1C5]'}`;
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-all active:scale-97 ${on
      ? 'bg-[#E10600] border-[#E10600] text-white'
      : dark ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.16]' : 'border-[#E3E0D9] text-zinc-500 hover:border-[#D6D1C5]'}`;

  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={eyebrow}>Inbox</p>
        <button
          onClick={() => load(filter)}
          className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
        >
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={chip(filter === f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}
      {rows === null && !error && <p className={`mt-6 text-[11px] font-ui ${muted}`}>Loading…</p>}
      {rows?.length === 0 && !error && (
        <p className={`mt-6 text-[12px] font-ui ${muted}`}>Nothing here.</p>
      )}

      <div className="mt-5 space-y-3">
        {rows?.map(t => {
          const expanded = openId === t.id;
          return (
            <div
              key={t.id}
              className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-[#E3E0D9]'}`}
            >
              <button
                onClick={() => { setOpenId(expanded ? null : t.id); setReply(t.admin_response ?? ''); }}
                className="w-full text-left p-4"
                aria-expanded={expanded}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui ${t.status === 'open' ? 'text-[#E10600]' : muted}`}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span className={`text-[9px] uppercase tracking-[0.06em] font-ui ${t.category === 'abuse' ? 'text-[#E10600]' : muted}`}>
                    {categoryLabel(t.category)}
                  </span>
                  <span className={`text-[9px] font-ui tabular-nums ml-auto ${muted}`}>{when(t.created_at)}</span>
                </div>
                <p className={`mt-1.5 text-[13px] font-bold font-ui leading-snug ${ink}`}>{t.subject}</p>
                <p className={`mt-0.5 text-[10.5px] font-ui truncate ${muted}`}>{t.email ?? t.user_id}</p>
              </button>

              {expanded && (
                <div className={`px-4 pb-4 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
                  <p className={`mt-3 text-[12px] font-ui leading-relaxed whitespace-pre-wrap ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {t.message}
                  </p>

                  {t.reported_name && (
                    <p className={`mt-3 text-[11px] font-ui ${muted}`}>
                      <span className="font-bold uppercase tracking-[0.06em]">Named: </span>
                      {t.reported_name}
                    </p>
                  )}

                  {/* The metadata the user never had to type. */}
                  <p className={`mt-3 text-[10px] font-ui leading-relaxed break-words ${muted}`}>
                    {t.route ? `On ${t.route}` : 'Route unknown'}
                    {t.user_agent ? ` · ${t.user_agent.slice(0, 120)}` : ''}
                  </p>

                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    maxLength={2000}
                    rows={3}
                    placeholder="Reply — they read this under Your messages. Optional."
                    className={`${field} mt-4 resize-none leading-relaxed`}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => act(() => respond(t.id, adminId, reply, 'resolved'))}
                      disabled={busy}
                      className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
                    >
                      {reply.trim() ? 'Reply & resolve' : 'Resolve'}
                    </button>
                    {t.status !== 'in_progress' && (
                      <button
                        onClick={() => act(() => setStatus(t.id, 'in_progress'))}
                        disabled={busy}
                        className={`px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-zinc-500 hover:text-[#17150F]'}`}
                      >
                        In progress
                      </button>
                    )}
                    {t.status !== 'open' && (
                      <button
                        onClick={() => act(() => setStatus(t.id, 'open'))}
                        disabled={busy}
                        className={`px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-zinc-500 hover:text-[#17150F]'}`}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default FeedbackInbox;
