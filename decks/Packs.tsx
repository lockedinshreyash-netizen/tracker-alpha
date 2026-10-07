/* ── Alpha packs in My Alpha ──
   A pack is a set of Alpha decks studied together ("Physics Essentials"
   holding Kinematics, Laws of Motion, Work & Energy). In the store
   (decks/store/) it is a physical object on a hook. Once it is yours it is
   not: here it is an ordinary digital deck, because the packaging was the
   store's metaphor and it ends when the pack is opened.

   - AlphaLibraryItem: a pack on your shelf. Stacked like a deck, with its
     own numbers: cards, how many you've reviewed, how many are due.
     CONTINUE studies the whole pack.
   - PackArt: the pack's decks fanned out, each in its subject colour.
     Used on the pack page and in the console.

   Presentational only, like Library. */

import React from 'react';
import { tokens } from '../ui/kit';
import { STATE_COLOR, deckAccent, room } from './theme';
import { Icon, MasteryBar, masteryPct } from './ui';
import type { DeckSummary, Pack, PackDeck } from './types';

/* ── Numbers ── */

export interface PackTotals {
  today: number;
  due: number;
  newAvailable: number;
  total: number;
  mature: number;
  young: number;
  learning: number;
  unseen: number;
  /** Cards you have studied at least once. */
  reviewed: number;
  nextDue: string | null;
}

/** A pack's numbers: the sum of the decks of it on your shelf. Drafts are not studied. */
export const packTotals = (decks: DeckSummary[]): PackTotals => {
  const live = decks.filter(d => d.status !== 'draft');
  const sum = (k: 'total' | 'mature' | 'young' | 'learning' | 'unseen') => decks.reduce((n, d) => n + d[k], 0);
  const next = live.map(d => d.nextDue).filter((x): x is string => !!x).sort()[0] ?? null;
  const total = sum('total');
  const unseen = sum('unseen');
  return {
    today: live.reduce((n, d) => n + d.due + d.newAvailable, 0),
    due: live.reduce((n, d) => n + d.due, 0),
    newAvailable: live.reduce((n, d) => n + d.newAvailable, 0),
    total,
    mature: sum('mature'),
    young: sum('young'),
    learning: sum('learning'),
    unseen,
    reviewed: Math.max(0, total - unseen - decks.reduce((n, d) => n + d.suspended, 0)),
    nextDue: next,
  };
};

/** The pack's subject colour, else its first deck's, else ink. */
export const packAccent = (pack: Pick<Pack, 'subject' | 'decks'>, dark: boolean): string =>
  deckAccent(pack.subject ?? pack.decks.find(d => d.subject)?.subject ?? null, dark);

/** "3 decks · 412 cards". */
export const packLine = (pack: Pick<Pack, 'decks'>): string => {
  const cards = pack.decks.reduce((n, d) => n + d.cards, 0);
  return `${pack.decks.length} ${pack.decks.length === 1 ? 'deck' : 'decks'} · ${cards.toLocaleString()} ${cards === 1 ? 'card' : 'cards'}`;
};

/** "α Pack" — the pack's badge, next to AlphaBadge's "α Alpha". */
export const PackBadge: React.FC<{ dark: boolean; label?: string }> = ({ dark, label = 'Pack' }) => (
  <span className={`inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] font-ui shrink-0 ${
    dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
    <span className={`w-4 h-4 rounded-full flex items-center justify-center font-accent italic normal-case tracking-normal text-[12px] leading-none ${dark ? 'bg-black text-white' : 'bg-white text-zinc-900'}`}>α</span>
    {label}
  </span>
);

/* ── The decks, fanned ── */

export const PackArt: React.FC<{ dark: boolean; decks: Pick<PackDeck, 'subject'>[]; size?: number; count?: number }> = ({ dark, decks, size = 160, count }) => {
  const r = room(dark);
  const ink = dark ? '#d4d4d8' : '#3f3f46';
  const colours = decks.slice(0, 3).map(d => deckAccent(d.subject, dark));
  while (colours.length < 3) colours.push(colours[colours.length - 1] ?? ink);
  const n = count ?? decks.length;
  const fan = [{ x: 14, y: 22, rot: -10 }, { x: 70, y: 22, rot: 10 }, { x: 42, y: 10, rot: 0 }];
  const order = [0, 2, 1];
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 140 112" fill="none" aria-hidden>
      {fan.map((s, i) => (
        <g key={i} transform={`rotate(${s.rot} ${s.x + 28} ${s.y + 80})`}>
          <rect x={s.x} y={s.y} width="56" height="78" rx="10" fill={r.card} stroke={r.rule} />
          <rect x={s.x} y={s.y} width="56" height="78" rx="10" fill={colours[order[i]]} fillOpacity={dark ? 0.12 : 0.07} />
          <rect x={s.x + 10} y={s.y + 11} width="18" height="4" rx="2" fill={colours[order[i]]} />
          <rect x={s.x + 10} y={s.y + 34} width="36" height="4" rx="2" fill={r.rule} />
          <rect x={s.x + 10} y={s.y + 44} width="26" height="4" rx="2" fill={r.rule} />
        </g>
      ))}
      <g>
        <rect x="88" y="84" width="44" height="22" rx="11" fill={dark ? '#fafafa' : '#18181b'} />
        <text x="110" y="99" textAnchor="middle" fontSize="11" fontWeight="800" fill={dark ? '#09090b' : '#fff'} className="font-ui">{n} {n === 1 ? 'deck' : 'decks'}</text>
      </g>
    </svg>
  );
};

/* ── On your shelf ── */

export const AlphaLibraryItem: React.FC<{
  pack: Pack;
  /** The decks of this pack on your shelf. */
  decks: DeckSummary[];
  dark: boolean;
  delay?: number;
  onOpen: () => void;
  onContinue: () => void;
}> = ({ pack, decks, dark, delay = 0, onOpen, onContinue }) => {
  const t = tokens(dark);
  const accent = packAccent(pack, dark);
  const sum = packTotals(decks);
  const layer = dark ? 'bg-[#0f0f12] border-white/[0.06]' : 'bg-[#f7f6f3] border-zinc-200/70';
  const c = STATE_COLOR(dark);
  return (
    <div className="mk-rise relative" style={{ animationDelay: `${delay}ms` }}>
      <div className="dk-tile relative group h-full">
        <div aria-hidden className={`dk-peek dk-peek-2 absolute inset-x-6 -top-[10px] h-8 rounded-t-2xl border ${layer}`} />
        <div aria-hidden className={`dk-peek dk-peek-1 absolute inset-x-3 -top-[5px] h-8 rounded-t-2xl border ${dark ? 'bg-[#131317] border-white/[0.07]' : 'bg-[#fbfaf8] border-zinc-200/80'}`} />

        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          className={`relative h-full rounded-2xl border p-5 md:p-6 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${t.card}`}
          aria-label={`${pack.title}: ${sum.total} cards, ${sum.reviewed} reviewed, ${sum.today} due`}
        >
          <div aria-hidden className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{ background: `linear-gradient(180deg, ${accent}${dark ? '14' : '0f'}, transparent)` }} />

          <div className="relative flex items-center justify-between gap-3">
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] flex items-center gap-1.5 min-w-0 ${t.faint}`}>
              <span className="flex -space-x-0.5 shrink-0">
                {pack.decks.slice(0, 3).map(d => <span key={d.id} className={`w-2 h-2 rounded-full ring-2 ${dark ? 'ring-[#111114]' : 'ring-white'}`} style={{ background: deckAccent(d.subject, dark) }} />)}
              </span>
              <span className="truncate">{pack.decks.length} {pack.decks.length === 1 ? 'deck' : 'decks'}</span>
            </p>
            <PackBadge dark={dark} label={pack.status === 'draft' ? 'Draft pack' : pack.status === 'archived' ? 'Archived' : 'Pack'} />
          </div>

          <h3 className={`relative font-display uppercase text-[20px] leading-[1.05] mt-3 line-clamp-2 min-h-[42px] ${t.heading}`}>{pack.title}</h3>

          <dl className="relative grid grid-cols-3 gap-2 mt-5">
            {([
              ['Cards', sum.total, t.heading],
              ['Reviewed', sum.reviewed, t.heading],
              ['Due', sum.today, sum.today ? '' : t.faint],
            ] as const).map(([label, n, cls]) => (
              <div key={label}>
                <dt className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>{label}</dt>
                <dd className={`num-stat text-[22px] mt-1 ${cls}`} style={label === 'Due' && n ? { color: c.due } : undefined}>{n.toLocaleString()}</dd>
              </div>
            ))}
          </dl>

          <div className="relative mt-5">
            <MasteryBar m={sum} dark={dark} />
            <div className="flex items-center justify-between gap-3 mt-4">
              <span className={`text-[11px] ${t.faint}`}>{sum.total ? `${masteryPct(sum)}% mastered` : 'No cards yet'}</span>
              {sum.today > 0 ? (
                <button
                  onClick={e => { e.stopPropagation(); onContinue(); }}
                  className="inline-flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full bg-[#E10600] text-white text-[12px] font-bold uppercase tracking-[0.08em] shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform hover:scale-[1.03] active:scale-95"
                >
                  Continue {Icon.arrow}
                </button>
              ) : (
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${t.body}`}>
                  <span style={{ color: c.due }}>{Icon.check}</span>{sum.total ? 'Done for today' : 'Open'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
