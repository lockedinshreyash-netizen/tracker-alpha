import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Announcement } from './api';
import { TYPE_FACE } from './face';
import PollBody, { PollHandle, PollStatus } from './PollBody';
import VideoBody from './VideoBody';

interface Props {
  announcement: Announcement;
  /** Position in the queue, for the "1 of 3" line. */
  index: number;
  total: number;
  theme: 'dark' | 'light';
  /** Needed to record a vote. Null only if the session vanished mid-read. */
  userId: string | null;
  saving: boolean;
  error: string | null;
  onAcknowledge: () => void;
  onAcknowledgeAll: () => void;
  /** Close without acknowledging. It comes back as a line on Today. */
  onSetAside: () => void;
}

/**
 * One message from the people who make the app, on the way into Today.
 *
 * Built on `UnlockModal`'s shell rather than beside it — same scrim, same
 * radius, same entrance, same footer — because those two are now the only
 * things in the product allowed to stop you on arrival, and two interruptions
 * that look different are two interruptions.
 *
 * Only the explicit button acknowledges. The scrim closes it, but closing is
 * not reading: the notice stays unread, Today keeps a line for it, and it is
 * still there tomorrow. An announcement lost to a stray tap is an announcement
 * that never went out.
 */
const AnnouncementModal: React.FC<Props> = ({
  announcement, index, total, theme, userId, saving, error,
  onAcknowledge, onAcknowledgeAll, onSetAside,
}) => {
  const dark = theme === 'dark';
  const face = TYPE_FACE[announcement.type];
  const isPoll = announcement.type === 'poll' && announcement.options.length > 0;

  /* While a poll's options are open, the primary button is Submit — never Skip.
     A big red "Skip" under an unanswered question was the most prominent thing
     on the card, and people pressed it thinking it was how you answer. Skipping
     is a small text link in the header now: available, not suggested. */
  const pollRef = useRef<PollHandle | null>(null);
  const [poll, setPoll] = useState<PollStatus>({ open: isPoll, draft: null });
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setPoll({ open: isPoll, draft: null }); }, [announcement.id, isPoll]);
  const onPollStatus = useCallback((s: PollStatus) => setPoll(s), []);
  const asking = isPoll && poll.open;
  const live = announcement.poll_visibility === 'live';

  const submit = async () => {
    if (!pollRef.current || submitting) return;
    setSubmitting(true);
    const ok = await pollRef.current.submit();
    setSubmitting(false);
    /* A private poll has nothing more to show once the vote is in, so Submit
       also marks it read and moves on. A live one stays open on its results. */
    if (ok && !live) onAcknowledge();
  };

  /* Escape sets it aside; it never acknowledges. Same reasoning as the scrim. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSetAside(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSetAside]);

  const eyebrow = face.urgent
    ? 'text-[#E10600]'
    : dark ? 'text-zinc-400' : 'text-zinc-500';

  return (
    <div
      className="fixed inset-0 z-[88] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onSetAside}
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
    >
      <div
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md max-h-[88vh] flex flex-col rounded-t-2xl md:rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      >
        {/* Scrolls, so a long notice on a short phone never clips its own
            acknowledge button off the bottom — the footer is outside it. */}
        <div
          className="px-7 md:px-8 pt-9 pb-7 overflow-y-auto"
          style={{
            background: face.urgent
              ? (dark
                ? 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.20) 0%, transparent 65%)'
                : 'radial-gradient(120% 90% at 50% 0%, rgba(225,6,0,0.09) 0%, transparent 65%)')
              : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            <span className={eyebrow} aria-hidden="true">{face.icon}</span>
            <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${eyebrow}`}>
              {face.label}
            </p>
            {total > 1 && (
              <span className={`ml-auto text-[10px] font-bold uppercase tracking-[0.06em] font-ui tabular-nums ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {index + 1} of {total}
              </span>
            )}
            {/* Skipping still marks it read — it just no longer looks like the
                way to answer. */}
            {asking && (
              <button
                onClick={onAcknowledge}
                disabled={saving || submitting}
                className={`${total > 1 ? 'ml-3' : 'ml-auto'} text-[10px] font-ui underline underline-offset-2 transition-colors disabled:opacity-50 ${dark ? 'text-zinc-600 hover:text-zinc-400' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                Skip
              </button>
            )}
          </div>

          <h2
            id="announcement-title"
            className={`mt-5 text-xl md:text-2xl font-black uppercase tracking-tight leading-tight ${dark ? 'text-white' : 'text-black'}`}
          >
            {announcement.title}
          </h2>

          <div className="accent-line mt-5 mb-5" />

          {/* `pre-wrap` so the paragraph breaks an admin typed are the
              paragraph breaks every user reads. A poll's question is its title
              and a video's subject is its title, so both are allowed to arrive
              with nothing here. */}
          {announcement.body.trim() && (
            <p className={`text-[13px] leading-relaxed font-ui whitespace-pre-wrap ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {announcement.body}
            </p>
          )}

          {announcement.type === 'video' && announcement.video_id && (
            <div className={announcement.body.trim() ? 'mt-5' : ''}>
              <VideoBody videoId={announcement.video_id} title={announcement.title} theme={theme} />
            </div>
          )}

          {isPoll && (
            <div className={announcement.body.trim() ? 'mt-5' : ''}>
              <PollBody
                key={announcement.id}
                ref={pollRef}
                announcement={announcement}
                userId={userId}
                theme={theme}
                onStatus={onPollStatus}
              />
            </div>
          )}

          {error && (
            <p className="mt-5 text-[11px] font-bold font-ui text-[#E10600]">
              {error}
            </p>
          )}
        </div>

        <div className={`px-7 md:px-8 py-5 border-t flex flex-col sm:flex-row gap-2.5 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button
            onClick={asking && !error ? submit : onAcknowledge}
            disabled={saving || (asking && !error && (submitting || !poll.draft || !userId))}
            className="flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
          >
            {saving || submitting
              ? 'Saving…'
              : error
                ? 'Try again'
                : asking
                  ? 'Submit'
                  : total > 1 ? 'Got it — next' : 'Got it'}
          </button>

          {/* Only when there is a backlog. One notice does not need two ways
              to agree with it. */}
          {total > 1 && (
            <button
              onClick={onAcknowledgeAll}
              disabled={saving}
              className={`px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'}`}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
