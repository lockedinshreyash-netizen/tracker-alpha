/* ── Opening a kit ──
   The unboxing. It only plays for a kit the server has already given you
   (`add_kit` said yes first), and it runs on the pack's state machine
   (decks/store/PackAcquisition.ts): each phase boundary is reported, so a
   double tap or a second box mid-flight changes nothing.

     TAKE     the box lifts off the table and comes forward.
     CENTER   it is carried to the middle of the screen. The store dims.
     LID      the lid lifts, slowly. For a moment it holds, the way a good
              box resists before it lets go, then it rises clear and drifts
              back out of the way.
     REVEAL   what was inside rises out of the box and fans out: the packs as
              packs, the sheets as pages, the decks as decks.
     LOAD     ✓ ADDED TO ALPHA, then the kit's page in Decks.

   About 3.2s, most of it the lid. Web Animations on transform and opacity
   only. Reduced motion skips straight to the confirmation. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../../audio';
import { Overlay, tokens } from '../../ui/kit';
import { STATE_COLOR } from '../../decks/theme';
import { Icon } from '../../decks/ui';
import { KitBox, kitFootprint } from './KitBox';
import { KitItemThumb } from './KitItemThumb';
import { kitLine, type Kit } from '../types';

const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
const run = (el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> =>
  el ? el.animate(frames, { fill: 'forwards', ...opts }).finished.then(() => undefined, () => undefined) : Promise.resolve();

interface Props {
  kit: Kit;
  /** Where the box stood, on screen, when it was taken. */
  from: DOMRect;
  dark: boolean;
  reduced: boolean;
  onStep: () => void;
  onDone: () => void;
}

export const KitOpening = ({ kit, from, dark, reduced, onStep, onDone }: Props) => {
  const t = tokens(dark);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const S = Math.round(Math.min(300, vw * 0.62));
  const foot = kitFootprint(S);
  const H = Math.round(S * 0.34);
  const s0 = from.width / foot.w || 1;
  const x0 = from.left + from.width / 2 - foot.w / 2;
  const y0 = from.top + from.height / 2 - foot.h / 2;
  const x1 = vw / 2 - foot.w / 2;
  const y1 = vh * 0.62 - foot.h / 2;
  const tf = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) scale(${s})`;

  // At most five things rise out of the box; the confirmation counts the rest.
  const shown = kit.items.slice(0, 5);
  const thumb = Math.round(Math.min(150, S * 0.52));
  const spread = Math.min(vw * 0.86, shown.length * thumb * 0.82) / Math.max(1, shown.length);

  const backdrop = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const lid = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const confirm = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const mounted = useRef(true);
  const finished = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const step = () => { if (mounted.current) onStep(); };
    const go = async () => {
      if (reduced) {
        for (let i = 0; i < 5; i += 1) step();
        sfx.play('kit-open', { late: 400 });
        await run(confirm.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
        if (mounted.current) setReady(true);
        await wait(1600);
        finish();
        return;
      }

      // TAKE
      await run(stage.current, [{ transform: tf(x0, y0, s0) }, { transform: tf(x0, y0 - 14, s0 * 1.04) }], { duration: 220, easing: 'cubic-bezier(.3,0,.3,1)' });
      step(); // → centering
      void run(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 480, easing: 'ease-out' });
      await run(stage.current, [
        { transform: tf(x0, y0 - 14, s0 * 1.04) },
        { transform: tf(x1, y1 - 6, 1.01), offset: 0.8 },
        { transform: tf(x1, y1, 1) },
      ], { duration: 520, easing: 'cubic-bezier(.55,0,.25,1)' });
      await wait(260); // the beat: it is in your hands now
      step(); // → tearing (here: the lid)

      // The lid resists, then lets go.
      sfx.play('kit-open', { late: 200 });
      await run(lid.current, [
        { transform: 'translate3d(0, 0, 0)' },
        { transform: 'translate3d(0, -3px, 0)', offset: 0.32 },
        { transform: `translate3d(0, ${-H * 2.1}px, 0) rotateX(-4deg)` },
      ], { duration: 1150, easing: 'cubic-bezier(.65,0,.3,1)' });
      const away = run(lid.current, [
        { transform: `translate3d(0, ${-H * 2.1}px, 0) rotateX(-4deg)`, opacity: 1 },
        { transform: `translate3d(0, ${-H * 2.6}px, ${-S * 0.5}px) rotateX(-10deg)`, opacity: 0 },
      ], { duration: 420, easing: 'ease-in' });
      step(); // → revealing

      await Promise.all([away, ...items.current.map((el, i) => {
        const dx = (i - (shown.length - 1) / 2) * spread;
        const rot = (i - (shown.length - 1) / 2) * 4;
        return run(el, [
          { transform: 'translate(-50%, 30px) scale(0.55)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.4}px), ${-thumb * 0.5}px) scale(0.85)`, opacity: 1, offset: 0.55 },
          { transform: `translate(calc(-50% + ${dx}px), ${-thumb * 0.78}px) rotate(${rot}deg) scale(1)`, opacity: 1 },
        ], { duration: 640, delay: i * 70, easing: 'cubic-bezier(.2,.7,.2,1)' });
      })]);
      await wait(520); // long enough to see what you got
      step(); // → transitioning

      await Promise.all([
        run(stage.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 340, easing: 'ease-in' }),
        ...items.current.map(el => run(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 40, easing: 'ease-in' })),
        run(confirm.current, [
          { opacity: 0, transform: 'translateY(16px) scale(0.94)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 380, delay: 80, easing: 'cubic-bezier(.2,.7,.2,1)' }),
      ]);
      step(); // → acquired
      if (mounted.current) setReady(true);
      await wait(1700);
      finish();
    };
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = STATE_COLOR(dark);
  return (
    <Overlay>
      <div className="fixed inset-0 z-[150] font-ui" role="dialog" aria-modal="true" aria-label={`${kit.title} added to Alpha`} onClick={ready ? finish : undefined}>
        <div ref={backdrop} className="absolute inset-0" style={{ opacity: reduced ? 1 : 0, background: dark ? 'rgba(6,6,8,0.8)' : 'rgba(242,240,236,0.86)' }} />

        {!reduced && (
          <>
            <div ref={stage} className="fixed left-0 top-0" style={{ width: foot.w, height: foot.h, transformOrigin: '50% 50%', transform: tf(x0, y0, s0), willChange: 'transform' }}>
              <KitBox kit={kit} size={S} lidRef={lid} />
            </div>
            {/* What was inside, rising from the mouth of the box. */}
            {shown.map((item, i) => (
              <div
                key={`${item.kind}:${item.id}`}
                ref={el => { items.current[i] = el; }}
                className="fixed"
                style={{ left: vw / 2, top: y1 + foot.h * 0.42, opacity: 0, transform: 'translate(-50%, 30px) scale(0.55)', transformOrigin: '50% 100%' }}
              >
                <KitItemThumb item={item} dark={dark} size={thumb} />
              </div>
            ))}
          </>
        )}

        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(380px, 88vw)' }}>
          <div ref={confirm} style={{ opacity: 0 }}>
            <div className={`relative rounded-2xl border p-6 ${t.card}`} style={dark ? undefined : { boxShadow: '0 30px 60px -30px rgba(24,24,27,0.35)' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: c.due }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${c.due}22` }}>{Icon.check}</span>
                Added to Alpha
              </p>
              <p className={`font-display text-[28px] leading-[1.02] mt-4 ${t.heading}`}>{kit.title}</p>
              <p className={`text-[13px] mt-2 ${t.muted}`}>{kitLine(kit.items)} · all yours now</p>
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
    </Overlay>
  );
};
