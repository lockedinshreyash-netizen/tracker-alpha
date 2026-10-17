/* ── When do you study? ──
   The opt-in for daily nudges (reminders/nudges.ts), asked after the profile
   and before the keep step, which uses the same time for the calendar block.

   The picture is the promise again: the student's own lock screen with the
   exact notification they will get, worded from their own goal. "Remind me"
   asks for notification permission inside the tap (browsers refuse it
   otherwise) and, signed in, subscribes this device for pushes with the app
   closed. A guest's nudges are armed for when they sign in (App does that
   once the account exists and permission is already granted).

   iPhone in a Safari tab cannot be asked for notifications at all: Apple
   allows them only to a home-screen web app. The time is still saved, and
   the line under the button says the next step is what turns them on. */

import React, { useState } from 'react';
import * as sfx from '../audio';
import type { DayMinute, ReminderPrefs } from '../types';
import { formatClock, fromClockValue, toClockValue } from '../schedule/schedule';
import { goalCopy } from '../reminders/nudges';
import { Eyebrow, Glass, haptic, Rise } from './kit';

const notificationsUsable = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

export const ReminderStep: React.FC<{
  goalHours: number;
  studyMinute: DayMinute;
  signedIn: boolean;
  /** iPhone/iPad, not installed: the permission cannot be asked yet. */
  iosTab: boolean;
  onChange: (m: DayMinute) => void;
  onSave: (patch: Partial<ReminderPrefs>) => void;
  onNext: () => void;
}> = ({ goalHours, studyMinute, signedIn, iosTab, onChange, onSave, onNext }) => {
  const [busy, setBusy] = useState(false);
  const goal = goalHours > 0 ? goalHours : 8;
  const preview = goalCopy({ day: '', hours: Math.min(goal - 0.5, Math.round(goal * 0.25 * 2) / 2), streak: 0, bank: 0 }, goal);

  const remind = async () => {
    if (busy) return;
    haptic.select();
    sfx.select();
    setBusy(true);
    let push = false;
    if (notificationsUsable()) {
      if (signedIn) {
        const { enablePush, pushSupported } = await import('../notify/push');
        push = pushSupported() ? await enablePush() : false;
        if (!push && Notification.permission === 'default') await Notification.requestPermission();
      } else if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
    onSave({ nudge: true, studyMinute, ...(push ? { push: true } : {}) });
    setBusy(false);
    onNext();
  };

  return (
    <div className="ob-col">
      <Eyebrow>Stay on it</Eyebrow>
      <h1 className="ob-h1"><Rise text="When do you *study?*" delay={80} /></h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>
        We’ll nudge you if the day slips. Up to 3 a day, only on days you haven’t finished.
      </p>

      <div className="ob-fade" style={{ animationDelay: '320ms', marginTop: 22 }}>
        <label className="ob-field">
          <span>I usually start at</span>
          <input
            type="time"
            className="ob-time"
            value={toClockValue(studyMinute)}
            onChange={e => {
              const m = fromClockValue(e.target.value);
              if (m !== null) onChange(m);
            }}
          />
        </label>
      </div>

      {/* The lock screen, with what will actually arrive. */}
      <div className="ob-fade" style={{ animationDelay: '400ms', marginTop: 22 }}>
        <div className="ob-lock" aria-hidden="true">
          <p className="ob-lock-time">{formatClock(Math.min(1080, Math.max(960, studyMinute + 180))).replace(/ [AP]M$/, '')}</p>
          <Glass radius={20} className="ob-notif">
            <img src="/icon-192.png" alt="" width={38} height={38} />
            <span className="ob-notif-body">
              <span className="ob-notif-top"><b>Tracker Alpha</b><i>now</i></span>
              <b className="ob-notif-title">{preview.title}</b>
              <span className="ob-notif-text">{preview.body}</span>
            </span>
          </Glass>
        </div>
      </div>

      <div className="ob-actions">
        <button className="ob-primary ob-ins-btn" data-ready={!busy} disabled={busy} onClick={() => { void remind(); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {busy ? 'One second…' : `Remind me at ${formatClock(studyMinute)}`}
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ob-faint)', margin: 0 }}>
          {iosTab
            ? 'On iPhone, these arrive once Alpha is on your home screen. That’s the next step.'
            : !signedIn
              ? 'Sign in later to get them even with Alpha closed.'
              : 'Turn them off any time in settings.'}
        </p>
        <button className="ob-ghost ob-ins-later" onClick={() => { sfx.select(); onNext(); }}>No reminders</button>
      </div>
    </div>
  );
};
