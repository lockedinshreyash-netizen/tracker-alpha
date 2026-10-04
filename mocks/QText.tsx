/* ── An error's text ──
   Hand-typed errors are plain text and render as they always have. Errors
   that came from a CBT paper carry LaTeX and figure tokens; only those reach
   for the renderer, which is lazily loaded, so a notebook with no CBT entries
   never downloads KaTeX. Until it arrives the raw text stands in. */

import React, { Suspense } from 'react';
import { ErrorEntry } from '../types';

const Tex = React.lazy(() => import('../cbt/Tex'));
const Loose = React.lazy(() => import('../cbt/Tex').then(m => ({ default: m.LooseFigures })));

export const QText: React.FC<{ e: Pick<ErrorEntry, 'qbankId' | 'figures'>; text: string; compact?: boolean; className?: string }> = ({ e, text, compact, className = '' }) => {
  if (!e.qbankId) return <span className={`whitespace-pre-wrap ${className}`}>{text}</span>;
  return (
    <Suspense fallback={<span className={`whitespace-pre-wrap ${className}`}>{text}</span>}>
      <Tex text={text} figures={e.figures ?? []} compact={compact} className={className} />
    </Suspense>
  );
};

/** Figures no token in the question points at, shown under it. Nothing for hand-typed errors. */
export const QFigures: React.FC<{ e: Pick<ErrorEntry, 'qbankId' | 'figures' | 'question' | 'options'> }> = ({ e }) => {
  if (!e.qbankId || !e.figures?.length) return null;
  return (
    <Suspense fallback={null}>
      <Loose body={e.question} options={e.options} figures={e.figures} />
    </Suspense>
  );
};

/** What the right answer reads as: an option's text, or the numerical value. */
export const answerOf = (e: Pick<ErrorEntry, 'numeric' | 'options' | 'correct'>): string =>
  e.numeric !== undefined ? String(e.numeric) : e.options[e.correct];
