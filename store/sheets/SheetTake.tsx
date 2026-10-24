/* ── Taking a sheet ──
   It only plays for a sheet the server has already given you: `add_sheet`
   said yes first. The page lifts off the shelf, is carried to the middle of
   the screen, and a folder rises under it. The page slides down into the
   folder (that is the sound), the folder settles, and then the sheet is what
   it became: ✓ ADDED TO ALPHA, and on to the reader in Decks.

   Short on purpose next to a pack's opening: a sheet is a page, and putting
   a page away is quick. About 1.6s. Web Animations on transform and opacity
   only. Reduced motion skips straight to the confirmation. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../../audio';
import { Overlay, tokens } from '../../ui/kit';
import { STATE_COLOR, deckAccent } from '../../decks/theme';
import { Icon } from '../../decks/ui';
import { SheetPaper } from './SheetPaper';
import type { FormulaEntry } from './Formula';
import { sheetLine, type Sheet } from '../types';

const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
const run = (el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> =>
  el ? el.animate(frames, { fill: 'forwards', ...opts }).finished.then(() => undefined, () => undefined) : Promise.resolve();

interface Props {
  sheet: Sheet;
  preview: FormulaEntry[] | null;
  /** Where the page stood, on screen, when it was taken. */
  from: DOMRect;
  dark: boolean;
  reduced: boolean;
  onDone: () => void;
}

export const SheetTake = ({ sheet, preview, from, dark, reduced, onDone }: Props) => {
  const t = tokens(dark);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const F = Math.min(300, vw * 0.78);          // folder width
  const FH = Math.round(F * 0.74);              // folder height
  const W = Math.round(F * 0.8);                // the page, in the folder
  const H = Math.round(W * Math.SQRT2);
  const folderTop = Math.round(vh * 0.56);
  const x1 = vw / 2 - W / 2;
  // A page is taller than its folder: it goes in bottom first and its top
  // stays out, as a sheet does. Its foot never shows below the pocket.
  const yAbove = folderTop + FH * 0.42 - H;     // standing in the mouth of the folder
  const yIn = folderTop + FH - 8 - H;           // slid down to the bottom of the folder
  const s0 = from.width / W || 1;
  const x0 = from.left + from.width / 2 - W / 2;
  const y0 = from.top + from.height / 2 - H / 2;
  const tf = (x: number, y: number, r: number, s: number) => `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;

  const backdrop = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const folder = useRef<HTMLDivElement>(null);
  const confirm = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const mounted = useRef(true);
  const finished = useRef(false);
  const [ready, setReady] = useState(false);

  const back = dark ? '#26262c' : '#dcd8cf';
  const front = dark ? '#1b1b20' : '#ebe8e1';
  const edge = dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.9)';
  const accent = deckAccent(sheet.subject, dark);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone();
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const go = async () => {
      if (reduced) {
        sfx.play('sheet-add', { late: 400 });
        await run(confirm.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
        if (mounted.current) setReady(true);
        await wait(1600);
        finish();
        return;
      }
      // Off the shelf and to the middle; the folder rises to meet it.
      void run(backdrop.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' });
      void run(folder.current, [
        { opacity: 0, transform: 'translateY(40px) scale(0.96)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' },
      ], { duration: 460, delay: 120, easing: 'cubic-bezier(.2,.7,.2,1)' });
      await run(page.current, [
        { transform: tf(x0, y0, -1.5, s0) },
        { transform: tf(x1, yAbove - 10, 1.2, 1.01), offset: 0.8 },
        { transform: tf(x1, yAbove, 0, 1) },
      ], { duration: 560, easing: 'cubic-bezier(.55,0,.25,1)' });
      await wait(140);
      // Into the folder.
      sfx.play('sheet-add', { late: 150 });
      await run(page.current, [
        { transform: tf(x1, yAbove, 0, 1) },
        { transform: tf(x1, yIn, 0, 0.985) },
      ], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)' });
      await run(folder.current, [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(3px) scale(1.018, 0.985)', offset: 0.4 },
        { transform: 'translateY(0) scale(1)' },
      ], { duration: 220, easing: 'ease-out' });
      await wait(120);
      // What it became.
      await Promise.all([
        run(page.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-in' }),
        run(folder.current, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(14px) scale(0.97)' }], { duration: 320, easing: 'ease-in' }),
        run(confirm.current, [
          { opacity: 0, transform: 'translateY(16px) scale(0.94)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 360, delay: 80, easing: 'cubic-bezier(.2,.7,.2,1)' }),
      ]);
      if (mounted.current) setReady(true);
      await wait(1700);
      finish();
    };
    void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = STATE_COLOR(dark);
  const fx = vw / 2 - F / 2;
  return (
    <Overlay>
      <div className="fixed inset-0 z-[150] font-ui" role="dialog" aria-modal="true" aria-label={`${sheet.title} added to Alpha`} onClick={ready ? finish : undefined}>
        <div ref={backdrop} className="absolute inset-0" style={{ opacity: reduced ? 1 : 0, background: dark ? 'rgba(6,6,8,0.78)' : 'rgba(242,240,236,0.84)' }} />

        {!reduced && (
          <>
            {/* The folder's back, with its tab. */}
            <div ref={folder} className="fixed" style={{ left: fx, top: folderTop, width: F, height: FH, opacity: 0, transformOrigin: '50% 100%' }}>
              <div className="absolute" style={{ left: 0, top: -FH * 0.09, width: F * 0.36, height: FH * 0.14, borderRadius: '10px 10px 0 0', background: back }} />
              <div className="absolute inset-0" style={{ borderRadius: 12, background: back, boxShadow: `0 1px 0 ${edge} inset, 0 30px 50px -24px rgba(0,0,0,0.55)` }} />
            </div>
            <div ref={page} className="fixed left-0 top-0" style={{ width: W, height: H, transformOrigin: '50% 50%', transform: tf(x0, y0, -1.5, s0), willChange: 'transform' }}>
              <SheetPaper sheet={sheet} entries={preview} width={W} />
            </div>
            {/* The folder's front pocket, over the page: what it slides behind. */}
            <div className="fixed pointer-events-none" style={{ left: fx, top: folderTop + FH * 0.3, width: F, height: FH * 0.7 }}>
              <div className="absolute inset-0 sh-folder-front" style={{ borderRadius: '6px 6px 12px 12px', background: `linear-gradient(180deg, ${front} 0%, ${back} 100%)`, boxShadow: `0 1px 0 ${edge} inset, 0 -8px 18px -12px rgba(0,0,0,0.5)` }}>
                <span className="absolute left-5 bottom-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: dark ? '#a1a1aa' : '#52525b' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  My Alpha
                </span>
              </div>
            </div>
          </>
        )}

        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: 'min(360px, 88vw)' }}>
          <div ref={confirm} style={{ opacity: 0 }}>
            <div className={`relative rounded-2xl border p-6 ${t.card}`} style={dark ? undefined : { boxShadow: '0 30px 60px -30px rgba(24,24,27,0.35)' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] flex items-center gap-2" style={{ color: c.due }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: `${c.due}22` }}>{Icon.check}</span>
                Added to Alpha
              </p>
              <p className={`font-display text-[26px] leading-[1.05] mt-4 ${t.heading}`}>{sheet.title}</p>
              <p className={`text-[13px] mt-2 ${t.muted}`}>{sheetLine(sheet)} · ready to read</p>
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
