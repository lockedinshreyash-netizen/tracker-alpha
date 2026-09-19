import React from 'react';

interface Props {
  theme: 'dark' | 'light';
  /** The bold half. What the line is about. */
  label: React.ReactNode;
  /** The muted half, on the same line. Where it is, or what happens next. */
  detail?: React.ReactNode;
  /** Tapping the line itself. */
  onOpen: () => void;
  /** Omitted means the line cannot be waved away — no cross is drawn. */
  onDismiss?: () => void;
  dismissLabel?: string;
  /** A count, a status — anything short, rendered before the cross. */
  trailing?: React.ReactNode;
}

/**
 * One line on Today, with a dot, a tap target and an optional cross.
 *
 * This shape was the sleep nudge's, and the reasoning it was built on applies
 * to anything Today has to mention rather than ask for: Today is for what you
 * need to do today, so a thing that lives somewhere else gets a line, not a
 * card. Announcements arrived needing exactly that, so the shape moved here
 * rather than being copied — a second implementation of this pill would have
 * drifted from the first within a release.
 *
 * It borrows the Observatory's tokens deliberately (`obs`/`obs-dark`). They are
 * the only palette in the app that resolves to a legible surface on either
 * theme without a `dark ? … : …` at every colour, and the nudge has always been
 * drawn with them.
 */
const NoticeLine: React.FC<Props> = ({
  theme, label, detail, onOpen, onDismiss, dismissLabel = 'Dismiss', trailing,
}) => (
  <div
    className={`obs ${theme === 'dark' ? 'obs-dark' : ''} flex items-center gap-3`}
    style={{
      background: 'var(--o-card)',
      border: '1px solid var(--o-line)',
      borderRadius: 999,
      padding: '10px 12px 10px 18px',
    }}
  >
    <span
      className="shrink-0"
      style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--o-accent)' }}
      aria-hidden="true"
    />
    <button onClick={onOpen} className="flex-1 min-w-0 text-left">
      <span className="o-body" style={{ fontSize: 14, color: 'var(--o-ink)', fontWeight: 600 }}>
        {label}
      </span>
      {detail && (
        <span className="o-body ml-2" style={{ fontSize: 13.5 }}>
          {detail}
        </span>
      )}
    </button>

    {trailing && (
      <span className="o-label shrink-0" style={{ fontSize: 10 }}>
        {trailing}
      </span>
    )}

    {onDismiss && (
      <button
        onClick={onDismiss}
        aria-label={dismissLabel}
        className="shrink-0 flex items-center justify-center transition-opacity hover:opacity-60"
        style={{
          width: 30, height: 30, borderRadius: 999,
          background: 'var(--o-sunk)', color: 'var(--o-ink-3)',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    )}
  </div>
);

export default NoticeLine;
