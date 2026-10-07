/* ── Opening a pack ──
   The payoff, and it only ever plays for a pack the server has already
   given you (PackAcquisition: CONFIRMED comes first). The story:

     TAKE     the pack lifts off its rod and comes forward. The hook stays,
              empty, on the rack behind.
     CENTER   it is carried to the middle of the screen, accelerating then
              settling. The store dims. A short beat of stillness.
     TEAR     the card bends, a tear starts at the slot the hook went through,
              runs down to the perforation and along it. The strip folds back
              and away, leaving a torn, fibrous edge.
     REVEAL   three real cards rise out of the opening and fan.
     LOAD     they square up and the packaging falls away. What is left is
              the digital deck: ✓ ADDED TO ALPHA. Then My Alpha.

   Slow and deliberate on purpose: about 3.4s the first time and 3.1s after
   that (localStorage remembers that you have seen one). Most of that is the
   tear. The card flexes before it gives, the rip pauses at the slot, then
   gathers speed along the perforation, and the strip folds back slowly before
   the cards come up. A quick rip read as a UI transition; this is meant to
   read as opening something. The confirmation then holds until tapped or for
   1.7s. Reduced motion skips straight to the confirmation.

   Web Animations on transform and opacity only: the compositor runs it. The
   one exception is the tear's stroke-dashoffset, about half a second in all.
   Each phase boundary is reported (`onStep`), so the state machine always
   says where the animation is. StrictMode runs effects twice in
   development; the timeline is guarded to start once. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Overlay, tokens } from '../../ui/kit';
import { STATE_COLOR } from '../theme';
import { Icon } from '../ui';
import { PackCard } from './PackCard';
import { PackReveal, revealCards } from './PackReveal';
import { geometry } from './geometry';
import type { Pack, PreviewCard } from '../types';

const SEEN_KEY = 'alpha_packs_opened_v1';

export const firstOpening = (): boolean => {
  try { return !localStorage.getItem(SEEN_KEY); } catch { return true; }
};
const markOpened = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode: every opening is the first */ } };

const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

const run = (el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> =>
  el ? el.animate(frames, { fill: 'forwards', ...opts }).finished.then(() => undefined, () => undefined) : Promise.resolve();

// Wide enough that all three cards can be read, not just the one in front.
const FAN_X = [-96, 0, 96];
const FAN_R = [-13, 0, 12];

export const PackOpeningAnimation: React.FC<{
  pack: Pack;
  /** Where the pack hung, on screen, when it was taken. */
  from: DOMRect;
  w: number;
  h: number;
  dark: boolean;
  preview: PreviewCard[] | null;
  reduced: boolean;
  onStep: () => void;
  onDone: () => void;
}> = ({ pack, from, w, h, dark, preview, reduced, onStep, onDone }) => {
  const t = tokens(dark);
  const g = useMemo(() => geometry(w, h, pack.packNo || 1), [w, h, pack.packNo]);
  const cards = useMemo(() => revealCards(pack, preview), [pack, preview]);
  const total = pack.decks.reduce((n, d) => n + d.cards, 0);

  const backdrop = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const flap = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const crackDown = useRef<SVGPathElement>(null);
  const crackLeft = useRef<SVGPathElement>(null);
  const crackRight = useRef<SVGPathElement>(null);
  const fibers = useRef<SVGPathElement>(null);
  const cardEls = useRef<(HTMLDivElement | null)[]>([]);
  const confirm = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const mounted = useRef(true);
  const finished = useRef(false);
  const [ready, setReady] = useState(false);

  // Where it starts (the hook) and where it goes (the middle, a little low,
  // so the cards have room to rise out of the top).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s0 = from.width / w || 1;
  const x0 = from.left + from.width / 2 - w / 2;
  const y0 = from.top + from.height / 2 - h / 2;
  const s1 = Math.min(1.42, (vh * 0.5) / h, (vw * 0.64) / w);
  const x1 = vw / 2 - w / 2;
  const y1 = vh * 0.58 - h / 2;
  const tf = (x: number, y: number, r: number, s: number) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const step = () => { if (mounted.current) onStep(); };
    // Later openings are a touch quicker, never rushed: still over three seconds.
    const T = firstOpening() ? (ms: number) => ms : (ms: number) => Math.round(ms * 0.9);
    markOpened();

    const go = async () => {
      if (reduced) {
        for (let i = 0; i < 5; i += 1) step();
        await run(confirm.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
        if (mounted.current) setReady(true);
        await wait(1600);
        finish();
        return;
      }

      // TAKE: up off the rod and forward.
      await run(stage.current, [{ transform: tf(x0, y0, 0, s0) }, { transform: tf(x0, y0 - 12, -2.4, s0 * 1.05) }], { duration: T(220), easing: 'cubic-bezier(.3,0,.3,1)' });
      step(); // → centering

      void run(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], { duration: T(480), easing: 'ease-out' });
      await run(stage.current, [
        { transform: tf(x0, y0 - 12, -2.4, s0 * 1.05) },
        { transform: tf(x1, y1, 1.1, s1 * 1.012), offset: 0.8 },
        { transform: tf(x1, y1, 0, s1) },
      ], { duration: T(480), easing: 'cubic-bezier(.55,0,.25,1)' });
      await wait(T(220)); // the beat: it is in your hands now
      step(); // → tearing

      // The card flexes and resists before it gives.
      await run(flap.current, [
        { transform: 'rotateX(0deg)' },
        { transform: 'rotateX(12deg)', offset: 0.55 },
        { transform: 'rotateX(6deg)' },
      ], { duration: T(200), easing: 'cubic-bezier(.3,0,.4,1)' });
      // It splits at the slot first, catches for a moment…
      await run(crackDown.current, [{ strokeDashoffset: g.crackLen.down }, { strokeDashoffset: 0 }], { duration: T(160), easing: 'cubic-bezier(.4,0,.7,1)' });
      await wait(T(50));
      // …then runs along the perforation, gathering speed as a real tear does.
      await Promise.all([crackLeft.current, crackRight.current].map(el =>
        run(el, [{ strokeDashoffset: g.crackLen.side }, { strokeDashoffset: 0 }], { duration: T(260), easing: 'cubic-bezier(.45,0,.85,.45)' })));
      void run(fibers.current, [{ opacity: 0 }, { opacity: 0.9 }], { duration: T(260) });
      // The strip lifts slowly, then falls back and away.
      const fold = run(flap.current, [
        { transform: 'rotateX(6deg)', opacity: 1 },
        { transform: 'translateY(-4px) rotateX(64deg)', opacity: 1, offset: 0.45 },
        { transform: 'translateY(-34px) rotateX(118deg)', opacity: 0 },
      ], { duration: T(480), easing: 'cubic-bezier(.4,0,.55,1)' });
      await wait(T(220));
      step(); // → revealing

      // Nearly all the way out: the last sixth stays in the pack.
      const lift = -((g.h - g.perf) * 0.74 * 0.84);
      const fanned = (i: number) => `translate(${FAN_X[i] * (w / 198)}px, ${lift + (i === 1 ? -10 : 6)}px) rotate(${FAN_R[i]}deg)`;
      await Promise.all([fold, ...cardEls.current.map((el, i) => run(el, [
        { transform: 'translate(0px, 0px) rotate(0deg)' },
        { transform: `translate(0px, ${lift}px) rotate(0deg)`, offset: 0.5 },
        { transform: fanned(i) },
      ], { duration: T(560), delay: T(i * 60), easing: 'cubic-bezier(.2,.7,.2,1)' }))]);
      await wait(T(320)); // long enough to read them
      step(); // → transitioning

      // Square up, then the packaging falls away into the digital deck.
      await Promise.all(cardEls.current.map((el, i) => run(el, [
        { transform: fanned(i) },
        { transform: `translate(0px, ${lift + (i - 1) * -3}px) rotate(0deg)` },
      ], { duration: T(220), easing: 'ease-in-out' })));
      await Promise.all([
        run(body.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(18px) scale(0.97)' }], { duration: T(340), easing: 'ease-in' }),
        // The whole object goes, its shadow included.
        run(stage.current, [{ opacity: 1 }, { opacity: 0 }], { duration: T(360), delay: T(60), easing: 'ease-in' }),
        ...cardEls.current.map(el => run(el, [{ opacity: 1 }, { opacity: 0 }], { duration: T(300), delay: T(80), easing: 'ease-in' })),
        run(confirm.current, [
          { opacity: 0, transform: 'translateY(16px) scale(0.94)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: T(380), delay: T(60), easing: 'cubic-bezier(.2,.7,.2,1)' }),
      ]);
      step(); // → acquired
      if (mounted.current) setReady(true);
      await wait(1700);
      finish();
    };
    void go();
    // The timeline runs once, from where the pack hung when it was taken.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = STATE_COLOR(dark);
  return (
    <Overlay>
      <div className="fixed inset-0 z-[150] font-ui" role="dialog" aria-modal="true" aria-label={`${pack.title} added to Alpha`} onClick={ready ? finish : undefined}>
        <div ref={backdrop} className="absolute inset-0" style={{ opacity: reduced ? 1 : 0, background: dark ? 'rgba(6,6,8,0.78)' : 'rgba(242,240,236,0.84)' }} />

        {!reduced && (
          <div ref={stage} className="fixed left-0 top-0" style={{ width: w, height: h, transformOrigin: '50% 50%', transform: tf(x0, y0, 0, s0), willChange: 'transform' }}>
            <PackCard
              pack={pack}
              w={w}
              h={h}
              geo={g}
              parts={{ flap, body, crackDown, crackLeft, crackRight, fibers }}
              inside={<PackReveal cards={cards} g={g} refs={cardEls} />}
              style={{ ['--pk-shadow-o' as string]: dark ? 0.7 : 0.3 }}
            />
          </div>
        )}

        {/* What it became: a deck in My Alpha. No packaging from here on. */}
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(360px, 88vw)' }}>
          <div ref={confirm} style={{ opacity: 0 }}>
            <div className="relative pt-3">
              <div aria-hidden className={`absolute inset-x-7 top-0 h-8 rounded-t-2xl border ${dark ? 'bg-[#0f0f12] border-white/[0.06]' : 'bg-[#f7f6f3] border-zinc-200/70'}`} />
              <div aria-hidden className={`absolute inset-x-3.5 top-[5px] h-8 rounded-t-2xl border ${dark ? 'bg-[#131317] border-white/[0.07]' : 'bg-[#fbfaf8] border-zinc-200/80'}`} />
              <div className={`relative rounded-2xl border p-6 ${t.card}`} style={dark ? undefined : { boxShadow: '0 30px 60px -30px rgba(24,24,27,0.35)' }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: c.due }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${c.due}22` }}>{Icon.check}</span>
                  Added to Alpha
                </p>
                <p className={`font-display uppercase text-[26px] leading-[1] mt-4 ${t.heading}`}>{pack.title}</p>
                <p className={`text-[13px] mt-2 ${t.muted}`}>{total.toLocaleString()} {total === 1 ? 'card' : 'cards'} · {pack.decks.length} {pack.decks.length === 1 ? 'deck' : 'decks'} · ready to study</p>
                <button
                  onClick={e => { e.stopPropagation(); finish(); }}
                  disabled={!ready}
                  className="mt-6 w-full h-12 rounded-full bg-[#E10600] text-white text-[13px] font-bold uppercase tracking-[0.1em] inline-flex items-center justify-center gap-2 transition-all hover:bg-[#c90500] active:scale-[0.98] disabled:opacity-100"
                >
                  Open in My Alpha {Icon.arrow}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
};
