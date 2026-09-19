import React, { useState } from 'react';
import { SleepState } from '../types';
import { getISTDateString } from '../utils';
import NoticeLine from '../notify/NoticeLine';

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
 * a nudge about somewhere else. That shape now lives in `notify/NoticeLine`,
 * where announcements reach for it too; what stays here is the only part that
 * is about sleep — when to show it, and what dismissing it means.
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
    <NoticeLine
      theme={theme}
      label="Log last night's sleep"
      detail="in the Observatory"
      onOpen={onOpen}
      onDismiss={dismiss}
      dismissLabel="Dismiss until tomorrow"
    />
  );
};

export default SleepReminder;
