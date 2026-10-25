import React, { useEffect, useState } from 'react';
import { AdminNote, NoteError, REPLY_MAX, adminListNotes, adminReply } from '../support/api';

interface Props {
  theme: 'dark' | 'light';
}

const when = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

/**
 * Notes to the founder, from the Support Alpha page (supabase/support.sql).
 *
 * Deliberately not the Feedback inbox: no status, no category, no metadata
 * about where they were standing. A note is a letter, and the only thing to do
 * with one is read it and, if you like, write one back. One reply per note;
 * editing it sends it again (the author sees it as new), and clearing it takes
 * it back.
 *
 * Who wrote it is not here and cannot be: admin_founder_notes() never returns
 * the author's account. A signed note carries the name they chose to attach,
 * and an unsigned one stays unsigned.
 */
const FounderNotesAdmin: React.FC<Props> = ({ theme }) => {
  const dark = theme === 'dark';

  const [unreplied, setUnreplied] = useState(true);
  const [rows, setRows] = useState<AdminNote[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const load = async (onlyUnreplied: boolean) => {
    setError(null);
    try {
      const page = await adminListNotes(onlyUnreplied, null);
      setRows(page);
      setMore(page.length === 50);
    } catch (e) {
      setRows([]);
      setError(e instanceof NoteError ? e.message : 'Something went wrong. Try again in a moment.');
    }
  };

  useEffect(() => { void load(unreplied); }, [unreplied]);

  const loadMore = async () => {
    if (!rows?.length || busy) return;
    setBusy(true);
    try {
      const page = await adminListNotes(unreplied, rows[rows.length - 1].created_at);
      setRows(prev => [...(prev ?? []), ...page.filter(n => !prev?.some(p => p.id === n.id))]);
      setMore(page.length === 50);
    } catch (e) {
      setError(e instanceof NoteError ? e.message : 'Something went wrong. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const send = async (id: string, text: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await adminReply(id, text);
      setOpenId(null);
      await load(unreplied);
    } catch (e) {
      setError(e instanceof NoteError ? e.message : 'Something went wrong. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const card = `p-6 md:p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const ink = dark ? 'text-white' : 'text-zinc-900';
  const body = dark ? 'text-zinc-300' : 'text-zinc-700';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const field = `w-full rounded-lg border px-3 py-2.5 text-[13px] font-ui outline-none transition-colors ${dark
    ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20'
    : 'bg-[#F7F6F3] border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300'}`;
  const chip = (on: boolean) =>
    `px-3.5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-all active:scale-97 ${on
      ? 'bg-[#E10600] border-[#E10600] text-white'
      : dark ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.16]' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'}`;
  const ghost = `px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'}`;

  return (
    <section className={card}>
      <div className="flex items-baseline justify-between gap-3">
        <p className={eyebrow}>Notes to the founder</p>
        <button
          onClick={() => { void load(unreplied); }}
          className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
        >
          Refresh
        </button>
      </div>
      <p className={`mt-2 text-[12px] font-ui ${muted}`}>
        From the Support Alpha page. You see a name only when they signed it. Your reply appears under their note.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => setUnreplied(true)} className={chip(unreplied)}>Waiting for a reply</button>
        <button onClick={() => setUnreplied(false)} className={chip(!unreplied)}>All</button>
      </div>

      {error && <p className="mt-4 text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}
      {rows === null && !error && <p className={`mt-6 text-[11px] font-ui ${muted}`}>Loading…</p>}
      {rows?.length === 0 && !error && (
        <p className={`mt-6 text-[12px] font-ui ${muted}`}>{unreplied ? 'Every note has a reply.' : 'No notes yet.'}</p>
      )}

      <div className="mt-5 space-y-3">
        {rows?.map(n => {
          const editing = openId === n.id;
          return (
            <article
              key={n.id}
              className={`rounded-xl border p-4 ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-zinc-200'}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${n.signed_name ? ink : muted}`}>
                  {n.signed_name ?? 'Unsigned'}
                </span>
                <span className={`text-[9px] font-ui tabular-nums ml-auto ${muted}`}>{when(n.created_at)}</span>
              </div>
              <p className={`mt-2 text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${body}`}>{n.body}</p>

              {n.reply && !editing && (
                <div className={`mt-4 pl-3 border-l-2 ${dark ? 'border-white/[0.12]' : 'border-zinc-300'}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${muted}`}>
                    Your reply · {n.replied_at ? when(n.replied_at) : ''} · {n.reply_seen ? 'Read' : 'Not read yet'}
                  </p>
                  <p className={`mt-1 text-[12.5px] font-ui leading-relaxed whitespace-pre-wrap break-words ${body}`}>{n.reply}</p>
                </div>
              )}

              {editing ? (
                <div className="mt-4">
                  <textarea
                    value={reply}
                    onChange={e => setReply(e.target.value.slice(0, REPLY_MAX))}
                    maxLength={REPLY_MAX}
                    rows={4}
                    autoFocus
                    aria-label="Your reply"
                    placeholder="Write back. They read it on the Support page."
                    className={`${field} resize-none leading-relaxed`}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => { void send(n.id, reply); }}
                      disabled={busy || !reply.trim() || reply.trim() === n.reply}
                      className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.06em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
                    >
                      {n.reply ? 'Update reply' : 'Send reply'}
                    </button>
                    {n.reply && (
                      <button onClick={() => { void send(n.id, ''); }} disabled={busy} className={ghost}>
                        Take back
                      </button>
                    )}
                    <button onClick={() => setOpenId(null)} disabled={busy} className={ghost}>Cancel</button>
                    <span className={`ml-auto text-[10px] font-ui tabular-nums ${muted}`}>{reply.length} / {REPLY_MAX}</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setOpenId(n.id); setReply(n.reply ?? ''); }}
                  className={`mt-4 ${ghost}`}
                >
                  {n.reply ? 'Edit reply' : 'Reply'}
                </button>
              )}
            </article>
          );
        })}
      </div>

      {more && (
        <button onClick={() => { void loadMore(); }} disabled={busy} className={`mt-5 ${ghost}`}>Older notes</button>
      )}
    </section>
  );
};

export default FounderNotesAdmin;
