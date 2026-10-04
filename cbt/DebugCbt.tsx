/* ── Dev-only harness: `?cbt=debug` ──
   The exam, the review and the error test on a fixture bank, with no
   database. Gated on import.meta.env.DEV in index.tsx and tree-shaken out of
   production, like share/DebugCards.tsx. Nothing here writes anywhere. */

import React, { useMemo, useState } from 'react';
import { getChaptersFor } from '../constants';
import { getWeight } from '../content';
import { ErrorEntry, MockTest } from '../types';
import ErrorQuiz from '../mocks/ErrorQuiz';
import { BankQuestion, CbtPaper, CbtSubject, Resp } from './types';
import { generatePaper } from './generate';
import { scorePaper } from './score';
import CbtExam from './CbtExam';
import PaperReview from './PaperReview';

const FIGURE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="120"><rect width="220" height="120" fill="white"/><line x1="20" y1="100" x2="200" y2="100" stroke="black" stroke-width="2"/><line x1="20" y1="100" x2="160" y2="30" stroke="black" stroke-width="2"/><rect x="80" y="52" width="30" height="20" fill="none" stroke="black" stroke-width="2" transform="rotate(-27 95 62)"/><text x="40" y="95" font-size="12">30°</text></svg>',
)}`;

const BODIES: Record<CbtSubject, string[]> = {
  Physics: [
    'A block of mass $m = 2\\,\\text{kg}$ rests on a rough incline of angle $30^\\circ$ with $\\mu = 0.2$. [[fig:0]] The frictional force on it is',
    'Two charges $q_1 = 2\\,\\mu C$ and $q_2 = -3\\,\\mu C$ are $10\\,\\text{cm}$ apart. The force between them is $$F = \\frac{1}{4\\pi\\varepsilon_0}\\frac{q_1 q_2}{r^2}$$ Find $|F|$ in newtons.',
    'A wire of resistance $R$ is stretched to twice its length. Its new resistance is',
  ],
  Chemistry: [
    'The hybridisation of the central atom in $\\mathrm{SF_4}$ is',
    'For the reaction $\\mathrm{N_2 + 3H_2 \\rightleftharpoons 2NH_3}$, $K_p$ and $K_c$ are related by $K_p = K_c(RT)^{\\Delta n}$ where $\\Delta n$ is',
    'The number of unpaired electrons in $\\mathrm{Fe^{3+}}$ is',
  ],
  Maths: [
    'If $\\displaystyle\\int_0^1 x e^{x}\\,dx = k$, then $k$ equals',
    'The number of real roots of $x^4 - 4x^2 + 3 = 0$ is',
    'The distance of the point $(1, 2, 3)$ from the plane $x + 2y + 2z = 5$ is',
  ],
  Biology: [],
};
const OPTIONS = [['$1$', '$2$', '$e - 1$', '$\\frac{1}{2}$'], ['$sp^3$', '$sp^3d$', '$sp^3d^2$', '$dsp^2$'], ['$R$', '$2R$', '$4R$', '$\\frac{R}{2}$']];

const fixture = (): BankQuestion[] => {
  const out: BankQuestion[] = [];
  let n = 0;
  (['Physics', 'Chemistry', 'Maths'] as CbtSubject[]).forEach(subject => {
    ([11, 12] as const).forEach(classId => {
      getChaptersFor('JEE', classId, subject).forEach(chapter => {
        for (let i = 0; i < 3; i++) {
          n += 1;
          const numerical = i === 2;
          const body = BODIES[subject][n % 3];
          out.push({
            id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
            sourceId: 'fixture', number: String(n), kind: numerical ? 'numerical' : 'mcq',
            body: numerical ? `${body} (give the number)` : body,
            options: numerical ? null : OPTIONS[n % 3],
            answer: numerical ? { value: 4 } : { option: 1 },
            figures: body.includes('[[fig:0]]') ? [FIGURE] : [],
            subject, classId, chapter, topic: null, year: 2019 + (n % 6), shift: `Shift ${1 + (n % 2)}`,
            difficulty: 1 + (n % 5), confidence: 1, status: 'ready', textHash: String(n),
          });
        }
      });
    });
  });
  return out;
};

const DebugCbt: React.FC = () => {
  const [dark, setDark] = useState(true);
  const questions = useMemo(fixture, []);
  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const [paper, setPaper] = useState<CbtPaper | null>(null);
  const [mode, setMode] = useState<'exam' | 'review' | 'quiz' | null>(null);
  const [saved, setSaved] = useState<{ mock: MockTest; errors: ErrorEntry[] } | null>(null);

  const build = (kind: 'full' | 'subject') => {
    const spec = kind === 'full' ? { kind } as const : { kind, subject: 'Physics' as CbtSubject } as const;
    const g = generatePaper({
      questions, spec, lastSeen: new Map(), openErrors: new Set(), weakChapters: new Set(), allowedChapters: null,
      weightOf: q => getWeight('JEE', q.classId as 11 | 12, q.subject, q.chapter as string)?.percent ?? 1.5, now: Date.now(), seed: 7,
    });
    const id = `debug-${kind}-${Date.now()}`;
    setPaper({ id, name: kind === 'full' ? 'JEE Main full paper' : 'Physics paper', kind, blueprint: g.blueprint, seed: 7, questionIds: g.questionIds, responses: {}, startedAt: null, submittedAt: null, score: null, mockId: null, createdAt: new Date().toISOString() });
    setSaved(null);
    setMode('exam');
  };

  const submit = (responses: Record<string, Resp>, startedAt: string) => {
    if (!paper) return;
    const next = { ...paper, responses, startedAt, submittedAt: new Date().toISOString(), score: scorePaper({ blueprint: paper.blueprint, responses }, byId) };
    setPaper(next);
    setMode('review');
  };

  return (
    <div className={`min-h-screen p-8 font-ui ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-zinc-900'}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60">Dev harness · ?cbt=debug</p>
      <h1 className="font-display text-[32px] mt-2">CBT</h1>
      <div className="flex flex-wrap gap-2 mt-6">
        <button className="px-4 py-2 rounded-lg border" onClick={() => build('full')}>Full paper</button>
        <button className="px-4 py-2 rounded-lg border" onClick={() => build('subject')}>Physics paper</button>
        <button className="px-4 py-2 rounded-lg border" onClick={() => setDark(d => !d)}>{dark ? 'Light' : 'Dark'}</button>
        {paper?.submittedAt && <button className="px-4 py-2 rounded-lg border" onClick={() => setMode('review')}>Review</button>}
        {saved?.errors.length ? <button className="px-4 py-2 rounded-lg border" onClick={() => setMode('quiz')}>Error test ({saved.errors.length})</button> : null}
      </div>
      {saved && <pre data-testid="saved" className="mt-6 text-[11px] opacity-80 whitespace-pre-wrap">{JSON.stringify({ mock: saved.mock, errors: saved.errors.map(e => ({ id: e.id, qbankId: e.qbankId, reason: e.reason, numeric: e.numeric, figures: e.figures?.length })) }, null, 2)}</pre>}

      {paper && mode === 'exam' && (
        <CbtExam paper={paper} questions={byId} dark={dark} onProgress={() => {}} onSubmit={submit} onLeave={() => setMode(null)} />
      )}
      {paper && mode === 'review' && (
        <PaperReview
          paper={paper}
          questions={byId}
          dark={dark}
          tests={[]}
          errors={[]}
          today="2026-10-04"
          onSave={saved ? undefined : (mock, errors) => { setSaved({ mock, errors }); setMode(null); }}
          onClose={() => setMode(null)}
        />
      )}
      {mode === 'quiz' && saved && (
        <ErrorQuiz title="From the paper" errors={saved.errors} dark={dark} onFinish={() => {}} onClose={() => setMode(null)} />
      )}
    </div>
  );
};

export default DebugCbt;
