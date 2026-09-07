/**
 * The way in.
 *
 * Sits on Streak (where the achievement already is) and on Today (where the
 * day was just logged). Deliberately a secondary control in the app's existing
 * button language — the accent red belongs to starting a session, not to
 * posting about one.
 */

import React from 'react';

interface Props {
  onClick: () => void;
  theme: 'dark' | 'light';
  label?: string;
  /** Compact form, for sitting inside an existing row rather than under a card. */
  small?: boolean;
}

const ShareButton: React.FC<Props> = ({ onClick, theme, label = 'Share your win', small }) => {
  const dark = theme === 'dark';
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md border font-bold uppercase tracking-[0.1em] font-ui transition-colors active:scale-97 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${
        small ? 'px-3 py-2 text-[9px]' : 'px-5 py-3 text-[10px]'
      } ${
        dark
          ? 'border-white/[0.12] text-zinc-400 hover:text-white hover:border-white/[0.2]'
          : 'border-zinc-300 text-zinc-500 hover:text-zinc-900 hover:border-zinc-400'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 10.5V1.5M8 1.5L4.75 4.75M8 1.5l3.25 3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 9.5v3.25c0 .69.56 1.25 1.25 1.25h8.5c.69 0 1.25-.56 1.25-1.25V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {label}
    </button>
  );
};

export default ShareButton;
