import React, { useState, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppState, TabType, DailyLog, Subject, TimerState, SyncStatus, QSubject, QuestionTrackingState, ExamPreference, TimerMode, PomodoroRuntime, PomodoroSettings, SyllabusStatus, Task, LogSource, TopicMastery, ScheduleState, ScheduleBlock, TemplateRule } from './types';
import { getActiveSubjects, getCoreSubjects, getCoreQSubjects, JEE_2027_DATE, NEET_2027_DATE, STATUS_CYCLE, SYLLABUS_DATA, STATUS_LABELS } from './constants';
import { getISTDateString, getDaysRemaining, calculateStreak, calculateVerifiedStreak, calculateLockInScore, generateId, addDays } from './utils';
import { supabase } from './supabaseClient';
import { DEFAULT_STATE, DEFAULT_POMODORO_SETTINGS, DEFAULT_LEADERBOARD, DEFAULT_COACH, normalizePomodoro, normalizeSchedule } from './state';
import { evaluate as evaluateRewards, normalizeRewards, mergeRewards, pendingCelebrations } from './rewards/engine';
import { mergeSchedule, instanceId, isInstanceId, parseInstanceId } from './schedule/schedule';
import PlanTab from './schedule/PlanTab';
import { wallpaperById } from './rewards/wallpapers';
import WallpaperLayer from './rewards/WallpaperLayer';
import UnlockModal from './rewards/UnlockModal';
import BookReader from './rewards/BookReader';
import { Recommendation } from './today/recommend';
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
import RanksTab from './leaderboard/RanksTab';
import { leaveBoard } from './leaderboard/api';
import { useRace } from './leaderboard/useRace';
import { RaceStrip, RaceToast } from './leaderboard/RaceControl';
import VoiceControl, { VoiceFeedback } from './voice/VoiceControl';
import { VoiceIntent, toQSubject } from './voice/commands';
import { PHASE_LABEL, isIdle as pomodoroIsIdle, isPaused as pomodoroIsPaused } from './today/pomodoro';
import { usePomodoro, PomodoroCommit } from './today/usePomodoro';

const ONBOARDING_KEY = 'onboarding_complete';

/* Ending a session by voice can't stop to ask for a focus rating, so it logs
   at the same neutral 4 the Pomodoro pending-block flush uses. */
const VOICE_QUALITY = 4;

type ChapterHit =
  | { ok: true; subject: Subject; chapter: string }
  | { ok: false; reason: 'none' | 'ambiguous' };

/**
 * Voice gives a rough chapter name ("rotational motion"), never the exact title
 * ("System of Particles & Rotational Motion").
 *
 * Every spoken word must appear in the title, and exactly one chapter may
 * qualify — "thermodynamics" is a real chapter in both Physics and Chemistry,
 * and silently picking one would quietly corrupt syllabus progress.
 */
const findChapter = (spoken: string, classId: 11 | 12, subjects: Subject[]): ChapterHit => {
  const words = spoken.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return { ok: false, reason: 'none' };

  const matches: { subject: Subject; chapter: string }[] = [];
  for (const subject of subjects) {
    if (subject === 'General') continue;
    const chapters = SYLLABUS_DATA[classId][subject as 'Physics' | 'Chemistry' | 'Maths' | 'Biology'] || [];
    for (const chapter of chapters) {
      const title = chapter.toLowerCase();
      if (words.every(w => title.includes(w))) matches.push({ subject, chapter });
    }
  }

  if (!matches.length) return { ok: false, reason: 'none' };
  if (matches.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, ...matches[0] };
};

/** Loosest-to-tightest match of a spoken phrase against a task list. */
const findTask = (spoken: string, tasks: Task[]): Task | null => {
  const query = spoken.toLowerCase().trim();
  if (!query) return null;

  const exact = tasks.find(t => t.text.toLowerCase() === query);
  if (exact) return exact;

  const contains = tasks.find(t => {
    const text = t.text.toLowerCase();
    return text.includes(query) || query.includes(text);
  });
  if (contains) return contains;

  const words = query.split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return null;
  return tasks.find(t => words.every(w => t.text.toLowerCase().includes(w))) ?? null;
};

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
        merged.pomodoro = normalizePomodoro(parsed.pomodoro);
        merged.timerMode = parsed.timerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
        merged.leaderboard = { ...DEFAULT_LEADERBOARD, ...(parsed.leaderboard || {}) };
        /* Rewards arrived late too, and an account with a long history should
           find its earned tiers already in the vault on first load — `evaluate`
           backfills them from the logs. */
        merged.rewards = normalizeRewards(parsed.rewards);
        merged.schedule = normalizeSchedule(parsed.schedule);
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
  /* View-only, and deliberately not in AppState: which width a rail is at on
     this screen is not something to sync to another device. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
              theme: prev.theme,
              // A push from another device must not reach in and restart or
              // rewind a timer running here.
              timer: prev.timer,
              pomodoro: prev.pomodoro,
              // …nor take back a reward already earned here.
              rewards: mergeRewards(normalizeRewards(prev.rewards), normalizeRewards(remoteState.rewards)),
              /* `schedule` deliberately rides the wholesale spread, exactly like
                 `tasks` and `progress`. A union here would look kinder and be
                 wrong: deleting a block on the phone has to reach the laptop,
                 and a device that unions can never be told something is gone.
                 The only place it is safe to merge is the local-newer branch
                 below, where the deletions in play are this device's own. */
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
              // …and anything mid-flight on this device. See the note below.
              timer: localState.timer,
              pomodoro: localState.pomodoro,
              /* Never last-write-wins: an unlock is a receipt, and a stale
                 push from another device must not be able to revoke one. */
              rewards: mergeRewards(
                normalizeRewards(localState.rewards),
                normalizeRewards(remoteState.rewards),
              ),
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
            /* Running timers belong to the device running them, never to the
               account. Taking these from the server resurrected an already
               flushed Pomodoro block on every reload — it was logged locally,
               but the clear could not be pushed back inside the 200ms
               preventSyncOnUpdate window, so the stale server copy won the next
               merge and the same block was logged again, and again. The same
               hazard applies to `timer`: a stale record could restart a
               stopwatch the user had stopped. */
            timer: localState.timer,
            pomodoro: localState.pomodoro,
            rewards: mergeRewards(
              normalizeRewards(localState.rewards),
              normalizeRewards(remoteState.rewards),
            ),
            /* Same treatment as logs and tasks directly above, and for the
               same reason: a block created on this device while the server
               moved on must not be dropped, but a deletion this device made
               must not be undone either. Union only in this branch. */
            schedule: mergeSchedule(
              normalizeSchedule(localState.schedule),
              normalizeSchedule(remoteState.schedule),
            ),
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

  /* ── Rewards ──────────────────────────────────────────────────────────── */

  const [isBookOpen, setIsBookOpen] = useState(false);

  /**
   * Re-derive unlocks whenever the logs move.
   *
   * `evaluateRewards` returns the same object when nothing was earned, so this
   * settles in one pass and never loops — the `setState` below is skipped
   * entirely on the overwhelmingly common no-change path. It also runs once on
   * mount, which is what backfills the vault for users who already had a long
   * streak before rewards existed.
   */
  useEffect(() => {
    setState(prev => {
      const current = normalizeRewards(prev.rewards);
      const next = evaluateRewards(prev.logs, current);
      if (next === current && prev.rewards) return prev;
      return { ...prev, rewards: next };
    });
  }, [state.logs]);

  const selectWallpaper = (id: string | null) => {
    setState(prev => {
      const next = { ...prev, rewards: { ...normalizeRewards(prev.rewards), wallpaper: id }, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
  };

  const setBookChapter = (index: number) => {
    setState(prev => {
      const next = { ...prev, rewards: { ...normalizeRewards(prev.rewards), bookChapter: index }, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
  };

  /* Records that the user opened the claim. The actual conversation happens
     over email — the app never collects a postal address. */
  const claimHamper = () => {
    setState(prev => {
      const rewards = normalizeRewards(prev.rewards);
      if (rewards.hamperClaimedOn) return prev;
      const next = {
        ...prev,
        rewards: { ...rewards, hamperClaimedOn: getISTDateString() },
        lastUpdated: Date.now(),
      };
      stateRef.current = next;
      return next;
    });
  };

  const acknowledgeReward = (id: string) => {
    setState(prev => {
      const rewards = normalizeRewards(prev.rewards);
      if (rewards.acknowledged.includes(id)) return prev;
      const next = {
        ...prev,
        rewards: { ...rewards, acknowledged: [...rewards.acknowledged, id] },
        lastUpdated: Date.now(),
      };
      stateRef.current = next;
      return next;
    });
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

  /* `source` defaults to 'manual' on purpose: only the paths that actually
     measured the time say so explicitly, so a caller that forgets can never
     accidentally donate leaderboard hours. */
  const logStudy = (
    subject: Subject,
    hours: number,
    quality: number,
    distractions: number,
    source: LogSource = 'manual',
    /* What was actually studied, and which planned block it was owed to.
       Both optional and both trailing, so every existing call site is
       unchanged — only the paths that genuinely know pass them. */
    chapter?: string,
    blockId?: string,
  ) => {
    if (hours <= 0) return;
    const today = getISTDateString();
    setState(prev => {
      const newLog: DailyLog = {
        id: generateId(),
        date: today,
        subject,
        hours: parseFloat(hours.toFixed(2)),
        quality: quality,
        distractions: distractions,
        source,
        chapter,
        blockId,
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
      const today = getISTDateString();
      /* Stamp the transitions the coach's spaced-repetition schedule needs.
         Entering `completed` starts the clock; entering `revision_pending` is
         the user telling us they have just been back over it. Existing stamps
         are carried forward so cycling past a state does not erase history. */
      const nextState = {
        ...prev,
        progress: [...filteredProgress, {
          classId, subject, chapter, status: nextStatus, notes: existing?.notes,
          completedAt: nextStatus === 'completed' ? today : existing?.completedAt,
          lastRevisedAt: nextStatus === 'revision_pending' ? today : existing?.lastRevisedAt,
        }],
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /**
   * Accept a coach recommendation: point the timer at that subject, start it,
   * and remember the topic was served so tomorrow offers a different one.
   */
  const engageRecommendation = (rec: Recommendation) => {
    setState(prev => {
      const today = getISTDateString();
      const nextState: AppState = {
        ...prev,
        /* `rec.chapter` was already in hand here and was being dropped, which
           left `hoursOnChapter` in recommend.ts reading a field nothing ever
           wrote. Carrying it is what makes the coach able to see a chapter you
           keep bouncing off. */
        timer: { isRunning: true, startTime: Date.now(), accumulatedMs: 0, subject: rec.subject, chapter: rec.chapter, blockId: undefined },
        coach: {
          ...(prev.coach || DEFAULT_COACH),
          served: { ...(prev.coach?.served || {}), [rec.id.split(':').slice(1).join(':')]: today },
        },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /** "Not now" — suppress for the rest of today only, so it resurfaces
      tomorrow rather than being lost. */
  const dismissRecommendation = (rec: Recommendation) => {
    setState(prev => {
      const today = getISTDateString();
      const sameDay = prev.coach?.dismissedOn === today;
      const nextState: AppState = {
        ...prev,
        coach: {
          served: prev.coach?.served || {},
          dismissedOn: today,
          dismissed: sameDay ? [...(prev.coach?.dismissed || []), rec.id] : [rec.id],
        },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /**
   * Record a mastery test. Clearing every topic confidently is the one thing
   * that marks a chapter complete outright — the tap-to-cycle path still works,
   * but this is the path with evidence behind it.
   */
  const recordTestResult = (
    classId: 11 | 12,
    subject: Subject,
    chapter: string,
    results: Record<string, TopicMastery>,
    allSolid: boolean,
  ) => {
    setState(prev => {
      const today = getISTDateString();
      const existing = prev.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const progress = allSolid
        ? [
            ...prev.progress.filter(p => !(p.classId === classId && p.subject === subject && p.chapter === chapter)),
            {
              classId, subject, chapter,
              status: 'completed' as SyllabusStatus,
              notes: existing?.notes,
              completedAt: today,
              lastRevisedAt: today,
            },
          ]
        : prev.progress;

      const nextState: AppState = {
        ...prev,
        progress,
        topicMastery: { ...(prev.topicMastery || {}), ...results },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const setCoachMuted = (muted: boolean) => {
    setState(prev => {
      const nextState: AppState = {
        ...prev,
        coach: { ...(prev.coach || DEFAULT_COACH), muted },
        lastUpdated: Date.now(),
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
    /* Leaving Pomodoro with a block part-served banks it on the way out.
       Switching modes is a UI choice; it should never be a way to lose the
       twenty minutes you just sat through. */
    if (mode !== 'pomodoro' && !pomodoroIsIdle(stateRef.current.pomodoro)) {
      pomodoro.end();
    }
    setState(prev => {
      const nextState = { ...prev, timerMode: mode, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /**
   * One atomic write for everything a Pomodoro transition touches.
   *
   * The runtime change and the log a block earned must land together. Two
   * separate setStates would leave a window where a block had been counted but
   * not recorded — and it is exactly that window the old flow lived in.
   *
   * `lastUpdated` moves only when something worth syncing changed. Ordinary
   * phase churn is device-local (every merge path keeps the local runtime), so
   * bumping it on every tick would just fight the cloud for no reason.
   */
  const commitPomodoro = (update: Partial<PomodoroRuntime>, extra?: PomodoroCommit) => {
    setState(prev => {
      const runtime = { ...prev.pomodoro, ...update };
      let logs = prev.logs;
      if (extra?.log) logs = [...logs, extra.log];
      if (extra?.rate) {
        const { logId, quality } = extra.rate;
        logs = logs.map(l => (l.id === logId ? { ...l, quality } : l));
      }
      const touched = Boolean(extra?.log || extra?.rate);
      const nextState: AppState = {
        ...prev,
        pomodoro: runtime,
        logs,
        ...(touched ? { lastUpdated: Date.now() } : {}),
      };
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

  /* The engine lives here rather than in the timer component so a block keeps
     running — and keeps being logged — while the user is off looking at their
     streak, their syllabus, or nothing at all. */
  const pomodoro = usePomodoro({
    runtime: state.pomodoro,
    settings: state.pomodoroSettings,
    read: () => ({ pomodoro: stateRef.current.pomodoro, settings: stateRef.current.pomodoroSettings }),
    commit: commitPomodoro,
    active: state.timerMode === 'pomodoro',
    ready: syncSettled,
  });

  /* Throw away an in-progress session without logging it. Used by onboarding:
     a running timer hides the goal card the tour needs to point at, and a
     few seconds started mid-tour isn't real study data worth keeping. */
  const discardActiveSession = () => {
    setState(prev => {
      if (!prev.timer.isRunning && !prev.timer.accumulatedMs) {
        return prev;
      }
      const nextState = {
        ...prev,
        timer: {
          ...prev.timer,
          isRunning: false,
          startTime: null,
          accumulatedMs: 0,
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

  /* ── Plan ─────────────────────────────────────────────────────────
     One helper so the optional slice is dealt with in a single place: every
     mutator below is handed a schedule that definitely exists. */
  const withSchedule = (fn: (s: ScheduleState) => ScheduleState) => {
    setState(prev => {
      const nextState: AppState = {
        ...prev,
        schedule: fn(normalizeSchedule(prev.schedule)),
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const addBlock = (input: Omit<ScheduleBlock, 'id'>) => {
    withSchedule(s => ({ ...s, blocks: [...s.blocks, { ...input, id: generateId() }] }));
  };

  /**
   * Edit one block on the grid.
   *
   * A rule instance has no row of its own — moving one writes an override for
   * that date instead of touching the rule, so dragging Wednesday's slot
   * cannot silently move every Wednesday.
   */
  const updateBlock = (id: string, patch: Partial<Omit<ScheduleBlock, 'id' | 'date'>>) => {
    withSchedule(s => {
      if (!isInstanceId(id)) {
        return { ...s, blocks: s.blocks.map(b => (b.id === id ? { ...b, ...patch } : b)) };
      }
      const parsed = parseInstanceId(id);
      if (!parsed) return s;
      const existing = s.overrides.find(o => o.id === id);
      const next = {
        ...(existing || { id, ruleId: parsed.ruleId, date: parsed.date }),
        ...patch,
        skipped: undefined,
      };
      return {
        ...s,
        overrides: [...s.overrides.filter(o => o.id !== id), next],
      };
    });
  };

  /* A one-off is removed; a rule instance is tombstoned for that date only. */
  const deleteBlock = (id: string) => {
    withSchedule(s => {
      if (!isInstanceId(id)) return { ...s, blocks: s.blocks.filter(b => b.id !== id) };
      const parsed = parseInstanceId(id);
      if (!parsed) return s;
      return {
        ...s,
        overrides: [
          ...s.overrides.filter(o => o.id !== id),
          { id, ruleId: parsed.ruleId, date: parsed.date, skipped: true },
        ],
      };
    });
  };

  /** Put a moved or skipped instance back to whatever the template says. */
  const resetInstance = (ruleId: string, date: string) => {
    withSchedule(s => ({
      ...s,
      overrides: s.overrides.filter(o => o.id !== instanceId(ruleId, date)),
    }));
  };

  const addRule = (input: Omit<TemplateRule, 'id' | 'from'>) => {
    withSchedule(s => ({
      ...s,
      rules: [...s.rules, { ...input, id: generateId(), from: getISTDateString(), until: null }],
    }));
  };

  /**
   * Change a weekly slot from today onward.
   *
   * The old rule is closed at yesterday rather than edited, and a new one
   * opened from today. Editing in place would move the slot on days already
   * spent, so last Monday's adherence would silently be re-measured against a
   * plan that did not exist when it was lived.
   */
  const updateRule = (id: string, patch: Partial<Omit<TemplateRule, 'id' | 'from' | 'until'>>) => {
    withSchedule(s => {
      const rule = s.rules.find(r => r.id === id);
      if (!rule) return s;
      const today = getISTDateString();
      /* Edited the same day it was created: nothing has been lived against it
         yet, so amend it rather than leaving a zero-length husk behind. */
      if (rule.from === today) {
        return { ...s, rules: s.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) };
      }
      const closed = { ...rule, until: addDays(today, -1) };
      const opened: TemplateRule = {
        ...rule,
        ...patch,
        id: generateId(),
        from: today,
        until: null,
      };
      return { ...s, rules: [...s.rules.map(r => (r.id === id ? closed : r)), opened] };
    });
  };

  /* Closed, not deleted — the days it already governed still have to
     materialize the way they were actually planned. A rule created today has
     no such history, so that one really does go. */
  const deleteRule = (id: string) => {
    withSchedule(s => {
      const rule = s.rules.find(r => r.id === id);
      if (!rule) return s;
      const today = getISTDateString();
      if (rule.from >= today) {
        return {
          ...s,
          rules: s.rules.filter(r => r.id !== id),
          overrides: s.overrides.filter(o => o.ruleId !== id),
        };
      }
      return {
        ...s,
        rules: s.rules.map(r => (r.id === id ? { ...r, until: addDays(today, -1) } : r)),
        overrides: s.overrides.filter(o => !(o.ruleId === id && o.date >= today)),
      };
    });
  };

  /**
   * Start a session against a planned block.
   *
   * Deliberately the same shape as `engageRecommendation` above rather than a
   * second copy of the timer rules — the only thing this adds is `blockId`,
   * which is what lets adherence say a block was honoured instead of guessing
   * it from subject and hours.
   */
  const startBlock = (block: ScheduleBlock) => {
    const current = stateRef.current;
    if (current.timer.isRunning || !pomodoroIsIdle(current.pomodoro)) {
      window.alert('A SESSION IS ALREADY RUNNING. FINISH IT.');
      return;
    }
    setState(prev => {
      const nextState: AppState = {
        ...prev,
        timer: {
          isRunning: true,
          startTime: Date.now(),
          accumulatedMs: 0,
          subject: block.subject,
          chapter: block.chapter,
          blockId: block.id,
        },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
    /* Engaging and staying on the grid is a dead end — the running clock is
       on Today. */
    handleTabChange('Today');
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

  /* ── Leaderboard ──
     Strictly opt-in: nothing is written to the shared table until the user
     joins, and leaving deletes their row rather than hiding it. Publishing is
     owned by useRace, which flips to an immediate write the moment `enabled`
     turns on — one place decides what this device tells the board. */
  const joinLeaderboard = (displayName: string) => {
    setState(prev => {
      const nextState = {
        ...prev,
        leaderboard: { ...prev.leaderboard, enabled: true, displayName },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const exitLeaderboard = () => {
    if (user) void leaveBoard(user.id);
    setState(prev => {
      const nextState = {
        ...prev,
        // The name is kept so re-joining doesn't mean typing it again.
        leaderboard: { ...prev.leaderboard, enabled: false },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  const setRaceNotifications = (enabled: boolean) => {
    setState(prev => {
      const nextState = {
        ...prev,
        leaderboard: { ...prev.leaderboard, notifications: enabled },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /* ── Race Control ──
     Mounted here rather than inside the Ranks tab: places change hands while
     the user is on Today, and the alert about it has to fire from wherever
     they are. Owns polling, publishing this device's row, and the day's
     event log. */
  const race = useRace({
    user,
    state,
    watching: activeTab === 'Ranks',
    onNotificationsChange: setRaceNotifications,
  });
  const inTheRace = Boolean(user && state.leaderboard?.enabled);

  /* Voice sets a chapter status outright. Deliberately separate from
     toggleChapterStatus, whose tap-to-cycle behaviour must stay exactly as is. */
  const setChapterStatus = (classId: 11 | 12, subject: Subject, chapter: string, status: SyllabusStatus) => {
    setState(prev => {
      const existing = prev.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const filtered = prev.progress.filter(p => !(p.classId === classId && p.subject === subject && p.chapter === chapter));
      const nextState = {
        ...prev,
        progress: [...filtered, { classId, subject, chapter, status, notes: existing?.notes }],
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  };

  /* ── Voice commands ──
     The parser is pure and exam-agnostic, so every check that depends on live
     state — which subjects are active, what's already running — happens here.
     Reads go through stateRef so a command fired moments after another still
     sees the result of the first. */
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
          const resuming = pomodoroIsPaused(current.pomodoro);
          // The subject only means anything for a work block.
          pomodoro.start(phase === 'work' ? intent.subject : undefined);
          return {
            ok: true,
            message: `${PHASE_LABEL[phase].toUpperCase()} ${resuming ? 'RESUMED' : 'STARTED'}.`,
          };
        }

        if (current.timer.isRunning) return { ok: false, message: 'SESSION ALREADY RUNNING.' };
        const subject = intent.subject ?? current.timer.subject;
        updateTimer({ isRunning: true, startTime: Date.now(), subject });
        return { ok: true, message: `SESSION LIVE: ${subject.toUpperCase()}.` };
      }

      case 'endSession': {
        if (current.timerMode === 'pomodoro') {
          if (pomodoroIsIdle(current.pomodoro)) return { ok: false, message: 'NOTHING RUNNING.' };
          const wasWork = current.pomodoro.phase === 'work';
          // Ending early still banks every minute that was served.
          const { hours } = pomodoro.end();
          if (!wasWork) return { ok: true, message: 'BREAK ENDED.' };
          return hours > 0
            ? { ok: true, message: `BLOCK ENDED. LOGGED ${hours.toFixed(2)}H ${current.pomodoro.subject.toUpperCase()}.` }
            : { ok: true, message: 'BLOCK ENDED. TOO SHORT TO LOG.' };
        }

        const t = current.timer;
        if (!t.isRunning && !t.accumulatedMs) return { ok: false, message: 'NOTHING RUNNING.' };
        const elapsedMs = (t.isRunning ? Date.now() - (t.startTime || Date.now()) : 0) + t.accumulatedMs;
        const hours = elapsedMs / (1000 * 60 * 60);
        // Ending by voice still ends a stopwatch the app timed itself.
        logStudy(t.subject, hours, VOICE_QUALITY, 0, 'timer');
        updateTimer({ isRunning: false, startTime: null, accumulatedMs: 0 });
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

      case 'adjustGoal': {
        const hours = Math.min(24, Math.max(1, current.dailyGoalHours + Math.round(intent.delta)));
        if (hours === current.dailyGoalHours) return { ok: false, message: `TARGET STAYS AT ${hours}H.` };
        updateDailyGoal(hours);
        return { ok: true, message: `DAILY TARGET: ${hours}H.` };
      }

      case 'logHours': {
        const subject = intent.subject ?? current.timer.subject;
        if (!activeSubjects.includes(subject)) {
          return { ok: false, message: `${subject.toUpperCase()} ISN'T IN YOUR ${exam} TRACK.` };
        }
        const hours = Math.round(intent.hours * 100) / 100;
        if (hours <= 0) return { ok: false, message: 'HOW LONG? TRY “LOG 2 HOURS OF PHYSICS”.' };
        /* Backfilled by voice, not measured — 'manual', so it counts towards the
           user's own totals but never towards the leaderboard. */
        logStudy(subject, hours, VOICE_QUALITY, 0, 'manual');
        return { ok: true, message: `LOGGED ${hours}H ${subject.toUpperCase()}.` };
      }

      case 'pauseTimer': {
        if (current.timerMode !== 'pomodoro') {
          return { ok: false, message: 'THE STOPWATCH DOESN’T PAUSE. SAY “END SESSION”.' };
        }
        if (!current.pomodoro.isRunning) return { ok: false, message: 'NOTHING RUNNING.' };
        pomodoro.pause();
        // Paused, not abandoned — the time served is still on the clock.
        return { ok: true, message: 'PAUSED. THE CLOCK IS HELD.' };
      }

      case 'resumeTimer': {
        if (current.timerMode !== 'pomodoro') {
          return { ok: false, message: 'SAY “START SESSION” TO BEGIN.' };
        }
        if (current.pomodoro.isRunning) return { ok: false, message: 'ALREADY RUNNING.' };
        const phase = current.pomodoro.phase;
        pomodoro.start();
        return { ok: true, message: `${PHASE_LABEL[phase].toUpperCase()} RUNNING.` };
      }

      case 'resetPomodoro': {
        if (current.timerMode !== 'pomodoro') return { ok: false, message: 'NOT IN POMODORO MODE.' };
        // Resets the set, not the day: focus already served is logged first.
        const { hours } = pomodoro.reset();
        return {
          ok: true,
          message: hours > 0 ? `SET RESET. LOGGED ${hours.toFixed(2)}H FIRST.` : 'SET RESET.',
        };
      }

      case 'setTimerMode': {
        if (current.timerMode === intent.mode) return { ok: false, message: `ALREADY IN ${intent.mode.toUpperCase()}.` };
        if (current.pomodoro.isRunning || current.timer.isRunning) {
          return { ok: false, message: 'FINISH THE RUNNING SESSION FIRST.' };
        }
        handleTabChange('Today');
        setTimerMode(intent.mode);
        return { ok: true, message: `${intent.mode.toUpperCase()} MODE.` };
      }

      case 'setTheme': {
        if (current.theme === intent.theme) return { ok: false, message: `ALREADY ${intent.theme.toUpperCase()}.` };
        setState(prev => ({ ...prev, theme: intent.theme }));
        return { ok: true, message: `${intent.theme.toUpperCase()} MODE.` };
      }

      case 'completeTask': {
        const open = current.tasks.filter(t => !t.completed);
        const hit = findTask(intent.query, open);
        if (!hit) return { ok: false, message: `NO OPEN TASK MATCHING “${intent.query.slice(0, 24)}”.` };
        toggleTask(hit.id);
        return { ok: true, message: `DONE: ${hit.text.toUpperCase().slice(0, 30)}` };
      }

      case 'deleteTask': {
        const hit = findTask(intent.query, current.tasks);
        if (!hit) return { ok: false, message: `NO TASK MATCHING “${intent.query.slice(0, 24)}”.` };
        deleteTask(hit.id);
        return { ok: true, message: `WIPED: ${hit.text.toUpperCase().slice(0, 30)}` };
      }

      case 'setChapterStatus': {
        const hit: ChapterHit = findChapter(intent.chapter, current.currentClass, activeSubjects);
        if (hit.ok === false) {
          return hit.reason === 'ambiguous'
            ? { ok: false, message: `“${intent.chapter.toUpperCase()}” MATCHES MORE THAN ONE CHAPTER. NAME THE SUBJECT.` }
            : { ok: false, message: `NO CLASS ${current.currentClass} CHAPTER MATCHING “${intent.chapter.slice(0, 24)}”.` };
        }
        setChapterStatus(current.currentClass, hit.subject, hit.chapter, intent.status);
        return { ok: true, message: `${hit.chapter.toUpperCase()} → ${STATUS_LABELS[intent.status].toUpperCase()}.` };
      }

      case 'query': {
        const today = getISTDateString();
        switch (intent.topic) {
          case 'streak': {
            const streak = calculateStreak(current.logs);
            return { ok: true, message: streak > 0 ? `STREAK: ${streak} DAY${streak === 1 ? '' : 'S'}.` : 'NO STREAK. LOG TODAY.' };
          }
          case 'hoursToday': {
            const hours = current.logs.filter(l => l.date === today).reduce((a, l) => a + l.hours, 0);
            return { ok: true, message: `${hours.toFixed(1)}H TODAY, TARGET ${current.dailyGoalHours}H.` };
          }
          case 'goal': {
            const hours = current.logs.filter(l => l.date === today).reduce((a, l) => a + l.hours, 0);
            const left = current.dailyGoalHours - hours;
            return {
              ok: true,
              message: left <= 0
                ? `TARGET HIT. ${hours.toFixed(1)}H DONE.`
                : `${left.toFixed(1)}H SHORT OF TODAY'S ${current.dailyGoalHours}H.`,
            };
          }
          case 'questionsToday': {
            const log = current.questionTracking.dailyQuestionsLog.find(l => l.date === today);
            const counts = (log?.counts ?? {}) as Partial<Record<QSubject, number>>;
            const total = (Object.keys(counts) as QSubject[]).reduce((a, k) => a + (counts[k] ?? 0), 0);
            return { ok: true, message: `${total} QUESTION${total === 1 ? '' : 'S'} TODAY.` };
          }
          case 'score': {
            const score = calculateLockInScore(current.logs, current.currentClass, current.progress, activeSubjects);
            return { ok: true, message: `LOCK-IN SCORE: ${score}/100.` };
          }
          case 'daysLeft': {
            const days = getDaysRemaining(exam === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE);
            return { ok: true, message: `${days} DAYS TO ${exam} 2027.` };
          }
          default:
            return { ok: false, message: 'UNKNOWN QUESTION.' };
        }
      }

      default:
        return { ok: false, message: 'UNKNOWN COMMAND.' };
    }
  };

  const targetExamDate = state.examPreference === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE;
  const daysRemaining = getDaysRemaining(targetExamDate);
  const streakCount = calculateStreak(state.logs);
  const verifiedStreakCount = calculateVerifiedStreak(state.logs);
  const lockInScore = calculateLockInScore(state.logs, state.currentClass, state.progress, activeSubjects);

  /* Normalized on the way out too: a blob written by an older build (or by a
     device that predates a field) must never reach the vault with a missing
     high-water mark and render NaN progress. */
  const rewards = normalizeRewards(state.rewards);
  /* Normalized on read as well as on load: the realtime path spreads a whole
     remote blob, and a blob written by a build that predates this feature has
     no schedule in it at all. */
  const schedule = normalizeSchedule(state.schedule);
  /* Oldest un-shown tier first, so someone returning after a long absence is
     walked up their unlocks one at a time instead of seeing only the last. */
  const celebration = pendingCelebrations(rewards)[0];
  const wallpaper = wallpaperById(rewards.wallpaper);

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
    <div className={`min-h-screen relative selection:bg-[#E10600] selection:text-white transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-[#17150F]'}`}>
      {/* An earned wallpaper, behind everything and reacting to nothing. */}
      {wallpaper && (
        <WallpaperLayer
          wallpaper={wallpaper}
          dark={theme === 'dark'}
          className="fixed inset-0 z-0 pointer-events-none"
        />
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        theme={theme}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(v => !v)}
      />

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

      {/* Margin tracks the rail's width, so collapsing it gives the page the
          space back instead of leaving the app parked to the right of a gap. */}
      <div className={`transition-all duration-300 pt-14 md:pt-0 ${sidebarCollapsed ? 'md:ml-[60px]' : 'md:ml-[200px]'}`}>
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

        <main className="max-w-5xl mx-auto w-full relative z-20 px-4 md:px-6 py-8 pb-16">
          {/* One line of the race, where the sessions actually get started. */}
          {activeTab === 'Today' && inTheRace && (
            <div className="mb-8">
              <RaceStrip status={race.status} onOpen={() => handleTabChange('Ranks')} theme={theme} />
            </div>
          )}
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
              pomodoro={pomodoro}
              onUpdatePomodoroSettings={updatePomodoroSettings}
              theme={theme}
              activeSubjects={activeSubjects}
              examPreference={state.examPreference || 'JEE'}
              onEngageRecommendation={engageRecommendation}
              onDismissRecommendation={dismissRecommendation}
              onSetCoachMuted={setCoachMuted}
              onStartBlock={startBlock}
              onOpenPlan={() => handleTabChange('Plan')}
            />
          )}
          {activeTab === 'Plan' && (
            <PlanTab
              schedule={schedule}
              logs={state.logs}
              timer={state.timer}
              theme={theme}
              activeSubjects={activeSubjects}
              currentClass={state.currentClass}
              examPreference={state.examPreference || 'JEE'}
              onAddBlock={addBlock}
              onUpdateBlock={updateBlock}
              onDeleteBlock={deleteBlock}
              onResetInstance={resetInstance}
              onAddRule={addRule}
              onUpdateRule={updateRule}
              onDeleteRule={deleteRule}
              onStartBlock={startBlock}
            />
          )}
          {activeTab === 'Syllabus' && (
            <SyllabusTab
              currentClass={state.currentClass}
              progress={state.progress}
              onToggle={toggleChapterStatus}
              theme={theme}
              activeSubjects={activeSubjects}
              examPreference={state.examPreference || 'JEE'}
              onTestFinished={recordTestResult}
            />
          )}
          {activeTab === 'Streak' && (
            <StreakTab
              streak={streakCount}
              verifiedStreak={verifiedStreakCount}
              logs={state.logs}
              dailyGoalHours={state.dailyGoalHours}
              theme={theme}
              dailyQuestionsLog={state.questionTracking.dailyQuestionsLog}
              coreSubjects={coreQSubjects}
              activeSubjects={activeSubjects}
              rewards={rewards}
              onSelectWallpaper={selectWallpaper}
              onOpenBook={() => setIsBookOpen(true)}
              onClaimHamper={claimHamper}
            />
          )}
          {activeTab === 'Questions' && (
            <QuestionsTab
              questionTracking={state.questionTracking}
              onUpdateTracking={updateQuestionTracking}
              onLogQuestions={logQuestions}
              theme={theme}
              coreSubjects={coreQSubjects}
            />
          )}
          {activeTab === 'Ranks' && (
            <RanksTab
              user={user}
              logs={state.logs}
              prefs={state.leaderboard ?? DEFAULT_LEADERBOARD}
              race={race}
              onJoin={joinLeaderboard}
              onLeave={exitLeaderboard}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              theme={theme}
            />
          )}
          {activeTab === 'Review' && (
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
      {!showOnboarding && (
        <VoiceControl theme={theme} onCommand={executeVoiceCommand} />
      )}

      {/* A place changing hands, wherever the user happens to be. Suppressed
          during the tour, which owns the screen. */}
      {!showOnboarding && (
        <RaceToast event={race.toast} onDismiss={race.dismissToast} theme={theme} />
      )}

      {/* The payoff. Held back until the tour is done and the book is closed,
          so it never lands on top of another full-screen moment. */}
      {!showOnboarding && !isBookOpen && celebration && (
        <UnlockModal
          def={celebration}
          theme={theme}
          onDismiss={() => acknowledgeReward(celebration.id)}
          onOpen={() => {
            acknowledgeReward(celebration.id);
            if (celebration.kind === 'book') setIsBookOpen(true);
            else handleTabChange('Streak');
          }}
        />
      )}

      {isBookOpen && (
        <BookReader
          theme={theme}
          chapter={rewards.bookChapter ?? 0}
          onChapterChange={setBookChapter}
          onClose={() => setIsBookOpen(false)}
        />
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
