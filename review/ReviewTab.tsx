import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { DailyLog, DailyQuestionsLog, Subject, ExamPreference } from '../types';

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
}

const ReviewTab: React.FC<Props> = ({ logs, score, onClearData, theme, user, onOpenAuth, onSignOut, onLog, examPreference, onChangeExamPreference, activeSubjects }) => {
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

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 p-10 md:p-14 rounded-xl border flex flex-col justify-center items-center text-center relative overflow-hidden ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-200'}`}>
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500 mb-6 font-ui">Composite Performance</p>
          <h2 className="text-9xl font-black italic tracking-tighter leading-none mb-4 num-hero">{score}</h2>
          <div className="accent-line mb-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-zinc-500 font-ui">Lock-In Score / 100</p>

          <div className={`w-full max-w-xs h-1 rounded-full mt-10 overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
            <div className={`h-full transition-all duration-1000 ${theme === 'dark' ? 'bg-white' : 'bg-black'}`} style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="space-y-4">
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Total Hours Logged</p>
            <p className="text-3xl num-stat">{logs.reduce((a, b) => a + b.hours, 0).toFixed(1)}H</p>
          </div>
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Total Sessions</p>
            <p className="text-3xl num-stat">{logs.length}</p>
          </div>
          <div className={`p-6 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Avg Quality</p>
            <p className="text-3xl num-stat">
              {logs.length > 0 ? (logs.reduce((a, b) => a + b.quality, 0) / logs.length).toFixed(1) : '0.0'}
            </p>
          </div>
        </div>
      </div>

      <div className={`p-8 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase font-ui">Account & Privacy</h4>
          <p className="text-[11px] text-zinc-500 font-bold mt-1">
            {user ? `ENROLLED AS: ${user.email?.toUpperCase()}` : 'OFFLINE MODE: PROGRESS STORED ON DEVICE ONLY.'}
          </p>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          {user ? (
            <button
              onClick={onSignOut}
              className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all rounded-lg"
            >
              Log Out
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white hover:bg-red-700 transition-all rounded-lg"
            >
              Sign In to Sync
            </button>
          )}
          <button
            onClick={onClearData}
            className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border border-red-900/40 text-red-500/70 hover:bg-red-900/10 hover:text-red-500 transition-all rounded-lg"
          >
            Reset Device
          </button>
        </div>
      </div>

      <div className={`p-8 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase font-ui">Exam Preference</h4>
          <p className="text-[11px] text-zinc-500 font-bold mt-1">
            CURRENT TARGET: {examPreference}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase font-medium mt-1">
            Your previous subject data is safe and will reappear if you switch back.
          </p>
        </div>
        <div className="flex gap-2">
          {(['JEE', 'NEET'] as const).map(e => (
            <button
              key={e}
              onClick={() => onChangeExamPreference(e)}
              className={`px-6 py-2 text-[10px] font-bold rounded-lg transition-all ${examPreference === e ? 'bg-[#E10600] text-white' : (theme === 'dark' ? 'bg-[#27272a] text-zinc-400 hover:text-white' : 'bg-zinc-200 text-zinc-600 hover:text-black')}`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-8 rounded-xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase font-ui">Contact & Socials</h4>
          <p className="text-[11px] text-zinc-500 font-bold mt-1 uppercase">
            FEEDBACK, BUG REPORTS, OR JUST SAY HI
          </p>
        </div>
        <div className="flex gap-6 flex-wrap justify-center">
          <a
            href="https://instagram.com/trackeralpha"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
            </svg>
            @trackeralpha
          </a>
          <a
            href="mailto:lockinhq@gmail.com"
            className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
            lockinhq@gmail.com
          </a>
        </div>
      </div>

      <form onSubmit={handleManualLog} className={`p-8 rounded-xl border flex flex-col gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <h4 className="text-sm font-bold uppercase font-ui">Manual Log</h4>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-black tracking-[0.06em] text-zinc-500">Subject</label>
            <select
              value={manualSubject}
              onChange={(e) => setManualSubject(e.target.value as Subject)}
              className={`p-3 rounded-md border text-sm font-black uppercase focus:outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
            >
              {activeSubjects.map((s: Subject) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-black tracking-[0.06em] text-zinc-500">Hours</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value)}
              placeholder="e.g. 1.5"
              required
              className={`p-3 rounded-md border text-sm font-black uppercase focus:outline-none ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white placeholder-zinc-800' : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'}`}
            />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-black tracking-[0.06em] text-zinc-500">Quality (1-5)</label>
            <select
              value={manualQuality}
              onChange={(e) => setManualQuality(parseInt(e.target.value))}
              className={`p-3 rounded-md border text-sm font-black uppercase focus:outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
            >
              {[1, 2, 3, 4, 5].map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            <button type="submit" className="w-full md:w-auto px-10 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95">
              Add Log
            </button>
          </div>
        </div>
      </form>


    </div>
  );
};

export default ReviewTab;
