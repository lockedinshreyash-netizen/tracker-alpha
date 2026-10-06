/* ── Alpha Decks: the shared pieces ──
   The vocabulary every Decks screen is built from, on top of ui/kit.tsx.
   Charts follow the dataviz method: thin marks, 2px surface gaps between
   segments, a legend whenever there is more than one series, numbers in ink
   (never in the series colour), and every colour from decks/theme.ts, which
   is where they were validated. */

import React, { useEffect, useRef, useState } from 'react';
import { MASTERY_RAMP, deckAccent, room } from './theme';
import type { DeckSubject, DeckSummary } from './types';

/* ── Buttons ── */

export const pill = {
  red: 'inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-[14px] font-bold font-ui bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_6px_20px_-8px_rgba(225,6,0,0.6)] transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
  redLg: 'inline-flex items-center justify-center gap-2.5 h-14 px-8 rounded-full text-[15px] font-bold font-ui bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_10px_30px_-10px_rgba(225,6,0,0.7)] transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none',
  ghost: (dark: boolean) => `inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-[14px] font-bold font-ui transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none ${
    dark ? 'text-zinc-100 bg-white/[0.06] hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.08]' : 'text-zinc-900 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`,
  quiet: (dark: boolean) => `inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-semibold font-ui transition-colors disabled:opacity-40 ${
    dark ? 'text-zinc-300 hover:bg-white/[0.06]' : 'text-zinc-700 hover:bg-zinc-900/[0.05]'}`,
};

export const Icon = {
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
  upload: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m6 10 6-6 6 6" /><path d="M4 20h16" /></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12" /><path d="m6 10 6 6 6-6" /><path d="M4 20h16" /></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>,
  back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>,
  play: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z" /></svg>,
  more: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>,
  pencil: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  gear: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>,
  trash: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>,
  pause: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 5v14M15 5v14" /></svg>,
};

/* ── Keycap ── */

export const Key: React.FC<{ children: React.ReactNode; dark: boolean; onInk?: boolean; className?: string }> = ({ children, dark, onInk, className = '' }) => (
  <kbd
    className={`dk-key ${className}`}
    style={onInk
      ? { background: dark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.14)', boxShadow: `inset 0 0 0 1px ${dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}`, color: 'inherit', opacity: 0.75 }
      : { background: dark ? 'rgba(255,255,255,0.05)' : '#fff', boxShadow: `inset 0 0 0 1px ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(24,24,27,0.12)'}, 0 1px 0 ${dark ? 'rgba(0,0,0,0.4)' : 'rgba(24,24,27,0.08)'}`, color: dark ? '#a1a1aa' : '#71717a' }}
  >
    {children}
  </kbd>
);

/* ── A stack of cards, squared up ── */

export const StackArt: React.FC<{ dark: boolean; accent: string; check?: boolean; plus?: boolean; size?: number }> = ({ dark, accent, check = true, plus = false, size = 120 }) => {
  const r = room(dark);
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 120 96" fill="none" aria-hidden>
      <rect x="22" y="22" width="76" height="62" rx="11" fill={r.layer2} stroke={r.rule} />
      <rect x="15" y="15" width="90" height="68" rx="12" fill={r.layer} stroke={r.rule} />
      <rect x="8" y="8" width="104" height="74" rx="13" fill={r.card} stroke={r.rule} />
      {plus ? (
        <path d="M60 32v26M47 45h26" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      ) : check ? (
        <path d="M46 46l9 9 19-20" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <rect x="26" y="34" width="68" height="6" rx="3" fill={r.rule} />
          <rect x="34" y="48" width="52" height="6" rx="3" fill={r.rule} />
        </>
      )}
    </svg>
  );
};

/* ── Labels ── */

export const SubjectEyebrow: React.FC<{ subject: DeckSubject | null; classId?: number | null; chapter?: string | null; dark: boolean; className?: string; fallback?: string }> = ({ subject, classId, chapter, dark, className = '', fallback = 'Deck' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui flex items-center gap-1.5 min-w-0 ${dark ? 'text-zinc-500' : 'text-zinc-400'} ${className}`}>
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: deckAccent(subject, dark) }} />
    <span className="truncate">
      {subject ? [subject, classId ? `Class ${classId}` : null, chapter].filter(Boolean).join(' · ') : fallback}
    </span>
  </p>
);

/** Alpha's mark on a curated deck: the α in a ring, and the word. */
export const AlphaBadge: React.FC<{ dark: boolean; status?: DeckSummary['status']; collection?: DeckSummary['collection'] }> = ({ dark, status, collection }) => (
  <span className={`inline-flex items-center gap-1.5 h-6 pl-1 pr-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] font-ui shrink-0 ${
    dark ? 'bg-white/[0.06] text-zinc-300 ring-1 ring-inset ring-white/[0.08]' : 'bg-zinc-900 text-white'}`}>
    <span className={`w-4 h-4 rounded-full flex items-center justify-center font-accent italic normal-case tracking-normal text-[12px] leading-none ${dark ? 'bg-white text-black' : 'bg-white text-zinc-900'}`}>α</span>
    {status === 'draft' ? 'Draft' : status === 'archived' ? 'Archived' : collection === 'essentials' ? 'Essential' : 'Alpha'}
  </span>
);

export const StatusPill: React.FC<{ status: DeckSummary['status']; dark: boolean }> = ({ status, dark }) => {
  const tone = status === 'published'
    ? { dot: '#1baf7a', label: 'Published' }
    : status === 'draft' ? { dot: '#eda100', label: 'Draft' } : { dot: dark ? '#71717a' : '#a1a1aa', label: 'Archived' };
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-bold font-ui ${dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.dot }} />
      {tone.label}
    </span>
  );
};

/* ── Mastery ── */

export interface Mastery { mature: number; young: number; learning: number; unseen: number; total: number }

export const masteryOf = (d: Pick<DeckSummary, 'mature' | 'young' | 'learning' | 'unseen' | 'total'>): Mastery => ({
  mature: d.mature, young: d.young, learning: d.learning, unseen: d.unseen, total: d.total,
});

/** Share of cards in long-term memory (interval of three weeks or more). */
export const masteryPct = (m: Mastery): number => (m.total ? Math.round((m.mature / m.total) * 100) : 0);

const MASTERY_ORDER = ['mature', 'young', 'learning'] as const;
const MASTERY_LABEL = { mature: 'Mastered', young: 'Young', learning: 'Learning', unseen: 'Not started' };

/** One thin bar: mastered, young, learning, then the unseen remainder as track. */
export const MasteryBar: React.FC<{ m: Mastery; dark: boolean; className?: string }> = ({ m, dark, className = '' }) => {
  const ramp = MASTERY_RAMP(dark);
  const parts = MASTERY_ORDER.filter(k => m[k] > 0);
  const rest = Math.max(0, m.total - m.mature - m.young - m.learning);
  return (
    /* Every segment is drawn, the remainder in the track colour, so the 2px
       gaps between them are the card's own surface rather than the track. */
    <div className={`flex h-1.5 gap-[2px] rounded-full overflow-hidden ${className}`}
      role="img" aria-label={`${m.mature} mastered, ${m.young} young, ${m.learning} learning, ${rest} not started`}>
      {parts.map(k => <div key={k} className="h-full" style={{ flexGrow: m[k], background: ramp[k] }} />)}
      {(rest > 0 || !m.total) && <div className="h-full" style={{ flexGrow: rest || 1, background: ramp.track }} />}
    </div>
  );
};

/** A donut of the same four groups, with the share mastered in the middle. */
export const MasteryRing: React.FC<{ m: Mastery; dark: boolean; size?: number }> = ({ m, dark, size = 168 }) => {
  const ramp = MASTERY_RAMP(dark);
  const [hover, setHover] = useState<keyof typeof MASTERY_LABEL | null>(null);
  const R = 42;
  const C = 2 * Math.PI * R;
  const gap = m.total ? 1.6 : 0;
  let offset = 0;
  const segs = MASTERY_ORDER.filter(k => m[k] > 0).map(k => {
    const len = (m[k] / Math.max(1, m.total)) * C;
    const seg = { k, dash: Math.max(0, len - gap), offset };
    offset += len;
    return seg;
  });
  const pct = masteryPct(m);
  const shown = hover && hover !== 'unseen' ? m[hover] : null;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
        <circle cx="50" cy="50" r={R} fill="none" stroke={ramp.track} strokeWidth="9" />
        {segs.map(s => (
          <circle
            key={s.k}
            cx="50" cy="50" r={R} fill="none"
            stroke={ramp[s.k]}
            strokeWidth={hover === s.k ? 11 : 9}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={-s.offset}
            className="mk-ring transition-[stroke-width] duration-150"
            style={{ ['--mk-len' as string]: C, opacity: hover && hover !== s.k ? 0.35 : 1 }}
            onMouseEnter={() => setHover(s.k)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`num-hero text-[34px] ${dark ? 'text-white' : 'text-zinc-900'}`}>{shown ?? `${pct}%`}</span>
        <span className={`text-[10px] font-bold uppercase tracking-[0.08em] mt-1.5 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {hover ? MASTERY_LABEL[hover] : 'Mastered'}
        </span>
      </div>
    </div>
  );
};

export const MasteryLegend: React.FC<{ m: Mastery; dark: boolean; suspended?: number }> = ({ m, dark, suspended = 0 }) => {
  const ramp = MASTERY_RAMP(dark);
  const rows = [
    { k: 'mature', label: 'Mastered', hint: '3+ weeks', n: m.mature, color: ramp.mature },
    { k: 'young', label: 'Young', hint: 'under 3 weeks', n: m.young, color: ramp.young },
    { k: 'learning', label: 'Learning', hint: 'today', n: m.learning, color: ramp.learning },
    { k: 'unseen', label: 'Not started', hint: '', n: m.unseen, color: ramp.track },
  ];
  return (
    <div className="space-y-2.5 font-ui">
      {rows.map(r => (
        <div key={r.k} className="flex items-center gap-2.5 text-[13px]">
          <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: r.color, boxShadow: r.k === 'unseen' ? `inset 0 0 0 1px ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(24,24,27,0.14)'}` : undefined }} />
          <span className={dark ? 'text-zinc-300' : 'text-zinc-700'}>{r.label}</span>
          {r.hint && <span className={`text-[11px] ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{r.hint}</span>}
          <span className={`num-stat tabular-nums ml-auto ${dark ? 'text-white' : 'text-zinc-900'}`}>{r.n.toLocaleString()}</span>
        </div>
      ))}
      {suspended > 0 && (
        <p className={`text-[11px] pt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{suspended} paused — not shown in reviews.</p>
      )}
    </div>
  );
};

/* ── Activity: reviews per study day ── */

const shortDate = (iso: string) => new Date(`${iso}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

export const ActivityBars: React.FC<{
  days: { day: string; reviews: number; again: number }[];
  dark: boolean;
  accent: string;
  height?: number;
}> = ({ days, dark, accent, height = 120 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map(d => d.reviews));
  const last = days.length - 1;
  const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.07)';
  return (
    <div className="relative font-ui">
      <div className="relative flex items-end gap-[3px] md:gap-1.5" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: grid }} />
        <div className="absolute inset-x-0 h-px border-t border-dashed" style={{ top: 0, borderColor: grid }} />
        {days.map((d, i) => {
          const h = d.reviews ? Math.max(4, (d.reviews / max) * (height - 4)) : 0;
          return (
            /* The slot is the hover target, wider than the mark; the mark itself stays thin. */
            <div key={d.day} className="relative flex-1 h-full flex items-end justify-center cursor-default" onMouseEnter={() => setHover(i)}>
              {d.reviews > 0 ? (
                <div
                  className="w-full max-w-[22px] rounded-t-[4px] dk-grow-y transition-opacity"
                  style={{ height: h, background: accent, opacity: hover === null || hover === i ? (i === last ? 1 : 0.8) : 0.3, animationDelay: `${i * 18}ms` }}
                />
              ) : (
                <div className="w-full max-w-[22px] h-[3px] rounded-full" style={{ background: grid }} />
              )}
            </div>
          );
        })}
        {hover !== null && (
          <div
            className={`absolute -top-2 -translate-y-full px-3 py-2 rounded-lg text-[12px] whitespace-nowrap pointer-events-none z-10 ${dark ? 'bg-[#1c1c21] text-zinc-200 ring-1 ring-white/[0.08]' : 'bg-white text-zinc-700 ring-1 ring-zinc-200 shadow-lg'}`}
            style={{ left: `${((hover + 0.5) / days.length) * 100}%`, transform: 'translate(-50%, -100%)' }}
          >
            <p className={`font-bold ${dark ? 'text-white' : 'text-zinc-900'}`}>{hover === last ? 'Today' : shortDate(days[hover].day)}</p>
            <p>{days[hover].reviews} {days[hover].reviews === 1 ? 'review' : 'reviews'}{days[hover].again ? ` · ${days[hover].again} again` : ''}</p>
          </div>
        )}
      </div>
      <div className={`flex justify-between mt-2.5 text-[11px] ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        <span>{days[0] ? shortDate(days[0].day) : ''}</span>
        <span>Today</span>
      </div>
    </div>
  );
};

/** The last `n` study days ending today, zero-filled. */
export const fillDays = (rows: { day: string; reviews: number; again: number }[], today: string, n = 14) => {
  const byDay = new Map(rows.map(r => [r.day, r]));
  const end = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: n }, (_, i) => {
    const day = new Date(end - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDay.get(day) ?? { day, reviews: 0, again: 0 };
  });
};

/* ── An overflow menu ── */

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export const MoreMenu: React.FC<{ items: MenuItem[]; dark: boolean; label?: string; quiet?: boolean }> = ({ items, dark, label = 'More', quiet = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc); };
  }, [open]);
  const shown = items.filter(i => !i.hidden);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-expanded={open}
        className={`rounded-full flex items-center justify-center transition-colors ${quiet
          ? `w-9 h-9 ${dark ? 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-900/[0.05]'}`
          : `w-11 h-11 ${dark ? 'text-zinc-300 bg-white/[0.06] hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.08]' : 'text-zinc-700 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`}`}
      >
        {Icon.more}
      </button>
      {open && (
        <div role="menu" className={`mk-sheet absolute right-0 top-full mt-2 min-w-[210px] p-1.5 rounded-xl z-30 font-ui ${dark ? 'bg-[#1a1a1f] ring-1 ring-white/[0.08] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.8)]' : 'bg-white ring-1 ring-zinc-200 shadow-[0_20px_50px_-16px_rgba(24,24,27,0.25)]'}`}>
          {shown.map(i => (
            <button
              key={i.label}
              role="menuitem"
              onClick={() => { setOpen(false); i.onSelect(); }}
              className={`w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-[13px] font-semibold text-left transition-colors ${
                i.danger ? 'text-rose-500 hover:bg-rose-500/10' : dark ? 'text-zinc-200 hover:bg-white/[0.06]' : 'text-zinc-800 hover:bg-zinc-100'}`}
            >
              <span className="w-4 flex justify-center opacity-80">{i.icon}</span>
              {i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** "2d ago", "just now". */
export const fmtAgo = (iso: string, now = Date.now()): string => {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = Math.floor(s / 86400);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
