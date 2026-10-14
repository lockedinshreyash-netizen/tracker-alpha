/* ── Onboarding ──
   The first minute of the app, and the only part of it every student sees.

     opening   the gate, a demo of the app, LOCK IN.         (Opening.tsx, Demo.tsx)
     exam → class → hours → style                            (Questions.tsx)
     pledge    hold to lock in: THE one write                (Commit.tsx)
     profile   name and badge, shown as Ranks and Groups do  (Profile.tsx)
     save      Google or guest, only if signed out           (Profile.tsx)
     start     the first session, started from here          (Finish.tsx)

   Everything the student answers is held here and written to AppState once,
   when the pledge is held to the end. Leaving before that (Skip, closing the
   app) changes nothing, the rule the old flow had. Onboarding builds no
   Plan: the demo shows the Plan tab and the student lays out their own day
   there. A plan guessed from a few questions was never one anybody kept.

   Google sign-in leaves the page and comes back. A session flag brings the
   student back to the first-session screen instead of the start of the flow,
   and the profile they built is applied once the account exists
   (profile/draft.ts).

   Lazy-loaded by App (with its stylesheet), so none of it is in the bundle
   anyone else downloads. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './onboarding.css';
import type { ChapterProgress, ExamPreference, PomodoroSettings, Subject, TimerMode } from '../types';
import { DEFAULT_ALPHA_AVATAR_ID } from '../profile/alphaAvatars';
import { saveProfileDraft } from '../profile/draft';
import { isLite, Stage, TopBar } from './kit';
import Opening from './Opening';
import { QClass, QExam, QHours, QStyle } from './Questions';
import { Pledge } from './Commit';
import { ProfileBuilder, type ProfilePick, SaveProfile } from './Profile';
import { FirstSession } from './Finish';
import { type Answers, DEFAULT_ANSWERS, startHere } from './answers';

export type { ProfilePick } from './Profile';

export interface OnboardingInitial {
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  dailyGoalHours: number;
  timerMode: TimerMode;
  pomodoroSettings: PomodoroSettings;
  progress: ChapterProgress[];
  signedIn: boolean;
  /** A signed-in student's current name and badge, to start the builder from. */
  profile: ProfilePick | null;
}

/** The one write. */
export interface OnboardingResult {
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  dailyGoalHours: number;
  timerMode: TimerMode;
}

interface Props {
  initial: OnboardingInitial;
  onApply: (r: OnboardingResult) => void;
  /** The profile is chosen. App prefills the Ranks name, and writes the
   *  profile at once if there is an account to write it to. */
  onProfile: (p: ProfilePick) => void;
  /** Leaves for Google. Resolves with an error message if it could not. */
  onGoogle: () => Promise<string | null>;
  onStart: (subject: Subject) => void;
  onComplete: () => void;
}

type Scene = 'opening' | 'exam' | 'class' | 'hours' | 'style' | 'pledge' | 'profile' | 'save' | 'start';

const LEAVE_MS = 260;

/** Survives the Google round trip (same tab), and nothing else. */
const RESUME_KEY = 'ob_resume_v1';
const takeResume = (): Scene | null => {
  try {
    const v = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    return v === 'start' ? 'start' : null;
  } catch {
    return null;
  }
};

const OnboardingFlow: React.FC<Props> = ({ initial, onApply, onProfile, onGoogle, onStart, onComplete }) => {
  const [a, setA] = useState<Answers>(() =>
    DEFAULT_ANSWERS(initial.examPreference, initial.currentClass, initial.dailyGoalHours, initial.timerMode));
  const [resumed] = useState(takeResume);
  const [scene, setScene] = useState<Scene>(resumed ?? 'opening');
  const [leaving, setLeaving] = useState(false);
  // Coming back from Google means the pledge was already held.
  const [applied, setApplied] = useState(resumed !== null);
  const [lite] = useState(isLite);
  const [pick, setPick] = useState<ProfilePick>(() => initial.profile ?? { name: '', avatarId: DEFAULT_ALPHA_AVATAR_ID });
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const set = useCallback((patch: Partial<Answers>) => setA(prev => ({ ...prev, ...patch })), []);

  const first = useMemo(() => startHere(a.exam, a.cls, initial.progress), [a.exam, a.cls, initial.progress]);

  /* The order, without the scenes that do not apply to this student. */
  const order = useMemo<Scene[]>(() => [
    'opening', 'exam', 'class', 'hours', 'style', 'pledge', 'profile',
    ...(initial.signedIn ? [] : ['save' as const]), 'start',
  ], [initial.signedIn]);
  const progressSteps = order.filter(s => s !== 'opening' && s !== 'start');
  const at = progressSteps.indexOf(scene);

  const timer = useRef<number | null>(null);
  const go = useCallback((to: Scene) => {
    if (timer.current) window.clearTimeout(timer.current);
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setScene(to);
      setLeaving(false);
    }, LEAVE_MS);
  }, []);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const next = useCallback(() => {
    const i = order.indexOf(scene);
    if (i >= 0 && i < order.length - 1) go(order[i + 1]);
  }, [order, scene, go]);

  /* Back, where it means something: not into the demo, not back across the
     pledge, not out of the first session. */
  const backTarget = useMemo<Scene | null>(() => {
    if (scene === 'opening' || scene === 'exam' || scene === 'profile' || scene === 'start') return null;
    if (scene === 'pledge') return applied ? null : 'style';
    const i = order.indexOf(scene);
    return i > 0 ? order[i - 1] : null;
  }, [scene, order, applied]);

  /* Android's back button walks the questions too. One history entry is
     pushed and re-pushed on each use, so the system back never leaves the app
     mid-question; where there is nowhere to go back to, it is let through. */
  const backRef = useRef<Scene | null>(null);
  backRef.current = backTarget;
  useEffect(() => {
    try { window.history.pushState({ onboarding: true }, ''); } catch { /* sandboxed */ }
    const onPop = () => {
      const to = backRef.current;
      if (!to) return;
      go(to);
      try { window.history.pushState({ onboarding: true }, ''); } catch { /* sandboxed */ }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [go]);

  const commit = useCallback(() => {
    if (applied) return;
    setApplied(true);
    onApply({
      examPreference: a.exam,
      currentClass: a.cls,
      dailyGoalHours: a.hours,
      timerMode: a.style,
    });
  }, [applied, a, onApply]);

  const confirmProfile = () => {
    const p = { name: pick.name.trim().replace(/\s+/g, ' '), avatarId: pick.avatarId };
    // Held on the device until there is an account to write it to.
    if (!initial.signedIn) saveProfileDraft(p);
    onProfile(p);
    next();
  };

  const google = async () => {
    setGoogleBusy(true);
    setGoogleError(null);
    try { sessionStorage.setItem(RESUME_KEY, 'start'); } catch { /* comes back to the start of the flow instead */ }
    const err = await onGoogle();
    // Still here: Google could not be reached.
    if (err !== null) {
      try { sessionStorage.removeItem(RESUME_KEY); } catch { /* nothing to undo */ }
      setGoogleError(err);
      setGoogleBusy(false);
    }
  };

  /* Skip writes nothing, before the pledge. After it, the profile can still
     be skipped (straight to the first session); the rest has its own "later". */
  const skip = scene === 'opening' ? undefined
    : !applied ? onComplete
    : scene === 'profile' ? () => go('start')
    : undefined;

  const render = (): React.ReactNode => {
    const q = { a, set, next };
    switch (scene) {
      case 'opening': return <Opening onDone={next} onSignIn={() => { void onGoogle(); }} />;
      case 'exam': return <QExam {...q} />;
      case 'class': return <QClass {...q} />;
      case 'hours': return <QHours {...q} />;
      case 'style': return <QStyle {...q} pomodoro={initial.pomodoroSettings} />;
      case 'pledge': return <Pledge a={a} onCommit={commit} onDone={next} />;
      case 'profile': return <ProfileBuilder pick={pick} onChange={setPick} onNext={confirmProfile} />;
      case 'save': return <SaveProfile pick={pick} busy={googleBusy} error={googleError} onGoogle={() => { void google(); }} onGuest={next} />;
      case 'start': return <FirstSession a={a} first={first} onStart={onStart} onLater={onComplete} />;
    }
  };

  return (
    <div className="ob" data-lite={lite} role="dialog" aria-modal="true" aria-label="Set up Tracker Alpha">
      <Stage />
      <TopBar
        hidden={at < 0}
        steps={progressSteps.length}
        at={Math.max(0, at)}
        onBack={backTarget ? () => go(backTarget) : undefined}
        onSkip={skip}
      />
      <div key={scene} className={`ob-scene ${scene === 'opening' ? 'center' : ''} ${leaving ? 'exit' : 'enter'}`}>
        {render()}
      </div>
    </div>
  );
};

export default OnboardingFlow;
