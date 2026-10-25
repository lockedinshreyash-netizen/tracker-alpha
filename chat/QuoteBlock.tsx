/* ── A reply's quote of the message it answers ──
   Shared by group chat and race chat, inside a bubble and above the composer.
   Never a copy of the text: the caller resolves it from the live message (or
   a looked-up one), so deleting the original blanks every quote of it. */

import React from 'react';

/** What a reply shows of the message it answers. */
export type Quote =
  | { state: 'ok'; id: string | number; mine: boolean; name: string; body: string; onScreen: boolean }
  | { state: 'deleted'; id: string | number; mine: boolean; name: string; onScreen: boolean }
  | { state: 'missing' };

/** One shape for both chats' quote sources. */
export const resolveQuote = (
  id: string | number,
  found: { senderId: string; body: string; deleted: boolean; name: string } | null | undefined,
  onScreen: boolean,
  userId: string
): Quote => {
  if (!found) return { state: 'missing' };
  const mine = found.senderId === userId;
  if (found.deleted) return { state: 'deleted', id, mine, name: found.name, onScreen };
  return { state: 'ok', id, mine, name: found.name, body: found.body, onScreen };
};

const QuoteBlock = ({ quote, dark, label, onJump }: {
  quote: Quote;
  dark: boolean;
  /** "Replying to" above the composer; absent inside a bubble. */
  label?: string;
  onJump?: (id: string | number) => void;
}) => {
  const muted = 'text-zinc-500';
  const mine = quote.state !== 'missing' && quote.mine;
  const rail = mine ? 'border-[#E10600]/60' : dark ? 'border-zinc-500' : 'border-zinc-400';
  const fill = dark ? 'bg-white/[0.04]' : 'bg-black/[0.04]';
  const jumpable = !!onJump && quote.state !== 'missing' && quote.onScreen;
  const who = quote.state === 'missing' ? '' : label && quote.mine ? 'yourself' : quote.name;
  const heading = [label, who].filter(Boolean).join(' ');
  const inner = (
    <>
      {heading && (
        <span className={`block text-[10px] font-bold font-ui truncate ${mine ? 'text-[#E10600]' : dark ? 'text-white' : 'text-zinc-900'}`}>{heading}</span>
      )}
      {quote.state === 'ok' && (
        <span className={`block text-[11px] font-ui truncate ${muted}`}>{quote.body.replace(/\s+/g, ' ')}</span>
      )}
      {quote.state === 'deleted' && <span className={`block text-[11px] font-ui italic ${muted}`}>Message deleted</span>}
      {quote.state === 'missing' && <span className={`block text-[11px] font-ui italic ${muted}`}>Original message unavailable</span>}
    </>
  );
  const cls = `block w-full text-left min-w-0 pl-2.5 pr-3 py-1.5 rounded-md border-l-2 ${rail} ${fill}`;
  if (!jumpable) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onJump!(quote.id); }}
      className={`${cls} hover:opacity-80`}
      aria-label={`Go to the message from ${quote.name}`}
    >
      {inner}
    </button>
  );
};

export default QuoteBlock;
