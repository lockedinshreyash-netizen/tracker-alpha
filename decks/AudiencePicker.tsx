/* ── Who is this deck for, and where does it go ──
   Administrators only; a student never sees a choice they could not make.

   Two questions, the second only once the first is "Everyone on Alpha":
   - Just me / Everyone on Alpha (the deck's scope — fixed once created).
   - Alpha Essentials / More from Alpha (the shelf students find it on —
     changeable later from the deck page and the console).

   Each shelf option carries a small drawing of the shelf it lands on — one
   big featured tile, or a grid of small ones — because "Essentials" and
   "More" are names, and the picture is what tells an administrator how the
   student will actually meet the deck. */

import React from 'react';
import type { DeckCollection, DeckScope } from './types';

export interface Audience {
  scope: DeckScope;
  collection: DeckCollection;
}

export const DEFAULT_AUDIENCE: Audience = { scope: 'personal', collection: 'more' };

export const COLLECTION_COPY: Record<DeckCollection, { title: string; line: string }> = {
  essentials: { title: 'Alpha Essentials', line: 'The must-have decks. Shown first, big and up front.' },
  more: { title: 'More from Alpha', line: 'Extra decks students can browse and add.' },
};

const Radio: React.FC<{ on: boolean; dark: boolean }> = ({ on, dark }) => (
  <span className={`w-4 h-4 shrink-0 rounded-full flex items-center justify-center ring-[1.5px] ${on ? (dark ? 'ring-white' : 'ring-zinc-900') : dark ? 'ring-zinc-600' : 'ring-zinc-300'}`}>
    {on && <span className={`w-2 h-2 rounded-full ${dark ? 'bg-white' : 'bg-zinc-900'}`} />}
  </span>
);

/** One big featured tile, or a grid of small ones — the shelf as the student sees it. */
const ShelfGlyph: React.FC<{ kind: DeckCollection; dark: boolean; on: boolean }> = ({ kind, dark, on }) => {
  const fill = on ? (dark ? 'rgba(255,255,255,0.9)' : '#18181b') : dark ? 'rgba(255,255,255,0.18)' : '#d4d4d8';
  const soft = on ? (dark ? 'rgba(255,255,255,0.35)' : '#a1a1aa') : dark ? 'rgba(255,255,255,0.08)' : '#e4e4e7';
  return (
    <svg width="44" height="32" viewBox="0 0 44 32" aria-hidden className="shrink-0">
      {kind === 'essentials' ? (
        <>
          <rect x="1" y="1" width="42" height="21" rx="4" fill={fill} />
          <rect x="1" y="25" width="20" height="6" rx="2" fill={soft} />
          <rect x="23" y="25" width="20" height="6" rx="2" fill={soft} />
        </>
      ) : (
        <>
          {[0, 1, 2].map(c => [0, 1].map(r => (
            <rect key={`${c}${r}`} x={1 + c * 14.5} y={1 + r * 16} width="12.5" height="14" rx="2.5" fill={r === 0 && c === 0 ? fill : soft} />
          )))}
        </>
      )}
    </svg>
  );
};

export const AudiencePicker: React.FC<{
  value: Audience;
  onChange: (v: Audience) => void;
  dark: boolean;
  /** Editing an existing Alpha deck: only the shelf can change. */
  shelfOnly?: boolean;
}> = ({ value, onChange, dark, shelfOnly }) => {
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const card = (on: boolean) => `text-left rounded-xl px-4 py-3.5 transition-all ${on
    ? dark ? 'bg-white/[0.06] ring-2 ring-white' : 'bg-white ring-2 ring-zinc-900'
    : dark ? 'ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.03]' : 'ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`;
  const label = `text-[13px] font-semibold mb-2.5 font-ui ${dark ? 'text-zinc-300' : 'text-zinc-700'}`;

  return (
    <div className="space-y-5 font-ui">
      {!shelfOnly && (
        <div role="radiogroup" aria-label="Who is this deck for?">
          <p className={label}>Who is this deck for?</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {([
              { v: 'personal', title: 'Just me', line: 'Personal deck. Only you can see it.' },
              { v: 'global', title: 'Everyone on Alpha', line: 'Starts as a draft. Students see it when you publish.' },
            ] as const).map(o => {
              const on = value.scope === o.v;
              return (
                <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, scope: o.v })} className={card(on)}>
                  <span className="flex items-center gap-2.5">
                    <Radio on={on} dark={dark} />
                    <span className={`text-[14px] font-bold ${heading}`}>{o.title}</span>
                  </span>
                  <span className="block text-[12px] mt-1.5 pl-[26px] leading-snug text-zinc-500">{o.line}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(shelfOnly || value.scope === 'global') && (
        <div role="radiogroup" aria-label="Where should students find it?" className={shelfOnly ? '' : 'mk-sheet'}>
          <p className={label}>Where should students find it?</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {(['essentials', 'more'] as const).map(k => {
              const on = value.collection === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, collection: k })} className={card(on)}>
                  <span className="flex items-start gap-3">
                    <ShelfGlyph kind={k} dark={dark} on={on} />
                    <span className="min-w-0">
                      <span className={`block text-[14px] font-bold ${heading}`}>{COLLECTION_COPY[k].title}</span>
                      <span className="block text-[12px] mt-1 leading-snug text-zinc-500">{COLLECTION_COPY[k].line}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
