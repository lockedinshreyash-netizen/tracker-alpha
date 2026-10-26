import { useEffect, useState } from 'react';
import { Overlay } from '../ui/kit';
import { formatCountdown, formatDuration } from './pomodoro';
import { ANSWER_MS } from './presence';
import { Ask, RemovedSession } from './useStillThere';

/* The "Still studying?" prompt and the notice after a session was removed.
   Rules in presence.ts, engine in useStillThere.ts. */

const card = (dark: boolean) =>
  `w-full max-w-md rounded-2xl border overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`;
const ink = (dark: boolean) => (dark ? 'text-white' : 'text-black');
const body = (dark: boolean) => (dark ? 'text-zinc-300' : 'text-zinc-700');
const ghost = (dark: boolean) =>
  dark ? 'bg-white/[0.06] text-white hover:bg-white/[0.1]' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200';
const btn = 'w-full px-5 py-4 text-[11px] font-bold uppercase tracking-[0.1em] rounded-lg font-ui active:scale-97 transition-colors';

/** Full screen, opaque, over everything: nothing else matters until it is answered. */
export const StillStudyingPrompt = ({ ask, dark, onContinue, onDone }: {
  ask: Ask; dark: boolean; onContinue: () => void; onDone: () => void;
}) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, ask.checkAt + ANSWER_MS - now);

  return (
    <Overlay>
      <div className={`fixed inset-0 z-[200] flex items-center justify-center p-4 safe-top ${dark ? 'bg-black' : 'bg-[#F2F0EC]'}`}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="still-title" className={card(dark)}>
          <div className="px-8 pt-8 pb-7 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Timer paused</p>
            <h2 id="still-title" className={`mt-3 text-4xl font-black uppercase tracking-tight leading-none font-display ${ink(dark)}`}>
              Still studying?
            </h2>
            <p className={`mt-4 text-[14px] leading-relaxed font-ui ${body(dark)}`}>
              3h 30m of {ask.subject} without a tap. No answer and this session is removed.
            </p>
            <p className="mt-6 num-timer tabular-nums text-6xl text-[#E10600]">{formatCountdown(left)}</p>
          </div>
          <div className={`px-8 py-5 border-t flex flex-col gap-2 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
            <button autoFocus onClick={onContinue} className={`${btn} bg-[#E10600] text-white hover:bg-[#c80500]`}>
              Yes, continue
            </button>
            <button onClick={onDone} className={`${btn} ${ghost(dark)}`}>I'm done. Log it.</button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

/** Next visit after a removal: what happened, why, and how to put real hours back. */
export const RemovedNotice = ({ removed, dark, onAddByHand, onClose }: {
  removed: RemovedSession; dark: boolean; onAddByHand: () => void; onClose: () => void;
}) => (
  <Overlay>
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-300">
      <div role="alertdialog" aria-modal="true" aria-labelledby="removed-title" className={`${card(dark)} animate-in zoom-in-95 duration-300`}>
        <div className="px-8 pt-8 pb-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Still studying?</p>
          <h2 id="removed-title" className={`mt-3 text-2xl font-black uppercase tracking-tight leading-tight ${ink(dark)}`}>
            Session removed
          </h2>
          <p className={`mt-3 text-[13px] leading-relaxed font-ui ${body(dark)}`}>
            Your {removed.subject} timer ran {formatDuration(removed.removedMs)} and nobody answered “Still studying?”.
            So we took those hours off. It keeps Ranks and Groups fair.
            {removed.keptMs > 0 && ` The ${formatDuration(removed.keptMs)} before your last tap is still logged.`}
          </p>
          <p className={`mt-4 text-[13px] leading-relaxed font-ui ${body(dark)}`}>
            Really studied? Add it in Review → Add a session by hand. It counts for your streak, not for Ranks.
          </p>
        </div>
        <div className={`px-8 py-5 border-t flex flex-col gap-2 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <button onClick={onAddByHand} className={`${btn} ${ghost(dark)}`}>Add it by hand</button>
          <button autoFocus onClick={onClose} className={`${btn} ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}>
            Got it
          </button>
        </div>
      </div>
    </div>
  </Overlay>
);
