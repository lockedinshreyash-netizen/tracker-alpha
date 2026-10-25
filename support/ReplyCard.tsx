/* ── The founder replied ──
   Shown once per reply, on the student's next visit, on whatever tab they are
   on: their note quoted small, the reply in full, signed. Reading it here is
   reading it — "Got it" marks it read on every device and withdraws the
   lock-screen push if it has not gone out yet (ack_founder_replies).

   Built on the same shell as UnlockModal, AnnouncementModal and
   RemovalNoticeModal, because those are the things allowed to stop you on
   arrival and they should look like one family. Queued behind all of them and
   never over a running session (App).

   Closing is not reading, the announcement rule: the scrim and Escape set the
   card aside for this visit, and the line on Today stays until the reply is
   actually read. A reply lost to a stray tap is a reply that never arrived. */

import React, { useEffect, useRef } from 'react';
import type { MyNote } from './api';
import { SUPPORT_COPY as C } from './content';

interface Props {
  note: MyNote;
  /** How many are waiting, including this one. */
  total: number;
  theme: 'dark' | 'light';
  saving: boolean;
  error: string | null;
  onAcknowledge: () => void;
  /** Acknowledge, then open the Support page to write another note. */
  onWriteBack: () => void;
  onSetAside: () => void;
}

const dateLine = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';

const ReplyCard = ({ note, total, theme, saving, error, onAcknowledge, onWriteBack, onSetAside }: Props) => {
  const dark = theme === 'dark';
  const gotItRef = useRef<HTMLButtonElement>(null);

  /* Focus "Got it" for the keyboard, without scrolling: on a cold load the
     card can mount before the CDN stylesheet has made it `fixed`, and a plain
     focus (or autoFocus) then scrolls the page down to where it briefly sat. */
  useEffect(() => { gotItRef.current?.focus({ preventScroll: true }); }, [note.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSetAside(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSetAside]);

  const ink = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onSetAside}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="founder-reply-title"
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      >
        <div className="px-7 sm:px-8 pt-8 pb-7 overflow-y-auto overscroll-contain">
          <div className="flex items-baseline justify-between gap-4">
            <p className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.06em] font-ui">
              <span aria-hidden="true" className="block h-px w-6 bg-[#E10600]" />
              <span className={muted}>A reply from the founder</span>
            </p>
            {total > 1 && <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${faint}`}>1 of {total}</p>}
          </div>

          <h2 id="founder-reply-title" className={`font-display text-[30px] leading-[1.02] mt-5 ${ink}`} style={{ fontWeight: 900, letterSpacing: '-0.035em' }}>
            {C.signature} wrote back<span className="text-[#E10600]">.</span>
          </h2>

          {/* Their own words first, small, so the reply has something to answer. */}
          <figure className={`mt-6 pl-4 border-l-2 ${dark ? 'border-white/[0.1]' : 'border-zinc-200'}`}>
            <figcaption className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${faint}`}>
              You wrote · {dateLine(note.created_at)}
            </figcaption>
            <blockquote className={`mt-1.5 text-[13px] font-ui leading-[1.6] whitespace-pre-wrap break-words line-clamp-4 ${muted}`}>
              {note.body}
            </blockquote>
          </figure>

          <p className={`mt-6 text-[16px] font-ui leading-[1.7] whitespace-pre-wrap break-words ${ink}`}>{note.reply}</p>

          <div className="mt-5 flex items-baseline justify-between gap-3">
            <p className={`font-accent text-[26px] leading-none ${ink}`}>{C.signature}</p>
            <p className={`text-[11px] font-ui ${faint}`}>{dateLine(note.replied_at)}</p>
          </div>
        </div>

        <div className={`shrink-0 px-7 sm:px-8 py-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          {error && <p role="alert" className="text-[11px] font-ui text-[#E10600] mb-3">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={onWriteBack}
              disabled={saving}
              className={`px-4 py-3 text-[12px] font-semibold font-ui underline underline-offset-4 disabled:opacity-50 ${muted} ${dark ? 'hover:text-white' : 'hover:text-zinc-900'}`}
            >
              Write back
            </button>
            <button
              ref={gotItRef}
              onClick={onAcknowledge}
              disabled={saving}
              className={`flex-1 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'bg-white text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
            >
              {saving ? 'Saving…' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReplyCard;
