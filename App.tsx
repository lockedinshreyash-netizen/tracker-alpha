import React, { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppState, TabType, DailyLog, Subject, TimerState, SyncStatus, QSubject, QuestionTrackingState, ExamPreference, TimerMode, PomodoroRuntime, PomodoroSettings } from './types';
import { getActiveSubjects, getCoreSubjects, getCoreQSubjects, JEE_2027_DATE, NEET_2027_DATE, STATUS_CYCLE, REQUIRED_FOCUS_MS } from './constants';
import { getISTDateString, getDaysRemaining, calculateStreak, calculateLockInScore, generateId } from './utils';
import { supabase } from './supabaseClient';
import { DEFAULT_STATE, IDLE_POMODORO, DEFAULT_POMODORO_SETTINGS } from './state';
import QuestionsTab from './questions/QuestionsTab';
import Sidebar from './Sidebar';
import LandingPage from './LandingPage';
import AuthModal from './AuthModal';
import Header from './Header';
import TodayTab from './today/TodayTab';
import SyllabusTab from './syllabus/SyllabusTab';
import StreakTab from './streak/StreakTab';
import ReviewTab from './review/ReviewTab';
import OnboardingFlow, { OnboardingSettings } from './onboarding/OnboardingFlow';
import VoiceControl, { VoiceFeedback } from './voice/VoiceControl';
import { VoiceIntent, toQSubject } from './voice/commands';
import { PHASE_LABEL, formatCountdown, phaseDurationMs } from './today/pomodoro';

const ONBOARDING_KEY = 'onboarding_complete';

/* Ending a session by voice can't stop to ask for a focus rating, so it logs
   at the same neutral 4 the Pomodoro pending-block flush uses. */
const VOICE_QUALITY = 4;

// --- Main App Component ---

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('locked_in_state_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        parsed.examPreference = parsed.examPreference || 'JEE';

        if (parsed.questionTracking?.dailyQuestionsLog) {
          parsed.questionTracking.dailyQuestionsLog = parsed.questionTracking.dailyQuestionsLog.map((log: any) => {
             if (!log.counts) {
                log.counts = {};
                if (typeof log.physicsCount === 'number') log.counts.physics = log.physicsCount;
                if (typeof log.chemistryCount === 'number') log.counts.chemistry = log.chemistryCount;
                if (typeof log.mathCount === 'number') log.counts.math = log.mathCount;
                delete log.physicsCount;
                delete log.chemistryCount;
                delete log.mathCount;
             }
             return log;
          });
        }
        if (parsed.questionTracking?.weeklyGoalBySubject) {
           const w = parsed.questionTracking.weeklyGoalBySubject;
           if (!('physics' in w) && !('chemistry' in w) && !('math' in w) && !('biology' in w)) {
              parsed.questionTracking.weeklyGoalBySubject = {
                physics: w.physicsGoal ?? null,
                chemistry: w.chemistryGoal ?? null,
                math: w.mathGoal ?? null
              };
           }
        }

        /* Pomodoro arrived after these users already had saved state. The
           top-level spread below covers a missing key, but not a partially
           shaped one, so merge the nested objects field by field. */
        const merged: AppState = { ...DEFAULT_STATE, ...parsed };
        merged.pomodoroSettings = { ...DEFAULT_POMODORO_SETTINGS, ...(parsed.pomodoroSettings || {}) };
        merged.pomodoro = { ...IDLE_POMODORO, ...(parsed.pomodoro || {}) };
        merged.timerMode = parsed.timerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
        return merged;
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return DEFAULT_STATE;
  });

  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(state.lastUsedTab);
  const [showLanding, setShowLanding] = useState<boolean | null>(null); // null = still checking
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_KEY) !== 'true';
    } catch {
      return false;
    }
  });
  /* Onboarding pre-fills from live state, so for a signed-in user it must not
     mount until the cloud pull has landed — otherwise it would show defaults
     and could overwrite real saved settings. isInitialSyncDone is a ref (no
     re-render), hence this companion state flag. */
  const [syncSettled, setSyncSettled] = useState(false);

  const isInitialSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const stateRef = useRef(state);
  const preventSyncOnUpdate = useRef(false);

  const activeSubjects = getActiveSubjects(state.examPreference);
  const coreSubjects = getCoreSubjects(state.examPreference);
  const coreQSubjects = getCoreQSubjects(state.examPreference);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Handle Auth, Initial Fetch, and Landing Page gating
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisited') === 'true';

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        handleInitialSync(u.id);
        setShowLanding(false);
      } else {
        setShowLanding(!hasVisited);
        // Local-only session: there is no cloud pull to wait for.
        setSyncSettled(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      if (newUser) {
        setShowLanding(false);
        if (!isInitialSyncDone.current) handleInitialSync(newUser.id);
      }
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
    if (isInitialSyncDone.current) {
      setSyncSettled(true);
      return;
    }
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
      // Settle either way — a failed pull must not leave onboarding stuck.
      setSyncSettled(true);
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
    document.body.style.backgroundColor = theme === 'dark' ? '#0B0B0D' : '#F2F0EC';
    document.body.style.color = theme === 'dark' ? '#FFFFFF' : '#17150F';
  }, [theme]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setState(prev => ({ ...prev, lastUsedTab: tab }));
  };

  /* Written once, when the calibration act completes. Skipping writes nothing. */
  const applyOnboardingSettings = (s: OnboardingSettings) => {
    setState(prev => {
      const next = {
        ...prev,
        examPreference: s.examPreference,
        currentClass: s.currentClass,
        dailyGoalHours: s.dailyGoalHours,
        lastUpdated: Date.now(),
      };
      stateRef.current = next;
      return next;
    });
  };

  const completeOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch {
      // Hardened browser modes can refuse writes; the session flag below still applies.
    }
    setNeedsOnboarding(false);
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

  const setTimerMode = (mode: TimerMode) => {
    setState(prev => {
      const nextState = { ...prev, timerMode: mode, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const updatePomodoro = (update: Partial<PomodoroRuntime>) => {
    setState(prev => {
      const nextState = { ...prev, pomodoro: { ...prev.pomodoro, ...update } };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const updatePomodoroSettings = (update: Partial<PomodoroSettings>) => {
    setState(prev => {
      const nextState = {
        ...prev,
        pomodoroSettings: { ...prev.pomodoroSettings, ...update },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /* A completed Pomodoro block goes through the same logging path as a
     stopwatch session, so hours, streaks, the heatmap and the Lock-In Score
     all pick it up with no special-casing. */
  const logPomodoroBlock = (subject: Subject, hours: number, quality: number) => {
    logStudy(subject, hours, quality, 0);
  };

  /* If the tab was closed between finishing a block and rating it, that block
     is still parked in pendingBlock. Flush it at a neutral quality on the next
     load so completed study time is never silently lost. */
  const pendingFlushDone = useRef(false);
  useEffect(() => {
    if (pendingFlushDone.current) return;
    pendingFlushDone.current = true;
    const pending = stateRef.current.pomodoro?.pendingBlock;
    if (!pending) return;
    logStudy(pending.subject, pending.hours, 4, 0);
    updatePomodoro({ pendingBlock: null });
  }, []);

  /* Throw away an in-progress session without logging it. Used by onboarding:
     a running timer hides the goal card the tour needs to point at, and a
     few seconds started mid-tour isn't real study data worth keeping. */
  const discardActiveSession = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* already exited */ });
    }
    setState(prev => {
      if (!prev.timer.isRunning && !prev.timer.accumulatedMs && !prev.timer.isLockInActive) {
        return prev;
      }
      const nextState = {
        ...prev,
        timer: {
          ...prev.timer,
          isRunning: false,
          startTime: null,
          accumulatedMs: 0,
          isLockInActive: false,
          distractions: 0,
        },
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const addTask = (text: string, subject: Subject) => {
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
      const idx = logs.findIndex((l) => l.date === today);
      if (idx >= 0) {
        const updated = { ...logs[idx] };
        updated.counts = { ...updated.counts, [subject]: (updated.counts?.[subject] || 0) + count };
        logs[idx] = updated;
      } else {
        logs.push({
          date: today,
          counts: { [subject]: count }
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

  /* ── Voice commands ──
     The parser is pure and exam-agnostic, so every check that depends on live
     state — which subjects are active, what's already running, the focus floor
     — happens here. Reads go through stateRef so a command fired moments after
     another still sees the result of the first. */
  const executeVoiceCommand = (intent: VoiceIntent): VoiceFeedback => {
    const current = stateRef.current;
    const exam = current.examPreference || 'JEE';

    switch (intent.kind) {
      case 'navigate':
        handleTabChange(intent.tab);
        return { ok: true, message: `OPENED ${intent.tab.toUpperCase()}.` };

      case 'startSession': {
        if (intent.subject && !activeSubjects.includes(intent.subject)) {
          return { ok: false, message: `${intent.subject.toUpperCase()} ISN'T IN YOUR ${exam} TRACK.` };
        }
        handleTabChange('Today');

        if (current.timerMode === 'pomodoro') {
          if (current.pomodoro.isRunning) return { ok: false, message: 'A BLOCK IS ALREADY RUNNING.' };
          const phase = current.pomodoro.phase;
          updatePomodoro({
            // The subject only means anything for a work block.
            ...(phase === 'work' && intent.subject ? { subject: intent.subject } : {}),
            isRunning: true,
            phaseEndsAt: Date.now() + phaseDurationMs(phase, current.pomodoroSettings),
          });
          return { ok: true, message: `${PHASE_LABEL[phase].toUpperCase()} STARTED.` };
        }

        if (current.timer.isRunning) return { ok: false, message: 'SESSION ALREADY RUNNING.' };
        const subject = intent.subject ?? current.timer.subject;
        updateTimer({ isRunning: true, startTime: Date.now(), subject });
        return { ok: true, message: `SESSION LIVE: ${subject.toUpperCase()}.` };
      }

      case 'endSession': {
        if (current.timerMode === 'pomodoro') {
          if (!current.pomodoro.isRunning) return { ok: false, message: 'NOTHING RUNNING.' };
          updatePomodoro({ isRunning: false, phaseEndsAt: null });
          return { ok: true, message: 'BLOCK ABANDONED. NOTHING LOGGED.' };
        }

        const t = current.timer;
        if (!t.isRunning && !t.accumulatedMs) return { ok: false, message: 'NOTHING RUNNING.' };
        const elapsedMs = (t.isRunning ? Date.now() - (t.startTime || Date.now()) : 0) + t.accumulatedMs;
        // Voice gets no shortcut past the focus floor the button enforces.
        if (elapsedMs < REQUIRED_FOCUS_MS) {
          return { ok: false, message: `LOCK-OUT: ${formatCountdown(REQUIRED_FOCUS_MS - elapsedMs)} LEFT.` };
        }
        const hours = elapsedMs / (1000 * 60 * 60);
        logStudy(t.subject, hours, VOICE_QUALITY, t.distractions || 0);
        updateTimer({ isRunning: false, startTime: null, accumulatedMs: 0, distractions: 0 });
        return { ok: true, message: `LOGGED ${hours.toFixed(2)}H ${t.subject.toUpperCase()}.` };
      }

      case 'addTask': {
        const subject = activeSubjects.includes(intent.subject) ? intent.subject : 'General';
        addTask(intent.text, subject);
        return { ok: true, message: `TASK ADDED: ${intent.text.toUpperCase().slice(0, 32)}` };
      }

      case 'logQuestions': {
        const qSubject = toQSubject(intent.subject);
        if (!qSubject || !coreQSubjects.includes(qSubject)) {
          return { ok: false, message: `${intent.subject.toUpperCase()} ISN'T TRACKED FOR QUESTIONS IN ${exam}.` };
        }
        logQuestions(qSubject, intent.count);
        return { ok: true, message: `+${intent.count} ${intent.subject.toUpperCase()} QUESTIONS.` };
      }

      case 'setGoal': {
        const hours = Math.min(24, Math.max(1, Math.round(intent.hours)));
        updateDailyGoal(hours);
        return { ok: true, message: `DAILY TARGET: ${hours}H.` };
      }

      default:
        return { ok: false, message: 'UNKNOWN COMMAND.' };
    }
  };

  const targetExamDate = state.examPreference === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE;
  const daysRemaining = getDaysRemaining(targetExamDate);
  const streakCount = calculateStreak(state.logs);
  const lockInScore = calculateLockInScore(state.logs, state.currentClass, state.progress, activeSubjects);
  const isCurrentlyLockInActive = state.timer.isLockInActive;

  /* Onboarding waits on: the landing page being dismissed, the auth modal
     being closed (so it can't cover a sign-up the user just started), and the
     cloud pull having settled so pre-filled values are the user's real ones. */
  const showOnboarding =
    showLanding === false && needsOnboarding && syncSettled && !isAuthModalOpen;

  // While checking session, show nothing (prevents flash)
  if (showLanding === null) {
    return <div style={{ background: theme === 'dark' ? '#0B0B0D' : '#F2F0EC', width: '100vw', height: '100vh' }} />;
  }

  // Show landing page for first-time visitors with no session
  if (showLanding) {
    return (
      <LandingPage
        onCtaClick={() => {
          setShowLanding(false);
          setIsAuthModalOpen(true);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen relative selection:bg-[#E10600] selection:text-white transition-colors duration-300 ${isCurrentlyLockInActive ? 'bg-black' : (theme === 'dark' ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-[#17150F]')}`}>
      {!isCurrentlyLockInActive && (
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} isLockInActive={isCurrentlyLockInActive} theme={theme} />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        theme={theme}
        onAuthSuccess={() => {
          isInitialSyncDone.current = false;
          setSyncSettled(false);
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
            examPreference={state.examPreference || 'JEE'}
            targetExamDate={targetExamDate}
          />
        )}

        <main className={`max-w-5xl mx-auto w-full relative z-20 ${isCurrentlyLockInActive ? 'p-0' : 'px-4 md:px-6 py-8 pb-16'}`}>
          {activeTab === 'Today' && (
            <TodayTab
              state={state}
              onLog={logStudy}
              onDeleteLog={deleteLog}
              onTimerUpdate={updateTimer}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onUpdateDailyGoal={updateDailyGoal}
              onSetTimerMode={setTimerMode}
              onUpdatePomodoro={updatePomodoro}
              onUpdatePomodoroSettings={updatePomodoroSettings}
              onLogPomodoroBlock={logPomodoroBlock}
              theme={theme}
              activeSubjects={activeSubjects}
            />
          )}
          {!isCurrentlyLockInActive && activeTab === 'Syllabus' && (
            <SyllabusTab
              currentClass={state.currentClass}
              progress={state.progress}
              onToggle={toggleChapterStatus}
              theme={theme}
              activeSubjects={activeSubjects}
            />
          )}
          {!isCurrentlyLockInActive && activeTab === 'Streak' && <StreakTab streak={streakCount} logs={state.logs} dailyGoalHours={state.dailyGoalHours} theme={theme} dailyQuestionsLog={state.questionTracking.dailyQuestionsLog} coreSubjects={coreQSubjects} activeSubjects={activeSubjects} />}
          {!isCurrentlyLockInActive && activeTab === 'Questions' && (
            <QuestionsTab
              questionTracking={state.questionTracking}
              onUpdateTracking={updateQuestionTracking}
              onLogQuestions={logQuestions}
              theme={theme}
              coreSubjects={coreQSubjects}
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
              examPreference={state.examPreference || 'JEE'}
              onChangeExamPreference={(p: ExamPreference) => setState(prev => ({ ...prev, examPreference: p }))}
              activeSubjects={activeSubjects}
            />
          )}
        </main>
      </div>

      {/* Kept out of the way of the tour's spotlight and of Lock-In. */}
      {!isCurrentlyLockInActive && !showOnboarding && (
        <VoiceControl theme={theme} onCommand={executeVoiceCommand} />
      )}

      {showOnboarding && (
        <OnboardingFlow
          initial={{
            examPreference: state.examPreference || 'JEE',
            currentClass: state.currentClass,
            dailyGoalHours: state.dailyGoalHours,
          }}
          onApplySettings={applyOnboardingSettings}
          onNavigateToToday={() => handleTabChange('Today')}
          onDiscardSession={discardActiveSession}
          onComplete={completeOnboarding}
        />
      )}
    </div>
  );
};

export default App;
