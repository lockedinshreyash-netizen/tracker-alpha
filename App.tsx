
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AppState, TabType, DailyLog, DailyQuestionsLog, ChapterProgress, Subject, SyllabusStatus, TimerState, Task, SyncStatus, QSubject, QuestionTrackingState } from './types';
import { SYLLABUS_DATA, STATUS_CYCLE, STATUS_COLORS, LOCK_IN_QUOTES, SUBJECTS, STATUS_LABELS } from './constants';
import { getISTDateString, getDaysRemaining, calculateStreak, calculateLockInScore, getLast7DaysStats, getSubjectDistribution } from './utils';
import { JEE_2027_DATE } from './constants';
import QuestionsTab from './questions/QuestionsTab';
import QuestionsBarChart from './review/QuestionsBarChart';
import QuestionsHeatmap from './review/QuestionsHeatmap';
import Sidebar from './Sidebar';

// --- Supabase Configuration ---
const SUPABASE_URL = 'https://ipwmgkctxkopuszkuebh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6c9JTFFjI7_wxw64kZdHsA_4PCuX84A';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Global Helpers ---
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const DEFAULT_STATE: AppState = {
  currentClass: 11,
  logs: [],
  progress: [],
  lastUsedTab: 'Today',
  timer: { isRunning: false, startTime: null, accumulatedMs: 0, subject: 'Physics', isLockInActive: false, distractions: 0 },
  isLockInModeEnabled: false,
  allowList: [],
  tasks: [],
  theme: 'dark',
  dailyGoalHours: 8,
  lastUpdated: 0,
  questionTracking: {
    weeklyGoalTotal: null,
    weeklyGoalBySubject: { physicsGoal: null, chemistryGoal: null, mathGoal: null },
    dailyQuestionsLog: [],
    weakSubject: null,
    goalStartDate: null,
  }
};

// --- Sub-components ---

const AuthModal = ({
  isOpen,
  onClose,
  theme,
  onAuthSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onAuthSuccess: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div
        className={`w-full max-w-sm rounded-2xl border p-6 space-y-4 ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-zinc-200'
          }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-ui">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </h2>
          <button
            onClick={onClose}
            className="text-xs font-black uppercase tracking-[0.06em] text-zinc-500 hover:text-zinc-300"
          >
            Close
          </button>
        </div>

        {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
        {successMsg && <p className="text-[11px] font-bold text-green-500">{successMsg}</p>}

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-tight border ${theme === 'dark'
              ? 'bg-[#18181b] border-[#27272a] text-white'
              : 'bg-zinc-50 border-zinc-200 text-black'
              }`}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={`w-full rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-tight border ${theme === 'dark'
              ? 'bg-[#18181b] border-[#27272a] text-white'
              : 'bg-zinc-50 border-zinc-200 text-black'
              }`}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                if (mode === 'login') {
                  const { error } = await supabase.auth.signInWithPassword({ email, password });
                  if (error) throw error;
                } else {
                  const { error } = await supabase.auth.signUp({ email, password });
                  if (error) throw error;
                  setSuccessMsg('Check your email to confirm your account.');
                }
                onAuthSuccess();
                onClose();
              } catch (err: any) {
                setError(err.message);
              } finally {
                setLoading(false);
              }
            }}
            className="w-full py-3 rounded-lg bg-[#E10600] text-white text-[10px] font-bold uppercase tracking-[0.15em] font-ui hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? 'Processing…' : mode === 'login' ? 'Sign In' : 'Sign Up'}
          </button>
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-[10px] font-medium uppercase tracking-[0.06em] text-zinc-500 hover:text-zinc-300"
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already enrolled? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};
const Header = ({
  currentClass,
  onClassChange,
  daysRemaining,
  theme,
  onToggleTheme,
  installPrompt,
  onInstall,
  syncStatus,
  user,
  onOpenAuth,
  logs
}: {
  currentClass: 11 | 12,
  onClassChange: (c: 11 | 12) => void,
  daysRemaining: number,
  theme: 'dark' | 'light',
  onToggleTheme: () => void,
  installPrompt: any,
  onInstall: () => void,
  syncStatus: SyncStatus,
  user: any,
  onOpenAuth: () => void,
  logs: DailyLog[]
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowTooltip(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const syncColors = {
    local: 'text-zinc-600',
    syncing: 'text-yellow-500 animate-pulse',
    synced: 'text-green-500',
    error: 'text-red-500'
  };

  return (
    <div className="w-full">
      <div className={`pt-8 pb-5 relative z-20 ${theme === 'dark' ? 'border-b border-white/[0.04]' : 'border-b border-zinc-200'}`}>
        <div className="max-w-5xl mx-auto flex justify-between items-start mb-2 px-6">
          <div className="relative">
            <h1 className={`text-xl md:text-2xl logo-text flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
              LOCK IN
            </h1>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <div className={`text-[8px] font-bold uppercase tracking-wide font-ui flex items-center gap-1.5 ${syncColors[syncStatus]}`}>
                <span className="text-[6px]">●</span>
                <span>{user ? (syncStatus === 'synced' ? 'CLOUD ACTIVE' : syncStatus.toUpperCase()) : 'OFFLINE MODE'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!user && (
              <button
                onClick={onOpenAuth}
                className={`text-[10px] font-black uppercase px-3 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-white transition-all`}
              >
                SYNC
              </button>
            )}
            {installPrompt && (
              <button
                onClick={onInstall}
                className={`text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all`}
              >
                INSTALL
              </button>
            )}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-lg border transition-all flex items-center justify-center ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white hover:border-white/[0.12]' : 'bg-zinc-100 border-zinc-200 text-black hover:border-zinc-300'}`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => onClassChange(currentClass === 11 ? 12 : 11)}
              className={`text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white hover:border-white/[0.12]' : 'bg-zinc-100 border-zinc-200 text-black hover:border-zinc-300'}`}
            >
              C-{currentClass} ▾
            </button>
          </div>
        </div>
      </div>

      {/* Burn Bar */}
      <div className="w-full relative px-6 mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[9px] md:text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>JEE Mains 2027</span>
          <span className={`text-[9px] md:text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>{daysRemaining} days left</span>
        </div>
      </div>
      <div
        className="w-full h-[6px] bg-zinc-800/50 group relative cursor-crosshair"
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className="h-full bg-[#E10600] transition-all duration-1000"
          style={{ width: `${Math.max(0, Math.min(100, (1 - (daysRemaining / Math.round((new Date('2027-01-01').getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24)))) * 100))}%` }}
        />
        {/* Tooltip */}
        <div className={`absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 md:w-80 p-4 bg-[#111114] border border-white/[0.08] rounded-xl shadow-xl transition-opacity duration-300 z-[90] pointer-events-none ${showTooltip ? 'opacity-100' : 'opacity-0'}`}>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Time left</span>
                <span className="text-white font-bold text-xs md:text-sm">{daysRemaining} days remaining until JEE Mains 2027</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Time elapsed</span>
                <span className="text-[#E10600] font-black text-sm md:text-base block">{(Math.max(0, Math.min(100, (1 - (daysRemaining / Math.round((new Date('2027-01-01').getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24)))) * 100))).toFixed(1)}% of your preparation time is already gone</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Projected finishing hours</span>
                <span className="text-white font-bold text-xs md:text-sm">At your current daily average you will finish with {(() => {
                  if (logs.length === 0) return '0';
                  const firstLogDate = new Date(logs[0].date).getTime();
                  const now = new Date().getTime();
                  const daysSinceFirstLog = Math.max(1, Math.ceil((now - firstLogDate) / (1000 * 60 * 60 * 24)));
                  const totalHrs = logs.reduce((sum, l) => sum + l.hours, 0);
                  const avg = totalHrs / daysSinceFirstLog;
                  return Math.round(totalHrs + (avg * daysRemaining));
                })()} total hours studied by exam day</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Required pace</span>
                <span className="text-white font-bold text-xs md:text-sm">You need {(() => {
                  const totalHrs = logs.reduce((sum, l) => sum + l.hours, 0);
                  const needed = 1000 - totalHrs;
                  return needed <= 0 ? '0' : (needed / Math.max(1, daysRemaining)).toFixed(1);
                })()} hours per day from today to reach 1000 total hours by Mains</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Consistency</span>
                <span className="text-white font-bold text-xs md:text-sm">Current streak: {calculateStreak(logs)} days</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Missed days</span>
                <span className="text-white font-bold text-xs md:text-sm">Days with zero study logged: {(() => {
                  if (logs.length === 0) return 0;
                  const firstLogDate = new Date(logs[0].date).getTime();
                  const now = new Date().getTime();
                  const totalDays = Math.max(1, Math.ceil((now - firstLogDate) / (1000 * 60 * 60 * 24)));
                  const uniqueLogDays = new Set(logs.map(l => l.date)).size;
                  return Math.max(0, totalDays - uniqueLogDays);
                })()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ activeTab, onTabChange, isLockInActive, theme }: { activeTab: TabType, onTabChange: (t: TabType) => void, isLockInActive: boolean, theme: 'dark' | 'light' }) => {
  if (isLockInActive) return null;
  const tabs: TabType[] = ['Today', 'Syllabus', 'Streak', 'Questions', 'Review'];
  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t z-50 transition-colors ${theme === 'dark' ? 'bg-[#0B0B0D]/90 backdrop-blur-xl border-white/[0.04]' : 'bg-white/80 backdrop-blur-md border-zinc-200 shadow-lg'}`}>
      <div className="max-w-5xl mx-auto flex justify-around items-center h-16 safe-area-inset-bottom">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab ? '' : 'opacity-35 hover:opacity-70'}`}
          >
            <span className={`text-[10px] uppercase tracking-wider font-bold font-ui ${activeTab === tab ? 'text-white' : (theme === 'dark' ? 'text-white' : 'text-black')}`}>
              {tab}
            </span>
            {activeTab === tab && <div className="w-4 h-[2px] rounded-full bg-[#E10600]" />}
          </button>
        ))}
      </div>
    </div>
  );
};

const TaskSection = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  activeSubject,
  theme,
  minimal = false
}: any) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | 'General'>('General');

  const handleAdd = () => {
    if (newTaskText.trim()) {
      onAddTask(newTaskText, selectedSubject);
      setNewTaskText('');
    }
  };

  const filteredTasks = useMemo(() => {
    if (activeSubject) return tasks.filter((t: any) => t.subject === activeSubject || t.subject === 'General');
    return tasks;
  }, [tasks, activeSubject]);

  return (
    <div className={`space-y-4 relative z-10 ${minimal ? 'max-w-md w-full mx-auto' : ''}`}>
      {!minimal && (
        <div className="flex justify-between items-end mb-4 pb-2">
          <h3 className={`text-[10px] uppercase font-semibold tracking-[0.06em] font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Focus Tasks</h3>
        </div>
      )}

      {!minimal && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {(['General', 'Physics', 'Chemistry', 'Maths'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`text-[9px] px-4 py-2 font-bold uppercase tracking-[0.06em] border rounded-lg transition-all ${selectedSubject === s ? 'bg-[#E10600] text-white border-[#E10600]' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400')}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`ADD ${selectedSubject.toUpperCase()} TASK...`}
              className={`flex-1 text-xs p-3 md:p-4 focus:outline-none focus:ring-1 focus:ring-white/20 font-bold uppercase border rounded-lg transition-colors ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className={`text-[10px] font-black px-4 md:px-8 transition-all ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-300' : 'bg-black text-white hover:bg-zinc-800'}`}
            >
              COMMIT
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
        {filteredTasks.length === 0 ? (
          <div className={`col-span-full py-8 text-center border rounded-lg ${theme === 'dark' ? 'border-white/[0.04] text-zinc-700' : 'border-zinc-200 text-zinc-300'}`}>
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] italic">No Pending Tasks</p>
          </div>
        ) : filteredTasks.map((task: any) => (
          <div
            key={task.id}
            className={`flex items-start gap-4 p-4 border rounded-lg transition-all group card-interactive ${task.completed ? 'opacity-30' : ''} ${theme === 'dark' ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-100 bg-white shadow-sm'}`}
          >
            <button
              onClick={() => onToggleTask(task.id)}
              className={`mt-1 w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all ${task.completed ? 'bg-[#E10600] border-[#E10600]' : 'border-zinc-700'}`}
            >
              {task.completed && <div className="w-2 h-2 bg-white rounded-sm" />}
            </button>
            <div className="flex-1">
              <span className={`text-[8px] font-medium uppercase tracking-[0.06em] block mb-0.5 ${task.subject === 'General' ? 'text-zinc-600' : 'text-[#E10600]'}`}>{task.subject}</span>
              <p className={`text-[11px] font-bold uppercase tracking-tight break-words ${task.completed ? 'line-through' : (theme === 'dark' ? 'text-white' : 'text-black')}`}>{task.text}</p>
            </div>
            {!minimal && (
              <button onClick={() => window.confirm('Discard task?') && onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <span className="text-[12px]">🗑️</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const SyllabusTab = ({ currentClass, progress, onToggle, theme }: any) => {
  const [activeSubject, setActiveSubject] = useState<Subject>('Physics');
  const chapters = SYLLABUS_DATA[currentClass as 11 | 12][activeSubject];

  const subjectStats = useMemo(() => {
    const subjectProgress = progress.filter((p: any) => p.classId === currentClass && p.subject === activeSubject);
    const completed = subjectProgress.filter((p: any) => p.status === 'completed').length;
    const revision = subjectProgress.filter((p: any) => p.status === 'revision_pending').length;
    const active = subjectProgress.filter((p: any) => p.status === 'in_progress').length;
    return {
      completed,
      revision,
      active,
      total: chapters.length,
      percent: Math.round((completed / chapters.length) * 100)
    };
  }, [currentClass, activeSubject, progress, chapters]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex justify-center gap-2 mb-6">
        {SUBJECTS.filter(s => s !== 'General').map(s => (
          <button
            key={s}
            onClick={() => setActiveSubject(s)}
            className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border transition-all rounded-lg ${activeSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={`mb-10 p-8 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="text-[10px] font-semibold uppercase text-zinc-500 tracking-[0.06em] mb-1 font-ui">Subject Mastery</h3>
            <p className="text-2xl font-black italic font-ui">{activeSubject.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl num-stat">{subjectStats.completed}<span className="text-zinc-500 text-sm not-italic ml-1 font-ui">/ {subjectStats.total}</span></p>
            <p className="text-[9px] font-bold uppercase text-zinc-600 font-ui">Chapters Completed</p>
          </div>
        </div>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
          <div
            className="h-full bg-[#E10600] transition-all duration-700"
            style={{ width: `${subjectStats.percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {chapters.map(chapter => {
          const prog = progress.find((p: any) => p.classId === currentClass && p.subject === activeSubject && p.chapter === chapter);
          const status = prog?.status || 'not_started';
          const colors = STATUS_COLORS[status as SyllabusStatus];

          return (
            <div
              key={chapter}
              onClick={() => onToggle(currentClass, activeSubject, chapter)}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] flex flex-col justify-between min-h-[120px] card-interactive ${colors.border} ${colors.bg} ${theme === 'dark' ? '' : 'shadow-sm'}`}
            >
              <div>
                <div className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-2 px-2 py-0.5 rounded border w-fit ${colors.label}`}>
                  {STATUS_LABELS[status as SyllabusStatus]}
                </div>
                <h4 className={`text-[11px] md:text-xs font-black uppercase leading-tight tracking-tight ${theme === 'dark' ? 'text-zinc-100' : 'text-black'}`}>
                  {chapter}
                </h4>
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">TAP TO CYCLE</p>
                <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MonthlyHeatmap = ({ logs, dailyGoalHours, theme }: { logs: DailyLog[], dailyGoalHours: number, theme: 'dark' | 'light' }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setSelectedDay(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: startOffset }, (_, i) => i);

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const getDayColor = (hours: number) => {
    if (hours === 0) return theme === 'dark' ? 'bg-[#1F1F23] border border-[#2A2A2E]' : 'bg-zinc-50 border border-zinc-200';
    const percent = (hours / dailyGoalHours) * 100;
    if (percent < 30) return theme === 'dark' ? 'bg-red-900/20' : 'bg-red-100';
    if (percent < 60) return theme === 'dark' ? 'bg-red-900/50' : 'bg-red-300';
    if (percent < 90) return 'bg-[#E10600]/70';
    return 'bg-[#E10600]';
  };

  return (
    <div className={`p-8 md:p-10 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.06em] text-zinc-500">
          Monthly Heatmap
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&lt;</button>
          <span className="text-xs md:text-sm font-black uppercase w-32 text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&gt;</button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="grid grid-cols-7 gap-[3px] md:gap-1 mb-1 w-fit">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[8px] md:text-[10px] font-black text-zinc-600 uppercase w-6 md:w-8">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[3px] md:gap-1 w-fit">
          {blanksArray.map(b => (
            <div key={`blank-${b}`} className="w-6 h-6 md:w-8 md:h-8 rounded-sm opacity-0" />
          ))}
          {daysArray.map(day => {
            const formattedMonth = String(month + 1).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            const dayLogs = logs.filter(l => l.date === dateStr);
            const totalHours = dayLogs.reduce((sum, l) => sum + l.hours, 0);
            const avgQuality = dayLogs.length > 0 ? (dayLogs.reduce((sum, l) => sum + l.quality, 0) / dayLogs.length).toFixed(1) : '0';
            const sessions = dayLogs.length;
            const metGoal = totalHours >= dailyGoalHours;

            const isSelected = selectedDay === dateStr;

            return (
              <div
                key={day}
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDay(isSelected ? null : dateStr);
                }}
              >
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-sm md:rounded-md transition-all duration-300 ${getDayColor(totalHours)} ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`} />

                {/* Tooltip */}
                <div className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-48 p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white transition-opacity duration-200 z-[90] shadow-xl pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                  <p className="text-[10px] font-black uppercase text-[#E10600] mb-2">{dateStr}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Hours Base:</span>
                      <span className="font-black">{totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Sessions:</span>
                      <span className="font-black">{sessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Avg Quality:</span>
                      <span className="font-black">{avgQuality}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-center text-[9px] font-medium uppercase tracking-[0.06em]">
                      {totalHours > 0 ? (metGoal ? <span className="text-green-500">Goal Met</span> : <span className="text-yellow-500">Below Goal</span>) : <span className="text-zinc-600">No Activity</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StreakTab = ({
  streak,
  logs,
  dailyGoalHours,
  theme,
  dailyQuestionsLog,
}: {
  streak: number;
  logs: DailyLog[];
  dailyGoalHours: number;
  theme: 'dark' | 'light';
  dailyQuestionsLog?: DailyQuestionsLog[];
}) => {
  const days = getLast7DaysStats(logs);
  const maxHours = Math.max(1, ...days.map(d => d.hours || 0)); // avoid divide‑by‑zero

  return (
    <div className="space-y-14 animate-in fade-in duration-500">
      {/* Current streak card */}
      <div className={`text-center py-16 md:py-24 rounded-2xl border ${theme === 'dark' ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-200 bg-zinc-50'}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 mb-6 font-ui">
          Current Streak
        </p>
        <h2 className={`text-[120px] md:text-[160px] tracking-tighter num-hero ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {streak}
        </h2>
        <div className="accent-line mt-4 mb-6" />
        <p className="text-sm font-medium tracking-wide text-zinc-600 mt-2 font-ui">
          days of undivided focus
        </p>
      </div>

      {/* 7‑day focus hours graph */}
      <div
        className={`p-8 md:p-10 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'
          }`}
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 mb-6 font-ui">
          PAST 7 DAYS ACTIVITY
        </h3>
        <div className="flex items-end justify-between h-40 gap-2 md:gap-3">
          {days.map((d, i) => {
            const heightPct = Math.min(100, (d.hours / maxHours) * 100);
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-1 md:gap-2 h-full">
                <div className="flex items-end h-full w-full">
                  <div
                    className="w-full rounded-t-md transition-all duration-700 bg-[#E10600]"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500">
                  {d.date}
                </span>
                <span className="text-[9px] font-black text-zinc-400">
                  {d.hours.toFixed(1)}h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <MonthlyHeatmap logs={logs} dailyGoalHours={dailyGoalHours} theme={theme} />

      {/* Question Analytics */}
      {dailyQuestionsLog && dailyQuestionsLog.length > 0 && (
        <>
          <QuestionsBarChart dailyQuestionsLog={dailyQuestionsLog} theme={theme} />
          <QuestionsHeatmap dailyQuestionsLog={dailyQuestionsLog} theme={theme} />
        </>
      )}
    </div>
  );
};

const ReviewTab = ({ logs, score, onClearData, theme, user, onOpenAuth, onSignOut, onLog, dailyQuestionsLog }: any) => {
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
        <div className={`md:col-span-2 p-10 md:p-14 rounded-2xl border flex flex-col justify-center items-center text-center relative overflow-hidden ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-200'}`}>
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
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Total Hours Logged</p>
            <p className="text-3xl num-stat">{logs.reduce((a: any, b: any) => a + b.hours, 0).toFixed(1)}H</p>
          </div>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Total Sessions</p>
            <p className="text-3xl num-stat">{logs.length}</p>
          </div>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-bold text-zinc-600 uppercase mb-2 font-ui">Avg Quality</p>
            <p className="text-3xl num-stat">
              {logs.length > 0 ? (logs.reduce((a: any, b: any) => a + b.quality, 0) / logs.length).toFixed(1) : '0.0'}
            </p>
          </div>
        </div>
      </div>

      <div className={`p-8 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase font-ui">Account & Privacy</h4>
          <p className="text-[11px] text-zinc-500 font-bold mt-1">
            {user ? `ENROLLED AS: ${user.email.toUpperCase()}` : 'OFFLINE MODE: PROGRESS STORED ON DEVICE ONLY.'}
          </p>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          {user ? (
            <button
              onClick={onSignOut}
              className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all rounded-xl"
            >
              Log Out
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white hover:bg-red-700 transition-all rounded-xl"
            >
              Sign In to Sync
            </button>
          )}
          <button
            onClick={onClearData}
            className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] border border-red-900/40 text-red-500/70 hover:bg-red-900/10 hover:text-red-500 transition-all rounded-xl"
          >
            Reset Device
          </button>
        </div>
      </div>

      <div className={`p-8 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
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

      <form onSubmit={handleManualLog} className={`p-8 rounded-2xl border flex flex-col gap-6 ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}>
        <h4 className="text-sm font-bold uppercase font-ui">Manual Log</h4>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-black tracking-[0.06em] text-zinc-500">Subject</label>
            <select
              value={manualSubject}
              onChange={(e) => setManualSubject(e.target.value as Subject)}
              className={`p-3 rounded-lg border text-sm font-black uppercase focus:outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Maths">Maths</option>
              <option value="General">General</option>
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
              className={`p-3 rounded-lg border text-sm font-black uppercase focus:outline-none ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white placeholder-zinc-800' : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'}`}
            />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <label className="text-[10px] uppercase font-black tracking-[0.06em] text-zinc-500">Quality (1-5)</label>
            <select
              value={manualQuality}
              onChange={(e) => setManualQuality(parseInt(e.target.value))}
              className={`p-3 rounded-lg border text-sm font-black uppercase focus:outline-none cursor-pointer ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
            >
              {[1, 2, 3, 4, 5].map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-0.5">
            <button type="submit" className="w-full md:w-auto px-10 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-lg hover:bg-red-700 transition-all active:scale-95">
              Add Log
            </button>
          </div>
        </div>
      </form>


    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('locked_in_state_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_STATE, ...parsed };
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return DEFAULT_STATE;
  });

  const [user, setUser] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(state.lastUsedTab);

  const isInitialSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const stateRef = useRef(state);
  const preventSyncOnUpdate = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Handle Auth and Initial Fetch
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) handleInitialSync(u.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser && !isInitialSyncDone.current) handleInitialSync(newUser.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // REALTIME LISTENER
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const remoteState = payload.new.state as AppState;
          if (remoteState && remoteState.lastUpdated > stateRef.current.lastUpdated) {
            console.log("Realtime Sync: Updating local state from cloud.");
            preventSyncOnUpdate.current = true;
            setState(prev => ({
              ...prev,
              ...remoteState,
              // Keep UI only state local
              lastUsedTab: prev.lastUsedTab,
              theme: prev.theme
            }));
            setTimeout(() => { preventSyncOnUpdate.current = false; }, 200);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleInitialSync = async (userId: string) => {
    if (isInitialSyncDone.current) return;
    setSyncStatus('syncing');
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('state')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && data.state) {
        const remoteState = data.state as AppState;

        setState(localState => {
          preventSyncOnUpdate.current = true;

          const cloudIsNewer = (remoteState.lastUpdated || 0) >= (localState.lastUpdated || 0);

          if (cloudIsNewer) {
            // Cloud is the source of truth for cross‑device consistency.
            // This ensures server-side deletions (like task removal) propagate everywhere.
            return {
              ...localState,
              ...remoteState,
              // Preserve UI‑only preferences from the current device.
              lastUsedTab: localState.lastUsedTab,
              theme: localState.theme,
            };
          }

          // Local is newer: merge in any unique remote logs/tasks without resurrecting deletions.
          const mergedLogs = [...localState.logs];
          remoteState.logs.forEach(l => {
            if (!mergedLogs.some(rl => rl.id === l.id)) mergedLogs.push(l);
          });

          const mergedTasks = [...localState.tasks];
          remoteState.tasks.forEach(t => {
            if (!mergedTasks.some(rt => rt.id === t.id)) mergedTasks.push(t);
          });

          return {
            ...localState,
            ...remoteState,
            logs: mergedLogs,
            tasks: mergedTasks,
            lastUpdated: localState.lastUpdated,
            // Preserve UI‑only preferences from the current device.
            lastUsedTab: localState.lastUsedTab,
            theme: localState.theme,
          };
        });
      }
      isInitialSyncDone.current = true;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Initial Sync Error:', err);
      setSyncStatus('error');
    } finally {
      setTimeout(() => { preventSyncOnUpdate.current = false; }, 200);
    }
  };

  const triggerSync = async () => {
    if (!user || !isInitialSyncDone.current || preventSyncOnUpdate.current) return;

    if (isSyncingRef.current) {
      pendingSyncRef.current = true;
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');

    try {
      const newState = { ...stateRef.current, lastUpdated: Date.now() };
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, state: newState, updated_at: new Date() });

      if (error) throw error;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Cloud Sync Failed:', err);
      setSyncStatus('error');
    } finally {
      isSyncingRef.current = false;
      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        triggerSync();
      }
    }
  };

  useEffect(() => {
    localStorage.setItem('locked_in_state_v2', JSON.stringify(state));
    if (user && isInitialSyncDone.current && !preventSyncOnUpdate.current) {
      triggerSync();
    }
  }, [state, user]);

  const handleSignOut = async () => {
    if (window.confirm("SIGN OUT? Your session data on this device will be cleared for security. Your cloud record is safe.")) {
      try {
        preventSyncOnUpdate.current = true;
        await supabase.auth.signOut();
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        localStorage.removeItem('locked_in_state_v2');
        setState(DEFAULT_STATE);
        setActiveTab('Today');
        window.location.href = window.location.origin;
      } catch (err) {
        localStorage.clear();
        window.location.href = window.location.origin;
      }
    }
  };

  const theme = state.theme || 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#0B0B0D' : '#FFFFFF';
    document.body.style.color = theme === 'dark' ? '#FFFFFF' : '#000000';
  }, [theme]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setState(prev => ({ ...prev, lastUsedTab: tab }));
  };

  const logStudy = (subject: Subject, hours: number, quality: number, distractions: number) => {
    if (hours <= 0) return;
    const today = getISTDateString();
    setState(prev => {
      const newLog: DailyLog = {
        id: generateId(),
        date: today,
        subject,
        hours: parseFloat(hours.toFixed(2)),
        quality: quality,
        distractions: distractions
      };
      const nextState = { ...prev, logs: [...prev.logs, newLog], lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const deleteLog = (id: string) => {
    if (window.confirm("ERASE SESSION? This cannot be undone.")) {
      setState(prev => {
        const nextState = {
          ...prev,
          logs: prev.logs.filter(log => log.id !== id),
          lastUpdated: Date.now()
        };
        stateRef.current = nextState;
        return nextState;
      });
    }
  };

  const toggleChapterStatus = (classId: 11 | 12, subject: Subject, chapter: string) => {
    setState(prev => {
      const existing = prev.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const currentStatus = existing ? existing.status : 'not_started';
      const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      const filteredProgress = prev.progress.filter(p => !(p.classId === classId && p.subject === subject && p.chapter === chapter));
      const nextState = {
        ...prev,
        progress: [...filteredProgress, { classId, subject, chapter, status: nextStatus, notes: existing?.notes }],
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const updateTimer = (timerUpdate: Partial<TimerState>) => {
    setState(prev => {
      const nextState = { ...prev, timer: { ...prev.timer!, ...timerUpdate } };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const addTask = (text: string, subject: Subject | 'General') => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: [...prev.tasks, { id: generateId(), text, completed: false, subject }],
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const toggleTask = (id: string) => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t),
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const deleteTask = (id: string) => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== id),
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const updateDailyGoal = (val: number) => {
    setState(prev => {
      const nextState = { ...prev, dailyGoalHours: val, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const updateQuestionTracking = (update: Partial<QuestionTrackingState>) => {
    setState(prev => {
      const nextState = {
        ...prev,
        questionTracking: { ...prev.questionTracking, ...update },
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const logQuestions = (subject: QSubject, count: number) => {
    const today = getISTDateString();
    setState(prev => {
      const logs = [...prev.questionTracking.dailyQuestionsLog];
      const idx = logs.findIndex(l => l.date === today);
      if (idx >= 0) {
        const updated = { ...logs[idx] };
        if (subject === 'physics') updated.physicsCount += count;
        else if (subject === 'chemistry') updated.chemistryCount += count;
        else updated.mathCount += count;
        logs[idx] = updated;
      } else {
        logs.push({
          date: today,
          physicsCount: subject === 'physics' ? count : 0,
          chemistryCount: subject === 'chemistry' ? count : 0,
          mathCount: subject === 'math' ? count : 0,
        });
      }
      const nextState = {
        ...prev,
        questionTracking: { ...prev.questionTracking, dailyQuestionsLog: logs },
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const clearLogs = () => {
    if (window.confirm("FACTORY RESET DEVICE? This will wipe ALL local progress. If you are signed in, cloud data remains.")) {
      localStorage.removeItem('locked_in_state_v2');
      setState(DEFAULT_STATE);
      setActiveTab('Today');
    }
  };

  const daysRemaining = getDaysRemaining(JEE_2027_DATE);
  const streakCount = calculateStreak(state.logs);
  const lockInScore = calculateLockInScore(state.logs, state.currentClass, state.progress);
  const isCurrentlyLockInActive = state.timer.isLockInActive;

  return (
    <div className={`min-h-screen relative selection:bg-[#E10600] selection:text-white transition-colors duration-300 ${isCurrentlyLockInActive ? 'bg-black' : (theme === 'dark' ? 'bg-[#0B0B0D] text-white' : 'bg-white text-black')}`}>
      {!isCurrentlyLockInActive && (
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} isLockInActive={isCurrentlyLockInActive} theme={theme} />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        theme={theme}
        onAuthSuccess={() => {
          isInitialSyncDone.current = false;
          setSyncStatus('syncing');
        }}
      />

      <div className={`transition-all duration-300 ${isCurrentlyLockInActive ? '' : 'md:ml-[200px] pt-14 md:pt-0'}`}>
        {!isCurrentlyLockInActive && (
          <Header
            currentClass={state.currentClass}
            onClassChange={(c) => setState(p => ({ ...p, currentClass: c }))}
            daysRemaining={daysRemaining}
            theme={theme}
            onToggleTheme={() => setState(p => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
            installPrompt={null}
            onInstall={() => { }}
            syncStatus={syncStatus}
            user={user}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            logs={state.logs}
          />
        )}

        <main className={`max-w-5xl mx-auto w-full relative z-20 ${isCurrentlyLockInActive ? 'p-0' : 'px-4 md:px-6 py-8 pb-16'}`}>
          {activeTab === 'Today' && (
            <TodayTab
              state={state}
              onLog={logStudy}
              onDeleteLog={deleteLog}
              onTimerUpdate={updateTimer}
              onToggleLockInMode={(val: boolean) => setState(p => ({ ...p, isLockInModeEnabled: val }))}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onUpdateDailyGoal={updateDailyGoal}
              theme={theme}
            />
          )}
          {!isCurrentlyLockInActive && activeTab === 'Syllabus' && (
            <SyllabusTab
              currentClass={state.currentClass}
              progress={state.progress}
              onToggle={toggleChapterStatus}
              theme={theme}
            />
          )}
          {!isCurrentlyLockInActive && activeTab === 'Streak' && <StreakTab streak={streakCount} logs={state.logs} dailyGoalHours={state.dailyGoalHours} theme={theme} dailyQuestionsLog={state.questionTracking.dailyQuestionsLog} />}
          {!isCurrentlyLockInActive && activeTab === 'Questions' && (
            <QuestionsTab
              questionTracking={state.questionTracking}
              onUpdateTracking={updateQuestionTracking}
              onLogQuestions={logQuestions}
              theme={theme}
            />
          )}
          {!isCurrentlyLockInActive && activeTab === 'Review' && (
            <ReviewTab
              logs={state.logs}
              score={lockInScore}
              onClearData={clearLogs}
              theme={theme}
              user={user}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onSignOut={handleSignOut}
              onLog={logStudy}
              dailyQuestionsLog={state.questionTracking.dailyQuestionsLog}
            />
          )}
        </main>
      </div>
    </div>
  );
};

const TodayTab = ({
  state,
  onLog,
  onDeleteLog,
  onTimerUpdate,
  onToggleLockInMode,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateDailyGoal,
  theme
}: any) => {
  const { timer, tasks, isLockInModeEnabled, logs, dailyGoalHours } = state;
  const [manualSubject, setManualSubject] = useState<Subject>('Physics');
  const [quality, setQuality] = useState(4);
  const [showWarning, setShowWarning] = useState(false);
  const [showBreach, setShowBreach] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [wipeHoldStart, setWipeHoldStart] = useState<number | null>(null);
  const [wipeProgress, setWipeProgress] = useState(0);

  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  const REQUIRED_FOCUS_MS = 15 * 60 * 1000;
  const WIPE_HOLD_MS = 15000;

  const [currentDisplayMs, setCurrentDisplayMs] = useState(0);

  useEffect(() => {
    let interval: number;
    if (timer.isRunning && timer.startTime) {
      interval = window.setInterval(() => {
        setCurrentDisplayMs(Date.now() - timer.startTime! + timer.accumulatedMs);
      }, 100);
    } else {
      setCurrentDisplayMs(timer.accumulatedMs);
    }
    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startTime, timer.accumulatedMs]);

  useEffect(() => {
    if (timer.isLockInActive) {
      const handleFsChange = () => {
        if (!document.fullscreenElement) {
          onTimerUpdate({
            isRunning: false,
            accumulatedMs: Date.now() - (timerRef.current.startTime || Date.now()) + timerRef.current.accumulatedMs,
            startTime: null,
            distractions: (timerRef.current.distractions || 0) + 1
          });
          setShowBreach(true);
        }
      };
      document.addEventListener('fullscreenchange', handleFsChange);
      return () => document.removeEventListener('fullscreenchange', handleFsChange);
    }
  }, [timer.isLockInActive, onTimerUpdate]);

  useEffect(() => {
    if (timer.isLockInActive) {
      const qInterval = setInterval(() => setQuoteIdx(p => (p + 1) % LOCK_IN_QUOTES.length), 10000);
      return () => clearInterval(qInterval);
    }
  }, [timer.isLockInActive]);

  useEffect(() => {
    let interval: number;
    if (wipeHoldStart !== null) {
      interval = window.setInterval(() => {
        const elapsed = Date.now() - wipeHoldStart;
        const progress = Math.min((elapsed / WIPE_HOLD_MS) * 100, 100);
        setWipeProgress(progress);
        if (elapsed >= WIPE_HOLD_MS) {
          handleWipeSession();
        }
      }, 100);
    } else {
      setWipeProgress(0);
    }
    return () => clearInterval(interval);
  }, [wipeHoldStart]);

  const handleStartTimer = async () => {
    if (isLockInModeEnabled) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        alert("LOCK-IN REQUIREMENT: Fullscreen access is mandatory.");
        return;
      }
    }
    onTimerUpdate({ isRunning: true, startTime: Date.now(), subject: manualSubject, isLockInActive: isLockInModeEnabled });
  };

  const handleStopTimer = () => {
    const currentTimer = timerRef.current;
    if (!currentTimer.startTime && !currentTimer.accumulatedMs) return;
    const finalMs = (currentTimer.isRunning ? Date.now() - (currentTimer.startTime || Date.now()) : 0) + currentTimer.accumulatedMs;
    onLog(currentTimer.subject, finalMs / (1000 * 60 * 60), quality, currentTimer.distractions || 0);
    onTimerUpdate({ isRunning: false, startTime: null, accumulatedMs: 0, isLockInActive: false, distractions: 0 });
    if (document.fullscreenElement) document.exitFullscreen();
    setShowBreach(false);
  };

  const handleWipeSession = () => {
    onTimerUpdate({ isRunning: false, startTime: null, accumulatedMs: 0, isLockInActive: false, distractions: 0 });
    if (document.fullscreenElement) document.exitFullscreen();
    setWipeHoldStart(null);
    setShowBreach(false);
  };

  const handleResumeBreach = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setShowBreach(false);
      onTimerUpdate({ isRunning: true, startTime: Date.now() });
    } catch (err) {
      alert("CRITICAL: Fullscreen required to resume focus.");
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const todayLogs = useMemo(() =>
    logs.filter((l: any) => l.date === getISTDateString()).reverse(),
    [logs]);

  const totalToday = todayLogs.reduce((a: any, b: any) => a + b.hours, 0);
  const progressPercent = Math.min((totalToday / dailyGoalHours) * 100, 100);
  const subjectDist = getSubjectDistribution(logs);

  const canEndSession = currentDisplayMs >= REQUIRED_FOCUS_MS;
  const timeRemainingToEnd = Math.max(0, REQUIRED_FOCUS_MS - currentDisplayMs);

  if (timer.isLockInActive) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center p-4 md:p-8 select-none overflow-hidden font-mono">
        {showBreach && (
          <div className="absolute inset-0 z-[10000] bg-black flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
            <h2 className="text-3xl md:text-5xl tracking-tighter mb-4 text-[#E10600] font-display">SESSION BREACHED</h2>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.06em] text-[10px] md:text-xs mb-8 text-center font-ui">Focus interrupted. Session paused. 1 Distraction recorded.</p>
            <button
              onClick={handleResumeBreach}
              className="px-12 py-6 bg-white text-black font-black uppercase tracking-[0.4em] rounded-xl hover:bg-zinc-200 transition-all"
            >
              RESUME FOCUS
            </button>
            <div className="mt-12 relative flex flex-col items-center">
              <button
                onMouseDown={() => setWipeHoldStart(Date.now())}
                onMouseUp={() => setWipeHoldStart(null)}
                onMouseLeave={() => setWipeHoldStart(null)}
                onTouchStart={() => setWipeHoldStart(Date.now())}
                onTouchEnd={() => setWipeHoldStart(null)}
                className="text-[10px] font-black uppercase text-zinc-700 hover:text-red-500 transition-colors py-2"
              >
                {wipeHoldStart ? `WIPING IN ${(15 - (wipeProgress * 15 / 100)).toFixed(1)}s` : 'HOLD FOR 15s TO DISCARD SESSION'}
              </button>
              {wipeProgress > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 transition-all" style={{ width: `${wipeProgress}%` }} />
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900 via-transparent to-transparent" />
        <div className="absolute top-12 left-0 right-0 text-center px-4">
          <p className="text-[10px] text-[#E10600] uppercase tracking-[0.5em] md:tracking-[0.8em] mb-2 font-ui font-bold">ACTIVE FOCUS SESSION</p>
          <p className="text-[12px] md:text-[14px] text-zinc-600 uppercase font-bold font-ui">{LOCK_IN_QUOTES[quoteIdx]}</p>
        </div>

        <p className="text-[18vw] md:text-[10vw] text-white tabular-nums tracking-tight leading-none num-timer">{formatTime(currentDisplayMs)}</p>
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-[10px] md:text-[12px] text-zinc-600 uppercase tracking-[0.3em] font-bold font-ui">{timer.subject} — DEEP FOCUS</p>
          {(timer.distractions || 0) > 0 && <p className="text-[8px] text-[#E10600] font-bold uppercase tracking-[0.06em] font-ui">{timer.distractions} BREACH(ES) RECORDED</p>}
        </div>

        <div className="mt-8 md:mt-12 w-full max-w-xs flex flex-col items-center gap-4">
          <button
            disabled={!canEndSession}
            onClick={handleStopTimer}
            className={`w-full py-6 md:py-8 font-black uppercase tracking-[0.4em] md:tracking-[0.6em] border-2 transition-all rounded-xl active:scale-95 ${canEndSession ? 'bg-white text-black border-white hover:bg-transparent hover:text-white shadow-[0_0_50px_rgba(255,255,255,0.05)]' : 'bg-zinc-900 text-zinc-700 border-zinc-800 opacity-50 cursor-not-allowed'}`}
          >
            {canEndSession ? 'SESSION FINISHED' : `LOCK-OUT: ${formatTime(timeRemainingToEnd)}`}
          </button>

          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min((currentDisplayMs / REQUIRED_FOCUS_MS) * 100, 100)}%` }} />
          </div>

          <div className="relative w-full mt-8 flex flex-col items-center">
            <button
              onMouseDown={() => setWipeHoldStart(Date.now())}
              onMouseUp={() => setWipeHoldStart(null)}
              onMouseLeave={() => setWipeHoldStart(null)}
              onTouchStart={() => setWipeHoldStart(Date.now())}
              onTouchEnd={() => setWipeHoldStart(null)}
              className="text-[9px] font-medium uppercase text-zinc-800 hover:text-zinc-400 transition-colors py-2"
            >
              {wipeHoldStart ? `WIPING IN ${(15 - (wipeProgress * 15 / 100)).toFixed(1)}s` : 'HOLD FOR 15s TO WIPE SESSION'}
            </button>
            {wipeProgress > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 transition-all" style={{ width: `${wipeProgress}%` }} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 md:space-y-14 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!timer.isRunning && (
        <section className={`p-6 md:p-10 rounded-2xl border flex flex-col gap-8 md:gap-10 transition-all ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <div className="flex flex-row gap-6 md:gap-10 items-center w-full">
            <div className="relative w-20 h-20 md:w-32 md:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={theme === 'dark' ? 'text-zinc-900' : 'text-zinc-100'} />
                <circle cx="50" cy="50" r="42" stroke="#E10600" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * progressPercent) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base md:text-xl leading-none num-stat">{Math.round(progressPercent)}%</span>
                <span className="text-[8px] md:text-[10px] font-bold uppercase text-zinc-500 mt-1 font-ui">Goal</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-2xl md:text-4xl tracking-tighter leading-none num-stat">{totalToday.toFixed(1)}<span className="text-zinc-500 text-sm md:text-lg ml-2 font-ui font-bold">/ {dailyGoalHours}H</span></p>
              <div className="flex gap-2 mt-4 items-center">
                <div className="flex gap-1">
                  <button onClick={() => onUpdateDailyGoal(Math.max(1, dailyGoalHours - 1))} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">-</button>
                  <button onClick={() => onUpdateDailyGoal(dailyGoalHours + 1)} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">+</button>
                </div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider font-ui">Daily Target</span>
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            {(['Physics', 'Chemistry', 'Maths', 'General'] as Subject[]).map(s => (
              <div key={s} className={`p-3 md:p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
                <p className="text-[8px] md:text-[10px] font-bold uppercase text-zinc-500 mb-1 font-ui">{s.substring(0, 3)}</p>
                <p className="text-sm md:text-base num-stat">{subjectDist[s].toFixed(1)}h</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`p-10 md:p-20 text-center rounded-2xl border relative overflow-hidden transition-all ${timer.isRunning ? 'timer-active-bg' : (theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-zinc-50 border-zinc-100')}`}>
        {timer.isRunning && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full z-10" />}
        <p className="text-[10px] uppercase font-bold tracking-[0.06em] text-zinc-500 mb-10 font-ui relative z-10">{timer.isRunning ? `FOCUSED ON: ${timer.subject}` : 'CHOOSE SUBJECT TO BEGIN'}</p>
        <p className="text-[14vw] md:text-8xl tabular-nums leading-none num-timer relative z-10">{formatTime(currentDisplayMs)}</p>

        {!timer.isRunning ? (
          <>
            <div className="flex flex-wrap justify-center gap-3 mt-14">
              {(['Physics', 'Chemistry', 'Maths', 'General'] as Subject[]).map(s => (
                <button
                  key={s}
                  onClick={() => setManualSubject(s)}
                  className={`px-5 md:px-8 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] border rounded-lg transition-all ${manualSubject === s ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-300 text-zinc-500 hover:border-zinc-400')}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center mt-12 gap-6">
              <button
                onClick={handleStartTimer}
                className={`w-full max-sm:px-4 py-6 md:py-7 font-black uppercase tracking-[0.3em] md:tracking-[0.5em] transition-all active:scale-[0.98] shadow-md rounded-xl font-ui ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-100' : 'bg-black text-white hover:bg-zinc-900'}`}
              >
                START SESSION
              </button>
              <button
                onClick={() => isLockInModeEnabled ? onToggleLockInMode(false) : setShowWarning(true)}
                className={`text-[9px] font-bold uppercase tracking-[0.1em] px-8 py-2.5 rounded-full border transition-all ${isLockInModeEnabled ? 'bg-[#E10600] border-[#E10600] text-white' : (theme === 'dark' ? 'border-white/[0.08] text-zinc-500 hover:border-white/[0.14]' : 'border-zinc-300 text-zinc-500 hover:border-zinc-400')}`}
              >
                {isLockInModeEnabled ? '🔒 LOCK-IN ACTIVE' : '🔓 LOCK-IN DISABLED'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center gap-6 relative z-10">
            <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
              <span className="text-[10px] font-black uppercase text-zinc-500">Focus Quality:</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setQuality(v)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${quality >= v ? 'bg-[#E10600] text-white' : (theme === 'dark' ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-200 text-zinc-500')}`}>{v}</button>
                ))}
              </div>
            </div>
            <button
              onClick={handleStopTimer}
              className="w-full max-w-xs py-6 bg-[#E10600] text-white font-black uppercase tracking-[0.4em] hover:bg-red-700 transition-all active:scale-[0.98] rounded-xl font-ui"
            >
              END SESSION
            </button>
          </div>
        )}
      </section>

      <TaskSection tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} theme={theme} activeSubject={timer.isRunning ? timer.subject : null} />

      <section className="space-y-4">
        <div className="flex justify-between items-end pb-2">
          <h3 className={`text-[10px] uppercase font-semibold tracking-[0.06em] font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Session History (Today)</h3>
        </div>
        <div className="grid gap-3">
          {todayLogs.length === 0 ? (
            <p className="text-[10px] text-zinc-700 font-black uppercase py-4 text-center italic">No sessions recorded today.</p>
          ) : (
            todayLogs.map((l: any) => (
              <div key={l.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all group card-interactive ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
                <div>
                  <p className="text-[8px] font-black text-[#E10600] uppercase mb-0.5">{l.subject}</p>
                  <p className="text-base font-black italic">{l.hours}h <span className="text-[10px] not-italic text-zinc-500 font-bold ml-2">Q: {l.quality}/5</span></p>
                </div>
                <button
                  onClick={() => onDeleteLog(l.id)}
                  className="text-[10px] font-black uppercase text-zinc-600 hover:text-red-500 px-3 py-1 border border-zinc-800 rounded opacity-40 group-hover:opacity-100 transition-all"
                >
                  WIPE
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`max-w-md w-full p-6 md:p-10 border-2 rounded-2xl ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#E10600]' : 'bg-white border-[#E10600]'}`}>
            <h2 className="text-2xl font-black italic tracking-tighter mb-4 text-[#E10600]">ACTIVATE LOCK-IN?</h2>
            <div className="space-y-4 text-xs font-bold uppercase tracking-tight text-zinc-500 leading-relaxed">
              <p>1. FULLSCREEN IS MANDATORY.</p>
              <p>2. EXITING FULLSCREEN PAUSES THE TIMER AND RECORDS A BREACH.</p>
              <p>3. YOU MUST FOCUS FOR AT LEAST 15 MINUTES TO LOG THE SESSION.</p>
              <p>4. TAB SWITCHING IS DETECTED.</p>
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={() => { onToggleLockInMode(true); setShowWarning(false); }} className="flex-1 py-4 bg-white text-black font-black uppercase tracking-[0.06em] rounded-lg hover:bg-zinc-200">ENGAGE</button>
              <button onClick={() => setShowWarning(false)} className="flex-1 py-4 bg-zinc-900 text-zinc-500 font-black uppercase tracking-[0.06em] rounded-lg">ABORT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
