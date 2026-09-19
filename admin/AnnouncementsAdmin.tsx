import React, { useEffect, useState } from 'react';
import {
  AdminAnnouncement, ANNOUNCEMENT_TYPES, AnnouncementType, POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS, PollVisibility, createAnnouncement, deleteAnnouncement,
  lifecycle, listAllAnnouncements, setPublished, thumbUrl, youTubeId,
} from '../announce/api';
import { TYPE_FACE } from '../announce/face';
import PollResults from './PollResults';
import { humanError } from '../feedback/api';

interface Props {
  /* No `adminId`. Authorship is pinned server-side: `admin_create_announcement`
     writes `created_by = auth.uid()` from the verified JWT, so passing an id
     down here would be decoration that looks like a parameter. */
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
const AnnouncementsAdmin: React.FC<Props> = ({ theme }) => {
  const dark = theme === 'dark';

  const [rows, setRows] = useState<AdminAnnouncement[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<AnnouncementType>('announcement');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /* Poll and video each add one field group. Kept as separate state rather than
     a discriminated draft object because switching type must not wipe what was
     typed into the other one — an admin who taps Poll, then Video, then Poll
     again should still have their options. */
  const [options, setOptions] = useState<string[]>(['', '']);
  const [pollVisibility, setPollVisibility] = useState<PollVisibility>('live');
  const [videoUrl, setVideoUrl] = useState('');

  /* Which poll's results are open, or null. One at a time — a console with six
     expanded charts is a console nobody can scan. */
  const [openResults, setOpenResults] = useState<string | null>(null);

  const videoId = youTubeId(videoUrl);

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
    if (title.trim().length < 3) {
      setFormError(type === 'poll' ? 'Write the question.' : 'Give it a title.');
      return;
    }
    /* A poll's question and a video's subject are the title, so neither needs a
       body — the database agrees (see announcement_body_len). */
    if (type !== 'poll' && type !== 'video' && body.trim().length < 3) {
      setFormError('Write the message.');
      return;
    }

    const cleanOptions = options.map(o => o.trim()).filter(Boolean);
    if (type === 'poll') {
      if (cleanOptions.length < POLL_MIN_OPTIONS) {
        setFormError(`A poll needs at least ${POLL_MIN_OPTIONS} options.`);
        return;
      }
      if (new Set(cleanOptions.map(o => o.toLowerCase())).size !== cleanOptions.length) {
        setFormError('Two options say the same thing.');
        return;
      }
    }
    if (type === 'video' && !videoId) {
      setFormError('That does not look like a YouTube link.');
      return;
    }

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
      await createAnnouncement({
        title, body, type, expiresAt, publish,
        pollVisibility,
        options: cleanOptions,
        videoId: videoId ?? undefined,
      });
      setTitle('');
      setBody('');
      setExpires('');
      setType('announcement');
      setOptions(['', '']);
      setPollVisibility('live');
      setVideoUrl('');
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
            placeholder={type === 'poll' ? 'The question' : type === 'video' ? "The video's subject" : 'Title'}
            className={field}
          />
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            maxLength={1200}
            rows={type === 'announcement' || type === 'update' || type === 'important' || type === 'maintenance' ? 5 : 3}
            placeholder={type === 'poll' || type === 'video'
              ? 'Context — optional. Line breaks are kept.'
              : 'The message. Line breaks are kept.'}
            className={`${field} resize-none leading-relaxed`}
          />

          {/* ── Video ── */}
          {type === 'video' && (
            <div className="space-y-2">
              <input
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="Paste the YouTube link"
                className={field}
              />
              {/* The thumbnail is the confirmation. An id parsed out of the
                  wrong link is the one mistake that is invisible in a form and
                  obvious in a picture. */}
              {videoId ? (
                <div className="flex items-center gap-3">
                  <img
                    src={thumbUrl(videoId)}
                    alt=""
                    aria-hidden="true"
                    className="w-24 rounded-md border"
                    style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
                  />
                  <span className={`text-[10px] font-ui ${muted}`}>
                    Video <span className="font-bold">{videoId}</span>
                  </span>
                </div>
              ) : videoUrl.trim() ? (
                <p className="text-[11px] font-bold font-ui text-[#E10600]">
                  No video id in that link.
                </p>
              ) : (
                <p className={`text-[10px] font-ui ${muted}`}>
                  Any form works — watch, youtu.be, shorts, embed or live.
                </p>
              )}
            </div>
          )}

          {/* ── Poll ── */}
          {type === 'poll' && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-5 text-[10px] font-bold font-ui tabular-nums ${muted}`}>{i + 1}</span>
                  <input
                    value={opt}
                    onChange={e => setOptions(prev => prev.map((o, j) => (j === i ? e.target.value : o)))}
                    maxLength={80}
                    placeholder={`Option ${i + 1}`}
                    className={field}
                  />
                  {options.length > POLL_MIN_OPTIONS && (
                    <button
                      onClick={() => setOptions(prev => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove option ${i + 1}`}
                      className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-opacity hover:opacity-60 ${muted}`}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {options.length < POLL_MAX_OPTIONS && (
                <button
                  onClick={() => setOptions(prev => [...prev, ''])}
                  className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
                >
                  + Add option
                </button>
              )}

              <div className="pt-1">
                <span className={eyebrow}>Who sees the results</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {([
                    ['live', 'Everyone, live', 'Students see the tally once they answer, updating as votes land.'],
                    ['private', 'Only me', 'The tally is for the console. Students just see that their answer was recorded.'],
                  ] as const).map(([id, label, blurb]) => (
                    <button
                      key={id}
                      onClick={() => setPollVisibility(id)}
                      title={blurb}
                      className={`px-3.5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-all active:scale-97 ${pollVisibility === id
                        ? 'bg-[#E10600] border-[#E10600] text-white'
                        : dark ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.16]' : 'border-[#E3E0D9] text-zinc-500 hover:border-[#D6D1C5]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className={`text-[10px] font-ui mt-2 leading-relaxed ${muted}`}>
                  {pollVisibility === 'live'
                    ? 'Students see the tally once they answer, and it updates as votes land.'
                    : 'Only administrators can read this tally. Students see that their answer was recorded and nothing more.'}
                  {' '}Either way, no individual vote is ever shown to anyone — including you.
                </p>
              </div>
            </div>
          )}

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
                    {a.read_count} read
                    {a.type === 'poll' && ` · ${a.vote_count} ${a.vote_count === 1 ? 'vote' : 'votes'}`}
                    {a.type === 'poll' && a.poll_visibility === 'private' && ' · private'}
                    {' · '}{when(a.published_at ?? a.created_at)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-start gap-3">
                  {a.type === 'video' && a.video_id && (
                    <img
                      src={thumbUrl(a.video_id)}
                      alt=""
                      aria-hidden="true"
                      className="w-20 rounded-md flex-shrink-0"
                      style={{ aspectRatio: '16 / 9', objectFit: 'cover' }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className={`text-[13px] font-bold font-ui leading-snug ${ink}`}>{a.title}</p>
                    {a.body.trim() && (
                      <p className={`mt-1 text-[11.5px] font-ui leading-relaxed whitespace-pre-wrap ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {a.body}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.type === 'poll' && (
                    <button
                      onClick={() => setOpenResults(openResults === a.id ? null : a.id)}
                      aria-expanded={openResults === a.id}
                      className={`px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.08em] rounded-md border transition-colors active:scale-97 font-ui ${openResults === a.id
                        ? 'bg-[#E10600] border-[#E10600] text-white'
                        : dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-zinc-500 hover:text-[#17150F]'}`}
                    >
                      {openResults === a.id ? 'Hide results' : 'Results'}
                    </button>
                  )}
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

                {a.type === 'poll' && openResults === a.id && (
                  <PollResults
                    announcementId={a.id}
                    live={a.poll_visibility === 'live'}
                    theme={theme}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default AnnouncementsAdmin;
