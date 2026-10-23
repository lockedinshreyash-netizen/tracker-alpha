import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppState, TabType, DailyLog, Subject, TimerState, SyncStatus, QSubject, ExamPreference, ErrorEntry, MockTest, MocksState, TimerMode, PomodoroRuntime, PomodoroSettings, SyllabusStatus, Task, LogSource, TopicMastery, ScheduleState, ScheduleBlock, TemplateRule, BlockKind, TaskColumn, ReminderPrefs } from './types';
import { getActiveSubjects, getCoreSubjects, getCoreQSubjects, STATUS_CYCLE } from './constants';
import { getISTDateString, calculateStreak, calculateVerifiedStreak, streakLedger, calculateLockInScore, generateId, addDays } from './utils';
import { supabase } from './supabaseClient';
import { DEFAULT_STATE, DEFAULT_POMODORO_SETTINGS, DEFAULT_LEADERBOARD, DEFAULT_COACH, DEFAULT_REMINDERS, NUDGED_KEEP, MAX_QUESTION_ENTRIES, normalizePomodoro, normalizeReminders, normalizeSchedule, normalizeTasks, normalizeSleep, normalizeAnalysis, normalizeAi, mergeSleep, mergeAnalysis, mergeAi } from './state';
import { evaluate as evaluateRewards, normalizeRewards, mergeRewards, pendingCelebrations, nextReward } from './rewards/engine';
import { mergeSchedule, instanceId, isInstanceId, parseInstanceId } from './schedule/schedule';
import PlanTab from './schedule/PlanTab';
import { wallpaperById } from './rewards/wallpapers';
import WallpaperLayer from './rewards/WallpaperLayer';
import UnlockModal from './rewards/UnlockModal';
import StreakMoment, { markStreakMoment, streakMomentDue } from './streak/StreakMoment';
import * as sfx from './audio';
import { loggedCue } from './sound/cues';
import { useSoundHotkey } from './sound/useSound';
import { soundForTaskMove } from './sound/moments';
/* Lazy: the whole text of the day-100 book rides in this chunk, not the main bundle. */
const BookReader = React.lazy(() => import('./rewards/BookReader'));
import { Recommendation } from './today/recommend';
import MocksTab from './mocks/MocksTab';
import { applyAttempts, mergeMocks, normalizeMocks } from './mocks/model';
import { mergeReading, normalizeReading, type ReadingState } from './reader/model';
import { BOOK } from './content/book';
import Sidebar from './Sidebar';
import LandingPage from './LandingPage';
import { landingWillShow } from './landing/gate';
import { readDeepLink, settleDeepLink } from './landing/deeplink';
import AuthModal from './AuthModal';
import QuickSettings from './settings/QuickSettings';
import ClassSwitch from './settings/ClassSwitch';
import TodayTab from './today/TodayTab';
import { CardPeriod } from './share/types';
/* Lazy boundaries. The share renderer is fetched on the click, not on the tab:
   a user who never shares never pays for it. Decks (the scheduler, the deck
   file reader, the editor) is fetched when the tab is first opened. */
const ShareModal = React.lazy(() => import('./share/ShareModal'));
/* Seen once per device: the flow, its stylesheet and its film stay out of the bundle everyone downloads. */
const OnboardingFlow = React.lazy(() => import('./onboarding/OnboardingFlow'));
const DecksTab = React.lazy(() => import('./decks/DecksTab'));
/* Notes: the store and Yjs arrive with the tab, the editor with the first page. */
const NotesTab = React.lazy(() => import('./notes/NotesTab'));
import SyllabusTab from './syllabus/SyllabusTab';
import StreakTab from './streak/StreakTab';
import ReviewTab from './review/ReviewTab';
import type { OnboardingResult, ProfilePick } from './onboarding/OnboardingFlow';
import RanksTab from './leaderboard/RanksTab';
import { leaveBoard } from './leaderboard/api';
import { useRace } from './leaderboard/useRace';
import { RaceStrip } from './leaderboard/RaceControl';
import { useProfileController } from './profile/useProfileController';
import { updateProfile, validateBio } from './profile/profileApi';
import { setCachedProfile } from './profile/profileCache';
import { DEFAULT_ALPHA_AVATAR_ID } from './profile/alphaAvatars';
import { ProfileModal, ProfilePage } from './profile/ProfileView';
import EditProfile from './profile/EditProfile';
import ToastHost from './notify/ToastHost';
import { moveCard, nextOrder } from './board/board';
import { useReminders } from './reminders/useReminders';
import { useNudges } from './reminders/useNudges';
import { materializeDay } from './schedule/schedule';
import { isIdle as pomodoroIsIdle, heldMode, effectiveMode } from './today/pomodoro';
import { usePomodoro, PomodoroCommit } from './today/usePomodoro';
import { isArmed as stopwatchArmed } from './today/stopwatch';
import { useAdmin } from './admin/useAdmin';
import { useFeature } from './cbt/useFeature';
import AdminTab from './admin/AdminTab';
import { FESTIVE_LABEL, useFestiveOptOut, useFestiveTheme } from './festive/useFestiveTheme';
/* Lazy: a student on an ordinary day downloads none of the festive artwork. */
const FestiveLayer = React.lazy(() => import('./festive/FestiveLayer'));
import { useAnnouncements } from './announce/useAnnouncements';
import AnnouncementModal from './announce/AnnouncementModal';
import { useModerationNotices } from './moderation/useModerationNotices';
import RemovalNoticeModal from './moderation/RemovalNoticeModal';
import { humanError as moderationError, rejoinLeaderboard } from './moderation/api';
import FeedbackWidget from './feedback/FeedbackWidget';
import { useInstall } from './install/useInstall';
import KeepBanner from './install/KeepBanner';
import { usePresence } from './install/usePresence';
import { buildSummary, publishSummary } from './install/extensionSummary';
import GroupsTab from './groups/GroupsTab';
import { useGroups } from './groups/useGroups';
import { clearPendingInvite, takePendingInvite } from './groups/invite';
import { forgetGroupsOnDevice } from './groups/publish';
import { forgetDecksOnDevice } from './decks/forget';
import { flushNotesBeforeSignOut, forgetNotesOnDevice } from './notes/forget';
import { mergeNotesPref, notesOn } from './notes/pref';
import type { NotesRequest } from './notes/NotesTab';
import { useActivityPing } from './analytics/useActivityPing';
import { forgetAnalyticsOnDevice } from './analytics/track';
import { deleteAccount } from './account/deleteAccount';

const ONBOARDING_KEY = 'onboarding_complete';

// --- Main App Component ---

const App: React.FC = () => {
  /* `/?open=syllabus&exam=NEET` from a guide page. Read before state so a new
     student can start with that exam. See landing/deeplink.ts. */
  const [deepLink] = useState(readDeepLink);
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
        /* Held to the session armed here, which also repairs a state saved
           while a synced mode was hiding it (see `heldMode`). */
        merged.timerMode = heldMode(merged.timer, merged.pomodoro)
          ?? (parsed.timerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch');
        merged.leaderboard = { ...DEFAULT_LEADERBOARD, ...(parsed.leaderboard || {}) };
        /* Rewards arrived late too, and an account with a long history should
           find its earned tiers already in the vault on first load — `evaluate`
           backfills them from the logs. */
        merged.rewards = normalizeRewards(parsed.rewards);
        merged.reminders = normalizeReminders(parsed.reminders);
      merged.tasks = normalizeTasks(parsed.tasks);
      /* Tasks first, so the schedule can be told which task ids still exist and
         drop links to ones that are gone — the same stance it takes on an
         override whose rule has been deleted. This is the one place with both
         halves in hand, which is why the cleanup happens on load rather than on
         every write. */
      merged.schedule = normalizeSchedule(parsed.schedule, new Set(merged.tasks.map(t => t.id)));
      /* Both arrived after these users already had saved state, and both are
         only ever read to be averaged — so an impossible row is worse than a
         missing one. It cannot be seen on screen and cannot be corrected, but
         it silently moves a figure the student is being shown as a fact about
         themselves. */
      merged.sleep = normalizeSleep(parsed.sleep);
      merged.analysis = normalizeAnalysis(parsed.analysis);
      merged.ai = normalizeAi(parsed.ai);
      merged.mocks = normalizeMocks(parsed.mocks);
      /* The reader used to remember only a chapter index (rewards.bookChapter);
         a student mid-book reopens in that chapter. */
      merged.reading = normalizeReading(parsed.reading, BOOK.chapterIds[parsed.rewards?.bookChapter ?? -1] ?? null);
      /* The Questions tab became Mocks and took its slot in the rail. */
      if ((parsed.lastUsedTab as string) === 'Questions') merged.lastUsedTab = 'Mocks';
      // The Observatory was removed; anyone who left the app there lands on Today.
      if ((parsed.lastUsedTab as string) === 'Observatory') merged.lastUsedTab = 'Today';
        return merged;
      } catch (e) {
        return DEFAULT_STATE;
      }
    }
    return deepLink?.exam ? { ...DEFAULT_STATE, examPreference: deepLink.exam } : DEFAULT_STATE;
  });

  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(deepLink?.tab ?? state.lastUsedTab);
  useEffect(() => { if (deepLink) settleDeepLink(); }, [deepLink]);
  /* Which period the share sheet opened on, or null when it is closed. The
     entry point decides: Today opens on the day, Streak on the week. */
  const [sharePeriod, setSharePeriod] = useState<CardPeriod | null>(null);
  /* Memoised because App re-renders on every timer tick, and a fresh object
     each time would make the sheet rebuild its card once a second. */
  const shareInput = useMemo(() => ({
    logs: state.logs,
    tasks: state.tasks,
    dailyQuestionsLog: state.questionTracking.dailyQuestionsLog,
    dailyGoalHours: state.dailyGoalHours,
  }), [state.logs, state.tasks, state.questionTracking.dailyQuestionsLog, state.dailyGoalHours]);
  /* null = still checking the session. A first-time visitor with no stored
     session is answered at once, so the pre-rendered landing page hydrates on
     the first render instead of being swapped for a blank screen while
     getSession() runs. See landing/gate.ts. */
  const [showLanding, setShowLanding] = useState<boolean | null>(() => (landingWillShow() ? true : null));
  /* A group invite from `/?join=CODE`, lifted out of the URL on the first
     render and held (in localStorage too) until it is used or dismissed — the
     person opening it has often not signed up yet. See groups/invite.ts. */
  const [pendingInvite, setPendingInvite] = useState<string | null>(takePendingInvite);
  /* View-only, and deliberately not in AppState: which width a rail is at on
     this screen is not something to sync to another device. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /* Notes is a writing room: the rail folds to its icons on the way in and
     goes back to however it was on the way out. Above every early return. */
  const railBeforeNotes = useRef<boolean | null>(null);
  useEffect(() => {
    if (activeTab === 'Notes') {
      if (railBeforeNotes.current === null) {
        railBeforeNotes.current = sidebarCollapsed;
        setSidebarCollapsed(true);
      }
    } else if (railBeforeNotes.current !== null) {
      setSidebarCollapsed(railBeforeNotes.current);
      railBeforeNotes.current = null;
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
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

  /* ── Staff ──
     Asked of the server, never read out of AppState: that blob is written by
     this client, so a role kept there would be a privilege the client could
     grant itself. This only decides whether the console is drawn; every query
     it makes is re-authorized in the database. See admin/useAdmin. */
  const { isAdmin, checked: adminChecked } = useAdmin(user);
  /* The festive theme an administrator has switched on for everyone (festive/). */
  const festiveLive = useFestiveTheme();
  /* A student can turn the live theme off on this device (quick settings). */
  const [festiveOff, setFestiveOff] = useFestiveOptOut(festiveLive);
  const festive = festiveOff ? 'none' : festiveLive;

  /* ── The private CBT ──
     Same stance as the console: asked of the server (`has_feature('cbt')`),
     decides only whether the Question bank is drawn, and every query behind it
     is re-checked by RLS. See supabase/cbt.sql. */
  const cbtEnabled = useFeature(user, 'cbt');

  /* ── App-wide announcements ──
     Checked on the way into Today and nowhere else, which is the whole
     feature: one message, one tab, one acknowledgement. Signed-out users have
     no per-user read state to keep, so they are never shown one. */
  const announcements = useAnnouncements(user, activeTab === 'Today');

  /* A saved `lastUsedTab` of 'Admin' can outlive the role that earned it — an
     administrator stood down, or somebody signed out on a shared laptop. Wait
     for the answer (`adminChecked`) before acting, or an administrator's own
     reload would bounce them off their console while the check is in flight. */
  useEffect(() => {
    if (activeTab === 'Admin' && adminChecked && !isAdmin) {
      setActiveTab('Today');
      setState(prev => (prev.lastUsedTab === 'Admin' ? { ...prev, lastUsedTab: 'Today' } : prev));
    }
  }, [activeTab, adminChecked, isAdmin]);

  const isInitialSyncDone = useRef(false);
  const isSyncingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const stateRef = useRef(state);
  const preventSyncOnUpdate = useRef(false);

  /* Memoised because `getActiveSubjects` returns a fresh array literal every
     call, and this is read on every render. An unstable array here silently
     defeats React.memo on every child that receives it — including the task
     board, which sits inside a tab that re-renders ten times a second while a
     stopwatch is running. */
  const activeSubjects = useMemo(() => getActiveSubjects(state.examPreference), [state.examPreference]);
  const coreSubjects = getCoreSubjects(state.examPreference);
  const coreQSubjects = getCoreQSubjects(state.examPreference);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Handle Auth, Initial Fetch, and Landing Page gating
  useEffect(() => {
    // Arriving through a guide page's deep link counts as having chosen the app.
    const hasVisited = localStorage.getItem('hasVisited') === 'true' || deepLink !== null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        handleInitialSync(u.id);
        setShowLanding(false);
      } else {
        /* An invite link skips the landing page: the person was sent to a
           specific group by a friend, and a pitch for the whole product
           standing between them and it is the fastest way to lose them. */
        setShowLanding(!hasVisited && !pendingInvite);
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
              notes: mergeNotesPref(prev.notes, remoteState.notes),
              // A push from another device must not reach in and restart or
              // rewind a timer running here…
              timer: prev.timer,
              pomodoro: prev.pomodoro,
              // …nor switch the Today tab away from it (see `heldMode`).
              timerMode: heldMode(prev.timer, prev.pomodoro) ?? remoteState.timerMode ?? prev.timerMode,
              // …nor take back a reward already earned here.
              rewards: mergeRewards(normalizeRewards(prev.rewards), normalizeRewards(remoteState.rewards)),
              /* `schedule` deliberately rides the wholesale spread, exactly like
                 `tasks` and `progress`. A union here would look kinder and be
                 wrong: deleting a block on the phone has to reach the laptop,
                 and a device that unions can never be told something is gone.
                 The only place it is safe to merge is the local-newer branch
                 below, where the deletions in play are this device's own.
                 `sleep` rides it for the same reason. */
              /* `analysis` is the exception, and the only one: its merge takes
                 the EARLIER start rather than unioning rows, so it cannot
                 resurrect anything — it can only stop a remote copy pushing the
                 experiment's beginning forwards and shortening a day count
                 mid-session. */
              analysis: mergeAnalysis(normalizeAnalysis(prev.analysis), normalizeAnalysis(remoteState.analysis)),
              ai: mergeAi(normalizeAi(prev.ai), normalizeAi(remoteState.ai)),
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
              notes: mergeNotesPref(localState.notes, remoteState.notes),
              // …and anything mid-flight on this device. See the note below.
              timer: localState.timer,
              pomodoro: localState.pomodoro,
              timerMode: heldMode(localState.timer, localState.pomodoro) ?? remoteState.timerMode ?? localState.timerMode,
              /* Never last-write-wins: an unlock is a receipt, and a stale
                 push from another device must not be able to revoke one. */
              rewards: mergeRewards(
                normalizeRewards(localState.rewards),
                normalizeRewards(remoteState.rewards),
              ),
              /* Merged rather than taken wholesale even here, for the one
                 property `mergeAnalysis` guarantees: the experiment began once,
                 and a later start arriving from another device must not shorten
                 a day count the student has been watching go up. */
              analysis: mergeAnalysis(
                normalizeAnalysis(localState.analysis),
                normalizeAnalysis(remoteState.analysis),
              ),
              /* Safe to union in every path, unlike sleep or logs: a cached
                 insight is immutable and keyed by a hash of the numbers that
                 produced it, so there is no stale one to resurrect and nothing
                 a merge can undo. */
              ai: mergeAi(normalizeAi(localState.ai), normalizeAi(remoteState.ai)),
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
            notes: mergeNotesPref(localState.notes, remoteState.notes),
            /* Running timers belong to the device running them, never to the
               account. Taking these from the server resurrected an already
               flushed Pomodoro block on every reload — it was logged locally,
               but the clear could not be pushed back inside the 200ms
               preventSyncOnUpdate window, so the stale server copy won the next
               merge and the same block was logged again, and again. The same
               hazard applies to `timer`: a stale record could restart a
               stopwatch the user had stopped. The mode that shows them is held
               with them while one is armed: a phone's Stopwatch landing on a
               laptop mid-block hid the block and locked the switch back. */
            timer: localState.timer,
            pomodoro: localState.pomodoro,
            timerMode: heldMode(localState.timer, localState.pomodoro) ?? remoteState.timerMode ?? localState.timerMode,
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
            /* Union by date, in this branch only — exactly the rule the by-id
               merges of `logs` and `tasks` above follow, and for the same
               reason: a night recorded on the phone must survive, and a night
               deleted on the phone must still be able to reach the laptop. A
               device that only ever unions can never be told something is
               gone. */
            sleep: mergeSleep(
              normalizeSleep(localState.sleep),
              normalizeSleep(remoteState.sleep),
            ),
            analysis: mergeAnalysis(
              normalizeAnalysis(localState.analysis),
              normalizeAnalysis(remoteState.analysis),
            ),
            ai: mergeAi(normalizeAi(localState.ai), normalizeAi(remoteState.ai)),
            /* Union by id with the later `updatedAt` winning, in this branch
               only — the same rule as logs, tasks and the schedule above. A
               result logged on the phone must survive; a mock deleted on the
               phone must still be able to reach the laptop. */
            mocks: mergeMocks(normalizeMocks(localState.mocks), normalizeMocks(remoteState.mocks)),
            /* Same rule again for the book. Deleting a highlight leaves a
               dated tombstone, so the union cannot bring it back; the newer
               reading position wins; a chapter's furthest point only rises. */
            reading: mergeReading(normalizeReading(localState.reading), normalizeReading(remoteState.reading)),
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

  /* Keyed on the user's id, not the object. Supabase re-emits SIGNED_IN (or
     TOKEN_REFRESHED) with a freshly parsed user every time a tab comes back to
     the foreground, so `[state, user]` pushed on every resume. A phone resumed
     from memory hours later then stamped its stale copy as the newest state in
     the account, and the next device to open adopted it wholesale. */
  useEffect(() => {
    localStorage.setItem('locked_in_state_v2', JSON.stringify(state));
    if (user && isInitialSyncDone.current && !preventSyncOnUpdate.current) {
      triggerSync();
    }
  }, [state, user?.id]);

  /* What signing out and deleting the account both leave on this device:
     nothing of the account. One list, so the two can never drift apart. */
  const forgetAccountOnDevice = () => {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    localStorage.removeItem('locked_in_state_v2');
    forgetGroupsOnDevice();
    forgetDecksOnDevice();
    forgetNotesOnDevice();
    forgetAnalyticsOnDevice();
  };

  const handleSignOut = async () => {
    if (window.confirm("SIGN OUT? Your session data on this device will be cleared for security. Your cloud record is safe.")) {
      try {
        preventSyncOnUpdate.current = true;
        // Notes typed offline are only in the outbox; send them while the session can.
        if (user) await flushNotesBeforeSignOut(user.id);
        await supabase.auth.signOut();
        forgetAccountOnDevice();
        setState(DEFAULT_STATE);
        setActiveTab('Today');
        window.location.href = window.location.origin;
      } catch (err) {
        localStorage.clear();
        window.location.href = window.location.origin;
      }
    }
  };

  /* Review → Account & sync → Delete account (account/DeleteAccountSheet.tsx).
     Sync is held off first and never released on success: the state effect
     would otherwise upsert this device's copy straight back into
     user_profiles between the delete and the reload, and if that table's
     foreign key does not cascade it would land as a row with no account. */
  const handleDeleteAccount = async (): Promise<void> => {
    if (!user) return;
    preventSyncOnUpdate.current = true;
    try {
      await deleteAccount(user.id);
    } catch (e) {
      preventSyncOnUpdate.current = false;
      throw e;
    }
    // The server session died with the account; only this device's copy is left to clear.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => { /* already gone */ });
    forgetAccountOnDevice();
    /* Signing out changes `user?.id`, which re-runs the effect that writes
       `locked_in_state_v2` before the reload lands. It must write the default,
       as sign-out's does, not the account just deleted. */
    setState(DEFAULT_STATE);
    setActiveTab('Today');
    window.location.href = window.location.origin;
  };

  const theme = state.theme || 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#0B0B0D' : '#F2F0EC';
    document.body.style.color = theme === 'dark' ? '#FFFFFF' : '#17150F';
  }, [theme]);

  /* A deck the admin console asked to open; DecksTab takes it and clears it. */
  const [deckToOpen, setDeckToOpen] = useState<string | null>(null);
  const clearDeckToOpen = useCallback(() => setDeckToOpen(null), []);

  /* Syllabus → a chapter's notes page: Notes opens it, or makes it. */
  const [notesRequest, setNotesRequest] = useState<NotesRequest | null>(null);
  const clearNotesRequest = useCallback(() => setNotesRequest(null), []);
  const openChapterNotes = useCallback((classId: 11 | 12, subject: Subject, chapter: string) => {
    setNotesRequest({ key: `${classId}|${subject}|${chapter}`, chapter, subject, nonce: Date.now() });
    handleTabChange('Notes');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openSyllabusTab = useCallback(() => handleTabChange('Syllabus'), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* Notes is opt-in: until it is on, the tab is its cover page and nothing
     of the workspace (its database, the editor, sync) is loaded. */
  const notesEnabled = notesOn(state.notes);
  const setNotesEnabled = useCallback((on: boolean) => {
    setState(prev => {
      const next = { ...prev, notes: { on, at: Date.now() }, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
  }, []);

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

  /* Opens the streak moment once the first log of the day has landed, so the
     streak it shows is derived from the logs that include it. */
  useEffect(() => {
    if (!pendingStreakMoment.current) return;
    pendingStreakMoment.current = false;
    const today = getISTDateString();
    if (!state.logs.some(l => l.date === today)) return;
    markStreakMoment(user?.id ?? null, today);
    setStreakMoment(calculateStreak(state.logs));
  }, [state.logs]);

  const selectWallpaper = (id: string | null) => {
    setState(prev => {
      const next = { ...prev, rewards: { ...normalizeRewards(prev.rewards), wallpaper: id }, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
  };

  /* Every change the book makes — a highlight, a note, a tick, the reading
     position — is one AppState write through here. The reader batches the
     position itself (reader/usePosition.ts), so scrolling is not a write. */
  const withReading = useCallback((fn: (r: ReadingState) => ReadingState) => {
    setState(prev => {
      const before = normalizeReading(prev.reading);
      const after = fn(before);
      if (after === before) return prev;
      const next = { ...prev, reading: after, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
  }, []);

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

  /* Onboarding's one write, when the pledge is held to the end. Skipping
     writes nothing. It never touches the Plan tab: the student lays out their
     own day there. */
  const applyOnboarding = (r: OnboardingResult) => {
    setState(prev => {
      const next: AppState = {
        ...prev,
        examPreference: r.examPreference,
        currentClass: r.currentClass,
        dailyGoalHours: r.dailyGoalHours,
        timerMode: r.timerMode,
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

  /* The exam picked on the landing page's toggle, carried into onboarding so
     a NEET student who said NEET is not asked as if they hadn't. */
  const landingExam = useRef<ExamPreference | null>(null);

  /* ── What a new log sounds like ──
     Read from `stateRef` before the write lands, so "first log today" and
     "crossed the target" compare against the state the user was looking at.
     Only the two paths that write a study log call this (logStudy and
     commitPomodoro), and only for a log dated today: a sync pull, a realtime
     update or a backfill for a past day never reaches it, so none of them can
     open the streak moment or ring anything. */
  const [streakMoment, setStreakMoment] = useState<number | null>(null);
  const pendingStreakMoment = useRef(false);
  const closeStreakMoment = useCallback(() => setStreakMoment(null), []);
  /* The class switch, drawn twice (the phone's capsule and the laptop's corner). */
  const setCurrentClass = useCallback((c: 11 | 12) => setState(p => ({ ...p, currentClass: c })), []);
  // The core sounds are fetched once the app is on screen, never under the landing page.
  useEffect(() => {
    if (showLanding === false) sfx.prefetchCore();
  }, [showLanding]);
  // `M` mutes and unmutes from anywhere. Desktop is most of the audience.
  useSoundHotkey();

  const celebrateLog = (date: string, hours: number, opts: { rang?: boolean } = {}) => {
    const today = getISTDateString();
    if (date !== today || hours <= 0) return;
    const before = stateRef.current;
    const todays = before.logs.filter(l => l.date === today);
    if (todays.length === 0 && streakMomentDue(user?.id ?? null, today)) {
      // The moment owns the sound; it opens once the log is in (effect below).
      pendingStreakMoment.current = true;
      return;
    }
    const had = todays.reduce((sum, l) => sum + l.hours, 0);
    const goal = before.dailyGoalHours;
    if (goal > 0 && had < goal && had + hours >= goal) {
      sfx.play('target-hit');
      return;
    }
    // A Pomodoro bell already rang for this block; a second sound on top is noise.
    if (!opts.rang) sfx.play(loggedCue(hours));
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
    /* When the session actually ran. Trailing and optional like the two above,
       so every existing call site is unchanged — only the paths that genuinely
       measured the time pass them, and a manual backfill passes nothing. That
       asymmetry is the whole guarantee: a log with no clock behind it can never
       reach the analysis, because it has no timestamps to be read. */
    startedAt?: number,
    endedAt?: number,
  ) => {
    if (hours <= 0) return;
    /* Both or neither. Half an interval cannot be placed on a clock, and a
       log carrying one of the two would be silently dropped downstream by
       `isObserved` anyway — better not to write it. */
    const timed = Number.isFinite(startedAt) && Number.isFinite(endedAt) && (endedAt as number) > (startedAt as number);
    /* A measured session belongs to the study day it ended on. That is today
       for everything but a stopwatch paused last night and ended this morning,
       whose minutes were served — and keep the streak — on the day before. */
    const date = timed ? getISTDateString(new Date(endedAt as number)) : getISTDateString();
    celebrateLog(date, hours);
    setState(prev => {
      const newLog: DailyLog = {
        id: generateId(),
        date,
        subject,
        hours: parseFloat(hours.toFixed(2)),
        quality: quality,
        distractions: distractions,
        source,
        chapter,
        blockId,
        startedAt: timed ? Math.floor(startedAt as number) : undefined,
        endedAt: timed ? Math.floor(endedAt as number) : undefined,
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
    {
      const existing = stateRef.current.progress.find(p => p.classId === classId && p.subject === subject && p.chapter === chapter);
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(existing ? existing.status : 'not_started') + 1) % STATUS_CYCLE.length];
      sfx.play(next === 'completed' ? 'chapter-complete' : 'tap');
    }
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
    sfx.play('session-start');
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
    if (timerUpdate.isRunning && !stateRef.current.timer.isRunning) sfx.play('session-start');
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
    if (extra?.log) celebrateLog(extra.log.date, extra.log.hours, { rang: extra.rang });
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
    active: effectiveMode(state) === 'pomodoro',
    ready: syncSettled,
  });

  /* ── Leaving onboarding ──
     Three ways out, all landing on Today. The pledge has already written the
     answers by the time any of these can be reached, except Skip, which by
     design writes nothing. */
  const finishOnboarding = () => {
    completeOnboarding();
    handleTabChangeAndExitProfile('Today');
  };

  /* The first session, started from onboarding's last screen in whichever
     mode the student chose. A session already running (a returning student)
     is left alone: they land on it instead. */
  const startFirstSession = (subject: Subject) => {
    const current = stateRef.current;
    if (!stopwatchArmed(current.timer) && pomodoroIsIdle(current.pomodoro)) {
      if (current.timerMode === 'pomodoro') {
        pomodoro.start(subject);
      } else {
        sfx.play('session-start');
        setState(prev => {
          const next: AppState = {
            ...prev,
            timer: { isRunning: true, startTime: Date.now(), accumulatedMs: 0, subject, chapter: undefined, blockId: undefined },
            lastUpdated: Date.now(),
          };
          stateRef.current = next;
          return next;
        });
      }
    }
    finishOnboarding();
  };

  /* Google, the only way in (onboarding and the settings pane). The page
     navigates away and comes back signed in; onboarding, if it was still
     running, picks up where it left off. Resolves only if Google could not
     be reached. */
  const signInWithGoogle = async (): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
      return error ? 'Could not reach Google. Try again.' : null;
    } catch {
      return 'Could not reach Google. Try again.';
    }
  };

  /* A student signing in on a new device already has a history: they are not
     new, and asking them to set up again would be noise. Decided after the
     cloud pull, which is what brings the history in. */
  useEffect(() => {
    if (needsOnboarding && syncSettled && user && state.logs.length > 0) completeOnboarding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOnboarding, syncSettled, user?.id, state.logs.length]);

  /* Mounted here for the same reason, and it is the whole of the deadline
     feature for a signed-out user: nothing in this engine touches Supabase.
     Push (below) is an additional delivery channel, not a dependency. */
  const reminderPrefs = state.reminders ?? DEFAULT_REMINDERS;
  const remindersReady = syncSettled;

  const todayPlanBlocks = useMemo(
    () => materializeDay(normalizeSchedule(state.schedule), getISTDateString()),
    [state.schedule],
  );

  const readReminders = useCallback(() => ({
    tasks: stateRef.current.tasks,
    prefs: stateRef.current.reminders ?? DEFAULT_REMINDERS,
    blocks: materializeDay(normalizeSchedule(stateRef.current.schedule), getISTDateString()),
  }), []);

  const commitReminded = useCallback((taskId: string, remindedKey: string) => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: prev.tasks.map(t => (t.id === taskId ? { ...t, remindedKey } : t)),
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  useReminders({
    tasks: state.tasks,
    prefs: reminderPrefs,
    blocks: todayPlanBlocks,
    read: readReminders,
    commit: commitReminded,
    ready: remindersReady,
    busy: stopwatchArmed(state.timer) || !pomodoroIsIdle(state.pomodoro),
  });

  /* ── Daily nudges ── (reminders/nudges.ts) Said here while the app is open;
     published below for when it is not. */
  const readNudges = useCallback(() => ({
    logs: stateRef.current.logs,
    goalHours: stateRef.current.dailyGoalHours,
    prefs: stateRef.current.reminders ?? DEFAULT_REMINDERS,
  }), []);

  const commitNudged = useCallback((keys: string[]) => {
    setState(prev => {
      const r = prev.reminders ?? DEFAULT_REMINDERS;
      const nudged = [...(r.nudged ?? []).filter(k => !keys.includes(k)), ...keys].slice(-NUDGED_KEEP);
      const nextState = { ...prev, reminders: { ...r, nudged }, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  useNudges({
    logs: state.logs,
    goalHours: state.dailyGoalHours,
    prefs: reminderPrefs,
    read: readNudges,
    commit: commitNudged,
    ready: remindersReady,
    busy: stopwatchArmed(state.timer) || !pomodoroIsIdle(state.pomodoro),
  });

  /* Publish what the server should be holding, so a deadline can still arrive
     with every tab shut.

     Debounced, and skipped entirely when the desired set is unchanged — the
     no-op contract rewards/engine.ts uses, applied to a network call, so typing
     in the task editor cannot produce a burst of requests. A signed-out user,
     or one who never turned push on, never reaches Supabase at all. */
  const publishedRef = useRef<string>('');
  useEffect(() => {
    /* Not gated on the switches: turning nudges or push off has to withdraw
       what is already on the server, and the row builders return nothing for
       a channel that is off. A user who never turned anything on publishes an
       empty set, which matches the empty signature and sends nothing. */
    if (!user || !isInitialSyncDone.current) return;

    const timer = window.setTimeout(async () => {
      const { desiredRows, nudgeRows, reconcile, signatureOf } = await import('./reminders/publish');
      const live = stateRef.current;
      const now = Date.now();
      /* One reconcile for both kinds: it deletes every unsent row it was not
         handed, so publishing them separately would have each erase the other. */
      const rows = [
        ...desiredRows(live.tasks, reminderPrefs, user.id, now),
        ...nudgeRows(live.logs, live.dailyGoalHours, reminderPrefs, user.id, now),
      ];
      const signature = signatureOf(rows);
      if (signature === publishedRef.current) return;
      publishedRef.current = signature;
      await reconcile(rows, user.id);
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [state.tasks, state.logs, state.dailyGoalHours, reminderPrefs, user]);

  /* A guest who asked for nudges in onboarding could not get them with the app
     closed: push needs an account to deliver to. Once they sign in, and the
     browser already said yes to notifications, push is switched on for them
     rather than left for them to find in settings. */
  useEffect(() => {
    if (!user || !reminderPrefs.nudge || reminderPrefs.push || !syncSettled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    void import('./notify/push').then(async ({ enablePush, pushSupported }) => {
      if (pushSupported() && await enablePush()) setReminderPrefs({ push: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, reminderPrefs.nudge, reminderPrefs.push, syncSettled]);

  /* ── Install to the home screen ──
     Moved wholesale into `install/useInstall`, which also serves the mobile
     banner. It matters for a reason beyond convenience: iOS delivers Web Push
     ONLY to a PWA installed to the home screen, so without this an iPhone user
     can turn on closed-app reminders and never receive one, with nothing
     anywhere explaining why.

     For the record of what was actually wrong: `Header` has always rendered an
     Install button when handed a prompt, and the prompt never arrived — Chrome
     fires `beforeinstallprompt` only for a page whose service worker has a
     `fetch` handler, and ours deliberately had none. The worker now carries a
     navigation-only offline fallback, which satisfies that rule with something
     the user gains from. */
  const install = useInstall();

  /* A notification opened from the lock screen focuses this tab and posts here.
     The worker deliberately does no routing of its own — it has no idea what
     the app is showing. */
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'notification-click') return;
      const channel = event.data.data?.channel;
      if (channel === 'reminder' || channel === 'nudge') handleTabChange('Today');
      if (channel === 'plan') handleTabChange('Plan');
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  const setReminderPrefs = useCallback((patch: Partial<ReminderPrefs>) => {
    setState(prev => {
      const nextState = {
        ...prev,
        reminders: { ...(prev.reminders ?? DEFAULT_REMINDERS), ...patch },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  /* ── Tasks ────────────────────────────────────────────────────────
     Every mutator here is wrapped in useCallback with empty deps. That is not
     tidiness: today/TodayTab.tsx runs a 100ms interval while a stopwatch is
     going, so the whole tab re-renders ten times a second through every study
     session. The board below it is React.memo, and a callback recreated on each
     render would defeat that silently — every card would re-render ten times a
     second on the cheapest phone, during the app's core loop.

     Empty deps are safe because each one reads live state through the setState
     updater and closes over nothing. */

  const addTask = useCallback((text: string, subject: Subject, column: TaskColumn = 'todo') => {
    setState(prev => {
      const task: Task = {
        id: generateId(),
        text,
        completed: false,
        subject,
        column,
        order: nextOrder(prev.tasks, column),
      };
      const nextState = {
        ...prev,
        tasks: [...prev.tasks, task],
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  /**
   * Move a card to a column and a position.
   *
   * The single code path that writes `completed`, `completedAt` and `column`.
   * `toggleTask` routes through it rather than writing its own — otherwise the
   * voice command and the board could disagree about the same card, and the
   * flag and the date could drift apart.
   */
  const moveTask = useCallback((id: string, column: TaskColumn, index: number) => {
    soundForTaskMove(stateRef.current.tasks, id, column);
    setState(prev => {
      const tasks = moveCard(prev.tasks, id, column, index);
      if (tasks === prev.tasks) return prev;
      const nextState = { ...prev, tasks, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  const updateTask = useCallback((id: string, patch: Partial<Omit<Task, 'id'>>) => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: prev.tasks.map(t => (t.id === id ? { ...t, ...patch } : t)),
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  /* Ticking the box stamps the day, un-ticking clears it — the flag and the
     date must never disagree, or a task could be counted for a day it is no
     longer finished on. Both now happen inside moveCard, which is also what
     puts the card in the right column. */
  const toggleTask = useCallback((id: string) => {
    soundForTaskMove(stateRef.current.tasks, id, 'done');
    setState(prev => {
      const task = prev.tasks.find(t => t.id === id);
      if (!task) return prev;
      const to: TaskColumn = task.completed ? 'todo' : 'done';
      const tasks = moveCard(prev.tasks, id, to, 0);
      const nextState = { ...prev, tasks, lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState(prev => {
      const nextState = {
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== id),
        lastUpdated: Date.now()
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);

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

  /* `from` defaults to today, but a rule made while looking at a future day
     starts there instead — otherwise turning tomorrow's block into a repeat
     would also drop it onto every day between now and then, including the one
     the user is standing in. */
  /** Recolour one activity. Study kinds never reach here — see RECOLOURABLE. */
  const setBlockColor = (kind: BlockKind, hex: string | null) => {
    withSchedule(s => {
      const colors = { ...(s.colors || {}) };
      if (hex) colors[kind] = hex;
      else delete colors[kind];
      return { ...s, colors };
    });
  };

  const addRule = (input: Omit<TemplateRule, 'id' | 'from'> & { from?: string }) => {
    withSchedule(s => {
      const today = getISTDateString();
      const from = input.from && input.from > today ? input.from : today;
      return {
        ...s,
        rules: [...s.rules, { ...input, id: generateId(), from, until: null }],
      };
    });
  };

  /**
   * Change a weekly slot from today onward.
   *
   * The old rule is closed at yesterday rather than edited, and a new one
   * opened from today. Editing in place would move the slot on days already
   * spent, so last Monday's adherence would silently be re-measured against a
   * plan that did not exist when it was lived.
   */
  const updateRule = (
    id: string,
    patch: Partial<Omit<TemplateRule, 'id' | 'from' | 'until'>>,
    opts?: { clearOverrideOn?: string },
  ) => {
    withSchedule(s => {
      const rule = s.rules.find(r => r.id === id);
      if (!rule) return s;
      const today = getISTDateString();

      /* A change made to the whole series supersedes whatever that one day was
         individually set to — otherwise the day you dragged would be the only
         one that did not take the change you just asked every day to take. */
      const overrides = opts?.clearOverrideOn
        ? s.overrides.filter(o => !(o.ruleId === id && o.date === opts.clearOverrideOn))
        : s.overrides;

      /* Nothing has been lived against a rule that starts today or later, so
         amend it rather than leaving a zero-length husk behind. `>=`, not
         `===`, matching deleteRule: a rule that begins next Monday has no
         history to protect, and closing it at yesterday would move its start
         forward to today. */
      if (rule.from >= today) {
        return { ...s, overrides, rules: s.rules.map(r => (r.id === id ? { ...r, ...patch } : r)) };
      }

      const openedId = generateId();
      const closed = { ...rule, until: addDays(today, -1) };
      const opened: TemplateRule = {
        ...rule,
        ...patch,
        id: openedId,
        from: today,
        until: null,
      };

      /* Overrides are keyed by rule, so re-opening it under a new id orphaned
         every one of them: a day skipped next week came back, and a day moved
         next week jumped. The ones still ahead move across with the rule; the
         ones already lived belong to the closed rule and stay exactly where
         they are, which is the whole point of closing it rather than editing
         it in place. */
      return {
        ...s,
        rules: [...s.rules.map(r => (r.id === id ? closed : r)), opened],
        overrides: overrides.map(o =>
          o.ruleId === id && o.date >= today
            ? { ...o, id: instanceId(openedId, o.date), ruleId: openedId }
            : o,
        ),
      };
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
    if (stopwatchArmed(current.timer) || !pomodoroIsIdle(current.pomodoro)) {
      window.alert('A SESSION IS ALREADY RUNNING. FINISH IT.');
      return;
    }
    sfx.play('session-start');
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

  /* ── Mocks ─────────────────────────────────────────────────────────
     One helper, like withSchedule: every mutator is handed a slice that
     definitely exists and has been through the normalizer. */
  const withMocks = (fn: (m: MocksState) => MocksState) => {
    setState(prev => {
      const nextState: AppState = { ...prev, mocks: normalizeMocks(fn(normalizeMocks(prev.mocks))), lastUpdated: Date.now() };
      stateRef.current = nextState;
      return nextState;
    });
  };
  const upsertMock = (test: MockTest) =>
    withMocks(m => ({ ...m, tests: m.tests.some(x => x.id === test.id) ? m.tests.map(x => (x.id === test.id ? test : x)) : [...m.tests, test] }));
  /* Errors logged from a deleted mock stay in the notebook — the question was
     still got wrong — and lose only the pointer. */
  const deleteMock = (id: string) =>
    withMocks(m => ({
      ...m,
      tests: m.tests.filter(x => x.id !== id),
      errors: m.errors.map(e => (e.mockId === id ? { ...e, mockId: undefined, updatedAt: Date.now() } : e)),
    }));
  const upsertError = (entry: ErrorEntry) =>
    withMocks(m => ({ ...m, errors: m.errors.some(e => e.id === entry.id) ? m.errors.map(e => (e.id === entry.id ? entry : e)) : [...m.errors, entry] }));
  /* One write for any number of errors, so "delete all cleared" is one sync,
     and Undo puts every row back exactly as it was (stats included). */
  const deleteErrors = (ids: string[]) => {
    const gone = new Set(ids);
    withMocks(m => ({ ...m, errors: m.errors.filter(e => !gone.has(e.id)) }));
  };
  const restoreErrors = (entries: ErrorEntry[]) =>
    withMocks(m => {
      const have = new Set(m.errors.map(e => e.id));
      return { ...m, errors: [...m.errors, ...entries.filter(e => !have.has(e.id))] };
    });
  const recordAttempts = (answers: Record<string, boolean>) =>
    withMocks(m => ({ ...m, errors: applyAttempts(m.errors, answers, Date.now()) }));
  /* A finished CBT paper: its MockTest and its notebook entries in one write,
     so one sync. An entry for a question already in the notebook arrives as
     an update of that entry (same id), never a second copy. */
  const saveCbtResult = (test: MockTest, entries: ErrorEntry[]) =>
    withMocks(m => {
      const byId = new Map(m.errors.map(e => [e.id, e]));
      entries.forEach(e => byId.set(e.id, e));
      return {
        ...m,
        tests: m.tests.some(x => x.id === test.id) ? m.tests.map(x => (x.id === test.id ? test : x)) : [...m.tests, test],
        errors: Array.from(byId.values()),
      };
    });
  const addMockTopic = (key: string, name: string) =>
    withMocks(m => {
      const list = m.topics[key] ?? [];
      if (list.some(x => x.toLowerCase() === name.toLowerCase())) return m;
      return { ...m, topics: { ...m.topics, [key]: [...list, name] } };
    });
  const forgetMockTopic = (key: string, name: string) =>
    withMocks(m => ({ ...m, topics: { ...m.topics, [key]: (m.topics[key] ?? []).filter(x => x !== name) } }));

  const logQuestions = (subject: QSubject, count: number) => {
    const today = getISTDateString();
    const at = Date.now();
    setState(prev => {
      const logs = [...prev.questionTracking.dailyQuestionsLog];
      const idx = logs.findIndex((l) => l.date === today);

      /* Stamped from here on, and deliberately not surfaced anywhere yet.
         `counts` stays the authoritative total for every figure the app already
         prints; these are additive detail. Questions-per-hour by time of day is
         unanswerable from a per-day tally, and data you did not start
         collecting is data you cannot analyse later — so it starts accruing now
         and the metric it enables can wait for the evidence to exist.

         Capped per day: the + button can be tapped arbitrarily often and this
         rides inside the synced blob. */
      const entry = { at, subject, count };

      if (idx >= 0) {
        const updated = { ...logs[idx] };
        updated.counts = { ...updated.counts, [subject]: (updated.counts?.[subject] || 0) + count };
        updated.entries = [...(updated.entries ?? []), entry].slice(-MAX_QUESTION_ENTRIES);
        logs[idx] = updated;
      } else {
        logs.push({
          date: today,
          counts: { [subject]: count },
          entries: [entry],
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
  /* Asks the server first, because staff may have removed or banned this
     account from the race (supabase/moderation.sql). A plain removal is
     cleared by choosing to join again; a ban is refused, and the reason
     comes back to the join screen instead of a board that would never list
     them. */
  const joinLeaderboard = async (displayName: string): Promise<string | null> => {
    try {
      if ((await rejoinLeaderboard()) === 'banned') {
        return 'You’re banned from the race. You can’t join until the ban is lifted.';
      }
    } catch (e) {
      return moderationError(e);
    }
    setState(prev => {
      const nextState = {
        ...prev,
        leaderboard: { ...prev.leaderboard, enabled: true, displayName },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
    return null;
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

  /* ── Groups ──
     Mounted here for useRace's reason: what a group can see of you has to
     stay current while you are on Today, where the hours are logged and the
     tasks are ticked — not only while the Groups tab is open. Waits on the
     cloud pull, or a fresh device would publish its empty defaults. */
  const groupsState = useGroups({
    user,
    logs: state.logs,
    tasks: state.tasks,
    watching: activeTab === 'Groups',
    ready: syncSettled,
  });
  /* ── Counting heads for the console ──
     Mounted here for the same reason: a visit happens on whatever tab the app
     opens on. Sends a day's totals and a few counts, never a log; never writes
     AppState, so it never triggers a sync. Waits on the cloud pull so a fresh
     device does not report its empty defaults as somebody's day. */
  const getStateForPing = useCallback(() => stateRef.current, []);
  useActivityPing({
    user,
    ready: syncSettled,
    logs: state.logs,
    getState: getStateForPing,
  });
  /* ── Being told you were removed ──
     Mounted at root: a removal can land while you are on any tab. A race
     removal turns the race off here (without deleting history — staff
     already took today's row down), and a group removal re-reads the group
     list so the group is gone before the notice is even closed. */
  const turnRaceOffAfterRemoval = useCallback(() => {
    setState(prev => {
      if (!prev.leaderboard?.enabled) return prev;
      const nextState = {
        ...prev,
        leaderboard: { ...prev.leaderboard, enabled: false },
        lastUpdated: Date.now(),
      };
      stateRef.current = nextState;
      return nextState;
    });
  }, []);
  const refreshGroupsRef = useRef(groupsState.refresh);
  refreshGroupsRef.current = groupsState.refresh;
  const moderation = useModerationNotices({
    user,
    ready: syncSettled,
    onLeaderboardRemoved: turnRaceOffAfterRemoval,
    onGroupRemoved: () => { void refreshGroupsRef.current(); },
  });

  const handleInviteHandled = useCallback(() => {
    clearPendingInvite();
    setPendingInvite(null);
  }, []);

  /* ── Profiles ──
     Mounted here for the same reason: a profile has to be openable from a
     leaderboard row or a chat bubble on the Ranks tab, and reachable directly
     by /u/:handle regardless of which tab was last active. */
  const profileCtl = useProfileController(user);

  /* The profile built in onboarding. The name also becomes the Ranks name,
     so joining the race later starts from it (joining stays opt-in). Signed
     in, it is written to the profile now; signed out, it waits as a draft
     for the account (profile/draft.ts). */
  const applyOnboardingProfile = (p: ProfilePick) => {
    setState(prev => {
      if (prev.leaderboard.enabled) return prev;
      const next = { ...prev, leaderboard: { ...prev.leaderboard, displayName: p.name }, lastUpdated: Date.now() };
      stateRef.current = next;
      return next;
    });
    const own = profileCtl.ownProfile;
    if (!user || !own) return;
    void updateProfile(user.id, {
      display_name: p.name,
      // The builder started from their current bio, so an empty one was cleared on purpose.
      bio: validateBio(p.bio) ?? own.bio ?? '',
      avatar_type: 'alpha',
      avatar_id: p.avatarId,
      avatar_url: null,
    }).then(saved => { setCachedProfile(saved); profileCtl.onSaved(saved); }, () => { /* Edit profile is one tap away */ });
  };
  /* Every logged hour, any source — the same figure Header's own tooltip and
     the Review tab already show. Memoized because it otherwise re-sums the
     full log history on every render, including the ones a running timer
     fires many times a minute. */
  const ownTotalHours = useMemo(
    () => state.logs.reduce((sum, l) => sum + l.hours, 0),
    [state.logs]
  );
  const handleTabChangeAndExitProfile = (tab: TabType) => {
    profileCtl.goHome();
    handleTabChange(tab);
  };

  /* One replay of the history (streak/firewood.ts), cached per log array. */
  const ledger = streakLedger(state.logs);
  const streakCount = ledger.streak;
  const verifiedStreakCount = calculateVerifiedStreak(state.logs);
  const lockInScore = calculateLockInScore(state.logs, state.currentClass, state.progress, activeSubjects);

  /* Normalized on the way out too: a blob written by an older build (or by a
     device that predates a field) must never reach the vault with a missing
     high-water mark and render NaN progress. */
  const rewards = normalizeRewards(state.rewards);
  /* Normalized on read as well as on load: the realtime path spreads a whole
     remote blob, and a blob written by a build that predates this feature has
     no schedule in it at all. */
  const schedule = useMemo(
    () => normalizeSchedule(state.schedule, new Set(state.tasks.map(t => t.id))),
    [state.schedule, state.tasks],
  );
  /* Same reason as `schedule`: the realtime path can spread a blob with no
     `mocks` in it, or one shaped by an older build. */
  const mocks = useMemo(() => normalizeMocks(state.mocks), [state.mocks]);
  /* Same reason: the realtime path can spread a blob with no `reading`. */
  const reading = useMemo(() => normalizeReading(state.reading), [state.reading]);
  /* Oldest un-shown tier first, so someone returning after a long absence is
     walked up their unlocks one at a time instead of seeing only the last. */
  const celebration = pendingCelebrations(rewards)[0];
  const wallpaper = wallpaperById(rewards.wallpaper);

  /* Onboarding waits on: the landing page being dismissed, the auth modal
     being closed (so it can't cover a sign-up the user just started), and the
     cloud pull having settled so pre-filled values are the user's real ones. */
  const showOnboarding =
    showLanding === false && needsOnboarding && syncSettled && !isAuthModalOpen;

  /* An invite takes you to Groups once you can see it — after the landing
     page and onboarding — and once more after signing in, when the card
     changes from "sign in to join" to the group itself. Keyed so it never
     pulls somebody back to Groups after they have walked away from it. */
  const routedInviteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingInvite || showLanding !== false || showOnboarding) return;
    const key = `${pendingInvite}:${user ? 'in' : 'out'}`;
    if (routedInviteRef.current === key) return;
    routedInviteRef.current = key;
    handleTabChangeAndExitProfile('Groups');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite, showLanding, showOnboarding, user]);

  /* The day in the tab strip, and on the home-screen icon (install/usePresence).
     Above the early return below, like every hook here. */
  const todayKey = getISTDateString();
  const todayHours = useMemo(
    () => state.logs.reduce((sum, l) => (l.date === todayKey ? sum + l.hours : sum), 0),
    [state.logs, todayKey],
  );
  /* The new-tab extension's view of the day (install/extensionSummary). One
     localStorage key, debounced, written whatever tab is open; a timer tick
     does not change any input here, so a running session writes nothing. */
  const summaryName = profileCtl.ownProfile?.display_name ?? state.leaderboard?.displayName ?? null;
  useEffect(() => {
    if (showLanding !== false) return;
    const t = window.setTimeout(() => {
      publishSummary(buildSummary(stateRef.current, summaryName));
    }, 600);
    return () => window.clearTimeout(t);
  }, [showLanding, state.logs, state.tasks, state.timer, state.pomodoro, state.dailyGoalHours, state.examPreference, summaryName]);

  usePresence({
    active: showLanding === false && !showOnboarding,
    streak: streakCount,
    todayHours,
    goalHours: state.dailyGoalHours,
    nudge: !!reminderPrefs.nudge,
  });

  // While checking session, show nothing (prevents flash)
  if (showLanding === null) {
    return <div style={{ background: theme === 'dark' ? '#0B0B0D' : '#F2F0EC', width: '100vw', height: '100vh' }} />;
  }

  // Show landing page for first-time visitors with no session
  if (showLanding) {
    return (
      <LandingPage
        onCtaClick={(exam: ExamPreference) => {
          /* Into onboarding, not a sign-up form: an account is offered at
             the end, once there is a plan worth keeping. */
          landingExam.current = exam;
          setShowLanding(false);
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
      {/* The festive theme, chosen for everyone from Console → Theme. */}
      {festive !== 'none' && (
        <React.Suspense fallback={null}>
          <FestiveLayer theme={festive} dark={theme === 'dark'} railPx={sidebarCollapsed ? 72 : 212} />
        </React.Suspense>
      )}

      <Sidebar
        activeTab={activeTab}
        onTabChange={handleTabChangeAndExitProfile}
        theme={theme}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(v => !v)}
        isAdmin={isAdmin}
        ownProfile={profileCtl.ownProfile}
        onOpenAccount={profileCtl.openEditProfile}
        groupsUnread={groupsState.totalUnread}
        currentClass={state.currentClass}
        onClassChange={setCurrentClass}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        theme={theme}
      />

      <ProfileModal
        userId={profileCtl.openProfileUserId}
        onClose={profileCtl.closeProfile}
        onViewFull={profileCtl.viewFullProfile}
        onEdit={profileCtl.openEditProfile}
        currentUserId={user?.id ?? null}
        ownTotalHours={ownTotalHours}
        theme={theme}
      />

      {profileCtl.editing && profileCtl.ownProfile && (
        <EditProfile
          profile={profileCtl.ownProfile}
          onClose={profileCtl.closeEditProfile}
          onSaved={profileCtl.onSaved}
          theme={theme}
        />
      )}

      {/* Margin tracks the rail's width, so collapsing it gives the page the
          space back instead of leaving the app parked to the right of a gap. */}
      <div className={`shell-offset ${festive !== 'none' ? 'festive-pad' : ''} transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-[212px]'}`}>

        <main className="max-w-5xl mx-auto w-full relative z-20 px-4 md:px-6 pt-8 md:pt-16 pb-16">
          {profileCtl.routeHandle ? (
            <ProfilePage
              handle={profileCtl.routeHandle}
              currentUserId={user?.id ?? null}
              ownTotalHours={ownTotalHours}
              onBack={profileCtl.goHome}
              onEdit={profileCtl.openEditProfile}
              theme={theme}
            />
          ) : (
          <>
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
              onUpdateTask={updateTask}
              onMoveTask={moveTask}
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
              onShare={() => setSharePeriod('daily')}
              unreadAnnouncements={announcements.open ? 0 : announcements.queue.length}
              onOpenAnnouncement={announcements.reopen}
              festive={festive}
            />
          )}
          {activeTab === 'Plan' && (
            <PlanTab
              schedule={schedule}
              logs={state.logs}
              timer={state.timer}
              theme={theme}
              activeSubjects={activeSubjects}
              tasks={state.tasks}
              currentClass={state.currentClass}
              examPreference={state.examPreference || 'JEE'}
              onAddBlock={addBlock}
              onUpdateBlock={updateBlock}
              onDeleteBlock={deleteBlock}
              onResetInstance={resetInstance}
              onSetColor={setBlockColor}
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
              notesOwner={user?.id ?? 'guest'}
              onOpenNotes={notesEnabled ? openChapterNotes : undefined}
            />
          )}
          {activeTab === 'Streak' && (
            <StreakTab
              streak={streakCount}
              verifiedStreak={verifiedStreakCount}
              ledger={ledger}
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
              onShare={() => setSharePeriod('weekly')}
            />
          )}
          {activeTab === 'Mocks' && (
            <MocksTab
              mocks={mocks}
              progress={state.progress}
              examPreference={state.examPreference || 'JEE'}
              subjects={getCoreSubjects(state.examPreference || 'JEE')}
              today={getISTDateString()}
              theme={theme}
              onUpsertMock={upsertMock}
              onDeleteMock={deleteMock}
              onUpsertError={upsertError}
              onDeleteErrors={deleteErrors}
              onRestoreErrors={restoreErrors}
              onRecordAttempts={recordAttempts}
              onAddTopic={addMockTopic}
              onForgetTopic={forgetMockTopic}
              cbt={cbtEnabled && user ? { userId: user.id, onSaved: saveCbtResult } : undefined}
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
              onOpenProfile={profileCtl.openProfile}
              theme={theme}
            />
          )}
          {activeTab === 'Groups' && (
            <GroupsTab
              user={user}
              groups={groupsState}
              tasks={state.tasks}
              pendingInvite={pendingInvite}
              onInviteHandled={handleInviteHandled}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onOpenProfile={profileCtl.openProfile}
              isStaff={isAdmin}
              theme={theme}
            />
          )}
          {/* Lazy: the scheduler, the deck file reader and the editor arrive
              with the tab. Nothing in it reads or writes AppState. */}
          {activeTab === 'Decks' && (
            <React.Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
              <DecksTab
                user={user}
                isAdmin={isAdmin}
                theme={theme}
                examPreference={state.examPreference || 'JEE'}
                onOpenAuth={() => setIsAuthModalOpen(true)}
                openDeckId={deckToOpen}
                onOpenedDeck={clearDeckToOpen}
              />
            </React.Suspense>
          )}
          {/* Lazy, and nothing in it reads or writes AppState except a to-do
              sent to Today. Its pages live in IndexedDB (notes/store.ts). */}
          {activeTab === 'Notes' && (
            <React.Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
              <NotesTab
                enabled={notesEnabled}
                onEnable={() => setNotesEnabled(true)}
                onDisable={() => setNotesEnabled(false)}
                user={user}
                theme={theme}
                examPreference={state.examPreference || 'JEE'}
                progress={state.progress}
                activeSubjects={activeSubjects}
                railPx={sidebarCollapsed ? 72 : 212}
                onAddTask={addTask}
                onOpenSyllabus={openSyllabusTab}
                request={notesRequest}
                onRequestHandled={clearNotesRequest}
              />
            </React.Suspense>
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
              onDeleteAccount={handleDeleteAccount}
              onLog={logStudy}
              dailyQuestionsLog={state.questionTracking.dailyQuestionsLog}
              examPreference={state.examPreference || 'JEE'}
              onChangeExamPreference={(p: ExamPreference) => setState(prev => ({ ...prev, examPreference: p }))}
              activeSubjects={activeSubjects}
              reminders={reminderPrefs}
              onChangeReminders={setReminderPrefs}
              goalHours={state.dailyGoalHours}
            />
          )}
          {/* Drawn only for an administrator, and `user` is guaranteed here
              because `isAdmin` can only be true for a signed-in session.
              Hiding it is not the control; every query inside it is refused by
              row-level security for anybody else. */}
          {activeTab === 'Admin' && isAdmin && user && (
            <AdminTab adminId={user.id} theme={theme} onOpenDeck={id => { if (id) setDeckToOpen(id); handleTabChange('Decks'); }} />
          )}
          </>
          )}
        </main>
      </div>

      {/* Everything the app says on screen, from any feature, in one place.
          Suppressed during the tour, which owns the screen. Renders nothing at
          all when the queue is empty, which is almost always. */}
      {!showOnboarding && <ToastHost theme={theme} />}

      {/* One message from the people who make the app, on the way into Today.
          Queued behind every other full-screen moment for the same reason
          those are queued behind each other: two interruptions arriving at
          once is one interruption nobody reads.

          Only on Today. An announcement that could open over the Plan grid or
          mid-way through a mock would be a modal that follows you
          around the app, which is the thing this feature is deliberately not. */}
      {!showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod
        && activeTab === 'Today' && announcements.current && (
        <AnnouncementModal
          announcement={announcements.current}
          index={0}
          total={announcements.queue.length}
          theme={theme}
          userId={user?.id ?? null}
          saving={announcements.saving}
          error={announcements.error}
          onAcknowledge={announcements.acknowledgeCurrent}
          onAcknowledgeAll={announcements.acknowledgeAll}
          onSetAside={announcements.setAside}
        />
      )}

      {/* You were removed from a group or the race. Any tab, because it can
          arrive anywhere — but never over a running session (Lock-In owns
          the screen, and the news keeps until the block is done), and
          queued behind the other full-screen moments, including an
          announcement already open on Today. */}
      {!showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod
        && !stopwatchArmed(state.timer) && pomodoroIsIdle(state.pomodoro)
        && !(activeTab === 'Today' && announcements.current)
        && moderation.current && (
        <RemovalNoticeModal
          notice={moderation.current}
          total={moderation.total}
          theme={theme}
          saving={moderation.saving}
          error={moderation.error}
          onAcknowledge={moderation.acknowledge}
        />
      )}

      {/* Keep Alpha close, on every device, at most three times. Held back
          behind every full-screen moment and any running session: the first
          run already asked in onboarding, and a banner over a running clock is
          the app interrupting the thing it exists for. */}
      {!showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod
        && !stopwatchArmed(state.timer) && pomodoroIsIdle(state.pomodoro) && (
        <KeepBanner install={install} theme={theme} />
      )}

      {/* "Need help? Tell us." Bottom-left, clear of the settings gear in the
          opposite corner, and gone during any full-screen moment — a floating
          bubble over the reward modal or the book is a bubble in the way. */}
      {!showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod && (
        <FeedbackWidget
          user={user}
          theme={theme}
          route={activeTab}
          railPx={sidebarCollapsed ? 72 : 212}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
      )}

      {/* Class 11 or 12, top-right on a laptop (the phone has it in the capsule,
          Sidebar.tsx), on Syllabus only: every other tab has it in quick
          settings. Same suppression as the gear below. */}
      {activeTab === 'Syllabus' && !profileCtl.routeHandle && !showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod && (
        <ClassSwitch placement="corner" dark={theme === 'dark'} value={state.currentClass} onChange={setCurrentClass} />
      )}

      {/* The gear, bottom-right, and the glass pane of quick settings it opens.
          It replaced the web-style header that held the same switches above
          every tab. Same suppression as the feedback launcher. */}
      {!showOnboarding && !isBookOpen && !celebration && streakMoment === null && !sharePeriod && (
        <QuickSettings
          theme={theme}
          onToggleTheme={() => setState(p => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))}
          currentClass={state.currentClass}
          onClassChange={setCurrentClass}
          showClass={activeTab !== 'Syllabus' || !!profileCtl.routeHandle}
          reminders={reminderPrefs}
          onChangeReminders={setReminderPrefs}
          user={user}
          profile={profileCtl.ownProfile}
          syncStatus={syncStatus}
          onSignIn={() => { void signInWithGoogle().then(err => { if (err) setIsAuthModalOpen(true); }); }}
          onOpenProfile={profileCtl.openEditProfile}
          install={install}
          onOpenAll={() => handleTabChangeAndExitProfile('Review')}
          festive={festiveLive === 'none' ? null : {
            theme: festiveLive,
            label: FESTIVE_LABEL[festiveLive],
            on: !festiveOff,
            onToggle: on => setFestiveOff(!on),
          }}
        />
      )}

      {/* The daily streak moment: once a day, after the first session logged on
          this device. It goes before a reward unlock — on day 30 the streak
          lands first and the wallpaper pack follows when it is closed. */}
      {!showOnboarding && !isBookOpen && !sharePeriod && streakMoment !== null && (
        <StreakMoment
          streak={streakMoment}
          ledger={ledger}
          logs={state.logs}
          next={nextReward(rewards, streakCount, verifiedStreakCount)}
          theme={theme}
          onClose={closeStreakMoment}
        />
      )}

      {/* The payoff. Held back until the tour is done and the book is closed,
          so it never lands on top of another full-screen moment. */}
      {!showOnboarding && !isBookOpen && streakMoment === null && celebration && (
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

      {/* Nothing renders until the chunk arrives; the fallback is deliberately
          nothing, because a flash of skeleton behind a scrim reads as a fault. */}
      {sharePeriod && (
        <React.Suspense fallback={null}>
          <ShareModal
            onClose={() => setSharePeriod(null)}
            initialPeriod={sharePeriod}
            theme={theme}
            input={shareInput}
          />
        </React.Suspense>
      )}

      {isBookOpen && (
        <React.Suspense fallback={<div className={`fixed inset-0 z-[80] ${theme === 'dark' ? 'bg-[#0B0B0D]' : 'bg-[#F6F4F0]'}`} />}>
          <BookReader
            theme={theme}
            reading={reading}
            onReading={withReading}
            onClose={() => setIsBookOpen(false)}
          />
        </React.Suspense>
      )}

      {showOnboarding && (
        <React.Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#050506' }} />}>
          <OnboardingFlow
            initial={{
              examPreference: landingExam.current ?? state.examPreference ?? 'JEE',
              currentClass: state.currentClass,
              dailyGoalHours: state.dailyGoalHours,
              timerMode: state.timerMode,
              progress: state.progress,
              signedIn: !!user,
              profile: profileCtl.ownProfile
                ? { name: profileCtl.ownProfile.display_name, avatarId: profileCtl.ownProfile.avatar_id ?? DEFAULT_ALPHA_AVATAR_ID, bio: profileCtl.ownProfile.bio ?? '' }
                : null,
              studyMinute: reminderPrefs.studyMinute,
            }}
            onApply={applyOnboarding}
            onProfile={applyOnboardingProfile}
            keepMethod={install.keep}
            installAvailable={install.mode === 'prompt'}
            onInstall={install.install}
            onReminders={setReminderPrefs}
            onGoogle={signInWithGoogle}
            onStart={startFirstSession}
            onComplete={finishOnboarding}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default App;
