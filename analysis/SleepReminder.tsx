import React, { useState } from 'react';
import { SleepState } from '../types';
import { getISTDateString } from '../utils';

interface Props {
  sleep: SleepState;
  theme: 'dark' | 'light';
  onOpen: () => void;
}

const DISMISS_KEY = 'obs_sleep_nudge_dismissed';

/**
 * Whether the nudge has already been waved away today.
 *
 * Kept in `localStorage`, deliberately not in `AppState`. A dismissal is a
 * gesture on one device on one morning, not data: putting it in the synced blob
 * would fire a Supabase upsert every time somebody flicked it away, and would
 * also hide it on the phone because it was dismissed on the laptop — which is
 * exactly wrong, since the phone is where they would actually log it.
 *
 * Stored as a study day, so it clears itself at the 04:00 rollover with no
 * expiry logic and nothing to clean up.
 */
const dismissedToday = (today: string): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === today;
  } catch {
    /* Hardened browser modes refuse storage. The nudge simply shows; a reminder
       that appears once more than it should is a far smaller failure than one
       that throws on the way into Today. */
    return false;
  }
};

/**
 * "You haven't logged last night yet" — on Today, once, and only if asked for.
 *
 * This is the one thing sleep tracking leaves on Today, and it stays inside the
 * product's standing rule about interruptions: Alpha never invents a reason to
 * speak, but it may hold you to something you asked for yourself. Turning sleep
 * on is that request. Turning it off removes this with it.
 *
 * Three conditions, all required: sleep is on, last night is genuinely not
 * recorded, and it has not already been dismissed today. It is a line with a
 * cross on it, not a card — Today is for what you need to do today, and this is
 * a nudge about somewhere else.
 */
const SleepReminder: React.FC<Props> = ({ sleep, theme, onOpen }) => {
  const today = getISTDateString();
  const [dismissed, setDismissed] = useState(() => dismissedToday(today));

  const logged = sleep.logs.some(l => l.date === today);
  if (!sleep.enabled || logged || dismissed) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, today);
    } catch {
      // See above — the dismissal just does not persist past a reload.
    }
    setDismissed(true);
  };

  return (
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
          Log last night's sleep
        </span>
        <span className="o-body ml-2" style={{ fontSize: 13.5 }}>
          in the Observatory
        </span>
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss until tomorrow"
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
    </div>
  );
};

export default SleepReminder;
