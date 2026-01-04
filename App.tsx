
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AppState, TabType, DailyLog, ChapterProgress, Subject, SyllabusStatus, TimerState, Task, SyncStatus } from './types';
import { SYLLABUS_DATA, STATUS_CYCLE, STATUS_COLORS, LOCK_IN_QUOTES, SUBJECTS, STATUS_LABELS } from './constants';
import { getISTDateString, getDaysRemaining, calculateStreak, calculateLockInScore, getLast7DaysStats, getSubjectDistribution } from './utils';
import { JEE_2027_DATE } from './constants';

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
  dailyGoalHours: 8
};

// --- Sub-components ---

const AuthModal = ({ isOpen, onClose, theme, onAuthSuccess }: { isOpen: boolean, onClose: () => void, theme: 'dark' | 'light', onAuthSuccess: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setSuccessMsg("CHECK YOUR EMAIL AND CONFIRM TO ACTIVATE CLOUD SYNC.");
        setEmail('');
        setPassword('');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthSuccess();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`max-w-md w-full p-8 md:p-10 border-2 rounded-2xl relative ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800' : 'bg-white border-zinc-200 shadow-2xl'}`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white font-black text-xl">×</button>
        <h2 className="text-2xl font-black italic tracking-tighter mb-2 text-[#E10600]">
          {mode === 'login' ? 'ACCESS ACCOUNT' : 'ENLIST NOW'}
        </h2>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-8 leading-relaxed">
          {mode === 'login' ? 'Resume your mission. Synchronize local progress.' : 'Create a permanent record. Enable cross-device persistence.'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Email Address</label>
            <input 
              type="email" 
              required
              placeholder="YOUR@EMAIL.COM" 
              className={`w-full p-4 text-xs font-bold uppercase border focus:outline-none focus:ring-1 focus:ring-[#E10600] transition-all ${theme === 'dark' ? 'bg-[#141417] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Secret Key (Password)</label>
            <input 
              type="password" 
              required
              placeholder="••••••••" 
              className={`w-full p-4 text-xs font-bold uppercase border focus:outline-none focus:ring-1 focus:ring-[#E10600] transition-all ${theme === 'dark' ? 'bg-[#141417] border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-5 mt-4 bg-[#E10600] text-white font-black uppercase tracking-[0.3em] hover:bg-red-700 transition-all rounded-xl disabled:opacity-50 shadow-lg shadow-red-900/20`}
          >
            {loading ? 'PROCESSING...' : (mode === 'login' ? 'LOGIN & SYNC' : 'CREATE ACCOUNT')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-zinc-900 text-center">
          <button 
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setSuccessMsg(null); setError(null); }}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-[#E10600] transition-colors"
          >
            {mode === 'login' ? "DON'T HAVE AN ACCOUNT? SIGN UP" : "ALREADY ENLISTED? LOG IN"}
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 border border-red-900/50 text-red-500 bg-red-500/5 text-[10px] font-black uppercase text-center animate-in zoom-in-95 duration-200">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mt-6 p-4 border border-green-900/50 text-green-500 bg-green-500/5 text-[10px] font-black uppercase text-center animate-in zoom-in-95 duration-200">
            {successMsg}
          </div>
        )}
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
  onOpenAuth
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
  onOpenAuth: () => void
}) => {
  const syncColors = {
    local: 'text-zinc-600',
    syncing: 'text-yellow-500 animate-pulse',
    synced: 'text-green-500',
    error: 'text-red-500'
  };

  return (
    <div className={`pt-8 pb-4 border-b relative z-20 ${theme === 'dark' ? 'border-[#1F1F23]' : 'border-zinc-200'}`}>
      <div className="max-w-5xl mx-auto flex justify-between items-start mb-2 px-6">
        <div className="relative">
          <h1 className={`text-xl md:text-2xl font-black tracking-tighter italic flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
            LOCK IN
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
            <p className={`text-[10px] md:text-xs uppercase tracking-widest font-bold ${theme === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-500'}`}>
              JEE '27: <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{daysRemaining}d REMAINING</span>
            </p>
            <div className={`text-[8px] font-black uppercase tracking-tighter flex items-center gap-1.5 ${syncColors[syncStatus]}`}>
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
              className={`text-[10px] font-black uppercase px-3 py-1 rounded border bg-[#E10600] border-[#E10600] text-white hover:bg-red-700 transition-all`}
            >
              INSTALL
            </button>
          )}
          <button 
            onClick={onToggleTheme}
            className={`p-2 rounded border transition-all flex items-center justify-center ${theme === 'dark' ? 'bg-[#1F1F23] border-[#2F2F33] text-white hover:border-[#E10600]' : 'bg-zinc-100 border-zinc-200 text-black hover:border-[#E10600]'}`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button 
            onClick={() => onClassChange(currentClass === 11 ? 12 : 11)}
            className={`text-[10px] font-black uppercase px-3 py-1 rounded border transition-colors ${theme === 'dark' ? 'bg-[#1F1F23] border-[#2F2F33] text-white hover:border-[#E10600]' : 'bg-zinc-100 border-zinc-200 text-black hover:border-[#E10600]'}`}
          >
            C-{currentClass} ▾
          </button>
        </div>
      </div>
    </div>
  );
};

const Navbar = ({ activeTab, onTabChange, isLockInActive, theme }: { activeTab: TabType, onTabChange: (t: TabType) => void, isLockInActive: boolean, theme: 'dark' | 'light' }) => {
  if (isLockInActive) return null; 
  const tabs: TabType[] = ['Today', 'Syllabus', 'Streak', 'Review'];
  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t z-50 transition-colors ${theme === 'dark' ? 'bg-[#0B0B0D]/80 backdrop-blur-md border-[#1F1F23]' : 'bg-white/80 backdrop-blur-md border-zinc-200 shadow-lg'}`}>
      <div className="max-w-5xl mx-auto flex justify-around items-center h-16 safe-area-inset-bottom">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === tab ? 'scale-110' : 'opacity-40 hover:opacity-100'}`}
          >
            <span className={`text-[10px] uppercase tracking-[0.2em] font-black ${activeTab === tab ? 'text-[#E10600]' : (theme === 'dark' ? 'text-white' : 'text-black')}`}>
              {tab}
            </span>
            {activeTab === tab && <div className="w-1 h-1 rounded-full bg-[#E10600]" />}
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
        <div className="flex justify-between items-end mb-4 border-b border-zinc-800 pb-2">
           <h3 className={`text-[10px] uppercase font-black tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>FOCUS TASKS</h3>
        </div>
      )}
      
      {!minimal && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {(['General', 'Physics', 'Chemistry', 'Maths'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`text-[9px] px-3 py-1.5 font-black uppercase border transition-all ${selectedSubject === s ? 'bg-[#E10600] text-white border-[#E10600]' : (theme === 'dark' ? 'border-[#1F1F23] text-zinc-600' : 'border-zinc-200 text-zinc-400')}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={`ADD ${selectedSubject.toUpperCase()} TASK...`} 
              className={`flex-1 text-xs p-3 md:p-4 focus:outline-none focus:ring-1 focus:ring-[#E10600] font-bold uppercase border transition-colors ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#2F2F33] text-white' : 'bg-zinc-50 border-zinc-200 text-black'}`}
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
          <div className={`col-span-full py-8 text-center border border-dashed rounded-lg ${theme === 'dark' ? 'border-zinc-900 text-zinc-700' : 'border-zinc-200 text-zinc-300'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest italic">No Pending Tasks</p>
          </div>
        ) : filteredTasks.map((task: any) => (
          <div 
            key={task.id} 
            className={`flex items-start gap-4 p-4 border rounded-lg transition-all group ${task.completed ? 'opacity-30' : 'hover:border-[#E10600]'} ${theme === 'dark' ? 'border-[#1F1F23] bg-[#141417]' : 'border-zinc-100 bg-white shadow-sm'}`}
          >
            <button 
              onClick={() => onToggleTask(task.id)}
              className={`mt-1 w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all ${task.completed ? 'bg-[#E10600] border-[#E10600]' : 'border-zinc-700'}`}
            >
              {task.completed && <div className="w-2 h-2 bg-white rounded-sm" />}
            </button>
            <div className="flex-1">
               <span className={`text-[8px] font-black uppercase tracking-widest block mb-0.5 ${task.subject === 'General' ? 'text-zinc-600' : 'text-[#E10600]'}`}>{task.subject}</span>
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
        {SUBJECTS.map(s => (
          <button
            key={s}
            onClick={() => setActiveSubject(s)}
            className={`px-4 md:px-6 py-2 text-[10px] font-black uppercase tracking-widest border transition-all rounded-lg ${activeSubject === s ? 'bg-[#E10600] border-[#E10600] text-white shadow-lg shadow-red-900/20' : (theme === 'dark' ? 'border-[#1F1F23] text-zinc-500 hover:border-zinc-700' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={`mb-8 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-end mb-4">
          <div>
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">Subject Mastery</h3>
            <p className="text-2xl font-black italic">{activeSubject.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black italic">{subjectStats.completed}<span className="text-zinc-500 text-sm not-italic ml-1">/ {subjectStats.total}</span></p>
            <p className="text-[9px] font-black uppercase text-zinc-600">Chapters Completed</p>
          </div>
        </div>
        <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
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
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.98] flex flex-col justify-between min-h-[120px] ${colors.border} ${colors.bg} ${theme === 'dark' ? '' : 'shadow-sm'}`}
            >
              <div>
                <div className={`text-[8px] font-black uppercase tracking-widest mb-2 px-2 py-0.5 rounded border w-fit ${colors.label}`}>
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

const StreakTab = ({ streak, logs, theme }: { streak: number, logs: DailyLog[], theme: 'dark' | 'light' }) => {
  const days = getLast7DaysStats(logs);
  
  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="text-center py-10 md:py-16 rounded-3xl border-2 border-dashed border-[#E10600] bg-[#E10600]/5">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#E10600] mb-4">CURRENT STREAK</p>
         <h2 className="text-8xl md:text-9xl font-black italic tracking-tighter text-white drop-shadow-[0_0_30px_rgba(225,6,0,0.4)]">
           {streak}
         </h2>
         <p className="text-sm font-bold uppercase tracking-widest text-zinc-500 mt-4">DAYS OF UNDIVIDED FOCUS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className={`p-8 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-8">PAST 7 DAYS ACTIVITY</h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {days.map((d, i) => (
              <div key={i} className="flex flex-col items-center flex-1 gap-2">
                <div 
                  className="w-full bg-[#E10600] rounded-t transition-all duration-1000" 
                  style={{ height: `${Math.min(100, (d.hours / 12) * 100)}%` }} 
                />
                <span className="text-[10px] font-black uppercase text-zinc-600">{d.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`p-8 rounded-2xl border flex flex-col justify-center text-center ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#E10600] mb-4">CONSISTENCY ADVICE</p>
          <p className="text-base md:text-lg font-black italic leading-tight">
            "YOU DON'T NEED MOTIVATION. YOU NEED DISCIPLINE. SHOW UP EVEN WHEN YOU FEEL LIKE QUITTING."
          </p>
        </div>
      </div>
    </div>
  );
};

const ReviewTab = ({ logs, score, onClearData, theme, user, onOpenAuth, onSignOut }: any) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`md:col-span-2 p-8 md:p-12 rounded-3xl border-2 flex flex-col justify-center items-center text-center relative overflow-hidden ${theme === 'dark' ? 'bg-black border-zinc-800' : 'bg-white border-zinc-200'}`}>
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mb-6">COMPOSITE PERFORMANCE</p>
          <h2 className="text-9xl font-black italic tracking-tighter leading-none mb-4">{score}</h2>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400">LOCK-IN SCORE / 100</p>
          
          <div className="w-full max-w-xs h-1 bg-zinc-900 rounded-full mt-10 overflow-hidden">
            <div className="h-full bg-white transition-all duration-1000" style={{ width: `${score}%` }} />
          </div>
        </div>

        <div className="space-y-4">
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-black text-zinc-600 uppercase mb-2">Total Hours Logged</p>
            <p className="text-3xl font-black italic">{logs.reduce((a: any, b: any) => a + b.hours, 0).toFixed(1)}H</p>
          </div>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-black text-zinc-600 uppercase mb-2">Total Sessions</p>
            <p className="text-3xl font-black italic">{logs.length}</p>
          </div>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100'}`}>
            <p className="text-[9px] font-black text-zinc-600 uppercase mb-2">Avg Quality</p>
            <p className="text-3xl font-black italic">
              {logs.length > 0 ? (logs.reduce((a: any, b: any) => a + b.quality, 0) / logs.length).toFixed(1) : '0.0'}
            </p>
          </div>
        </div>
      </div>

      <div className={`p-8 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-6 ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100'}`}>
        <div>
          <h4 className="text-sm font-black uppercase">Account & Data</h4>
          <p className="text-xs text-zinc-500 font-bold">
            {user ? `Logged in as ${user.email}` : 'Offline Mode: Progress is local only.'}
          </p>
        </div>
        <div className="flex gap-4 flex-wrap justify-center">
          {user ? (
            <button 
              onClick={onSignOut}
              className="px-6 py-2 text-[10px] font-black uppercase border border-zinc-700 hover:bg-zinc-800 transition-all rounded-lg"
            >
              Sign Out / Switch Account
            </button>
          ) : (
            <button 
              onClick={onOpenAuth}
              className="px-6 py-2 text-[10px] font-black uppercase border border-[#E10600] text-[#E10600] hover:bg-[#E10600]/10 transition-all rounded-lg"
            >
              Sync / Log In
            </button>
          )}
          <button 
            onClick={onClearData}
            className="px-6 py-2 text-[10px] font-black uppercase border border-red-900 text-red-500 hover:bg-red-900/10 transition-all rounded-lg"
          >
            System Reset
          </button>
        </div>
      </div>
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
  const isInitialSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) handleInitialSync(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser && !isInitialSyncDone.current) {
        handleInitialSync(newUser.id);
      } else if (!newUser) {
        isInitialSyncDone.current = false;
        setSyncStatus('local');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
          // Strict Overwrite / Clean Merge Logic
          // If local state is essentially empty, just take remote.
          if (localState.logs.length === 0 && localState.progress.length === 0 && localState.tasks.length === 0) {
            return { ...localState, ...remoteState, theme: localState.theme || remoteState.theme || 'dark' };
          }

          // Otherwise, merge unique by ID to avoid "random data" (duplicates)
          const mergedLogs = [...remoteState.logs];
          localState.logs.forEach(l => {
             if (!mergedLogs.some(rl => rl.id === l.id)) mergedLogs.push(l);
          });
          
          const mergedTasks = [...remoteState.tasks];
          localState.tasks.forEach(t => {
             if (!mergedTasks.some(rt => rt.id === t.id)) mergedTasks.push(t);
          });

          // For progress, we prefer the status that is more "advanced" in the cycle
          const mergedProgress = [...remoteState.progress];
          localState.progress.forEach(p => {
             const exists = mergedProgress.find(rp => rp.classId === p.classId && rp.subject === p.subject && rp.chapter === p.chapter);
             if (!exists) {
               mergedProgress.push(p);
             } else {
               const localIdx = STATUS_CYCLE.indexOf(p.status);
               const remoteIdx = STATUS_CYCLE.indexOf(exists.status);
               if (localIdx > remoteIdx) {
                 exists.status = p.status;
               }
             }
          });

          return { 
            ...localState, 
            ...remoteState, 
            logs: mergedLogs, 
            tasks: mergedTasks, 
            progress: mergedProgress,
            theme: localState.theme || remoteState.theme || 'dark'
          };
        });
      }
      isInitialSyncDone.current = true;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Initial Sync Error:', err);
      setSyncStatus('error');
    }
  };

  const triggerSync = async () => {
    if (!user || !isInitialSyncDone.current) return;
    if (isSyncingRef.current) {
      pendingSyncRef.current = true;
      return;
    }

    isSyncingRef.current = true;
    setSyncStatus('syncing');
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: user.id, state: stateRef.current, updated_at: new Date() });
      
      if (error) throw error;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Cloud Update Failed:', err);
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
    if (user && isInitialSyncDone.current) {
      triggerSync();
    }
  }, [state, user]);

  const handleSignOut = async () => {
    if (window.confirm("SIGN OUT? Your local unsynced progress will be cleared to ensure security.")) {
      await supabase.auth.signOut();
      localStorage.removeItem('locked_in_state_v2');
      setState(DEFAULT_STATE);
      window.location.reload();
    }
  };

  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then(() => setInstallPrompt(null));
  };

  const theme = state.theme || 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#0B0B0D' : '#FFFFFF';
    document.body.style.color = theme === 'dark' ? '#FFFFFF' : '#000000';
  }, [theme]);

  const [activeTab, setActiveTab] = useState<TabType>(state.lastUsedTab);

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
      return { ...prev, logs: [...prev.logs, newLog] };
    });
  };

  const deleteLog = (id: string) => {
    if (window.confirm("Delete this focus session record?")) {
      setState(prev => ({ ...prev, logs: prev.logs.filter(log => log.id !== id) }));
    }
  };

  const toggleChapterStatus = (classId: 11 | 12, subject: Subject, chapter: string) => {
    setState(prev => {
      const existing = prev.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const currentStatus = existing ? existing.status : 'not_started';
      const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      const filteredProgress = prev.progress.filter(p => !(p.classId === classId && p.subject === subject && p.chapter === chapter));
      return { 
        ...prev, 
        progress: [...filteredProgress, { classId, subject, chapter, status: nextStatus, notes: existing?.notes }] 
      };
    });
  };

  const updateTimer = (timerUpdate: Partial<TimerState>) => {
    setState(prev => ({ ...prev, timer: { ...prev.timer!, ...timerUpdate } }));
  };

  const addTask = (text: string, subject: Subject | 'General') => {
    setState(prev => ({ ...prev, tasks: [...prev.tasks, { id: generateId(), text, completed: false, subject }] }));
  };

  const toggleTask = (id: string) => {
    setState(prev => ({ ...prev, tasks: prev.tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t) }));
  };

  const deleteTask = (id: string) => {
    setState(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  };

  const updateDailyGoal = (val: number) => {
    setState(prev => ({ ...prev, dailyGoalHours: val }));
  };

  const clearLogs = () => {
    if (window.confirm("RESET SYSTEM: This will permanently wipe all study logs on this device. Are you sure?")) {
      localStorage.removeItem('locked_in_state_v2');
      setState(DEFAULT_STATE);
    }
  };

  const daysRemaining = getDaysRemaining(JEE_2027_DATE);
  const streakCount = calculateStreak(state.logs);
  const lockInScore = calculateLockInScore(state.logs, state.currentClass, state.progress);
  const isCurrentlyLockInActive = state.timer.isLockInActive;

  return (
    <div className={`min-h-screen pb-24 relative selection:bg-[#E10600] selection:text-white transition-colors duration-300 ${isCurrentlyLockInActive ? 'bg-black' : (theme === 'dark' ? 'bg-[#0B0B0D] text-white' : 'bg-white text-black')}`}>
      {!isCurrentlyLockInActive && (
        <Header 
          currentClass={state.currentClass} 
          onClassChange={(c) => setState(p => ({ ...p, currentClass: c }))} 
          daysRemaining={daysRemaining} 
          theme={theme} 
          onToggleTheme={() => setState(p => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
          installPrompt={installPrompt}
          onInstall={handleInstallClick}
          syncStatus={syncStatus}
          user={user}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
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

      <main className={`max-w-5xl mx-auto w-full relative z-20 ${isCurrentlyLockInActive ? 'p-0' : 'px-4 md:px-6 py-8'}`}>
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
        {!isCurrentlyLockInActive && activeTab === 'Streak' && <StreakTab streak={streakCount} logs={state.logs} theme={theme} />}
        {!isCurrentlyLockInActive && activeTab === 'Review' && (
          <ReviewTab 
            logs={state.logs} 
            score={lockInScore} 
            onClearData={clearLogs}
            theme={theme}
            user={user}
            onOpenAuth={() => setIsAuthModalOpen(true)}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      <Navbar activeTab={activeTab} onTabChange={handleTabChange} isLockInActive={isCurrentlyLockInActive} theme={theme} />
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
             <h2 className="text-[#E10600] text-3xl md:text-5xl font-black italic tracking-tighter mb-4">SESSION BREACHED</h2>
             <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] md:text-xs mb-8 text-center">Focus interrupted. Session paused. 1 Distraction recorded.</p>
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

        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900 via-transparent to-transparent animate-pulse" />
        <div className="absolute top-12 left-0 right-0 text-center px-4">
            <p className="text-[10px] text-[#E10600] uppercase font-black tracking-[0.5em] md:tracking-[1em] mb-2">ACTIVE FOCUS SESSION</p>
            <p className="text-[12px] md:text-[14px] text-zinc-500 uppercase font-black animate-pulse">{LOCK_IN_QUOTES[quoteIdx]}</p>
        </div>

        <p className="text-[18vw] md:text-[10vw] font-black text-white tabular-nums tracking-tighter leading-none">{formatTime(currentDisplayMs)}</p>
        <div className="flex flex-col items-center gap-2 mt-4">
           <p className="text-[10px] md:text-[12px] text-zinc-600 uppercase tracking-[0.4em] font-black">{timer.subject} — DEEP FOCUS</p>
           {(timer.distractions || 0) > 0 && <p className="text-[8px] text-[#E10600] font-black uppercase tracking-widest">{timer.distractions} BREACH(ES) RECORDED</p>}
        </div>
        
        <div className="w-full max-w-lg mt-8 md:mt-12 bg-zinc-900/40 p-4 md:p-6 border border-zinc-800 rounded-xl overflow-y-auto max-h-[40vh]">
          <TaskSection tasks={tasks} onToggleTask={onToggleTask} activeSubject={timer.subject} theme="dark" minimal />
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
              className="text-[9px] font-black uppercase text-zinc-800 hover:text-zinc-400 transition-colors py-2"
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
    <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {!timer.isRunning && (
        <section className={`p-5 md:p-8 rounded-2xl border flex flex-col gap-6 md:gap-8 transition-all ${theme === 'dark' ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <div className="flex flex-row gap-6 md:gap-10 items-center w-full">
            <div className="relative w-20 h-20 md:w-32 md:h-32 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={theme === 'dark' ? 'text-zinc-900' : 'text-zinc-100'} />
                <circle cx="50" cy="50" r="42" stroke="#E10600" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * progressPercent) / 100} strokeLinecap="round" className="transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base md:text-xl font-black leading-none">{Math.round(progressPercent)}%</span>
                <span className="text-[8px] md:text-[10px] font-black uppercase text-zinc-500 mt-1">Goal</span>
              </div>
            </div>
            <div className="flex flex-col justify-center flex-1">
              <p className="text-2xl md:text-4xl font-black italic tracking-tighter leading-none">{totalToday.toFixed(1)}<span className="text-zinc-500 text-sm md:text-lg not-italic ml-2 font-black">/ {dailyGoalHours}H</span></p>
              <div className="flex gap-2 mt-4 items-center">
                 <div className="flex gap-1">
                    <button onClick={() => onUpdateDailyGoal(Math.max(1, dailyGoalHours - 1))} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">-</button>
                    <button onClick={() => onUpdateDailyGoal(dailyGoalHours + 1)} className="w-7 h-7 rounded bg-[#E10600]/10 text-[#E10600] text-xs font-bold flex items-center justify-center hover:bg-[#E10600]/20 active:scale-90 transition-all">+</button>
                 </div>
                 <span className="text-[10px] uppercase font-black text-zinc-500 tracking-wider">Daily Target</span>
              </div>
            </div>
          </div>
          
          <div className="w-full grid grid-cols-3 gap-2 md:gap-4">
            {(['Physics', 'Chemistry', 'Maths'] as Subject[]).map(s => (
              <div key={s} className={`p-3 md:p-4 rounded-xl border ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
                 <p className="text-[8px] md:text-[10px] font-black uppercase text-zinc-500 mb-1">{s.substring(0, 3)}</p>
                 <p className="text-sm md:text-base font-black">{subjectDist[s].toFixed(1)}h</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={`p-8 md:p-20 text-center rounded-2xl border relative overflow-hidden transition-all ${timer.isRunning ? 'border-[#E10600] bg-[#E10600]/5' : (theme === 'dark' ? 'bg-[#141417]/40 border-[#1F1F23]' : 'bg-zinc-50 border-zinc-100')}`}>
        {timer.isRunning && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full" />}
        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-6">{timer.isRunning ? `FOCUSED ON: ${timer.subject}` : 'CHOOSE SUBJECT TO BEGIN'}</p>
        <p className="text-[14vw] md:text-8xl font-mono font-black tabular-nums tracking-tighter leading-none">{formatTime(currentDisplayMs)}</p>
        
        {!timer.isRunning ? (
          <>
            <div className="flex flex-wrap justify-center gap-2 mt-10">
              {(['Physics', 'Chemistry', 'Maths'] as Subject[]).map(s => (
                <button 
                  key={s} 
                  onClick={() => setManualSubject(s)} 
                  className={`px-4 md:px-6 py-2 text-[10px] font-black uppercase border rounded-lg transition-all ${manualSubject === s ? 'bg-[#E10600] border-[#E10600] text-white shadow-lg' : 'border-zinc-800 text-zinc-500 hover:border-zinc-500'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex flex-col items-center mt-8 gap-4">
              <button 
                onClick={handleStartTimer} 
                className="w-full max-sm:px-4 py-5 md:py-6 bg-white text-black font-black uppercase tracking-[0.3em] md:tracking-[0.5em] hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl rounded-xl"
              >
                START SESSION
              </button>
              <button 
                onClick={() => isLockInModeEnabled ? onToggleLockInMode(false) : setShowWarning(true)}
                className={`text-[9px] font-black uppercase tracking-widest px-6 py-2 rounded-full border transition-all ${isLockInModeEnabled ? 'bg-[#E10600] border-[#E10600] text-white' : 'border-zinc-800 text-zinc-500'}`}
              >
                {isLockInModeEnabled ? '🔒 LOCK-IN ACTIVE' : '🔓 LOCK-IN DISABLED'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-12 flex flex-col items-center gap-6">
             <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center">
                <span className="text-[10px] font-black uppercase text-zinc-500">Focus Quality:</span>
                <div className="flex gap-1">
                   {[1,2,3,4,5].map(v => (
                     <button key={v} onClick={() => setQuality(v)} className={`w-8 h-8 rounded flex items-center justify-center text-[10px] font-bold ${quality >= v ? 'bg-[#E10600] text-white' : 'bg-zinc-800 text-zinc-500'}`}>{v}</button>
                   ))}
                </div>
             </div>
             <button 
                onClick={handleStopTimer} 
                className="w-full max-w-xs py-5 bg-[#E10600] text-white font-black uppercase tracking-[0.4em] hover:bg-red-700 transition-all active:scale-95 shadow-xl shadow-red-900/20 rounded-xl"
             >
               END SESSION
             </button>
          </div>
        )}
      </section>

      <TaskSection tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} theme={theme} activeSubject={timer.isRunning ? timer.subject : null} />

      <section className="space-y-4">
        <div className="flex justify-between items-end border-b border-zinc-800 pb-2">
           <h3 className={`text-[10px] uppercase font-black tracking-widest ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>SESSION HISTORY (TODAY)</h3>
        </div>
        <div className="grid gap-3">
          {todayLogs.length === 0 ? (
            <p className="text-[10px] text-zinc-700 font-black uppercase py-4 text-center italic">No sessions recorded today.</p>
          ) : (
            todayLogs.map((l: any) => (
              <div key={l.id} className={`flex justify-between items-center p-4 rounded-xl border transition-all group ${theme === 'dark' ? 'bg-[#141417] border-zinc-900' : 'bg-white border-zinc-100 shadow-sm'}`}>
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
              <button onClick={() => { onToggleLockInMode(true); setShowWarning(false); }} className="flex-1 py-4 bg-white text-black font-black uppercase tracking-widest rounded-lg hover:bg-zinc-200">ENGAGE</button>
              <button onClick={() => setShowWarning(false)} className="flex-1 py-4 bg-zinc-900 text-zinc-500 font-black uppercase tracking-widest rounded-lg">ABORT</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
