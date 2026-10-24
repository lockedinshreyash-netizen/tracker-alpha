/* ── A subject kit, as an object ──
   A box, in the spirit of the boxes phones and laptops come in: matte white
   or matte black (the administrator's choice), a lid that covers the top of
   the box down to a fine seam, the name printed on the lid in heavy type, one
   thin line of the subject's colour, and the kit number small on the front.
   It is the only object drawn this way in the app, so a kit never reads as a
   card.

   Real CSS 3D: two cuboids (the base, and the lid over it) built from faces
   with `preserve-3d`, seen from above and to the left. Lit from the top
   left, so the lid's top is the brightest face, the front the next and the
   side the darkest; a soft contact shadow sits under it. Every size is
   derived from `size` (the box's width) and set inline, because CDN Tailwind
   cannot compile computed values.

   Pointed at, it turns a few degrees toward the pointer on a critically
   damped spring (decks/store/physics.ts), one rAF loop that writes one
   transform and runs only while it moves. Reduced motion keeps it still.
   The opening (KitOpening) lifts the lid through `lidRef`. */

import React, { useEffect, useRef } from 'react';
import { springStep } from '../../decks/store/physics';
import { deckAccent } from '../../decks/theme';
import type { Kit } from '../types';

/** "KIT 002". A kit not yet saved has no number. */
export const kitNumber = (n: number) => (n > 0 ? `KIT ${String(n).padStart(3, '0')}` : 'NEW KIT');

const VIEW = { x: -24, y: -34 };
const TILT = { x: 6, y: 11 };

export type Skin = { lidTop: string; lidFront: string; lidSide: string; front: string; side: string; inside: string; ink: string; muted: string; edge: string; seam: string };

export const SKIN: Record<Kit['finish'], Skin> = {
  white: {
    lidTop: 'linear-gradient(140deg, #ffffff 0%, #f6f5f1 55%, #ecebe6 100%)',
    lidFront: 'linear-gradient(180deg, #f8f7f3 0%, #ebeae4 100%)',
    lidSide: 'linear-gradient(180deg, #dedcd5 0%, #d2d0c8 100%)',
    front: 'linear-gradient(180deg, #ecebe5 0%, #e0ded7 100%)',
    side: 'linear-gradient(180deg, #cfccc4 0%, #c3c0b7 100%)',
    inside: 'linear-gradient(180deg, #c9c6be 0%, #dedbd3 100%)',
    ink: '#111113',
    muted: '#76767e',
    edge: 'rgba(255,255,255,0.85)',
    seam: 'rgba(0,0,0,0.16)',
  },
  black: {
    lidTop: 'linear-gradient(140deg, #2c2c31 0%, #1d1d21 55%, #141417 100%)',
    lidFront: 'linear-gradient(180deg, #1f1f23 0%, #151518 100%)',
    lidSide: 'linear-gradient(180deg, #111114 0%, #0b0b0d 100%)',
    front: 'linear-gradient(180deg, #19191c 0%, #111113 100%)',
    side: 'linear-gradient(180deg, #0d0d0f 0%, #08080a 100%)',
    inside: 'linear-gradient(180deg, #050506 0%, #121214 100%)',
    ink: '#f5f5f4',
    muted: '#8c8c95',
    edge: 'rgba(255,255,255,0.09)',
    seam: 'rgba(0,0,0,0.6)',
  },
};

interface FaceProps {
  w: number;
  h: number;
  transform: string;
  background: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const Face = ({ w, h, transform, background, style, children }: FaceProps) => (
  <div
    className="absolute"
    style={{ left: -w / 2, top: -h / 2, width: w, height: h, transform, background, backfaceVisibility: 'hidden', ...style }}
  >
    {children}
  </div>
);

interface Props {
  kit: Pick<Kit, 'title' | 'kitNo' | 'subject' | 'examLine' | 'finish'>;
  /** The box's width, in px. Everything else follows from it. */
  size: number;
  /** Turn toward the pointer. */
  interactive?: boolean;
  reduced?: boolean;
  /** The lid, for the opening to lift. */
  lidRef?: React.Ref<HTMLDivElement>;
  /** Drawn on the floor of the box, seen once the lid is off. */
  inside?: React.ReactNode;
  /** A few degrees off square, so boxes in a pile are not set down perfectly. */
  turn?: number;
  /** Without its own contact shadow: a box in a pile sits on the box below, which draws the shade. */
  shadow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** The space the box needs on screen, so callers can lay it out. */
export const kitFootprint = (size: number) => ({ w: Math.round(size * 1.34), h: Math.round(size * 0.98) });

export const KitBox = ({ kit, size, interactive = false, reduced = false, lidRef, inside, turn = 0, shadow = true, className = '', style }: Props) => {
  const W = size;
  const D = Math.round(size * 0.74);
  const H = Math.round(size * 0.34);
  const HL = Math.round(H * 0.46);
  const HB = H - HL;
  const e = Math.max(1, Math.round(size * 0.006)); // the lid overhangs the base by a hair
  const s = SKIN[kit.finish === 'black' ? 'black' : 'white'];
  const accent = deckAccent(kit.subject, kit.finish === 'black');
  const foot = kitFootprint(size);

  // Base centred at y = HL/2 (below the lid), lid centred at -HB/2 (above the seam).
  const yb = HL / 2;
  const yl = -HB / 2;
  const LW = W + 2 * e;
  const LD = D + 2 * e;

  const rig = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!interactive || reduced) return;
    const el = host.current;
    if (!el) return;
    let tx = 0, ty = 0;
    let x = 0, vx = 0, y = 0, vy = 0;
    let raf = 0;
    let last = 0;
    const paint = () => {
      if (rig.current) rig.current.style.transform = `rotateX(${VIEW.x + y}deg) rotateY(${VIEW.y + turn + x}deg)`;
    };
    const tick = (now: number) => {
      const dt = Math.min(32, last ? now - last : 16);
      last = now;
      ({ x, v: vx } = springStep(x, vx, tx, dt));
      ({ x: y, v: vy } = springStep(y, vy, ty, dt));
      paint();
      if (Math.abs(x - tx) < 0.02 && Math.abs(y - ty) < 0.02 && Math.abs(vx) + Math.abs(vy) < 0.0005) { raf = 0; last = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      const dy = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
      tx = dx * TILT.y;
      ty = -dy * TILT.x;
      kick();
    };
    const onLeave = () => { tx = 0; ty = 0; kick(); };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [interactive, reduced, turn]);

  const edge = `inset 0 0 0 1px ${s.edge}`;
  const title = kit.title.toUpperCase();
  const longest = Math.max(...title.split(/\s+/).map(x => x.length), 1);
  const fs = Math.min(W * (title.length > 22 ? 0.072 : 0.09), (LW * 0.8) / (longest * 0.66));

  return (
    <div ref={host} className={`relative select-none ${className}`} style={{ width: foot.w, height: foot.h, ...style }} aria-hidden>
      {/* The contact shadow: where the box meets the table. */}
      {shadow && <div
        className="absolute left-1/2"
        style={{
          top: foot.h * 0.64,
          width: W * 1.18,
          height: W * 0.34,
          transform: 'translateX(-50%)',
          background: `radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,${kit.finish === 'black' ? 0.55 : 0.32}) 0%, rgba(0,0,0,0.12) 55%, transparent 75%)`,
          filter: `blur(${Math.max(4, W * 0.03)}px)`,
        }}
      />}
      <div className="absolute inset-0" style={{ perspective: size * 4.2, perspectiveOrigin: '50% 30%' }}>
        <div
          ref={rig}
          className="absolute left-1/2"
          style={{ top: foot.h * 0.5, width: 0, height: 0, transformStyle: 'preserve-3d', transform: `rotateX(${VIEW.x}deg) rotateY(${VIEW.y + turn}deg)` }}
        >
          {/* ── The base ── */}
          <div className="absolute" style={{ transformStyle: 'preserve-3d' }}>
            {/* Its floor, seen from inside once the lid is off. */}
            <Face w={W} h={D} transform={`translate3d(0, ${yb - HB / 2 + 1}px, 0) rotateX(90deg)`} background={s.inside} style={{ boxShadow: 'inset 0 0 18px rgba(0,0,0,0.35)' }}>
              {inside}
            </Face>
            <Face w={W} h={D} transform={`translate3d(0, ${yb + HB / 2}px, 0) rotateX(-90deg)`} background={s.side} />
            <Face w={W} h={HB} transform={`translate3d(0, ${yb}px, ${D / 2}px)`} background={s.front} style={{ boxShadow: `${edge}, inset 0 ${Math.max(3, HB * 0.12)}px ${Math.max(3, HB * 0.12)}px -${Math.max(3, HB * 0.12)}px ${s.seam}` }}>
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between font-ui font-bold uppercase" style={{ padding: `0 ${W * 0.05}px ${HB * 0.14}px`, fontSize: Math.max(6, W * 0.028), letterSpacing: '0.18em', color: s.muted }}>
                <span>{kitNumber(kit.kitNo)}</span>
                <span className="truncate" style={{ maxWidth: '60%' }}>{kit.examLine ?? ''}</span>
              </div>
            </Face>
            <Face w={W} h={HB} transform={`translate3d(0, ${yb}px, ${-D / 2}px) rotateY(180deg)`} background={s.side} />
            <Face w={D} h={HB} transform={`translate3d(${W / 2}px, ${yb}px, 0) rotateY(90deg)`} background={s.side} style={{ boxShadow: edge }} />
            <Face w={D} h={HB} transform={`translate3d(${-W / 2}px, ${yb}px, 0) rotateY(-90deg)`} background={s.front} />
          </div>

          {/* ── The lid ── */}
          <div ref={lidRef} className="absolute" style={{ transformStyle: 'preserve-3d' }}>
            <Face w={LW} h={LD} transform={`translate3d(0, ${yl - HL / 2}px, 0) rotateX(90deg)`} background={s.lidTop} style={{ boxShadow: edge }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: W * 0.06 }}>
                <span className="font-ui font-bold uppercase flex items-center" style={{ fontSize: Math.max(6, W * 0.03), letterSpacing: '0.32em', color: s.muted, gap: W * 0.015 }}>
                  <span className="font-accent italic normal-case tracking-normal" style={{ fontSize: '1.7em', color: s.ink, lineHeight: 1 }}>α</span>
                  Alpha
                </span>
                <span className="font-display uppercase" style={{ fontSize: fs, lineHeight: 0.95, color: s.ink, marginTop: W * 0.04, letterSpacing: '-0.01em' }}>{kit.title}</span>
                <span style={{ width: W * 0.16, height: Math.max(1.5, W * 0.006), background: accent, marginTop: W * 0.045, borderRadius: 2 }} />
              </div>
            </Face>
            <Face w={LW} h={HL} transform={`translate3d(0, ${yl}px, ${LD / 2}px)`} background={s.lidFront} style={{ boxShadow: `${edge}, 0 1px 0 ${s.seam}` }} />
            <Face w={LW} h={HL} transform={`translate3d(0, ${yl}px, ${-LD / 2}px) rotateY(180deg)`} background={s.lidSide} />
            <Face w={LD} h={HL} transform={`translate3d(${LW / 2}px, ${yl}px, 0) rotateY(90deg)`} background={s.lidSide} style={{ boxShadow: edge }} />
            <Face w={LD} h={HL} transform={`translate3d(${-LW / 2}px, ${yl}px, 0) rotateY(-90deg)`} background={s.lidFront} />
            {/* The underside of the lid: only ever seen while it is being lifted. */}
            <Face w={LW} h={LD} transform={`translate3d(0, ${yl + HL / 2}px, 0) rotateX(-90deg)`} background={s.inside} />
          </div>
        </div>
      </div>
    </div>
  );
};
