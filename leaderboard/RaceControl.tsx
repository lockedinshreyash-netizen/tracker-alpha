import React from 'react';
import { RaceEvent } from './raceDay';
import { RaceStatus, clockLabel, describeEvent } from './messages';

/* ── Race control ──
   The live cards that sit between the status card and the standings, and the
   one interrupting banner for the moments that can't wait.

   These are not notifications with the browser taken out. They exist so that a
   user who has never granted permission — or who has it switched off — still
   sees the race happen. The push channel is a convenience on top of this, not
   the other way round. */

interface FeedProps {
  events: RaceEvent[];
  theme: 'dark' | 'light';
}

/* Red is the alarm, and it is reserved for things going against the user. A
   win is stated plainly: a card shouting about every good thing is a card
   nobody reads by Thursday. */
const RaceControlFeed: React.FC<FeedProps> = ({ events, theme }) => {
  if (!events.length) return null;
  const dark = theme === 'dark';

  return (
    <section className="space-y-2" aria-live="polite">
      {events.map(event => {
        const copy = describeEvent(event);
        return (
          <article
            key={event.id}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${copy.good
              ? dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'
              : 'bg-[#E10600]/[0.06] border-[#E10600]/30'}`}
          >
            <span className="text-base leading-none mt-0.5 select-none" aria-hidden="true">{copy.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold font-ui leading-snug ${dark ? 'text-white' : 'text-[#17150F]'}`}>
                {copy.headline}
              </p>
              {copy.line && (
                <p className={`text-[11px] font-ui mt-1 leading-relaxed ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
                  {copy.line}
                </p>
              )}
            </div>
            <span className={`text-[10px] font-data flex-shrink-0 tabular-nums ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
              {clockLabel(event.at)}
            </span>
          </article>
        );
      })}
    </section>
  );
};

interface StripProps {
  status: RaceStatus;
  onOpen: () => void;
  theme: 'dark' | 'light';
}

/**
 * One line of race control, for the tab where the work actually happens.
 *
 * The Today tab is where a session is started and ended, so it is the only
 * place where knowing "this session takes you to first" can change what
 * someone does. Kept to a single tappable line — the standings live on their
 * own tab and this must not turn into a second copy of them.
 */
export const RaceStrip: React.FC<StripProps> = ({ status, onOpen, theme }) => {
  const dark = theme === 'dark';
  const urgent = status.tone === 'live' || status.tone === 'threat';

  return (
    <button
      onClick={onOpen}
      className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl border text-left transition-all active:scale-[0.99] ${urgent
        ? 'border-[#E10600]/40 bg-[#E10600]/[0.06]'
        : dark ? 'bg-[#111114] border-white/[0.06] hover:border-white/[0.12]' : 'bg-white border-[#E3E0D9] hover:border-[#D6D1C5]'}`}
    >
      <span className="text-base leading-none select-none" aria-hidden="true">{status.icon}</span>
      <span className="flex-1 min-w-0">
        <span className={`block text-[12px] font-bold font-ui truncate ${dark ? 'text-white' : 'text-[#17150F]'}`}>
          {status.headline}
        </span>
        <span className={`block text-[10px] font-ui truncate mt-0.5 ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
          {status.cta ?? status.line}
        </span>
      </span>
      <span className={`text-[9px] font-bold uppercase tracking-[0.12em] font-ui flex-shrink-0 ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
        Board
      </span>
    </button>
  );
};

interface ToastProps {
  event: RaceEvent | null;
  onDismiss: () => void;
  theme: 'dark' | 'light';
}

/**
 * The one thing that interrupts.
 *
 * Only fired for a place changing hands, and only from the engine — never for
 * a gap drifting, never on a timer. Sits clear of the voice control in the
 * bottom-right and of the mobile header above.
 */
export const RaceToast: React.FC<ToastProps> = ({ event, onDismiss, theme }) => {
  if (!event) return null;
  const dark = theme === 'dark';
  const copy = describeEvent(event);

  return (
    <div className="fixed top-16 md:top-6 left-1/2 z-[45] w-[min(92vw,26rem)] race-toast" role="status">
      <button
        onClick={onDismiss}
        className={`w-full text-left flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all ${copy.good
          ? dark ? 'bg-[#111114]/95 border-white/[0.10]' : 'bg-white/95 border-[#E3E0D9]'
          : dark ? 'bg-[#1A0605]/95 border-[#E10600]/40' : 'bg-white/95 border-[#E10600]/40'}`}
      >
        <span className="text-lg leading-none mt-0.5 select-none" aria-hidden="true">{copy.icon}</span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-bold font-ui leading-snug ${dark ? 'text-white' : 'text-[#17150F]'}`}>
            {copy.headline}
          </span>
          {copy.line && (
            <span className={`block text-[11px] font-ui mt-1 ${dark ? 'text-zinc-400' : 'text-[#6B675C]'}`}>
              {copy.line}
            </span>
          )}
        </span>
        <span className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui flex-shrink-0 ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
          Dismiss
        </span>
      </button>
    </div>
  );
};

export default RaceControlFeed;
