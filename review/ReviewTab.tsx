import React, { useState } from 'react';
import { Card, Eyebrow, Field, PageHeader, Segmented, StatTile, btn, tokens } from '../ui/kit';
import type { User } from '@supabase/supabase-js';
import { DailyLog, DailyQuestionsLog, Subject, ExamPreference, ReminderPrefs } from '../types';
import ReminderSettings from '../reminders/ReminderSettings';

interface Props {
  logs: DailyLog[];
  score: number;
  onClearData: () => void;
  theme: 'dark' | 'light';
  user: User | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onLog: (subject: Subject, hours: number, quality: number, distractions: number) => void;
  dailyQuestionsLog: DailyQuestionsLog[];
  examPreference: ExamPreference;
  onChangeExamPreference: (p: ExamPreference) => void;
  activeSubjects: Subject[];
  reminders: ReminderPrefs;
  onChangeReminders: (patch: Partial<ReminderPrefs>) => void;
}

/* One shape for every setting: what it is, where it stands, and its control.
   Module level, not inside the tab: defined in render it would be a new
   component type each keystroke, remounting (and re-animating) every row. */
const Row: React.FC<{ title: string; detail: React.ReactNode; children: React.ReactNode; delay: number; dark: boolean }> = ({ title, detail, children, delay, dark }) => {
  const t = tokens(dark);
  return (
    <Card dark={dark} delay={delay} className="p-6 md:p-7 flex flex-col md:flex-row md:items-center justify-between gap-5">
      <div className="min-w-0">
        <p className={`text-[15px] font-ui font-bold ${t.heading}`}>{title}</p>
        <div className={`text-[13px] font-ui mt-1 ${t.muted}`}>{detail}</div>
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">{children}</div>
    </Card>
  );
};

const ReviewTab: React.FC<Props> = ({
  logs, score, onClearData, theme, user, onOpenAuth, onSignOut, onLog,
  examPreference, onChangeExamPreference, activeSubjects, reminders, onChangeReminders,
}) => {
  const [manualSubject, setManualSubject] = useState<Subject>('Physics');
  const [manualHours, setManualHours] = useState<string>('');
  const [manualQuality, setManualQuality] = useState<number>(3);

  const handleManualLog = (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(manualHours);
    if (!isNaN(h) && h > 0) {
      onLog(manualSubject, h, manualQuality, 0);
      setManualHours('');
      setManualQuality(3);
    }
  };

  const dark = theme === 'dark';
  const t = tokens(dark);
  const totalHours = logs.reduce((a, b) => a + b.hours, 0);
  const avgQuality = logs.length > 0 ? logs.reduce((a, b) => a + b.quality, 0) / logs.length : 0;
  const ring = 2 * Math.PI * 54;
  const verdict = score >= 80 ? 'Locked in. Hold it.' : score >= 60 ? 'Solid. Not yet dangerous.' : score >= 30 ? 'Showing up. Now show up harder.' : 'The score starts moving with your first week.';

  const field = `${t.input} !py-3 cursor-pointer`;

  return (
    <div className="space-y-6">
      <PageHeader
        dark={dark}
        title="Review"
        subtitle={logs.length ? `${totalHours.toFixed(1)} hours across ${logs.length} sessions. Here’s what they add up to.` : 'Your numbers, your settings, and the log you fix by hand.'}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card dark={dark} delay={60} className="md:col-span-2 p-6 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(90% 100% at 100% 0%, rgba(225,6,0,${dark ? '0.12' : '0.06'}), transparent 60%)` }} />
          <div className="relative flex items-center gap-6 md:gap-10">
            <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
                <circle cx="60" cy="60" r="54" fill="none" stroke={dark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'} strokeWidth="8" />
                {/* Not drawn at zero: a round cap on a zero-length arc still paints a dot. */}
                {score > 0 && (
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#E10600" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${(score / 100) * ring} ${ring}`} className="mk-ring" style={{ ['--mk-len' as string]: ring } as React.CSSProperties} />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`num-hero text-[44px] md:text-[56px] ${t.heading}`}>{score}</span>
                <span className={`text-[10px] font-ui font-bold ${t.faint}`}>/ 100</span>
              </div>
            </div>
            <div className="min-w-0">
              <Eyebrow dark={dark}>Lock-In score</Eyebrow>
              <p className={`font-display text-[22px] md:text-[28px] leading-tight mt-2 ${t.heading}`}>{verdict}</p>
              <p className={`text-[12px] font-ui mt-2 ${t.muted}`}>Consistency, volume and focus quality, minus distractions. Rebuilt every time you log.</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 md:grid-cols-1 gap-3">
          <StatTile dark={dark} delay={100} label="Hours" value={totalHours.toFixed(1)} />
          <StatTile dark={dark} delay={140} label="Sessions" value={logs.length} />
          <StatTile dark={dark} delay={180} label="Avg focus" value={avgQuality.toFixed(1)} />
        </div>
      </div>

      <form onSubmit={handleManualLog}>
        <Card dark={dark} delay={220} className="p-6 md:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <p className={`text-[15px] font-ui font-bold ${t.heading}`}>Add a session by hand</p>
            <span className={`text-[11px] font-ui ${t.faint}`}>Counts for your streak, not for Ranks</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 mt-5 items-end">
            <Field label="Subject" dark={dark}>
              <select value={manualSubject} onChange={(e) => setManualSubject(e.target.value as Subject)} className={field}>
                {activeSubjects.map((sub: Subject) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </Field>
            <Field label="Hours" dark={dark}>
              <input type="number" step="0.1" min="0.1" value={manualHours} onChange={(e) => setManualHours(e.target.value)} placeholder="e.g. 1.5" required className={`mk-num ${t.input} !py-3`} />
            </Field>
            <Field label="Focus (1–5)" dark={dark}>
              <select value={manualQuality} onChange={(e) => setManualQuality(parseInt(e.target.value))} className={field}>
                {[1, 2, 3, 4, 5].map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <button type="submit" className={`${btn} px-8 py-3.5 ${t.primary}`}>Add log</button>
          </div>
        </Card>
      </form>

      <div className="pt-4">
        <Eyebrow dark={dark} className="mb-3">Settings</Eyebrow>
        <div className="space-y-3">
          <Row
            dark={dark}
            delay={260}
            title="Account & sync"
            detail={user ? <>Signed in as <b className={t.heading}>{user.email}</b>. Synced across your devices.</> : 'Offline mode. Your progress lives on this device only.'}
          >
            {user
              ? <button onClick={onSignOut} className={`${btn} px-5 py-3 ${t.ghost}`}>Log out</button>
              : <button onClick={onOpenAuth} className={`${btn} px-5 py-3 ${t.primary}`}>Sign in to sync</button>}
            <button onClick={onClearData} className={`${btn} px-5 py-3 border ${dark ? 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10' : 'border-rose-200 text-rose-600 hover:bg-rose-50'}`}>Reset device</button>
          </Row>

          <ReminderSettings
            prefs={reminders}
            theme={theme}
            signedIn={!!user}
            onChange={onChangeReminders}
          />

          <Row dark={dark} delay={300} title="Exam" detail="Switch any time. The other exam’s data stays safe and comes back if you switch back.">
            <Segmented
              value={examPreference}
              onChange={(e: ExamPreference) => onChangeExamPreference(e)}
              dark={dark}
              label="Exam"
              options={[{ value: 'JEE', label: 'JEE' }, { value: 'NEET', label: 'NEET' }]}
            />
          </Row>

          <Row dark={dark} delay={340} title="Talk to us" detail="Feedback, bug reports, or just say hi.">
            <a href="https://instagram.com/trackeralpha" target="_blank" rel="noopener noreferrer" className={`${btn} px-4 py-3 ${t.ghost} !normal-case !tracking-normal !text-[12px] !font-semibold`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
              @trackeralpha
            </a>
            <a href="mailto:lockinhq@gmail.com" className={`${btn} px-4 py-3 ${t.ghost} !normal-case !tracking-normal !text-[12px] !font-semibold`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              lockinhq@gmail.com
            </a>
          </Row>
        </div>
      </div>
    </div>
  );
};

export default ReviewTab;
