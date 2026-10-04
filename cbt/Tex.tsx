/* ── Question text ──
   Bank text is prose with inline LaTeX — $…$ and \(…\) inline, $$…$$ and
   \[…\] on their own line — and figure tokens, [[fig:N]], pointing at the
   question's N-th figure. KaTeX renders the maths; a bad expression renders
   red in place instead of throwing, so one OCR slip cannot blank a paper.

   KaTeX and its stylesheet are heavy, which is why this file is only ever
   reached through a lazy import: nobody without the CBT downloads it. */

import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useFigureUrls } from './figures';

type Seg =
  | { t: 'text'; v: string }
  | { t: 'math'; v: string; display: boolean }
  | { t: 'fig'; i: number };

const FIG = /\[\[fig:(\d{1,2})\]\]/g;

const parseMath = (src: string): Seg[] => {
  const out: Seg[] = [];
  let buf = '';
  let i = 0;
  const flush = () => { if (buf) out.push({ t: 'text', v: buf }); buf = ''; };
  const close = (open: string, end: string, display: boolean): boolean => {
    if (!src.startsWith(open, i)) return false;
    const j = src.indexOf(end, i + open.length);
    if (j < 0) return false;
    flush();
    out.push({ t: 'math', v: src.slice(i + open.length, j), display });
    i = j + end.length;
    return true;
  };
  while (i < src.length) {
    if (src[i] === '\\' && src[i + 1] === '$') { buf += '$'; i += 2; continue; }
    if (close('$$', '$$', true) || close('\\[', '\\]', true) || close('\\(', '\\)', false)) continue;
    if (src[i] === '$') {
      const j = src.indexOf('$', i + 1);
      // A lone "$" (a price, a typo) stays text.
      if (j > i + 1) { flush(); out.push({ t: 'math', v: src.slice(i + 1, j), display: false }); i = j + 1; continue; }
    }
    buf += src[i];
    i += 1;
  }
  flush();
  return out;
};

export const parse = (src: string): Seg[] => {
  const out: Seg[] = [];
  let last = 0;
  for (const m of src.matchAll(FIG)) {
    out.push(...parseMath(src.slice(last, m.index)));
    out.push({ t: 'fig', i: Number(m[1]) });
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(...parseMath(src.slice(last)));
  return out;
};

/** Figure indexes a piece of text points at. */
export const figureRefs = (src: string): number[] => Array.from(src.matchAll(FIG)).map(m => Number(m[1]));

const rendered = new Map<string, string>();
const renderMath = (v: string, display: boolean): string => {
  const key = `${display ? 'D' : 'I'}${v}`;
  let html = rendered.get(key);
  if (html === undefined) {
    html = katex.renderToString(v, { throwOnError: false, displayMode: display, strict: 'ignore', output: 'html', trust: false });
    if (rendered.size > 4000) rendered.clear();
    rendered.set(key, html);
  }
  return html;
};

/* A figure is a scan: black ink on white. In dark mode it sits on its own
   white card rather than being inverted, because inverting a circuit diagram
   is fine and inverting a photo of a titration is not. */
export const Figure: React.FC<{ path: string | undefined; url: string | undefined; small?: boolean }> = ({ path, url, small }) => {
  const src = path && (path.startsWith('data:') || path.startsWith('http')) ? path : url;
  return (
    // Full size on a line of its own; option-sized ones sit inline with their letter.
    <span className={`bg-white rounded-lg p-1.5 ${small ? 'inline-block align-middle my-1 max-w-[220px]' : 'block w-fit max-w-full my-3'}`}>
      {src ? (
        <img src={src} alt="Figure" loading="lazy" className="block max-w-full h-auto" style={{ maxHeight: small ? 140 : 340 }} />
      ) : (
        <span className="block px-6 py-5 text-[11px] font-ui text-zinc-400">Figure</span>
      )}
    </span>
  );
};

const Tex: React.FC<{
  text: string;
  figures?: string[];
  className?: string;
  /** Options and short labels: figures drawn smaller, no block margins. */
  compact?: boolean;
}> = ({ text, figures = [], className = '', compact }) => {
  const segs = useMemo(() => parse(text), [text]);
  const urls = useFigureUrls(figures.filter(p => !p.startsWith('data:') && !p.startsWith('http')));
  return (
    <span className={`cbt-tex whitespace-pre-wrap break-words ${className}`}>
      {segs.map((s, i) => {
        if (s.t === 'text') return <React.Fragment key={i}>{s.v}</React.Fragment>;
        if (s.t === 'fig') return <Figure key={i} path={figures[s.i]} url={urls[figures[s.i]]} small={compact} />;
        return (
          <span
            key={i}
            className={s.display && !compact ? 'block my-2 overflow-x-auto overflow-y-hidden' : ''}
            dangerouslySetInnerHTML={{ __html: renderMath(s.v, s.display && !compact) }}
          />
        );
      })}
    </span>
  );
};

/** Figures no token in the body or options points at — shown under the question so none are lost. */
export const LooseFigures: React.FC<{ body: string; options?: string[] | null; figures: string[] }> = ({ body, options, figures }) => {
  const used = new Set([body, ...(options ?? [])].flatMap(figureRefs));
  const loose = figures.map((p, i) => ({ p, i })).filter(x => !used.has(x.i));
  const urls = useFigureUrls(loose.map(x => x.p).filter(p => !p.startsWith('data:') && !p.startsWith('http')));
  if (!loose.length) return null;
  return (
    <span className="flex flex-wrap gap-2 mt-3">
      {loose.map(x => <Figure key={x.i} path={x.p} url={urls[x.p]} />)}
    </span>
  );
};

export default Tex;
