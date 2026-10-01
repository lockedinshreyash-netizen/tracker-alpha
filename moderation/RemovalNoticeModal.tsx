import React from 'react';
import { ModerationNotice, noticeCopy } from './api';

interface Props {
  notice: ModerationNotice;
  /** How many are waiting, including this one. */
  total: number;
  theme: 'dark' | 'light';
  saving: boolean;
  error: string | null;
  onAcknowledge: () => void;
}

/**
 * You were removed from a group or the race, and this is why.
 *
 * Built on `UnlockModal`'s shell, like `AnnouncementModal`, because those are
 * the things allowed to stop you on arrival and they should look like one
 * family. Unlike those two it does not close on the scrim: it is short, it is
 * about you, and "Got it" is the only way past it — a removal notice lost to a
 * stray tap is a group that silently vanished, which is exactly what this
 * exists to prevent.
 *
 * The accent is deliberately absent. This is information, not an alarm, and
 * the person reading it is most likely a teenager who just lost a group.
 */
const RemovalNoticeModal: React.FC<Props> = ({ notice, total, theme, saving, error, onAcknowledge }) => {
  const dark = theme === 'dark';
  const copy = noticeCopy(notice);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="removal-notice-title"
        className={`w-full max-w-md rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-300 ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      >
        <div className="px-8 pt-8 pb-7">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              {copy.eyebrow}
            </p>
            {total > 1 && (
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                1 of {total}
              </p>
            )}
          </div>

          <h2
            id="removal-notice-title"
            className={`text-2xl font-black uppercase tracking-tight leading-tight break-words ${dark ? 'text-white' : 'text-black'}`}
          >
            {copy.title}
          </h2>
          <p className={`text-[13px] leading-relaxed font-ui mt-3 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
            {copy.who}
          </p>

          {notice.reason && (
            <div className={`mt-5 p-4 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui mb-2 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Reason
              </p>
              <p className={`text-[13px] leading-relaxed font-ui whitespace-pre-wrap break-words ${dark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                {notice.reason}
              </p>
            </div>
          )}

          <p className={`text-[11px] leading-relaxed font-ui mt-5 ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            {copy.next} Think this is wrong? Tell us with the chat button in the bottom-left corner.
          </p>
        </div>

        <div className={`px-8 py-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          {error && <p className="text-[11px] font-ui text-[#E10600] mb-3">{error}</p>}
          <button
            onClick={onAcknowledge}
            disabled={saving}
            autoFocus
            className={`w-full px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
          >
            {saving ? 'Saving…' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemovalNoticeModal;
