/* ── "Add a daily study block to your calendar" ──
   Two buttons, ordered for the device: an iPhone or Mac opens the .ics into
   Apple Calendar, everything else reaches for Google first. Used on the
   onboarding keep step (variant 'ob') and in settings. */

import React, { useState } from 'react';
import type { DayMinute } from '../types';
import { getISTDateString } from '../utils';
import { downloadIcs, googleCalendarUrl, studyEvent } from './calendar';
import { markKept } from './keepState';

const appleFirst = (): boolean =>
  typeof navigator !== 'undefined' && /iPhone|iPad|Macintosh/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent);

const CalIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);

const CalendarButtons: React.FC<{
  goalHours: number;
  studyMinute: DayMinute;
  dark?: boolean;
  variant?: 'app' | 'ob';
  onAdded?: () => void;
}> = ({ goalHours, studyMinute, dark = true, variant = 'app', onAdded }) => {
  const [added, setAdded] = useState<null | 'google' | 'ics'>(null);
  const event = studyEvent(goalHours, getISTDateString(), studyMinute);

  const done = (which: 'google' | 'ics') => {
    setAdded(which);
    markKept('calendar');
    onAdded?.();
  };

  const google = (
    <a
      key="g"
      href={googleCalendarUrl(event)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => done('google')}
      className={variant === 'ob' ? 'ob-cal-btn' : `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${dark ? 'border-white/[0.12] text-zinc-200 hover:bg-white/[0.04]' : 'border-zinc-200 text-zinc-800 hover:bg-zinc-50'}`}
    >
      <CalIcon /> {added === 'google' ? 'Added' : 'Google Calendar'}
    </a>
  );
  const ics = (
    <button
      key="i"
      type="button"
      onClick={() => { downloadIcs(event); done('ics'); }}
      className={variant === 'ob' ? 'ob-cal-btn' : `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-[11px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${dark ? 'border-white/[0.12] text-zinc-200 hover:bg-white/[0.04]' : 'border-zinc-200 text-zinc-800 hover:bg-zinc-50'}`}
    >
      <CalIcon /> {added === 'ics' ? 'Added' : appleFirst() ? 'Apple Calendar' : 'Apple / Outlook'}
    </button>
  );

  return (
    <div className={variant === 'ob' ? 'ob-cal' : 'flex flex-wrap gap-2'}>
      {appleFirst() ? [ics, google] : [google, ics]}
    </div>
  );
};

export default CalendarButtons;
