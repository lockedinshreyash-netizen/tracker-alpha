import React, { useState } from 'react';
import { BlockKind, Subject } from '../types';
import {
  ACTIVITIES, ACTIVITY_BASE, BlockColors, RECOLOURABLE, activityColor, derive, subjectStyle,
} from './colors';

interface Props {
  colors: BlockColors;
  theme: 'dark' | 'light';
  /** The subjects this exam actually uses — the locked half of the palette. */
  activeSubjects: Subject[];
  onSetColor: (kind: BlockKind, hex: string | null) => void;
}

/**
 * A dozen colours worth having, so the common case is one tap.
 *
 * The accent red is not among them: it means "now" and "this is an action"
 * everywhere else in the app, and a gym block wearing it would read as a
 * warning. The native picker underneath covers everything else.
 */
const PRESETS = [
  '#4C6EF5', '#7048E8', '#BE4BDB', '#E64980',
  '#F76707', '#FAB005', '#82C91E', '#12B886',
  '#22B8CF', '#1098AD', '#5C7CFA', '#868E96',
];

/**
 * Colours for the parts of the day that are yours.
 *
 * Split deliberately down the middle. Subject colours are data — Physics is
 * that blue on the grid, in the charts, in the heatmap and on another device —
 * so they are shown here and cannot be changed. Everything else is just your
 * life, and there is no reason the app should be the one deciding that dinner
 * is beige.
 */
const PaletteSection: React.FC<Props> = ({ colors, theme, activeSubjects, onSetColor }) => {
  const dark = theme === 'dark';
  const [open, setOpen] = useState<BlockKind | null>(null);

  const current = open ? activityColor(open, colors) : '#000000';
  const customised = RECOLOURABLE.filter(k => !!colors[k]);

  return (
    <section className={`p-8 md:p-10 rounded-xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Colours
        </h3>
        {customised.length > 0 && (
          <button
            onClick={() => customised.forEach(k => onSetColor(k, null))}
            className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
              dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Reset all
          </button>
        )}
      </div>

      <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-8 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
Paint your own day. Tap anything below to change it.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {RECOLOURABLE.map(kind => {
          const hex = activityColor(kind, colors);
          const c = derive(hex);
          const on = open === kind;
          return (
            <button
              key={kind}
              onClick={() => setOpen(on ? null : kind)}
              style={{
                background: dark ? c.bg : c.bgLight,
                borderColor: on ? hex : (dark ? c.border : c.borderLight),
                color: dark ? c.text : c.textLight,
              }}
              className="flex items-center gap-2 pl-2.5 pr-3.5 py-2 border rounded-md transition-all active:scale-95"
            >
              <span style={{ background: hex }} className="w-2.5 h-2.5 rounded-full shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui">
                {ACTIVITIES[kind].label}
              </span>
            </button>
          );
        })}
      </div>

      {open && (
        <div className={`mt-6 p-5 md:p-6 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-100'}`}>
          <div className="flex items-center justify-between gap-4 mb-4">
            <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {ACTIVITIES[open].label}
            </span>
            <div className="flex items-center gap-4">
              {colors[open] && (
                <button
                  onClick={() => onSetColor(open, null)}
                  className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
                    dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
                  }`}
                >Reset</button>
              )}
              <button
                onClick={() => setOpen(null)}
                className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
                  dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
                }`}
              >Done</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(hex => {
              const on = current.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  onClick={() => onSetColor(open, hex === ACTIVITY_BASE[open] ? null : hex)}
                  aria-label={hex}
                  style={{ background: hex }}
                  className={`w-8 h-8 rounded-md transition-all active:scale-95 ${
                    on ? `ring-2 ring-offset-2 ${dark ? 'ring-white ring-offset-[#0D0D10]' : 'ring-zinc-900 ring-offset-zinc-50'}` : ''
                  }`}
                />
              );
            })}

            {/* Whatever colour they want, not only the twelve we thought of.
                The native picker is the one control every platform already
                knows how to open, including on a phone. */}
            <label
              className={`w-8 h-8 rounded-md border border-dashed flex items-center justify-center cursor-pointer transition-all ${
                dark ? 'border-zinc-600 text-zinc-500 hover:text-white' : 'border-zinc-300 text-zinc-400 hover:text-zinc-900'
              }`}
              title="Any colour"
            >
              <span className="text-sm leading-none">+</span>
              <input
                type="color"
                value={current}
                onChange={e => onSetColor(open, e.target.value)}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      )}

      <div className={`mt-8 pt-6 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-3 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Subjects — fixed
        </p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {activeSubjects.map(s => {
            const c = subjectStyle(s);
            return (
              <span
                key={s}
                style={{
                  background: dark ? c.bg : c.bgLight,
                  borderColor: dark ? c.border : c.borderLight,
                  color: dark ? c.text : c.textLight,
                }}
                className="flex items-center gap-2 pl-2.5 pr-3.5 py-2 border rounded-md"
              >
                <span style={{ background: c.dot }} className="w-2.5 h-2.5 rounded-full shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui">{s}</span>
              </span>
            );
          })}
        </div>
        <p className={`text-[10px] font-medium uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
A subject is the same colour everywhere — grid, charts, heatmap, every device. Recolour it and you can no longer read your own week at a glance. These stay.
        </p>
      </div>
    </section>
  );
};

export default PaletteSection;
