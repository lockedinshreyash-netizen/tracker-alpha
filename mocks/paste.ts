/* ── Pasting a question ──
   A student copies a question from a PDF, a coaching site, Telegram or a
   ChatGPT answer, and it arrives as one block: the number, the question, four
   options in some style, often the answer and a solution after them. This
   splits that block into what the error form asks for, so one paste fills
   three steps.

   Pure and React-free (tested: `npm run test:mocks`). It decides nothing the
   student can't see: the form shows every field filled, with Undo.

   How options are found. Every marker in the text is listed — (A) [a] A. a)
   (1) 1) 1. (i) — with its style and family. A run is four of one kind in
   order (A B C D, 1 2 3 4…). The run that ends last wins, ties going to the one
   that starts last, so:
     · a question numbered "1." before options "1. 2. 3. 4." loses its number,
     · a List-I of (A)–(D) before options (1)–(4) is question text,
     · statements (i)–(iv) before options (a)–(d) are question text.
   A marker followed by a pairing ("(A)-(III)", "A → P") is a match-the-column
   pair inside an option, never a marker. Suffix markers (A. 1)) need a space
   after them, so 1.5 m is a number, not option 1. */

export interface PastedQuestion {
  question: string;
  options: [string, string, string, string] | null;
  /** Taken from an "Answer: (B)" line in the paste, if it had one. */
  correct: 0 | 1 | 2 | 3 | null;
}

const MAX_QUESTION = 1500;
const MAX_OPTION = 300;

type Family = 'upper' | 'lower' | 'digit' | 'roman';
type Style = 'paren' | 'bracket' | 'suffix';
interface Marker { start: number; end: number; kind: string; value: number }

const ROMAN = ['i', 'ii', 'iii', 'iv'];

const valueOf = (label: string): { family: Family; value: number } | null => {
  if (/^[A-D]$/.test(label)) return { family: 'upper', value: label.charCodeAt(0) - 65 };
  if (/^[a-d]$/.test(label)) return { family: 'lower', value: label.charCodeAt(0) - 97 };
  if (/^[1-4]$/.test(label)) return { family: 'digit', value: Number(label) - 1 };
  const r = ROMAN.indexOf(label);
  return r >= 0 ? { family: 'roman', value: r } : null;
};

/* Before a marker: the start, whitespace, or the colon of "Options:". */
const MARKER = /(^|[\s:;,])(?:\(([A-Da-d1-4]|iv|i{1,3})\)|\[([A-Da-d1-4])\]|([A-Da-d1-4])[.)](?=\s))/g;
/* "(A)-(III)", "(A) → P", "(B) – (q)": a column pairing, not an option. A
   plain minus is left alone: "(A) -1" and "(A) -(1/2)" are answers. */
const PAIRING = /^\s*(?:→|[-–—=]+\s*(?:\((?:[IVXivx]+|[P-Tp-t]|[1-5])\)|[IVX]+\b|[P-T]\b))/;

const markersIn = (text: string): Marker[] => {
  const out: Marker[] = [];
  for (const m of text.matchAll(MARKER)) {
    const label = m[2] ?? m[3] ?? m[4];
    const style: Style = m[2] ? 'paren' : m[3] ? 'bracket' : 'suffix';
    const v = valueOf(label);
    if (!v) continue;
    const start = (m.index ?? 0) + m[1].length;
    const end = (m.index ?? 0) + m[0].length;
    if (PAIRING.test(text.slice(end, end + 12))) continue;
    out.push({ start, end, kind: `${style}:${v.family}`, value: v.value });
  }
  return out;
};

const cleanOption = (s: string): string =>
  s.replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '').trim();

interface Run { markers: Marker[]; options: string[] }

const bestRun = (text: string): Run | null => {
  const ms = markersIn(text);
  let best: Run | null = null;
  for (let i = 0; i < ms.length; i++) {
    if (ms[i].value !== 0) continue;
    const run = [ms[i]];
    for (let j = i + 1; j < ms.length && run.length < 4; j++) {
      if (ms[j].kind === ms[i].kind && ms[j].value === run.length) run.push(ms[j]);
    }
    if (run.length < 4) continue;
    const options = run.map((m, k) => cleanOption(text.slice(m.end, k < 3 ? run[k + 1].start : undefined)));
    if (options.some(o => !o || o.length > MAX_OPTION)) continue;
    const better = !best
      || run[3].start > best.markers[3].start
      || (run[3].start === best.markers[3].start && run[0].start > best.markers[0].start);
    if (better) best = { markers: run, options };
  }
  return best;
};

/* NTA's response sheets and question papers put ids and statuses between
   the options; "Options:" on a line of its own is a heading. */
const JUNK_LINE = /^[ \t]*(?:question\s*id|option\s*[1-4]\s*id|status|chosen\s*option|question\s*type)[ \t]*:.*$/gim;
const HEADING_LINE = /^[ \t]*(?:options?|choices)[ \t]*[:\-]?[ \t]*$/gim;

const normalize = (raw: string): string =>
  raw
    .replace(/\r\n?/g, '\n')
    .replace(/[  -   　\t]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(JUNK_LINE, '')
    .replace(HEADING_LINE, '');

/* An answer the paste itself states. A separator or brackets are required
   ("Ans: B", "Answer (C)", "correct answer is (2)"), so a sentence like
   "the answer 2 times…" is never read as a key. */
const ANSWER = /(?:^|[\s(])(?:correct\s+(?:answer|option)|ans(?:wer)?|key)\b\.?\s*(?:is\s*)?(?:[:\-–=]\s*(?:option\s*)?[([]?([A-Da-d1-4])[)\]]?|[([]([A-Da-d1-4])[)\]])(?=$|[\s.,;)])/gim;
const SOLUTION = /(?:^|\n)[ \t]*(?:sol(?:ution)?|explanation|hint)\b\.?[ \t]*[:.\-–]/i;

const lastAnswer = (text: string): { index: number; value: 0 | 1 | 2 | 3 } | null => {
  let found: { index: number; value: 0 | 1 | 2 | 3 } | null = null;
  for (const m of text.matchAll(ANSWER)) {
    const v = valueOf(m[1] ?? m[2]);
    if (v) found = { index: m.index ?? 0, value: v.value as 0 | 1 | 2 | 3 };
  }
  return found;
};

const cleanQuestion = (s: string): string =>
  s
    .split('\n').map(l => l.replace(/ {2,}/g, ' ').trim()).join('\n')
    // "Q12.", "Question 5", "12)" — but not the 2 of "2.5 kg".
    .replace(/^\s*(?:q(?:uestion)?\s*(?:no\.?)?\s*\.?\s*\d{1,3}(?:\s*[.):\-](?!\d))?|\d{1,3}\s*[.):](?!\d))\s*/i, '')
    // A PDF breaks lines mid-sentence; a line that starts in lower case continues the one before.
    .replace(/\n(?=[a-z])/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*(?:options?|choices)\s*[:\-]?\s*$/i, '')
    .trim()
    .slice(0, MAX_QUESTION);

export const parsePastedQuestion = (raw: string): PastedQuestion => {
  const text = normalize(raw);
  const sol = text.search(SOLUTION);
  const before = sol >= 0 ? text.slice(0, sol) : text;
  const stated = lastAnswer(before);
  const inSolution = !stated && sol >= 0 ? lastAnswer(text.slice(sol)) : null;
  const answer = stated ?? inSolution;
  const answerCut = stated ? stated.index : -1;

  /* Cut at the answer if that leaves four options standing; an "answer" that
     sits inside the question would cut them off, so then read the whole. */
  const tries: { body: string; correct: 0 | 1 | 2 | 3 | null }[] = [];
  if (answerCut >= 0) tries.push({ body: before.slice(0, answerCut), correct: answer!.value });
  tries.push({ body: before, correct: answerCut >= 0 ? null : answer?.value ?? null });

  for (const { body, correct } of tries) {
    const run = bestRun(body);
    if (!run) continue;
    return {
      question: cleanQuestion(body.slice(0, run.markers[0].start)),
      options: run.options as [string, string, string, string],
      correct,
    };
  }
  return { question: cleanQuestion(before), options: null, correct: null };
};
