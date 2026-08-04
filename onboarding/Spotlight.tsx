import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACCENT, INK_DEEP, MICRO_LABEL, PAPER } from '../landing/tokens';
import * as sfx from '../audio';

/* Act 3 — orientation over the real UI.
   The rect-measuring / tooltip-positioning approach here is salvaged from the
   old (never-rendered) OnboardingTour.tsx, which handled resize, scroll and
   the mobile off-canvas sidebar correctly. */

type Rect = { top: number; right: number; bottom: number; left: number; width: number; height: number };

interface Step {
  target: string;
  line: string;
}

const STEPS: Step[] = [
  { target: 'session-timer', line: 'Pick a subject. Press start.' },
  { target: 'daily-target', line: 'Your goal for today.' },
  { target: 'syllabus-nav', line: 'Syllabus, streaks, and questions live here.' },
];

const TRANSITION_MS = 200;

const isSidebarTarget = (t: string) => t === 'syllabus-nav' || t === 'streak-nav';
const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const readRect = (target: string): Rect | null => {
  const el = document.querySelector<HTMLElement>(`[data-onboarding-target="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height };
};

interface Props {
  /* Runs before each step change. Used to clear a running session, which
     would otherwise unmount the element the next step points at. */
  onBeforeAdvance?: () => void;
  onDone: () => void;
  onSkip: () => void;
}

const Spotlight: React.FC<Props> = ({ onBeforeAdvance, onDone, onSkip }) => {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [tipSize, setTipSize] = useState({ width: 300, height: 96 });

  const tipRef = useRef<HTMLDivElement | null>(null);
  const preparedFor = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  const step = STEPS[index];

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    setRect(readRect(step.target));
  }, [step.target]);

  /* Bring the target into view (and open the mobile drawer for nav steps). */
  useEffect(() => {
    if (preparedFor.current === index) return;
    preparedFor.current = index;

    const prepare = () => {
      const el = document.querySelector<HTMLElement>(`[data-onboarding-target="${step.target}"]`);
      if (!el) {
        measure();
        return;
      }
      const r = el.getBoundingClientRect();
      if (isSidebarTarget(step.target) && window.innerWidth < 768 && r.right <= 0) {
        document.querySelector<HTMLButtonElement>('[data-onboarding-mobile-menu="toggle"]')?.click();
      } else if (!isSidebarTarget(step.target)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      window.setTimeout(measure, 340);
    };

    window.setTimeout(prepare, 60);
  }, [index, step.target, measure]);

  useEffect(() => {
    window.requestAnimationFrame(() => setVisible(true));
    measure();

    const onChange = () => window.requestAnimationFrame(measure);
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    const poll = window.setInterval(measure, 260);

    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
      window.clearInterval(poll);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [measure]);

  useEffect(() => {
    if (!tipRef.current) return;
    const r = tipRef.current.getBoundingClientRect();
    setTipSize(prev =>
      Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
        ? prev
        : { width: r.width, height: r.height }
    );
  }, [rect, index]);

  const advance = () => {
    sfx.select();
    // Clear any in-progress session first — it hides the next step's target.
    onBeforeAdvance?.();

    if (index >= STEPS.length - 1) {
      setVisible(false);
      timer.current = window.setTimeout(onDone, TRANSITION_MS);
      return;
    }
    setVisible(false);
    timer.current = window.setTimeout(() => {
      setIndex(i => i + 1);
      window.requestAnimationFrame(() => setVisible(true));
    }, TRANSITION_MS);
  };

  const pool = useMemo(() => {
    if (!rect) return null;
    const pad = 14;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Radius that comfortably covers the element's diagonal.
    const size = Math.max(rect.width, rect.height) / 2 + pad + 90;
    return { cx, cy, size };
  }, [rect]);

  const tipPos = useMemo(() => {
    if (!rect) return null;
    const gap = 18;
    const margin = 16;
    const width = Math.min(320, viewport.w - margin * 2);
    const spaceBelow = viewport.h - rect.bottom;
    const below = spaceBelow >= tipSize.height + gap + margin || rect.top < tipSize.height + gap + margin;
    const top = below
      ? clamp(rect.bottom + gap, margin, viewport.h - tipSize.height - margin)
      : clamp(rect.top - tipSize.height - gap, margin, viewport.h - tipSize.height - margin);
    const left = clamp(rect.left + rect.width / 2 - width / 2, margin, viewport.w - width - margin);
    return { top, left, width };
  }, [rect, tipSize, viewport]);

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 300, opacity: visible ? 1 : 0, transition: `opacity ${TRANSITION_MS}ms ease`, pointerEvents: 'none' }}
    >
      {/* Darkened ground + light pool on the target. Falls back to a plain
          scrim if the target can't be found, so the step never looks broken. */}
      {pool ? (
        <>
          <div
            className="onb-vignette"
            style={{
              ['--onb-x' as any]: `${pool.cx}px`,
              ['--onb-y' as any]: `${pool.cy}px`,
              ['--onb-size' as any]: `${pool.size}px`,
              transition: 'background 260ms ease',
            }}
          />
          <div
            className="onb-spotlight"
            style={{
              ['--onb-x' as any]: `${pool.cx}px`,
              ['--onb-y' as any]: `${pool.cy}px`,
              ['--onb-size' as any]: `${pool.size}px`,
              transition: 'background 260ms ease',
            }}
          />
          {rect && (
            <div
              className="fixed rounded-lg"
              style={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
                border: `1px solid ${ACCENT}`,
                boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
                transition: 'all 260ms cubic-bezier(0.16, 1, 0.3, 1)',
                pointerEvents: 'none',
              }}
            />
          )}
        </>
      ) : (
        <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.82)' }} />
      )}

      {/* Caption. Anchored to the target when we have one; otherwise centred —
          a step whose element is missing must still read as a step, never as
          a blank screen. */}
      {tipPos ? (
        <div
          ref={tipRef}
          className="fixed"
          style={{ top: tipPos.top, left: tipPos.left, width: tipPos.width, pointerEvents: 'auto' }}
        >
          <p className="font-ui" style={{ fontSize: '15px', fontWeight: 600, color: PAPER, lineHeight: 1.45, margin: 0, textShadow: '0 1px 12px rgba(0,0,0,0.85)' }}>
            {step.line}
          </p>
          <p className="font-data" style={{ ...MICRO_LABEL, color: 'rgba(242,240,236,0.4)', marginTop: '10px' }}>
            {index + 1} / {STEPS.length}
          </p>
        </div>
      ) : (
        <div className="fixed inset-0 flex items-center justify-center px-8" style={{ pointerEvents: 'none' }}>
          <div style={{ maxWidth: '320px', textAlign: 'center' }}>
            <p className="font-ui" style={{ fontSize: '15px', fontWeight: 600, color: PAPER, lineHeight: 1.45, margin: 0 }}>
              {step.line}
            </p>
            <p className="font-data" style={{ ...MICRO_LABEL, color: 'rgba(242,240,236,0.4)', marginTop: '10px' }}>
              {index + 1} / {STEPS.length}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{ position: 'fixed', bottom: '22px', left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 clamp(20px, 5vw, 44px)', pointerEvents: 'auto' }}>
        <button
          onClick={onSkip}
          className="font-data"
          style={{ ...MICRO_LABEL, background: 'none', border: 'none', color: 'rgba(242,240,236,0.4)', cursor: 'pointer', padding: '8px' }}
        >
          Skip
        </button>
        <button
          onClick={advance}
          className="font-data"
          style={{ ...MICRO_LABEL, padding: '14px 34px', background: PAPER, color: INK_DEEP, border: 'none', borderRadius: '2px', cursor: 'pointer' }}
        >
          {index >= STEPS.length - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default Spotlight;
