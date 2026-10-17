/* ── `?keep=debug`: every way Alpha keeps itself close, on one board ──
   DEV only, tree-shaken from production (index.tsx). The onboarding keep step
   for each KeepMethod, the nudge step, the guide sheets, and the next three
   days of nudges with their real copy. Nothing is written: install, reminders
   and kept-state are all stubbed. */

import React, { useMemo, useState } from 'react';
import '../onboarding/onboarding.css';
import { InstallStep } from '../onboarding/Install';
import { ReminderStep } from '../onboarding/Reminder';
import type { KeepMethod } from './platform';
import { planNudges } from '../reminders/nudges';
import { istInstant, getISTDateString, addDays } from '../utils';

const METHODS: KeepMethod[] = ['prompt', 'ios-share', 'mac-dock', 'firefox-android', 'bookmark', 'inapp'];
type View = KeepMethod | 'remind' | 'nudges';

const DebugKeep: React.FC = () => {
  const [view, setView] = useState<View>('prompt');
  const [key, setKey] = useState(0);
  const [hours, setHours] = useState(2.5);
  const [minute, setMinute] = useState(840);

  const nudges = useMemo(() => {
    const today = getISTDateString();
    return planNudges({
      prefs: { nudge: true, studyMinute: minute },
      goalHours: 10,
      days: [0, 1, 2, 3].map(i => ({ day: addDays(today, i), hours: i === 0 ? hours : 0, streak: 12 + (i ? 0 : 0), bank: i > 1 ? 1 : 0 })),
      instant: istInstant,
      now: istInstant(today, 0),
    });
  }, [hours, minute]);

  return (
    <div style={{ minHeight: '100vh', background: '#050506' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500, display: 'flex', gap: 8, padding: 8, background: '#111', flexWrap: 'wrap', fontFamily: 'system-ui', fontSize: 12 }}>
        <select value={view} onChange={e => { setView(e.target.value as View); setKey(k => k + 1); }} style={{ background: '#222', color: '#eee', border: '1px solid #333', borderRadius: 6, padding: '4px 6px' }}>
          {METHODS.map(m => <option key={m} value={m}>Keep step · {m}</option>)}
          <option value="remind">Nudge step</option>
          <option value="nudges">Nudge plan · next 4 days</option>
        </select>
        <button onClick={() => setKey(k => k + 1)} style={{ color: '#aaa' }}>Reset</button>
      </div>

      {view === 'nudges' ? (
        <div style={{ padding: '64px 20px', color: '#eee', fontFamily: 'system-ui', maxWidth: 640 }}>
          <label style={{ display: 'block', fontSize: 13 }}>Logged today: {hours}h of 10h
            <input type="range" min={0} max={11} step={0.5} value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <label style={{ display: 'block', fontSize: 13, marginTop: 8 }}>Studies at minute {minute} (study-day axis)
            <input type="range" min={0} max={1200} step={30} value={minute} onChange={e => setMinute(Number(e.target.value))} style={{ width: '100%' }} />
          </label>
          <ol style={{ marginTop: 16, display: 'grid', gap: 10, padding: 0, listStyle: 'none' }}>
            {nudges.map(n => (
              <li key={n.key} style={{ background: '#16161a', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: '#888' }}>{n.day} · {n.kind} · {new Date(n.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}</div>
                <div style={{ fontWeight: 800, marginTop: 4 }}>{n.copy.title}</div>
                <div style={{ color: '#bbb', fontSize: 14 }}>{n.copy.body}</div>
              </li>
            ))}
            {!nudges.length && <li style={{ color: '#888' }}>Nothing: the goal is met.</li>}
          </ol>
        </div>
      ) : (
        <div className="ob" style={{ position: 'fixed', top: 40 }}>
          <div className="ob-scene enter" key={key}>
            {view === 'remind'
              ? <ReminderStep goalHours={10} studyMinute={minute} signedIn={false} iosTab={false} onChange={setMinute} onSave={() => {}} onNext={() => setKey(k => k + 1)} />
              : (
                <InstallStep
                  method={view}
                  available={view === 'prompt'}
                  onInstall={() => new Promise(r => window.setTimeout(() => r('accepted'), 600))}
                  onNext={() => setKey(k => k + 1)}
                  goalHours={10}
                  studyMinute={minute}
                />
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugKeep;
