/* ── "Pick your exams." — once, for students who were here before exams ──
   Alpha used to know two exams, JEE and NEET. Everyone who joined before the
   exam list arrived has a target the app guessed from their stream and class
   (normalizeTarget), and was never asked. This asks them, once, anywhere in
   the app.

   Who sees it is decided in App (`showExamLaunch`): past onboarding, synced,
   and no `examsAskedAt` on the account. New students never see it: onboarding
   asks the same questions and stamps `examsAskedAt` when it ends, finished or
   skipped. Saving here, or in Settings → Exam, stamps it too, and the stamp
   syncs, so answering on the phone clears the laptop.

   It cannot be dismissed without an answer, and it does not need to be: it
   opens on the target the app already guessed, so one press of the button
   keeps it. Same three questions as Settings (ExamFields), plus each exam's
   date in the chosen year, and a live line saying what the countdown will
   count to. */

import React, { useEffect, useRef } from 'react';
import { Overlay, btn, tokens } from '../ui/kit';
import { ExamFields, useExamDraft } from './ExamSheet';
import { EXAMS, examDateFor, targetLabel, type ExamTarget, type Stream } from '../content/exams';
import { getDaysRemaining } from '../utils';

interface Props {
  dark: boolean;
  stream: Stream;
  target: ExamTarget;
  cls: 11 | 12;
  onSave: (stream: Stream, target: ExamTarget) => void;
}

const ExamLaunch = ({ dark, stream, target, cls, onSave }: Props) => {
  const t = tokens(dark);
  const draft = useExamDraft(stream, target);
  const panelRef = useRef<HTMLDivElement>(null);

  const main = draft.picked[0];
  const when = examDateFor(main, draft.year);
  const days = Math.max(0, getDaysRemaining(when.date));
  const others = draft.picked.length - 1;

  /* The page behind stays put, and focus starts inside. */
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <Overlay>
      <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-center md:p-4 font-ui" role="dialog" aria-modal="true" aria-labelledby="exam-launch-title">
        <div className="absolute inset-0 bg-black/70 mk-fade" />
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`relative w-full md:max-w-[540px] max-h-[94dvh] md:max-h-[88dvh] flex flex-col rounded-t-3xl md:rounded-2xl border outline-none overflow-hidden mk-sheet ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
        >
          <div className="overflow-y-auto overscroll-contain">
            <div
              className="px-6 md:px-8 pt-8 pb-6"
              style={{
                background: dark
                  ? 'radial-gradient(120% 100% at 50% 0%, rgba(225,6,0,0.18) 0%, transparent 70%)'
                  : 'radial-gradient(120% 100% at 50% 0%, rgba(225,6,0,0.08) 0%, transparent 70%)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#E10600]">New in Alpha</p>
              <h2 id="exam-launch-title" className={`font-display text-[30px] md:text-[34px] leading-[1.05] mt-3 ${t.heading}`}>
                Pick your exams<span className="text-[#E10600]">.</span>
              </h2>
              <p className={`font-accent text-[18px] mt-1 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>Know exactly what you’re racing.</p>
              <p className={`text-[13px] leading-relaxed mt-3 ${t.muted}`}>
                Alpha now has {EXAMS.length} exams, not just JEE and NEET. Pick every one you’re writing and the year.
                Your countdown follows your main exam.
              </p>
            </div>

            <div className="px-6 md:px-8 pb-6">
              <ExamFields dark={dark} draft={draft} />
            </div>
          </div>

          <div className={`shrink-0 px-6 md:px-8 py-4 border-t flex items-center gap-4 ${dark ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-100 bg-white'}`} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className={`text-[14px] font-bold truncate ${t.heading}`}>
                {targetLabel(main, draft.year)}{others > 0 ? <span className={`font-normal ${t.muted}`}> +{others} more</span> : null}
              </p>
              <p className={`text-[12px] ${t.muted}`}>
                <span className="num-stat">{days}</span> {days === 1 ? 'day' : 'days'} to go{when.official ? '' : ', expected'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSave(draft.stream, draft.result(cls))}
              className={`${btn} shrink-0 px-6 py-3.5 ${t.primary}`}
            >
              Lock it in
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
};

export default ExamLaunch;
