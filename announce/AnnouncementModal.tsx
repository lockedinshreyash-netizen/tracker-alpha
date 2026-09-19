import React, { useEffect } from 'react';
import { Announcement } from './api';
import { TYPE_FACE } from './face';

interface Props {
  announcement: Announcement;
  /** Position in the queue, for the "1 of 3" line. */
  index: number;
  total: number;
  theme: 'dark' | 'light';
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
  announcement, index, total, theme, saving, error,
  onAcknowledge, onAcknowledgeAll, onSetAside,
}) => {
  const dark = theme === 'dark';
  const face = TYPE_FACE[announcement.type];

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
            <p className={`text-[9px] font-bold uppercase tracking-[0.24em] font-ui ${eyebrow}`}>
              {face.label}
            </p>
            {total > 1 && (
              <span className={`ml-auto text-[9px] font-bold uppercase tracking-[0.14em] font-ui tabular-nums ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {index + 1} of {total}
              </span>
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
              paragraph breaks every user reads. */}
          <p className={`text-[13px] leading-relaxed font-ui whitespace-pre-wrap ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {announcement.body}
          </p>

          {error && (
            <p className="mt-5 text-[11px] font-bold font-ui text-[#E10600]">
              {error}
            </p>
          )}
        </div>

        <div className={`px-7 md:px-8 py-5 border-t flex flex-col sm:flex-row gap-2.5 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button
            onClick={onAcknowledge}
            disabled={saving}
            className="flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
          >
            {saving ? 'Saving…' : error ? 'Try again' : total > 1 ? 'Got it — next' : 'Got it'}
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
