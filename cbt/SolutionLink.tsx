/* ── Find the solution ──
   One tap to a Google search for a worked solution to this exact question.
   Shown only once the answer is out (practice after Check, the review after
   submit), never during a mock: there it would be a cheat button.

   NTA's questions are images, so the words come from the question's
   on-device OCR (`searchText`, served with the answers), or from the text of
   a question typed into the private bank. With the paper's date and shift in
   front, a dozen of the question's own words usually find it on a solutions
   site. When the OCR left too little to go on, the search names the paper,
   subject and question number instead. */

import React from 'react';
import { BankQuestion } from './types';
import { shiftLabel } from './generate';

const words = (q: BankQuestion): string => {
  const src = q.searchText ?? q.body.replace(/\[\[fig:\d+\]\]/g, ' ').replace(/\\[a-zA-Z]+/g, ' ');
  return (src.match(/[A-Za-z][A-Za-z'-]*|\d+(?:\.\d+)?/g) ?? []).slice(0, 18).join(' ');
};

export const solutionQuery = (q: BankQuestion): string => {
  const paper = q.sourceId === 'pyq' && q.shift ? `JEE Main ${shiftLabel(q.shift).replace(' · ', ' ')}` : q.year ? `JEE Main ${q.year}` : 'JEE Main';
  const w = words(q);
  return w.length >= 30 ? `${paper} ${w}` : `${paper} ${q.subject} question ${q.number ?? ''} solution`.replace(/\s+/g, ' ').trim();
};

export const solutionUrl = (q: BankQuestion): string => `https://www.google.com/search?q=${encodeURIComponent(solutionQuery(q))}`;

export default function SolutionLink({ q, dark, className = '' }: { q: BankQuestion; dark: boolean; className?: string }) {
  return (
    <a
      href={solutionUrl(q)}
      target="_blank"
      rel="noopener noreferrer"
      title="Opens a Google search in a new tab"
      className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12.5px] font-ui font-semibold transition-colors ${
        dark ? 'border-white/[0.12] text-zinc-200 hover:bg-white/[0.06]' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50'
      } ${className}`}
    >
      Find the solution
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
    </a>
  );
}
