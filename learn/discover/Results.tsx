/* ── A YouTube result, ready to be filed ──
   One row in the Discover panel's list: YouTube's thumbnail and length, the
   title, the channel, and what one tap does. The thumbnail is
   YouTube's, shown live and never stored; on the shelf every lecture wears
   Alpha's own case.

   What a tap does depends on the video:
   - new        "+ Add" files it at once (one tap, no form);
   - adding     the button holds while the encrypted write lands;
   - on shelf   "On your shelf · PHY-007", and a tap opens it;
   - blocked    the creator allows it only on YouTube: no add, a link out.
   Results are never hidden or reordered here: YouTube's order, YouTube's
   list (API policy III.C.5). */

import React from 'react';
import { durationLabel } from './match';
import { watchUrl } from '../../video/model';
import type { FoundVideo } from './api';

export type ResultState =
  | { kind: 'new' }
  | { kind: 'adding' }
  | { kind: 'have'; code: string; id: string };

interface Props {
  v: FoundVideo;
  state: ResultState;
  dark: boolean;
  onAdd: () => void;
  onOpen: (id: string) => void;
}

const Thumb = ({ v, className = '' }: { v: FoundVideo; className?: string }) => (
  <span className={`relative block overflow-hidden bg-zinc-900 ${className}`} style={{ aspectRatio: '16 / 9' }}>
    {v.thumb ? (
      <img src={v.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: v.embeddable ? 1 : 0.4 }} />
    ) : null}
    {v.durationS !== null && (
      <span className="absolute right-1.5 bottom-1.5 px-1.5 py-0.5 rounded text-[11px] font-bold font-ui tabular-nums text-white" style={{ background: 'rgba(0,0,0,0.78)' }}>
        {durationLabel(v.durationS)}
      </span>
    )}
  </span>
);

const Action = ({ v, state, dark, onAdd, onOpen, compact }: Props & { compact?: boolean }) => {
  const ghost = dark ? 'border border-white/[0.12] text-zinc-200 hover:bg-white/[0.06]' : 'border border-zinc-200 text-zinc-800 hover:bg-zinc-50';
  const h = compact ? 'h-9 px-3 text-[12px]' : 'h-10 px-4 text-[13px]';
  if (!v.embeddable) {
    return (
      <a href={watchUrl(v.id)} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center rounded-lg font-ui font-bold ${h} ${ghost}`} title="The creator allows this only on YouTube">
        Only on YouTube ↗
      </a>
    );
  }
  if (state.kind === 'have') {
    return (
      <button type="button" onClick={() => onOpen(state.id)} className={`inline-flex items-center gap-1.5 rounded-lg font-ui font-bold ${h} ${ghost}`}>
        <span aria-hidden="true">✓</span> {state.code}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={state.kind === 'adding'}
      className={`inline-flex items-center gap-1.5 rounded-lg font-ui font-bold text-white bg-[#E10600] hover:bg-[#c90500] disabled:opacity-60 ${h}`}
    >
      {state.kind === 'adding' ? 'Filing…' : '+ Add'}
    </button>
  );
};

interface RowProps extends Props {
  index: number;
  selected: boolean;
  onSelect: () => void;
}

export const ResultRow = ({ index, selected, onSelect, ...p }: RowProps) => {
  const { v, dark } = p;
  return (
    <li
      data-sl-row={index}
      role="option"
      aria-selected={selected}
      onMouseEnter={onSelect}
      className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${selected ? (dark ? 'bg-white/[0.08]' : 'bg-zinc-100') : ''}`}
    >
      <Thumb v={v} className="w-[120px] sm:w-[136px] shrink-0 rounded-lg" />
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] sm:text-[14px] font-ui font-bold leading-snug line-clamp-2 ${dark ? 'text-white' : 'text-zinc-900'}`}>{v.title}</span>
        <span className="block text-[12px] font-ui text-zinc-500 truncate mt-0.5">{v.channel}</span>
      </span>
      <span className="shrink-0"><Action {...p} compact /></span>
    </li>
  );
};

/** Where every set of results says it came from (API policy III.F.2.a). */
export const FromYouTube = ({ dark, remaining }: { dark: boolean; remaining?: number | null }) => (
  <p className={`flex flex-wrap items-center justify-between gap-2 text-[11px] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>
    <span className="inline-flex items-center gap-1.5">
      Results from
      <span className={`inline-flex items-center gap-1 font-bold ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><rect width="16" height="12" rx="3" fill="#FF0000" /><path d="M6.4 3.4v5.2L10.6 6z" fill="#fff" /></svg>
        YouTube
      </span>
    </span>
    {remaining !== null && remaining !== undefined && <span>{remaining} {remaining === 1 ? 'search' : 'searches'} left today</span>}
  </p>
);

/* ── States that replace the results ── */

export const RESULT_COPY: Record<string, { title: string; body: string }> = {
  limit: { title: "That's today's 30 searches.", body: 'Back at 4 AM. Your shelf still works, and so does pasting a link.' },
  busy: { title: 'Discover is full for today.', body: 'Every search Alpha can make today is used. Back at 4 AM. Pasting a link still works.' },
  offline: { title: "You're offline.", body: 'Discover needs the internet. Your shelf and notes are on this device.' },
  unreachable: { title: "Couldn't reach Alpha.", body: 'Your internet works, but Discover did not answer. A blocker or network filter may be in the way.' },
  'not-set-up': { title: "Discover isn't switched on yet.", body: 'Paste a link to add a lecture for now.' },
  'not-member': { title: 'Discover is for Alpha members.', body: 'Get in with an Access Pass.' },
  'signed-out': { title: 'Sign in to search.', body: 'Discover needs your account.' },
  error: { title: "YouTube didn't answer.", body: 'Try again in a moment.' },
};

export const ResultsSkeleton = ({ dark, rows }: { dark: boolean; rows?: boolean }) => (
  <div className={rows ? 'space-y-2' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'} aria-busy="true" aria-label="Searching">
    {Array.from({ length: rows ? 5 : 6 }, (_, i) => (
      <div key={i} className={rows ? 'flex items-center gap-3 p-2' : `rounded-xl border overflow-hidden ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
        <div className={`${rows ? 'w-[136px] rounded-lg' : 'w-full'} ${dark ? 'bg-white/[0.05]' : 'bg-zinc-100'} animate-pulse`} style={{ aspectRatio: '16 / 9' }} />
        <div className={`${rows ? 'flex-1' : 'p-4'} space-y-2`}>
          <div className={`h-3 rounded ${dark ? 'bg-white/[0.07]' : 'bg-zinc-100'} w-[85%]`} />
          <div className={`h-3 rounded ${dark ? 'bg-white/[0.05]' : 'bg-zinc-100'} w-[50%]`} />
        </div>
      </div>
    ))}
  </div>
);
