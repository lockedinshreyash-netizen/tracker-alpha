import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
};

type ModalStep = {
  type: 'modal';
  title: string;
  subtext: string;
  cta: string;
};

type SpotlightStep = {
  type: 'spotlight';
  target: string;
  tooltip: string;
  focusTab?: 'Today';
};

type TourStep = ModalStep | SpotlightStep;

const STORAGE_KEY = 'onboarding_complete';
const TRANSITION_MS = 180;

const TOUR_STEPS: TourStep[] = [
  {
    type: 'modal',
    title: 'Welcome to LOCK IN.',
    subtext: "Let's show you around. It'll take 30 seconds.",
    cta: 'Show me',
  },
  {
    type: 'spotlight',
    target: 'session-timer',
    focusTab: 'Today',
    tooltip: 'Choose a subject and hit Start Session to begin logging your study time.',
  },
  {
    type: 'spotlight',
    target: 'daily-target',
    focusTab: 'Today',
    tooltip: 'Set your daily study goal here. Adjust it anytime.',
  },
  {
    type: 'spotlight',
    target: 'syllabus-nav',
    tooltip: 'Track the status of every chapter across Physics, Chemistry and Maths.',
  },
  {
    type: 'spotlight',
    target: 'streak-nav',
    tooltip: "Your consistency visualized. Don't break the chain.",
  },
  {
    type: 'modal',
    title: "You're all set.",
    subtext: 'Now stop reading and start studying.',
    cta: 'Lock In \u{1F512}',
  },
];

const getShouldShowTour = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'true';
  } catch {
    return false;
  }
};

const markTourComplete = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // localStorage can be unavailable in hardened browser modes.
  }
};

const readTargetRect = (target: string): Rect | null => {
  const element = document.querySelector<HTMLElement>(`[data-onboarding-target="${target}"]`);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  return {
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
};

const isSidebarTarget = (target: string) => target === 'syllabus-nav' || target === 'streak-nav';

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

interface OnboardingTourProps {
  onNavigateToTab?: (tab: 'Today') => void;
  onComplete?: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onNavigateToTab, onComplete }) => {
  const [isActive, setIsActive] = useState(getShouldShowTour);
  const [stepIndex, setStepIndex] = useState(0);
  const [isStepVisible, setIsStepVisible] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 128 });
  const transitionTimerRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const preparedStepRef = useRef<number | null>(null);

  const currentStep = TOUR_STEPS[stepIndex];

  const updateTargetRect = useCallback(() => {
    setViewport({ width: window.innerWidth, height: window.innerHeight });

    if (!isActive || currentStep.type !== 'spotlight') {
      setTargetRect(null);
      return;
    }

    setTargetRect(readTargetRect(currentStep.target));
  }, [currentStep, isActive]);

  const completeTour = useCallback(() => {
    markTourComplete();
    setIsStepVisible(false);

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setIsActive(false);
      onComplete?.();
    }, TRANSITION_MS);
  }, [onComplete]);

  const goToStep = useCallback((nextStepIndex: number) => {
    setIsStepVisible(false);

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      preparedStepRef.current = null;
      setStepIndex(nextStepIndex);
      window.requestAnimationFrame(() => setIsStepVisible(true));
    }, TRANSITION_MS);
  }, []);

  const handlePrimaryAction = () => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      completeTour();
      return;
    }

    goToStep(stepIndex + 1);
  };

  useEffect(() => {
    if (!isActive) return;
    window.requestAnimationFrame(() => setIsStepVisible(true));

    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive || currentStep.type !== 'spotlight') return;
    if (currentStep.focusTab) onNavigateToTab?.(currentStep.focusTab);

    const prepareTarget = () => {
      const element = document.querySelector<HTMLElement>(`[data-onboarding-target="${currentStep.target}"]`);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      if (isSidebarTarget(currentStep.target) && window.innerWidth < 768 && rect.right <= 0) {
        document.querySelector<HTMLButtonElement>('[data-onboarding-mobile-menu="toggle"]')?.click();
      } else if (!isSidebarTarget(currentStep.target)) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }

      window.setTimeout(updateTargetRect, 340);
    };

    if (preparedStepRef.current !== stepIndex) {
      preparedStepRef.current = stepIndex;
      window.setTimeout(prepareTarget, 60);
    }
  }, [currentStep, isActive, onNavigateToTab, stepIndex, updateTargetRect]);

  useEffect(() => {
    if (!isActive) return;

    updateTargetRect();

    const handleLayoutChange = () => {
      window.requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);

    const interval = window.setInterval(updateTargetRect, 250);

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
      window.clearInterval(interval);
    };
  }, [isActive, updateTargetRect]);

  useEffect(() => {
    if (!tooltipRef.current || currentStep.type !== 'spotlight') return;

    const rect = tooltipRef.current.getBoundingClientRect();
    setTooltipSize(prev => {
      if (Math.abs(prev.width - rect.width) < 1 && Math.abs(prev.height - rect.height) < 1) {
        return prev;
      }

      return { width: rect.width, height: rect.height };
    });
  }, [currentStep, targetRect]);

  const spotlightRect = useMemo(() => {
    if (!targetRect) return null;

    const padding = 10;
    const top = clamp(targetRect.top - padding, 8, viewport.height - 16);
    const left = clamp(targetRect.left - padding, 8, viewport.width - 16);
    const right = clamp(targetRect.right + padding, 16, viewport.width - 8);
    const bottom = clamp(targetRect.bottom + padding, 16, viewport.height - 8);

    return {
      top,
      left,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }, [targetRect, viewport]);

  const tooltipPosition = useMemo(() => {
    if (!spotlightRect) return null;

    const gap = 16;
    const margin = 16;
    const width = Math.min(320, viewport.width - margin * 2);
    const spaceBelow = viewport.height - spotlightRect.bottom;
    const placeBelow = spaceBelow >= tooltipSize.height + gap + margin || spotlightRect.top < tooltipSize.height + gap + margin;
    const top = placeBelow
      ? clamp(spotlightRect.bottom + gap, margin, viewport.height - tooltipSize.height - margin)
      : clamp(spotlightRect.top - tooltipSize.height - gap, margin, viewport.height - tooltipSize.height - margin);
    const left = clamp(
      spotlightRect.left + spotlightRect.width / 2 - width / 2,
      margin,
      viewport.width - width - margin
    );

    return { top, left, width };
  }, [spotlightRect, tooltipSize, viewport]);

  if (!isActive) return null;

  const isSpotlight = currentStep.type === 'spotlight';

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 9999,
        opacity: isStepVisible ? 1 : 0,
        transition: `opacity ${TRANSITION_MS}ms ease`,
      }}
    >
      {isSpotlight ? (
        <>
          {spotlightRect ? (
            <>
              <div className="fixed left-0 top-0 right-0 bg-black/70" style={{ height: spotlightRect.top }} />
              <div className="fixed left-0 bg-black/70" style={{ top: spotlightRect.top, width: spotlightRect.left, height: spotlightRect.height }} />
              <div className="fixed right-0 bg-black/70" style={{ top: spotlightRect.top, left: spotlightRect.right, height: spotlightRect.height }} />
              <div className="fixed left-0 right-0 bottom-0 bg-black/70" style={{ top: spotlightRect.bottom }} />
              <div
                className="fixed rounded-lg border border-[#E10600] shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_36px_rgba(225,6,0,0.28)] transition-all duration-300"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                }}
              />
            </>
          ) : (
            <div className="fixed inset-0 bg-black/70" />
          )}

          {tooltipPosition && (
            <div
              ref={tooltipRef}
              className="fixed pointer-events-auto rounded-md border border-zinc-700 bg-zinc-800 p-4 shadow-2xl transition-all duration-300"
              style={{
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                width: tooltipPosition.width,
              }}
            >
              <p className="text-sm font-bold leading-relaxed text-white font-ui">{currentStep.tooltip}</p>
            </div>
          )}

          <button
            type="button"
            onClick={completeTour}
            className="fixed bottom-5 left-5 pointer-events-auto rounded-md border border-zinc-700 bg-zinc-800 px-5 py-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 shadow-xl hover:text-white font-ui"
          >
            Skip tour
          </button>
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="fixed bottom-5 right-5 pointer-events-auto rounded-md bg-[#E10600] px-6 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-xl hover:bg-red-700 font-ui"
          >
            Next
          </button>
        </>
      ) : (
        <>
          <div className="fixed inset-0 bg-black/70" />
          <div className="fixed inset-0 flex items-center justify-center px-4">
            <div className="pointer-events-auto w-full max-w-md rounded-md border border-zinc-700 bg-zinc-900 p-7 text-center shadow-2xl md:p-9">
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl font-display">{currentStep.title}</h2>
              <p className="mt-4 text-sm font-bold leading-relaxed text-zinc-400 md:text-base font-ui">{currentStep.subtext}</p>
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="mt-8 w-full rounded-md bg-[#E10600] px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-xl hover:bg-red-700 font-ui"
              >
                {currentStep.cta}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OnboardingTour;
