import React, { useEffect, useState } from 'react';
import {
  AdminAnnouncement, ANNOUNCEMENT_TYPES, AnnouncementType, createAnnouncement,
  deleteAnnouncement, lifecycle, listAllAnnouncements, setPublished,
} from '../announce/api';
import { TYPE_FACE } from '../announce/face';
import { humanError } from '../feedback/api';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
}

const LIFECYCLE_COPY: Record<ReturnType<typeof lifecycle>, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  expired: 'Expired',
};

const when = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

/**
 * Compose, publish, and see what went out.
 *
 * The composer is one card and four fields because that is the whole job. The
 * two things it does insist on: a notice is a DRAFT until somebody presses
 * publish, and publishing says out loud who is about to read it. An interface
 * that puts "send to everyone" one keystroke from "save" will eventually send
 * to everyone.
 */
const AnnouncementsAdmin: React.FC<Props> = ({ adminId, theme }) => {
  const dark = theme === 'dark';

  const [rows, setRows] = useState<AdminAnnouncement[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<AnnouncementType>('announcement');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setListError(null);
    try {
      setRows(await listAllAnnouncements());
    } catch (e) {
      setRows([]);
      setListError(humanError(e));
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (publish: boolean) => {
    if (busy) return;
    if (title.trim().length < 3) { setFormError('Give it a title.'); return; }
    if (body.trim().length < 3) { setFormError('Write the message.'); return; }

    /* `datetime-local` hands back wall-clock with no zone. Parsed as local
       time, which is what the admin typing it meant, and stored as an
       instant. */
    let expiresAt: string | null = null;
    if (expires) {
      const t = Date.parse(expires);
      if (Number.isNaN(t)) { setFormError('That expiry date is not valid.'); return; }
      if (publish && t <= Date.now()) { setFormError('That expiry is already in the past.'); return; }
      expiresAt = new Date(t).toISOString();
    }

    setBusy(true);
    setFormError(null);
    try {
      await createAnnouncement(adminId, { title, body, type, expiresAt, publish });
      setTitle('');
      setBody('');
      setExpires('');
      setType('announcement');
      await load();
    } catch (e) {
      setFormError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const act = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setListError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setListError(humanError(e));
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

  return (
    <div className="space-y-6">
      {/* ── Composer ── */}
      <section className={card}>
        <p className={eyebrow}>New announcement</p>
        <p className={`text-[11px] font-ui mt-1 ${muted}`}>
          Published notices open on every signed-in user's Today page, once each.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {ANNOUNCEMENT_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-all active:scale-97 ${type === t
                ? 'bg-[#E10600] border-[#E10600] text-white'
                : dark ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.16]' : 'border-[#E3E0D9] text-zinc-500 hover:border-[#D6D1C5]'}`}
            >
              <span aria-hidden="true">{TYPE_FACE[t].icon}</span>
              {TYPE_FACE[t].label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={90}
            placeholder="Title"
            className={field}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={1200}
            rows={5}
            placeholder="The message. Line breaks are kept."
            className={`${field} resize-none leading-relaxed`}
          />
          <label className="block">
            <span className={eyebrow}>Stops showing — optional</span>
            <input
              type="datetime-local"
              value={expires}
              onChange={e => setExpires(e.target.value)}
              className={`${field} mt-1.5`}
            />
          </label>
        </div>

        {formError && (
          <p className="mt-4 text-[11px] font-bold font-ui text-[#E10600]">{formError}</p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => save(true)}
            disabled={busy}
            className="flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
          >
            {busy ? 'Working…' : 'Publish to everyone'}
          </button>
          <button
            onClick={() => save(false)}
            disabled={busy}
            className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'}`}
          >
            Save as draft
          </button>
        </div>
      </section>

      {/* ── What has been sent ── */}
      <section className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <p className={eyebrow}>Sent and drafted</p>
          <button
            onClick={load}
            className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
          >
            Refresh
          </button>
        </div>

        {listError && (
          <p className="mt-4 text-[11px] font-bold font-ui text-[#E10600]">{listError}</p>
        )}

        {rows === null && !listError && (
          <p className={`mt-6 text-[11px] font-ui ${muted}`}>Loading…</p>
        )}

        {rows?.length === 0 && !listError && (
          <p className={`mt-6 text-[12px] font-ui ${muted}`}>Nothing yet.</p>
        )}

        <div className="mt-5 space-y-3">
          {rows?.map(a => {
            const stage = lifecycle(a);
            return (
              <div
                key={a.id}
                className={`p-4 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-[#E3E0D9]'}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui ${stage === 'live' ? 'text-[#E10600]' : muted}`}>
                    {LIFECYCLE_COPY[stage]}
                  </span>
                  <span className={`text-[9px] uppercase tracking-[0.06em] font-ui ${muted}`}>
                    {TYPE_FACE[a.type].label}
                  </span>
                  <span className={`text-[9px] font-ui tabular-nums ml-auto ${muted}`}>
                    {a.read_count} read · {when(a.published_at ?? a.created_at)}
                  </span>
                </div>

                <p className={`mt-1.5 text-[13px] font-bold font-ui leading-snug ${ink}`}>{a.title}</p>
                <p className={`mt-1 text-[11.5px] font-ui leading-relaxed whitespace-pre-wrap ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {a.body}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => act(() => setPublished(a.id, stage === 'draft'))}
                    disabled={busy}
                    className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-zinc-500 hover:text-[#17150F]'}`}
                  >
                    {stage === 'draft' ? 'Publish' : 'Unpublish'}
                  </button>
                  <button
                    onClick={() => {
                      /* It is one row, and pulling it back to a draft is right
                         there — so the only reason to reach for delete is to
                         erase it, including everybody's acknowledgement of it. */
                      if (window.confirm(`Delete "${a.title}"? This also erases who has read it.`)) {
                        act(() => deleteAnnouncement(a.id));
                      }
                    }}
                    disabled={busy}
                    className="px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border border-red-900/40 text-red-500/70 hover:bg-red-900/10 hover:text-red-500 transition-colors active:scale-97 font-ui disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AnnouncementsAdmin;
