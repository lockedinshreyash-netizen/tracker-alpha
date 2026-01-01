
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, TabType, DailyLog, ChapterProgress, Subject, SyllabusStatus, TimerState, Task } from './types';
import { SYLLABUS_DATA, STATUS_CYCLE, STATUS_COLORS, LOCK_IN_QUOTES } from './constants';
import { getISTDateString, getDaysRemaining, calculateStreak, calculateLockInScore, getLast7DaysStats, getSubjectDistribution } from './utils';
import { JEE_2027_DATE } from './constants';

// --- Global Helpers ---
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// --- Sub-components ---

const Header = ({ 
  currentClass, 
  onClassChange, 
  daysRemaining, 
  theme, 
  onToggleTheme,
  installPrompt,
  onInstall
}: { 
  currentClass: 11 | 12, 
  onClassChange: (c: 11 | 12) => void, 
  daysRemaining: number, 
  theme: 'dark' | 'light',
  onToggleTheme: () => void,
  installPrompt: any,
  onInstall: () => void
}) => (
  <div className={`pt-8 pb-4 border-b relative z-20 ${theme === 'dark' ? 'border-[#1F1F23]' : 'border-zinc-200'}`}>
    <div className="max-w-5xl mx-auto flex justify-between items-start mb-2 px-6">
      <div className="relative">
        <h1 className={`text-xl md:text-2xl font-black tracking-tighter italic flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          LOCK IN
        </h1>
        <p className={`text-[10px] md:text-xs uppercase tracking-widest font-bold ${theme === 'dark' ? 'text-[#A1A1AA]' : 'text-zinc-500'}`}>
          Mains '27: <span className={theme === 'dark' ? 'text-white' : 'text-black'}>{daysRemaining}d REMAINING</span>
        </p>
      </div>
      <div className="flex gap-2">
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

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('locked_in_state_v2');
    const defaultState: AppState = { 
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultState, ...parsed };
      } catch (e) {
        return defaultState;
      }
    }
    return defaultState;
  });

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
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the A2HS prompt');
      } else {
        console.log('User dismissed the A2HS prompt');
      }
      setInstallPrompt(null);
    });
  };

  const theme = state.theme || 'dark';

  useEffect(() => {
    localStorage.setItem('locked_in_state_v2', JSON.stringify(state));
    document.body.style.backgroundColor = theme === 'dark' ? '#0B0B0D' : '#FFFFFF';
    document.body.style.color = theme === 'dark' ? '#FFFFFF' : '#000000';
  }, [state, theme]);

  const [activeTab, setActiveTab] = useState<TabType>(state.lastUsedTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setState(prev => ({ ...prev, lastUsedTab: tab }));
  };

  const logStudy = (subject: Subject, hours: number, quality: number, distractions: number, append: boolean = true) => {
    if (hours <= 0) return;
    const today = getISTDateString();
    setState(prev => {
      const existing = prev.logs.find(l => l.date === today && l.subject === subject);
      const filteredLogs = prev.logs.filter(l => !(l.date === today && l.subject === subject));
      const newHours = append && existing ? existing.hours + hours : hours;
      const newLog: DailyLog = {
        id: generateId(), 
        date: today,
        subject,
        hours: parseFloat(newHours.toFixed(2)),
        quality: quality,
        distractions: (existing?.distractions || 0) + distractions
      };
      return { ...prev, logs: [...filteredLogs, newLog] };
    });
  };

  const deleteLog = (id: string) => {
    if (window.confirm("Delete this focus record?")) {
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

  const updateChapterNotes = (classId: 11 | 12, subject: Subject, chapter: string, notes: string | undefined) => {
    setState(prev => {
      const existing = prev.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const filteredProgress = prev.progress.filter(p => !(p.classId === classId && p.subject === subject && p.chapter === chapter));
      return { ...prev, progress: [...filteredProgress, { classId, subject, chapter, status: existing?.status || 'not_started', notes }] };
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
    if (window.confirm("RESET SYSTEM: This will permanently wipe all study logs. Are you sure?")) {
      localStorage.removeItem('locked_in_state_v2');
      window.location.reload();
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
        />
      )}

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
            onUpdateNotes={updateChapterNotes}
            theme={theme}
          />
        )}
        {!isCurrentlyLockInActive && activeTab === 'Streak' && <StreakTab streak={streakCount} logs={state.logs} theme={theme} />}
        {!isCurrentlyLockInActive && activeTab === 'Review' && (
          <ReviewTab 
            logs={state.logs} 
            score={lockInScore} 
            currentClass={state.currentClass} 
            progress={state.progress}
            onClearData={clearLogs}
            onDeleteLog={deleteLog}
            theme={theme}
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
  const [displayMs, setDisplayMs] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [showBreach, setShowBreach] = useState(false);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [wipeHoldStart, setWipeHoldStart] = useState<number | null>(null);
  const [wipeProgress, setWipeProgress] = useState(0);
  
  const timerRef = useRef(timer);
  useEffect(() => { timerRef.current = timer; }, [timer]);

  const REQUIRED_FOCUS_MS = 15 * 60 * 1000; // 15 Minutes
  const WIPE_HOLD_MS = 15 * 1000; // 15 Seconds hold

  useEffect(() => {
    let interval: number;
    if (timer.isRunning && timer.startTime) {
      interval = window.setInterval(() => {
        setDisplayMs(Date.now() - timer.startTime! + timer.accumulatedMs);
      }, 100);
    } else {
      setDisplayMs(timer.accumulatedMs);
    }
    return () => clearInterval(interval);
  }, [timer.isRunning, timer.startTime, timer.accumulatedMs]);

  // Breach Detection
  useEffect(() => {
    if (timer.isLockInActive) {
      const handleFsChange = () => {
        if (!document.fullscreenElement) {
          onTimerUpdate({ 
            isRunning: false, 
            accumulatedMs: Date.now() - (timerRef.current.startTime || Date.now()) + timerRef.current.accumulatedMs, 
            startTime: null,
            distractions: timerRef.current.distractions + 1 
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

  // Emergency Wipe Progress Timer
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
    onLog(currentTimer.subject, finalMs / (1000 * 60 * 60), quality, currentTimer.distractions, true);
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

  const todayLogs = logs.filter((l: any) => l.date === getISTDateString());
  const totalToday = todayLogs.reduce((a: any, b: any) => a + b.hours, 0);
  const progressPercent = Math.min((totalToday / dailyGoalHours) * 100, 100);
  const subjectDist = getSubjectDistribution(logs);
  
  const canEndSession = displayMs >= REQUIRED_FOCUS_MS;
  const timeRemainingToEnd = Math.max(0, REQUIRED_FOCUS_MS - displayMs);

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

        <p className="text-[18vw] md:text-[10vw] font-black text-white tabular-nums tracking-tighter leading-none">{formatTime(displayMs)}</p>
        <div className="flex flex-col items-center gap-2 mt-4">
           <p className="text-[10px] md:text-[12px] text-zinc-600 uppercase tracking-[0.4em] font-black">{timer.subject} — DEEP FOCUS</p>
           {timer.distractions > 0 && <p className="text-[8px] text-[#E10600] font-black uppercase tracking-widest">{timer.distractions} BREACH(ES) RECORDED</p>}
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
             <div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min((displayMs / REQUIRED_FOCUS_MS) * 100, 100)}%` }} />
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
      {/* Overview Card */}
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

      {/* Timer Section */}
      <section className={`p-8 md:p-20 text-center rounded-2xl border relative overflow-hidden transition-all ${timer.isRunning ? 'border-[#E10600] bg-[#E10600]/5' : (theme === 'dark' ? 'bg-[#141417]/40 border-[#1F1F23]' : 'bg-zinc-50 border-zinc-100')}`}>
        {timer.isRunning && <div className="absolute top-4 right-4 animate-ping w-2 h-2 bg-[#E10600] rounded-full" />}
        <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500 mb-6">{timer.isRunning ? `FOCUSED ON: ${timer.subject}` : 'CHOOSE SUBJECT TO BEGIN'}</p>
        <p className="text-[14vw] md:text-8xl font-mono font-black tabular-nums tracking-tighter leading-none">{formatTime(displayMs)}</p>
        
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
                className="w-full max-w-sm py-5 md:py-6 bg-white text-black font-black uppercase tracking-[0.3em] md:tracking-[0.5em] hover:bg-zinc-200 transition-all active:scale-95 shadow-2xl rounded-xl"
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

      {/* Task Section */}
      <TaskSection tasks={tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} theme={theme} activeSubject={timer.isRunning ? timer.subject : null} />

      {/* Protocol Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`max-w-md w-full p-6 md:p-10 border-2 rounded-2xl ${theme === 'dark' ? 'bg-[#0B0B0D] border-[#E10600]' : 'bg-white border-[#E10600]'}`}>
             <h3 className="text-xl md:text-2xl font-black italic tracking-tighter text-[#E10600] mb-4 md:mb-6">LOCK-IN MODE</h3>
             <div className={`space-y-4 mb-8 md:mb-10 text-[10px] md:text-[11px] font-bold uppercase tracking-tight leading-relaxed ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                <p>• <span className="text-[#E10600]">STRICT FULLSCREEN:</span> Browser focus is enforced. Any exit triggers a pause and distraction log.</p>
                <p>• <span className="text-white">15-MINUTE MINIMUM:</span> You cannot end a focus session before the 15-minute mark.</p>
                <p>• <span className="text-white">INTEGRITY PENALTY:</span> Every breach recorded in Lock-In mode subtracts 2 points from your Integrity Score.</p>
             </div>
             <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { onToggleLockInMode(true); setShowWarning(false); }}
                  className="bg-[#E10600] text-white font-black py-4 md:py-5 uppercase tracking-[0.2em] md:tracking-[0.3em] rounded-xl shadow-xl hover:bg-red-700 transition-all"
                >
                  ACTIVATE LOCK-IN
                </button>
                <button onClick={() => setShowWarning(false)} className="text-[9px] font-black uppercase text-zinc-500 hover:text-white py-2">CANCEL</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SyllabusTab = ({ currentClass, progress, onToggle, onUpdateNotes, theme }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingChapter, setEditingChapter] = useState<{ subject: Subject, chapter: string } | null>(null);

  const stats = useMemo(() => {
    const res: any = {};
    const classData = SYLLABUS_DATA[currentClass as 11|12];
    Object.keys(classData).forEach(sub => {
      const chapters = classData[sub as Subject];
      const completed = progress.filter((p: any) => p.subject === sub && p.classId === currentClass && p.status === 'completed').length;
      res[sub] = Math.round((completed / chapters.length) * 100);
    });
    return res;
  }, [progress, currentClass]);

  const filteredData = useMemo(() => {
    const data = SYLLABUS_DATA[currentClass as 11|12];
    if (!searchTerm) return data;
    const lowerSearch = searchTerm.toLowerCase();
    const res: any = {};
    Object.entries(data).forEach(([sub, chapters]: any) => {
      const filtered = chapters.filter((ch: string) => ch.toLowerCase().includes(lowerSearch));
      if (filtered.length > 0) res[sub] = filtered;
    });
    return res;
  }, [currentClass, searchTerm]);

  return (
    <div className="space-y-8 md:space-y-10 pb-24 animate-in fade-in duration-500">
      <div className="sticky top-0 z-40 pb-4 pt-4 bg-inherit border-b border-zinc-900/50">
        <input 
          type="text" 
          placeholder="SEARCH CHAPTERS..." 
          className={`w-full p-4 rounded-xl text-xs font-black uppercase border focus:outline-none focus:ring-1 focus:ring-[#E10600] transition-all ${theme === 'dark' ? 'bg-[#141417] border-zinc-900 text-white' : 'bg-zinc-50 border-zinc-200'}`}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {Object.entries(filteredData).map(([subject, chapters]: any) => (
        <div key={subject} className="space-y-4 md:space-y-6">
          <div className="flex justify-between items-end border-b-2 border-zinc-900 pb-2">
            <h2 className="text-xl md:text-3xl font-black uppercase tracking-tighter italic">{subject}</h2>
            <span className="text-[10px] md:text-xs font-black text-[#E10600] tracking-widest">{stats[subject]}% MASTERY</span>
          </div>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
            {chapters.map((ch: string) => {
              const p = progress.find((x: any) => x.chapter === ch && x.subject === subject);
              const currentStatus: SyllabusStatus = p?.status || 'not_started';
              const styles = STATUS_COLORS[currentStatus];
              return (
                <div key={ch} className={`p-3 md:p-4 border rounded-xl flex items-center gap-3 transition-all ${styles.border} ${styles.bg} ${theme === 'dark' ? 'bg-opacity-10' : 'bg-opacity-20'} ${theme === 'dark' ? 'bg-[#0B0B0D]' : 'bg-white'}`}>
                  <button onClick={() => onToggle(currentClass, subject as Subject, ch)} className={`flex-1 text-[10px] md:text-[11px] font-bold uppercase text-left tracking-tight ${styles.text} ${currentStatus === 'not_started' && (theme === 'dark' ? 'text-zinc-200' : 'text-zinc-900')}`}>
                    {ch}
                  </button>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingChapter({ subject: subject as Subject, chapter: ch })} className="p-2 rounded bg-zinc-900/40 border border-zinc-800 text-[10px]">✏️</button>
                    <span className={`text-[8px] font-black uppercase px-2 py-1 rounded border min-w-[70px] md:min-w-[80px] text-center ${styles.label}`}>{currentStatus.replace('_', ' ')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {editingChapter && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-2xl border-2 ${theme === 'dark' ? 'bg-[#0B0B0D] border-zinc-800' : 'bg-white border-zinc-200'} p-6 md:p-8 shadow-2xl`}>
             <div className="flex justify-between items-start mb-6">
                <div>
                   <p className="text-[10px] font-black uppercase text-[#E10600]">{editingChapter.subject}</p>
                   <h3 className={`text-xl md:text-2xl font-black italic tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-black'}`}>{editingChapter.chapter}</h3>
                </div>
                <button onClick={() => setEditingChapter(null)} className="text-zinc-600 font-black text-xl px-2">✕</button>
             </div>
             <textarea
                placeholder="STUDY NOTES: KEY FORMULAE, WEAK CONCEPTS, OR PENDING TASKS..."
                className={`w-full text-xs md:text-sm p-4 font-bold uppercase rounded-xl border focus:outline-none focus:border-[#E10600] h-64 md:h-80 ${theme === 'dark' ? 'bg-black border-zinc-900 text-zinc-400' : 'bg-white border-zinc-200 text-zinc-800'}`}
                value={progress.find((p: any) => p.chapter === editingChapter.chapter && p.subject === editingChapter.subject)?.notes || ''}
                onChange={(e) => onUpdateNotes(currentClass, editingChapter.subject, editingChapter.chapter, e.target.value)}
             />
             <div className="mt-6">
                <button 
                  onClick={() => setEditingChapter(null)}
                  className="w-full bg-[#E10600] text-white font-black py-4 uppercase tracking-widest rounded-xl"
                >
                  SAVE NOTES
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StreakTab = ({ streak, logs, theme }: { streak: number, logs: DailyLog[], theme: string }) => {
  const stats7d = getLast7DaysStats(logs);
  const maxHours = Math.max(...stats7d.map(s => s.hours), 1);

  return (
    <div className="space-y-8 md:space-y-12 animate-in fade-in duration-700">
      <div className="text-center py-12 md:py-20 relative overflow-hidden rounded-3xl border border-[#E10600]/20">
         <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600 via-transparent to-transparent animate-pulse" />
         <h2 className="text-[10px] md:text-xs font-black uppercase tracking-[0.5em] text-[#E10600] mb-4">CONSISTENCY SCORE</h2>
         <p className="text-8xl md:text-[10rem] font-black tracking-tighter italic leading-none">{streak}</p>
         <p className="text-xl md:text-2xl font-black uppercase tracking-widest text-zinc-500">Day Streak</p>
      </div>

      <div className="space-y-6">
         <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">FOCUS INTENSITY (LAST 7D)</h3>
         <div className="flex items-end justify-between h-48 gap-2 md:gap-4 px-2">
            {stats7d.map((day, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full">
                <div className="flex-1 w-full flex items-end justify-center group relative">
                  <div 
                    className={`w-full max-w-[40px] rounded-t-lg transition-all duration-1000 group-hover:bg-[#E10600] ${day.hours > 0 ? 'bg-zinc-800' : 'bg-zinc-900/20'}`} 
                    style={{ height: `${(day.hours / maxHours) * 100}%` }}
                  />
                  <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-[#E10600] text-white text-[9px] font-black px-2 py-1 rounded">
                    {day.hours}H
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">{day.date}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );
};

const ReviewTab = ({ logs, score, currentClass, progress, onClearData, onDeleteLog, theme }: any) => {
  const subjectDistribution = getSubjectDistribution(logs);
  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8 md:space-y-10 pb-24 animate-in fade-in duration-700">
      <div className={`p-8 md:p-12 rounded-3xl border ${theme === 'dark' ? 'bg-[#141417] border-zinc-900' : 'bg-white border-zinc-100 shadow-xl'} flex flex-col items-center text-center`}>
         <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-6">INTEGRITY SCORE</h2>
         <div className="relative w-32 h-32 md:w-48 md:h-48 mb-6">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" fill="transparent" className={theme === 'dark' ? 'text-zinc-900' : 'text-zinc-50'} />
              <circle cx="50" cy="50" r="42" stroke="#E10600" strokeWidth="8" fill="transparent" strokeDasharray="264" strokeDashoffset={264 - (264 * score / 100)} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
               <span className="text-4xl md:text-6xl font-black tracking-tighter italic leading-none">{score}</span>
            </div>
         </div>
         <p className="text-[11px] font-bold uppercase tracking-tight text-zinc-500 max-w-xs leading-relaxed">
           A composite metric tracking consistency, volume, and focus quality. <br/>
           <span className="text-[#E10600]">Distractions subtract 2 points each.</span>
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className={`p-6 md:p-8 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#E10600] mb-6">TOTAL TIME EXPENDED</h3>
            <div className="space-y-4">
               {Object.entries(subjectDistribution).map(([sub, hours]: any) => (
                 <div key={sub}>
                    <div className="flex justify-between text-[11px] font-black uppercase mb-1">
                       <span>{sub}</span>
                       <span>{hours.toFixed(1)}H</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                       <div className="h-full bg-[#E10600]" style={{ width: `${Math.min((hours / 500) * 100, 100)}%` }} />
                    </div>
                 </div>
               ))}
            </div>
         </div>
         <div className={`p-6 md:p-8 rounded-2xl border ${theme === 'dark' ? 'bg-[#141417] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#E10600] mb-6">FOCUS SESSION LOGS</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2 no-scrollbar">
               {sortedLogs.length === 0 ? (
                 <p className="text-[10px] uppercase font-black text-zinc-700 italic">No historical records.</p>
               ) : sortedLogs.map((log: any) => (
                 <div key={log.id} className="flex justify-between items-center p-3 rounded-lg bg-black/20 border border-zinc-900 group">
                    <div className="flex-1">
                       <p className="text-[8px] font-black text-zinc-500 uppercase">{log.date}</p>
                       <p className="text-[10px] font-black uppercase text-white">{log.subject} — {log.hours}h</p>
                       {log.distractions > 0 && <p className="text-[7px] text-red-500 font-black uppercase tracking-widest mt-0.5">{log.distractions} BREACH(ES) DETECTED</p>}
                    </div>
                    <button onClick={() => onDeleteLog(log.id)} className="opacity-0 group-hover:opacity-100 text-xs hover:text-red-500 transition-all">✕</button>
                 </div>
               ))}
            </div>
         </div>
      </div>

      <div className="pt-12 flex flex-col items-center gap-6">
         <p className="text-[10px] font-black uppercase text-zinc-700">DANGER ZONE</p>
         <button 
           onClick={onClearData}
           className="px-8 py-3 rounded-full border border-zinc-900 text-zinc-700 hover:border-red-600 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-all"
         >
           RESET DATABASE
         </button>
      </div>
    </div>
  );
};

export default App;
