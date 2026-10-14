/* ── The exam countdown ──
   A small calendar page beside Today's title: a hairline red outline, two
   ring ticks, and the number of days in bold. Nothing else, so it reads at a
   glance. Tapping it opens a liquid glass pane that says what the number is
   counting down to. It replaced the countdown bar in the old web header.

   The pane renders through `Overlay` (a portal): PageHeader rises in with
   `mk-rise`, a transform, and a fixed element inside a transformed ancestor
   would be positioned against that ancestor instead of the screen. Its
   dimming is a sibling, never an ancestor, and it grows out of the widget
   with a transform (`cd-pop`), never a fade, as liquid glass requires. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import LiquidGlass, { prewarmGlass } from '../ui/LiquidGlass';
import { usePresence } from '../ui/usePresence';
import { Overlay } from '../ui/kit';
import { getDaysRemaining } from '../utils';
import { JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import type { ExamPreference } from '../types';

const RED = '#E10600';

/* The same notes the landing page gives (landing/content.ts): no exam date
   for 2027 is announced yet, so neither is claimed here. */
const EXAM = {
  JEE: { name: 'JEE Main', date: JEE_2027_DATE, note: 'Session 1 is expected in January.' },
  NEET: { name: 'NEET', date: NEET_2027_DATE, note: 'Usually held on the first Sunday of May.' },
} as const;

/** The calendar page itself, at any size: a hairline red outline, two ring
 *  ticks and a hairline header rule. No fill, no glow; the number carries it. */
const Page: React.FC<{ days: number; size: 'sm' | 'lg'; dark: boolean }> = ({ days, size, dark }) => {
  const lg = size === 'lg';
  const w = lg ? 68 : 34;
  const h = lg ? 70 : 35;
  const stroke = lg ? 1.5 : 1.25;
  const digits = String(days).length;
  const font = (lg ? 30 : 15) * (digits > 3 ? 0.75 : digits > 2 ? 0.88 : 1);
  const tick = lg ? 7 : 4;
  return (
    <span className="relative inline-block flex-shrink-0" style={{ width: w, height: h + tick / 2 }} aria-hidden="true">
      {[0.3, 0.7].map(x => (
        <span
          key={x}
          className="absolute"
          style={{ left: `${x * 100}%`, top: 0, width: stroke, height: tick, marginLeft: -stroke / 2, borderRadius: 2, background: RED, zIndex: 1 }}
        />
      ))}
      <span
        className="absolute left-0 right-0 bottom-0 flex flex-col"
        style={{ height: h, borderRadius: lg ? 14 : 8, border: `${stroke}px solid ${RED}` }}
      >
        <span style={{ height: lg ? 13 : 7, borderBottom: `${stroke}px solid ${RED}`, opacity: 0.55, flexShrink: 0 }} />
        <span
          className={`flex-1 flex items-center justify-center font-display tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}
          style={{ fontSize: font, lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 800 }}
        >
          {days}
        </span>
      </span>
    </span>
  );
};

const ExamCountdown: React.FC<{ exam: ExamPreference; dark: boolean }> = ({ exam, dark }) => {
  const info = EXAM[exam === 'NEET' ? 'NEET' : 'JEE'];
  const days = getDaysRemaining(info.date);
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const { mounted, closing } = usePresence(open, 260);

  // The pane's glass is drawn before anyone taps, so it opens on its first frame.
  useEffect(() => { prewarmGlass(28, 18); }, []);

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    setAt({ top: r.bottom + 10, right: Math.max(12, window.innerWidth - r.right) });
    setOpen(true);
    sfx.select();
  };

  // Escape, a scroll or a resize closes it: a pane pinned to a widget that moved is in the wrong place.
  // It closes the way it opened, shrinking back into the calendar (usePresence keeps it for that).
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, { capture: true } as EventListenerOptions);
    };
  }, [open]);

  const ink = dark ? 'text-white' : 'text-zinc-900';

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={show}
        aria-expanded={open}
        aria-label={`${days} days till ${info.name}`}
        className="mt-1 active:scale-95 transition-transform"
      >
        <Page days={days} size="sm" dark={dark} />
      </button>

      {mounted && at && (
        <Overlay>
          <div className="fixed inset-0 z-[80] glass-scrim" data-closing={closing} style={{ background: 'rgba(0,0,0,0.25)' }} onClick={() => setOpen(false)} aria-hidden="true" />
          <LiquidGlass
            dark={dark}
            radius={28}
            variant="panel"
            bezel={18}
            strength={20}
            className="cd-pop"
            data-closing={closing}
            role="dialog"
            aria-label={`${days} days till ${info.name}`}
            style={{ position: 'fixed', top: at.top, right: at.right, width: 'min(320px, calc(100vw - 24px))', zIndex: 81 }}
          >
            <div className="glass-body p-6 flex flex-col items-center text-center">
              <Page days={days} size="lg" dark={dark} />
              <p className={`font-display text-[26px] leading-tight mt-5 ${ink}`}>
                {days} {days === 1 ? 'day' : 'days'} till {info.name}<span style={{ color: RED }}>.</span>
              </p>
              <p className="text-[13px] font-ui text-zinc-500 mt-2">{info.note}</p>
              <p className={`text-[13px] font-ui font-semibold mt-4 ${ink}`}>Make every one of them count.</p>
            </div>
          </LiquidGlass>
        </Overlay>
      )}
    </>
  );
};

export default ExamCountdown;
