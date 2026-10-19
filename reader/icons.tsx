import React from 'react';

/* One stroke language for the reader: 1.8px, round caps, 24px box. No <title>
   elements: a title is a text node, and the note pin lives inside a unit
   whose text must be exactly the book's (see anchors.ts). Labels go on the
   buttons instead. */
const I = ({ d, fill, size }: { d: string; fill?: boolean; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export const IconClose = () => <I d="M6 6l12 12M18 6L6 18" />;
export const IconSearch = () => <I d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.6-3.6" />;
export const IconList = () => <I d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />;
export const IconBookmark = ({ filled }: { filled?: boolean }) => <I fill={filled} d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4.2L6 21V4.5a1 1 0 0 1 1-1z" />;
export const IconNote = () => <I d="M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4.5" />;
export const IconNoteFill = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 4h14v11l-5 5H5z" fill="currentColor" />
    <path d="M8.5 9h7M8.5 12.5h4.5" stroke="var(--pin, #fff)" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);
export const IconCopy = () => <I d="M9 9h10v11H9zM5 15V4h10" />;
export const IconShare = () => <I d="M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />;
export const IconTrash = () => <I d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />;
export const IconCheck = () => <I d="M5 12.5l4.5 4.5L19 7.5" />;
export const IconChevron = () => <I d="M9 6l6 6-6 6" />;
export const IconHighlighter = () => <I d="M9 15l-2 5h4l1-2M14.5 4.5l5 5L12 17l-5-5zM12.5 6.5l5 5" />;

export const TypeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <text x="1.5" y="18.5" fontFamily="Literata, Georgia, serif" fontSize="17" fill="currentColor">A</text>
    <text x="13" y="18.5" fontFamily="Literata, Georgia, serif" fontSize="11" fill="currentColor">a</text>
  </svg>
);

/** A small progress ring: empty, part-read, or a tick when done. */
export const Ring = ({ value }: { value: number }) => {
  const r = 9;
  const c = 2 * Math.PI * r;
  if (value >= 0.98) {
    return (
      <svg className="rd-ring" viewBox="0 0 22 22" aria-label="Read">
        <circle cx="11" cy="11" r="10" fill="var(--rd-ink)" />
        <path d="M6.8 11.3l2.9 2.9 5.5-5.6" fill="none" stroke="var(--rd-bg)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="rd-ring" viewBox="0 0 22 22" aria-label={`${Math.round(value * 100)}% read`}>
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--rd-rule)" strokeWidth="2.2" />
      {value > 0 && (
        <circle cx="11" cy="11" r={r} fill="none" stroke="var(--rd-accent)" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={`${c * Math.max(0.04, value)} ${c}`} transform="rotate(-90 11 11)" />
      )}
    </svg>
  );
};
