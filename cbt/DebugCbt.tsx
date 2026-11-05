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
import { generatePaper, paperTitle, shiftLabel } from './generate';
import PyqCover from './PyqCover';
import PyqHome, { shiftCards } from './PyqHome';
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

/* The shared NTA bank's shape: every question and option an image, a real
   shift sat in NTA's order, a third of the questions with no chapter tag. */
const ntaImage = (label: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${label.length > 3 ? 520 : 90}" height="${label.length > 3 ? 70 : 36}"><rect width="100%" height="100%" fill="white"/><text x="8" y="24" font-family="Times" font-size="18">${label}</text></svg>`,
)}`;
const NTA_SHIFTS = ['2026-0408-S2', '2026-0406-S1', '2026-0405-S2', '2026-0404-S1', '2026-0402-S2', '2026-0402-S1', '2025-0407-S1', '2025-0403-S2', '2025-0402-S1'];
const ntaFixture = (): BankQuestion[] => NTA_SHIFTS.flatMap((paper, k) => ntaShift(paper, k));
const ntaShift = (paper: string, k: number): BankQuestion[] => {
  const out: BankQuestion[] = [];
  let n = 0;
  (['Maths', 'Physics', 'Chemistry'] as CbtSubject[]).forEach(subject => {
    const chapters = getChaptersFor('JEE', 12, subject);
    for (let i = 0; i < 25; i++) {
      n += 1;
      const numerical = i >= 20;
      const tagged = n % 3 !== 0;
      out.push({
        id: `00000000-0000-4000-9${k}00-${String(n).padStart(12, '0')}`,
        sourceId: 'pyq', number: String(n), kind: numerical ? 'numerical' : 'mcq',
        body: '[[fig:0]]',
        options: numerical ? null : ['[[fig:1]]', '[[fig:2]]', '[[fig:3]]', '[[fig:4]]'],
        answer: numerical ? { value: 5 } : { option: 2 },
        figures: [ntaImage(`Q${n}. NTA question image (${subject})`), ...(numerical ? [] : ['(1) 2', '(2) 4', '(3) 6', '(4) 8'].map(ntaImage))],
        subject, classId: tagged ? 12 : null, chapter: tagged ? chapters[i % chapters.length] : null, topic: null,
        year: Number(paper.slice(0, 4)), shift: paper,
        searchText: i % 4 === 3 ? 'garbled' : 'A block of mass 2 kg slides down a smooth incline of angle 30 degrees The acceleration of the block is', difficulty: null, confidence: null, status: 'ready', textHash: String(n),
      });
    }
  });
  return out;
};

/* NTA papers' cover and home, on fixture papers: a shift sat with a score,
   one unfinished, a mixed paper waiting for its review. */
const fakePaper = (id: string, spec: CbtPaper['blueprint']['spec'], name: string, o: Partial<CbtPaper>): CbtPaper => ({
  id, bank: 'pyq', name, kind: spec.kind, seed: 1, questionIds: Array.from({ length: 75 }, (_, i) => `q${i}`), responses: {},
  blueprint: { exam: 'mains', spec, durationMins: 180, marking: { right: 4, wrong: -1 }, sections: [], notes: [] },
  startedAt: null, usedMs: null, submittedAt: null, score: null, mockId: null, createdAt: '2026-11-03T10:00:00Z', ...o,
});
const score = (marks: number) => ({ marks, max: 300, subjects: [] });

const NtaBoard: React.FC<{ view: 'cover' | 'home' | 'home-new' | 'home-done'; dark: boolean; questions: BankQuestion[] }> = ({ view, dark, questions }) => {
  const papers: CbtPaper[] = view === 'home-new' ? [] : view === 'home-done'
    ? NTA_SHIFTS.map((p, i) => fakePaper(`d${i}`, { kind: 'shift', paper: p }, `JEE Main ${shiftLabel(p)}`, { submittedAt: '2026-11-0' + (1 + (i % 4)) + 'T10:00:00Z', score: score(120 + i * 17), mockId: 'm' }))
    : [
      fakePaper('a', { kind: 'shift', paper: '2026-0408-S2' }, 'JEE Main 8 Apr 2026 · Shift 2', { submittedAt: '2026-11-04T12:00:00Z', score: score(212), mockId: 'm1' }),
      fakePaper('b', { kind: 'full' }, 'JEE Main full paper', { submittedAt: '2026-11-03T12:00:00Z', score: score(168) }),
      fakePaper('c', { kind: 'shift', paper: '2026-0405-S2' }, 'JEE Main 5 Apr 2026 · Shift 2', { startedAt: new Date(Date.now() - 64 * 60_000).toISOString() }),
    ];
  const cards = shiftCards(questions, papers);
  if (view === 'cover') {
    return <PyqCover dark={dark} questions={2348} shifts={29} tagged={98.9} nextLabel={cards[0]?.label ?? null} busy={false} onStart={() => {}} onBrowse={() => {}} />;
  }
  return (
    <PyqHome
      dark={dark}
      questions={2348}
      shifts={cards}
      next={cards.find(c => !c.sat) ?? null}
      resume={papers.find(p => !p.submittedAt) ?? null}
      history={papers.filter(p => p.submittedAt)}
      reviewDue={new Set(papers.filter(p => p.submittedAt && !p.mockId).map(p => p.id))}
      busy={null}
      now={Date.now()}
      onShift={() => {}}
      onOpen={() => {}}
      onBuild={() => {}}
    />
  );
};

const DebugCbt: React.FC = () => {
  const [dark, setDark] = useState(true);
  const questions = useMemo(() => [...fixture(), ...ntaFixture()], []);
  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions]);
  const [paper, setPaper] = useState<CbtPaper | null>(null);
  const [mode, setMode] = useState<'exam' | 'review' | 'quiz' | null>(null);
  const [board, setBoard] = useState<'cover' | 'home' | 'home-new' | 'home-done' | null>(null);
  const [saved, setSaved] = useState<{ mock: MockTest; errors: ErrorEntry[] } | null>(null);

  const build = (kind: 'full' | 'subject' | 'shift', practice = false) => {
    const spec = kind === 'full' ? { kind } as const : kind === 'shift' ? { kind, paper: '2026-0402-S1' } as const : { kind, subject: 'Physics' as CbtSubject } as const;
    const g = generatePaper({
      pyq: kind === 'shift',
      questions: kind === 'shift' ? questions.filter(q => q.sourceId === 'pyq') : questions.filter(q => q.sourceId !== 'pyq'), spec, lastSeen: new Map(), openErrors: new Set(), weakChapters: new Set(), allowedChapters: null,
      weightOf: q => getWeight('JEE', q.classId as 11 | 12, q.subject, q.chapter as string)?.percent ?? 1.5, now: Date.now(), seed: 7,
    });
    const id = `debug-${kind}-${Date.now()}`;
    setPaper({ id, bank: kind === 'shift' ? 'pyq' : 'private', name: `${practice ? 'Practice · ' : ''}${paperTitle(spec)}`, kind, blueprint: { ...g.blueprint, mode: practice ? 'practice' : 'mock' }, seed: 7, questionIds: g.questionIds, responses: {}, startedAt: null, usedMs: null, submittedAt: null, score: null, mockId: null, createdAt: new Date().toISOString() });
    setSaved(null);
    setMode('exam');
  };

  const submit = (responses: Record<string, Resp>, startedAt: string, usedMs: number) => {
    if (!paper) return;
    const next = { ...paper, responses, startedAt, usedMs, submittedAt: new Date().toISOString(), score: scorePaper({ blueprint: paper.blueprint, responses }, byId) };
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
        <button className="px-4 py-2 rounded-lg border" onClick={() => build('shift')}>NTA shift</button>
        <button className="px-4 py-2 rounded-lg border" onClick={() => build('shift', true)}>Practice shift</button>
        <button className="px-4 py-2 rounded-lg border" onClick={() => setDark(d => !d)}>{dark ? 'Light' : 'Dark'}</button>
        {(['cover', 'home', 'home-new', 'home-done'] as const).map(b => (
          <button key={b} className={`px-4 py-2 rounded-lg border ${board === b ? 'bg-white/10' : ''}`} onClick={() => setBoard(x => (x === b ? null : b))}>NTA {b}</button>
        ))}
        {paper?.submittedAt && <button className="px-4 py-2 rounded-lg border" onClick={() => setMode('review')}>Review</button>}
        {saved?.errors.length ? <button className="px-4 py-2 rounded-lg border" onClick={() => setMode('quiz')}>Error test ({saved.errors.length})</button> : null}
      </div>
      {saved && <pre data-testid="saved" className="mt-6 text-[11px] opacity-80 whitespace-pre-wrap">{JSON.stringify({ mock: saved.mock, errors: saved.errors.map(e => ({ id: e.id, qbankId: e.qbankId, reason: e.reason, numeric: e.numeric, figures: e.figures?.length })) }, null, 2)}</pre>}

      {board && <div className="mt-10 max-w-[1024px] mx-auto"><NtaBoard view={board} dark={dark} questions={questions.filter(q => q.sourceId === 'pyq')} /></div>}

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
