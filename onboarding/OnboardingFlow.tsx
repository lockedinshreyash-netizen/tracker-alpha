/* ── Onboarding ──
   The first minute of the app, and the only part of it every student sees.

     opening   the gate, the Arena cold open, LOCK IN.        (Opening.tsx)
     exam → class → day → hours → style                       (Questions.tsx)
     build → reveal                                           (PlanScreens.tsx)
     pledge    hold to lock in: THE one write                 (Commit.tsx)
     save      an account, only now, and only if signed out   (Finish.tsx)
     start     the first session, started from here           (Finish.tsx)

   Everything the student answers is held here and written to AppState once,
   when the pledge is held to the end. Leaving before that (Skip, closing the
   app) changes nothing, the rule the old flow had. A student who already has
   a plan (signed in on a new device) is not asked about their day and gets
   no new blocks: the Plan tab is theirs.

   Lazy-loaded by App (with its stylesheet and the film), so none of it is in
   the bundle anyone else downloads. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './onboarding.css';
import type { ChapterProgress, ExamPreference, PomodoroSettings, Subject, TimerMode } from '../types';
import { isLite, Stage, TopBar } from './kit';
import Opening from './Opening';
import { QClass, QDay, QExam, QHours, QStyle } from './Questions';
import { Building, Reveal } from './PlanScreens';
import { Pledge } from './Commit';
import { FirstSession, Save } from './Finish';
import { type Answers, buildPlan, DEFAULT_ANSWERS, type RuleDraft, startHere } from './plan';

export interface OnboardingInitial {
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  dailyGoalHours: number;
  timerMode: TimerMode;
  pomodoroSettings: PomodoroSettings;
  progress: ChapterProgress[];
  /** Any repeating block or one-off already on the Plan tab. */
  hasPlan: boolean;
  signedIn: boolean;
}

/** The one write. `rules` is null when the student already had a plan. */
export interface OnboardingResult {
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  dailyGoalHours: number;
  timerMode: TimerMode;
  rules: RuleDraft[] | null;
}

interface Props {
  initial: OnboardingInitial;
  onApply: (r: OnboardingResult) => void;
  /** `modal` opens the sign-in sheet (email or Google); `google` goes straight to Google. */
  onSignIn: (how: 'google' | 'modal') => void;
  onStart: (subject: Subject) => void;
  onComplete: () => void;
}

type Scene = 'opening' | 'exam' | 'class' | 'day' | 'hours' | 'style' | 'build' | 'reveal' | 'pledge' | 'save' | 'start';

/* How far the city steps back behind each scene. */
const DIM: Record<Scene, number> = {
  opening: 0.25, exam: 0.62, class: 0.62, day: 0.82, hours: 0.7, style: 0.62,
  build: 0.45, reveal: 0.84, pledge: 0.3, save: 0.7, start: 0.6,
};

const LEAVE_MS = 260;

const OnboardingFlow: React.FC<Props> = ({ initial, onApply, onSignIn, onStart, onComplete }) => {
  const plannable = !initial.hasPlan;
  const [a, setA] = useState<Answers>(() =>
    DEFAULT_ANSWERS(initial.examPreference, initial.currentClass, initial.dailyGoalHours, initial.timerMode));
  const [scene, setScene] = useState<Scene>('opening');
  const [leaving, setLeaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [lite] = useState(isLite);

  const set = useCallback((patch: Partial<Answers>) => setA(prev => ({ ...prev, ...patch })), []);

  const first = useMemo(() => startHere(a.exam, a.cls, initial.progress), [a.exam, a.cls, initial.progress]);
  const plan = useMemo(() => (plannable ? buildPlan(a, first) : null), [a, first, plannable]);

  /* The order, without the scenes that do not apply to this student. */
  const order = useMemo<Scene[]>(() => [
    'opening', 'exam', 'class', ...(plannable ? ['day' as const] : []), 'hours', 'style',
    'build', 'reveal', 'pledge', ...(initial.signedIn ? [] : ['save' as const]), 'start',
  ], [plannable, initial.signedIn]);
  const progressSteps = order.filter(s => s !== 'opening' && s !== 'build' && s !== 'save' && s !== 'start');
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

  /* Back, where it means something: not into the film, not into the
     building theatre, not back across the pledge. */
  const backTarget = useMemo<Scene | null>(() => {
    if (scene === 'opening' || scene === 'exam' || scene === 'build' || scene === 'save' || scene === 'start') return null;
    if (scene === 'pledge') return applied ? null : 'reveal';
    if (scene === 'reveal') return 'style';
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
      rules: plan ? plan.rules : null,
    });
  }, [applied, a, plan, onApply]);

  /* Skip writes nothing, before the pledge. After it, there is nothing left
     to skip but the account and the first session, which have their own
     "later". */
  const skip = !applied && scene !== 'opening' ? onComplete : undefined;

  const render = (): React.ReactNode => {
    const q = { a, set, next };
    switch (scene) {
      case 'opening': return <Opening onDone={next} onSignIn={() => onSignIn('modal')} />;
      case 'exam': return <QExam {...q} />;
      case 'class': return <QClass {...q} />;
      case 'day': return <QDay {...q} />;
      case 'hours': return <QHours {...q} plannable={plannable} />;
      case 'style': return <QStyle {...q} pomodoro={initial.pomodoroSettings} />;
      case 'build': return <Building a={a} plannable={plannable} first={first} onDone={next} />;
      case 'reveal': return <Reveal a={a} plan={plan} first={first} onNext={next} />;
      case 'pledge': return <Pledge a={a} onCommit={commit} onDone={next} />;
      case 'save': return <Save onGoogle={() => onSignIn('google')} onEmail={() => onSignIn('modal')} onLater={next} />;
      case 'start': return <FirstSession a={a} first={first} onStart={onStart} onLater={onComplete} />;
    }
  };

  const centred = scene === 'opening' || scene === 'build';
  return (
    <div className="ob" data-lite={lite} role="dialog" aria-modal="true" aria-label="Set up Tracker Alpha">
      {scene !== 'opening' && <Stage dim={DIM[scene]} />}
      <TopBar
        hidden={at < 0}
        steps={progressSteps.length}
        at={Math.max(0, at)}
        onBack={backTarget ? () => go(backTarget) : undefined}
        onSkip={skip}
      />
      <div key={scene} className={`ob-scene ${centred ? 'center' : ''} ${leaving ? 'exit' : 'enter'}`}>
        {render()}
      </div>
    </div>
  );
};

export default OnboardingFlow;
