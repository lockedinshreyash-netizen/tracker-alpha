import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExamPreference } from '../types';
import { JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import { getDaysRemaining } from '../utils';
import { ACCENT, INK_DEEP, MICRO_LABEL, PAPER, TYPE } from '../landing/tokens';
import Spotlight from './Spotlight';
import * as sfx from '../audio';

/* Settings the flow can change. Applied in one write when calibration
   finishes — never per-screen, so abandoning midway changes nothing. */
export interface OnboardingSettings {
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  dailyGoalHours: number;
}

interface Props {
  /* Seeded from live AppState, never from DEFAULT_STATE — an existing user
     must see their own saved values here, not defaults. */
  initial: OnboardingSettings;
  onApplySettings: (s: OnboardingSettings) => void;
  onNavigateToToday: () => void;
  /* Discards an in-progress session. A running timer hides the goal card the
     tour points at in step 2, which would leave the user staring at an empty
     overlay — so advancing past the timer step clears it first. */
  onDiscardSession: () => void;
  onComplete: () => void;
}

type Act = 'sound' | 'open' | 'calibrate' | 'tour' | 'close';

const MUTED = 'rgba(242,240,236,0.55)';
const FAINT = 'rgba(242,240,236,0.34)';

/* ── Count-up used for the days number ── */
const useCountUp = (target: number, durationMs: number, start: boolean) => {
  const [value, setValue] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [target, durationMs, start]);

  return value;
};

const OnboardingFlow: React.FC<Props> = ({ initial, onApplySettings, onNavigateToToday, onDiscardSession, onComplete }) => {
  const [act, setAct] = useState<Act>('sound');
  const [step, setStep] = useState(0);
  const [soundOn, setSoundOn] = useState(false);

  const [examPref, setExamPref] = useState<ExamPreference>(initial.examPreference);
  const [currentClass, setCurrentClass] = useState<11 | 12>(initial.currentClass);
  const [goalHours, setGoalHours] = useState<number>(initial.dailyGoalHours);

  const targetDate = examPref === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE;
  const daysLeft = getDaysRemaining(targetDate);
  const examLabel = examPref === 'NEET' ? 'NEET 2027' : 'JEE Mains 2027';

  const shownDays = useCountUp(daysLeft, 1200, act === 'open');

  const finish = useCallback(() => {
    sfx.stopAll();
    onComplete();
  }, [onComplete]);

  /* Skip leaves every setting untouched. */
  const skip = useCallback(() => {
    sfx.stopAll();
    onComplete();
  }, [onComplete]);

  const chooseSound = (on: boolean) => {
    // This click is the user gesture that unlocks audio playback at all.
    sfx.setSoundEnabled(on);
    setSoundOn(on);
    setAct('open');
  };

  /* Act 1 ignition cue + auto-advance. */
  useEffect(() => {
    if (act !== 'open') return;
    sfx.ignite();
    const riserAt = window.setTimeout(() => sfx.riser(), 900);
    const advance = window.setTimeout(() => setAct('calibrate'), 7600);
    return () => {
      window.clearTimeout(riserAt);
      window.clearTimeout(advance);
    };
  }, [act]);

  const advanceCalibration = () => {
    sfx.select();
    if (step < 2) {
      setStep(step + 1);
      return;
    }
    // One write, at the end.
    onApplySettings({ examPreference: examPref, currentClass, dailyGoalHours: goalHours });
    onNavigateToToday();
    setAct('tour');
  };

  const toggleMute = () => {
    const next = !soundOn;
    sfx.setSoundEnabled(next);
    setSoundOn(next);
  };

  /* The in-app tour renders over the real UI, so no fullscreen shell. */
  if (act === 'tour') {
    return (
      <Spotlight
        onBeforeAdvance={onDiscardSession}
        onDone={() => setAct('close')}
        onSkip={skip}
      />
    );
  }

  const shellStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    background: INK_DEEP,
    color: PAPER,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'clamp(24px, 6vw, 80px)',
    textAlign: 'center',
    overflow: 'hidden',
  };

  return (
    <div style={shellStyle}>
      {/* Light pool — ignites in Act 1, steady afterwards */}
      <div
        className={`onb-spotlight ${act === 'open' ? 'onb-spotlight-ignite' : ''}`}
        style={{ ['--onb-size' as any]: act === 'open' ? '460px' : '760px' }}
      />
      <div
        className="onb-vignette"
        style={{ ['--onb-size' as any]: act === 'open' ? '460px' : '820px' }}
      />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '620px' }}>
        {/* ── Act 0 — sound gate ── */}
        {act === 'sound' && (
          <>
            <p className="font-data onb-fade" style={{ ...MICRO_LABEL, color: FAINT, animationDelay: '120ms' }}>
              Headphones recommended
            </p>
            <h1
              className="font-display onb-rise"
              style={{ fontSize: TYPE.displayM, letterSpacing: '-0.03em', lineHeight: 1.02, margin: '22px 0 0', animationDelay: '260ms' }}
            >
              Sound on?
            </h1>
            <p className="font-ui onb-rise" style={{ fontSize: TYPE.body, color: MUTED, margin: '14px auto 0', maxWidth: '34ch', animationDelay: '380ms' }}>
              This takes about thirty seconds.
            </p>

            <div className="onb-rise flex flex-wrap items-center justify-center gap-3" style={{ marginTop: '44px', animationDelay: '520ms' }}>
              <button
                onClick={() => chooseSound(true)}
                className="font-data"
                style={{ ...MICRO_LABEL, padding: '16px 38px', background: PAPER, color: INK_DEEP, border: 'none', borderRadius: '2px', cursor: 'pointer' }}
              >
                Sound on
              </button>
              <button
                onClick={() => chooseSound(false)}
                className="font-data"
                style={{ ...MICRO_LABEL, padding: '16px 32px', background: 'transparent', color: MUTED, border: '1px solid rgba(242,240,236,0.22)', borderRadius: '2px', cursor: 'pointer' }}
              >
                Continue silently
              </button>
            </div>
          </>
        )}

        {/* ── Act 1 — cold open ── */}
        {act === 'open' && (
          <>
            <p
              className="logo-text onb-fade"
              style={{ fontSize: 'clamp(20px, 3vw, 30px)', color: PAPER, letterSpacing: '0.08em', animationDelay: '340ms' }}
            >
              LOCK IN
            </p>

            <p
              className="font-display onb-rise"
              style={{
                fontSize: TYPE.displayXL,
                lineHeight: 0.82,
                letterSpacing: '-0.05em',
                margin: 'clamp(32px, 6vh, 64px) 0 0',
                fontVariantNumeric: 'tabular-nums',
                animationDelay: '1500ms',
              }}
            >
              {shownDays}
            </p>
            <p className="font-ui onb-rise" style={{ fontSize: TYPE.body, color: MUTED, marginTop: '18px', animationDelay: '1640ms' }}>
              days until {examLabel}.
            </p>

            <p
              className="font-accent onb-rise"
              style={{ fontSize: 'clamp(20px, 2.6vw, 30px)', color: PAPER, marginTop: 'clamp(34px, 6vh, 58px)', animationDelay: '3400ms' }}
            >
              Let's make them count.
            </p>
          </>
        )}

        {/* ── Act 2 — calibration ── */}
        {act === 'calibrate' && (
          <>
            <p className="font-data onb-fade" style={{ ...MICRO_LABEL, color: FAINT }}>
              {step + 1} / 3
            </p>

            {step === 0 && (
              <>
                <h2 className="font-display onb-rise" style={{ fontSize: TYPE.displayM, letterSpacing: '-0.03em', margin: '20px 0 0', animationDelay: '90ms' }}>
                  Which exam?
                </h2>
                <div className="onb-rise grid grid-cols-2 gap-3" style={{ marginTop: '38px', animationDelay: '200ms' }}>
                  {(['JEE', 'NEET'] as const).map(e => (
                    <button
                      key={e}
                      onClick={() => { sfx.select(); setExamPref(e); }}
                      className="font-display"
                      style={{
                        padding: '30px 12px',
                        fontSize: 'clamp(20px, 3vw, 28px)',
                        letterSpacing: '-0.02em',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: examPref === e ? PAPER : 'transparent',
                        color: examPref === e ? INK_DEEP : MUTED,
                        border: examPref === e ? `1px solid ${PAPER}` : '1px solid rgba(242,240,236,0.2)',
                        transition: 'all 180ms ease',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="font-display onb-rise" style={{ fontSize: TYPE.displayM, letterSpacing: '-0.03em', margin: '20px 0 0', animationDelay: '90ms' }}>
                  Which class?
                </h2>
                <div className="onb-rise grid grid-cols-2 gap-3" style={{ marginTop: '38px', animationDelay: '200ms' }}>
                  {([11, 12] as const).map(c => (
                    <button
                      key={c}
                      onClick={() => { sfx.select(); setCurrentClass(c); }}
                      className="font-display"
                      style={{
                        padding: '30px 12px',
                        fontSize: 'clamp(20px, 3vw, 28px)',
                        letterSpacing: '-0.02em',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: currentClass === c ? PAPER : 'transparent',
                        color: currentClass === c ? INK_DEEP : MUTED,
                        border: currentClass === c ? `1px solid ${PAPER}` : '1px solid rgba(242,240,236,0.2)',
                        transition: 'all 180ms ease',
                      }}
                    >
                      Class {c}
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-display onb-rise" style={{ fontSize: TYPE.displayM, letterSpacing: '-0.03em', margin: '20px 0 0', animationDelay: '90ms' }}>
                  How many hours a day?
                </h2>

                <div className="onb-rise flex items-center justify-center gap-6" style={{ marginTop: '38px', animationDelay: '200ms' }}>
                  <button
                    onClick={() => { sfx.select(); setGoalHours(h => Math.max(1, h - 1)); }}
                    aria-label="Decrease daily goal"
                    style={{ width: '46px', height: '46px', borderRadius: '999px', border: '1px solid rgba(242,240,236,0.22)', background: 'transparent', color: PAPER, fontSize: '20px', cursor: 'pointer' }}
                  >
                    −
                  </button>
                  <span
                    className="font-display"
                    style={{ fontSize: 'clamp(58px, 9vw, 96px)', lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', minWidth: '2ch' }}
                  >
                    {goalHours}
                  </span>
                  <button
                    onClick={() => { sfx.select(); setGoalHours(h => Math.min(16, h + 1)); }}
                    aria-label="Increase daily goal"
                    style={{ width: '46px', height: '46px', borderRadius: '999px', border: '1px solid rgba(242,240,236,0.22)', background: 'transparent', color: PAPER, fontSize: '20px', cursor: 'pointer' }}
                  >
                    +
                  </button>
                </div>

                {/* The live projection — the payoff moment of the whole flow. */}
                <p className="font-ui onb-fade" style={{ fontSize: TYPE.body, color: MUTED, marginTop: '30px' }}>
                  <span className="font-display" style={{ color: PAPER, fontSize: '1.35em', letterSpacing: '-0.02em' }}>
                    {(goalHours * daysLeft).toLocaleString('en-IN')}
                  </span>{' '}
                  hours before you sit the exam.
                </p>
              </>
            )}

            <button
              onClick={advanceCalibration}
              className="font-data onb-rise"
              style={{ ...MICRO_LABEL, marginTop: '44px', padding: '16px 44px', background: ACCENT, color: '#FFFFFF', border: 'none', borderRadius: '2px', cursor: 'pointer', animationDelay: '320ms' }}
            >
              {step < 2 ? 'Continue' : 'Set it'}
            </button>
          </>
        )}

        {/* ── Act 4 — close ── */}
        {act === 'close' && (
          <>
            <p className="font-ui onb-rise" style={{ fontSize: 'clamp(19px, 2.4vw, 26px)', color: MUTED, margin: 0, animationDelay: '120ms' }}>
              {goalHours} hours a day.
            </p>
            <p className="font-ui onb-rise" style={{ fontSize: 'clamp(19px, 2.4vw, 26px)', color: MUTED, margin: '6px 0 0', animationDelay: '340ms' }}>
              {daysLeft} days.
            </p>
            <p
              className="font-display onb-rise"
              style={{ fontSize: TYPE.displayM, letterSpacing: '-0.03em', color: PAPER, margin: '26px 0 0', animationDelay: '620ms' }}
            >
              Starting now.
            </p>

            <button
              onClick={() => { sfx.lock(); window.setTimeout(finish, 340); }}
              className="font-data onb-rise"
              style={{ ...MICRO_LABEL, marginTop: '46px', padding: '17px 46px', background: PAPER, color: INK_DEEP, border: 'none', borderRadius: '2px', cursor: 'pointer', animationDelay: '900ms' }}
            >
              Lock in 🔒
            </button>
          </>
        )}
      </div>

      {/* Persistent controls */}
      {act !== 'sound' && (
        <div style={{ position: 'fixed', bottom: '22px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 clamp(20px, 5vw, 44px)', zIndex: 3 }}>
          <button
            onClick={toggleMute}
            className="font-data"
            style={{ ...MICRO_LABEL, background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: '8px' }}
          >
            {soundOn ? 'Mute' : 'Sound on'}
          </button>
          {act !== 'close' && (
            <button
              onClick={skip}
              className="font-data"
              style={{ ...MICRO_LABEL, background: 'none', border: 'none', color: FAINT, cursor: 'pointer', padding: '8px' }}
            >
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
