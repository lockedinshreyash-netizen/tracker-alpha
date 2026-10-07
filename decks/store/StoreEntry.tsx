/* ── The store's sign ──
   How you find Alpha Packs from Decks: a strip of wall with a short rail and
   three real packs hanging on it, drawn by the same PackCard and hooks the
   store uses, at sign size. It is still, with no physics. The moving rack
   is inside. */

import React, { useMemo } from 'react';
import { tokens } from '../../ui/kit';
import { Icon } from '../ui';
import { PackCard } from './PackCard';
import { HookBack, HookFront } from './PackHook';
import { PackRail, wallStyle } from './PackRail';
import { geometry } from './geometry';
import type { Pack } from '../types';

const W = 86;
const H = 130;
const GAP = 102;
const PIVOT = 34;

export const StoreEntry: React.FC<{ packs: Pack[]; dark: boolean; onOpen: () => void; delay?: number }> = ({ packs, dark, onOpen, delay = 0 }) => {
  const t = tokens(dark);
  const g = useMemo(() => geometry(W, H, 1), []);
  const hung = packs.filter(p => !p.inLibrary).slice(0, 3);
  const shown = hung.length ? hung : packs.slice(0, 3);
  const fresh = packs.filter(p => !p.inLibrary && p.status === 'published').length;
  const width = 24 + (shown.length - 1) * GAP + W + 24;
  const tilt = [-1.6, 0.8, -0.6];

  return (
    <button
      onClick={onOpen}
      className={`mk-rise group w-full text-left rounded-2xl border overflow-hidden grid md:grid-cols-[1fr_auto] items-stretch transition-shadow hover:shadow-lg ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`}
      style={{ ...wallStyle(dark), animationDelay: `${delay}ms` }}
      aria-label="Open the Alpha Packs store"
    >
      <span className="block p-7 md:p-9">
        <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${t.faint}`}>{fresh ? `${fresh} ${fresh === 1 ? 'pack' : 'packs'} on the racks` : 'The store'}</span>
        <span className={`block font-display uppercase text-[32px] md:text-[40px] leading-[0.95] mt-3 ${t.heading}`}>Alpha Packs</span>
        <span className={`block text-[15px] mt-3 ${t.muted}`}>Curated knowledge. <span className="font-accent">Ready to load.</span></span>
        <span className={`inline-flex items-center gap-2 mt-6 text-[13px] font-bold uppercase tracking-[0.08em] ${t.heading}`}>
          Browse the store <span className="transition-transform group-hover:translate-x-1">{Icon.arrow}</span>
        </span>
      </span>
      <span aria-hidden className="relative hidden sm:block self-end mx-auto md:mx-0 md:mr-8 pointer-events-none" style={{ width, height: PIVOT - g.pivot.y + H + 18 }}>
        <PackRail width={width} dark={dark} brackets={[18, width - 18]} />
        {shown.map((p, i) => {
          const hx = 24 + i * GAP + W / 2;
          return (
            <React.Fragment key={p.id}>
              <HookBack x={hx} pivotY={PIVOT} dark={dark} scale={0.6} />
              <span className="absolute block transition-transform duration-500 group-hover:rotate-0" style={{ left: hx - W / 2, top: PIVOT - g.pivot.y, transformOrigin: `${g.pivot.x}px ${g.pivot.y}px`, transform: `rotate(${tilt[i]}deg)` }}>
                <PackCard pack={p} w={W} h={H} geo={geometry(W, H, p.packNo || 1)} style={{ ['--pk-shadow-o' as string]: dark ? 0.6 : 0.2 }} />
              </span>
              <HookFront x={hx} pivotY={PIVOT} dark={dark} scale={0.6} />
            </React.Fragment>
          );
        })}
      </span>
    </button>
  );
};
