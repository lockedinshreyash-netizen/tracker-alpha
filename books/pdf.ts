/* ── pdf.js, loaded only when a PDF is touched ──
   pdfjs-dist is ~400 kB of script plus a worker of ~1 MB, so nothing imports
   it statically: `loadPdfjs()` is the one door, and it opens the first time a
   book is added or opened. The worker is a separate file Vite emits (`?url`),
   so it never enters any chunk either.

   Everything a shelf needs from a PDF is read here once, at import time
   (`inspectPdf`): the page count, the title the file carries, the outline as
   (title, page) pairs for the chapter map, and page 1 as a small picture for
   the "First page" cover. */

import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { OutlineEntry } from './model';
import { pageText } from './anchors';
import { isContentsPage, opensWith, parseContents, pickChapterEntries, toPdfPages } from './mapping';

type Pdfjs = typeof import('pdfjs-dist');

let lib: Promise<Pdfjs> | null = null;

export const loadPdfjs = (): Promise<Pdfjs> => {
  if (!lib) {
    lib = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    }).catch(e => { lib = null; throw e; });
  }
  return lib;
};

export class NotAPdfError extends Error {
  readonly reason: 'not-pdf' | 'password' | 'broken';
  constructor(reason: 'not-pdf' | 'password' | 'broken') {
    super(reason === 'password' ? 'This PDF is locked with a password.' : reason === 'not-pdf' ? 'This file is not a PDF.' : 'This PDF could not be read.');
    this.reason = reason;
  }
}

export const openPdf = async (data: ArrayBuffer | Uint8Array): Promise<PDFDocumentProxy> => {
  const pdfjs = await loadPdfjs();
  try {
    // pdf.js takes ownership of the buffer it is given; hand it a copy so the caller's survives.
    const bytes = data instanceof Uint8Array ? data.slice() : new Uint8Array(data.slice(0));
    return await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'PasswordException') throw new NotAPdfError('password');
    if (name === 'InvalidPDFException') throw new NotAPdfError('not-pdf');
    throw new NotAPdfError('broken');
  }
};

/** A PDF's bookmarks, three levels deep, each resolved to a 1-based page and kept with its depth. */
export const outlineOf = async (doc: PDFDocumentProxy): Promise<(OutlineEntry & { depth: number })[]> => {
  let outline: Awaited<ReturnType<PDFDocumentProxy['getOutline']>> = null;
  try { outline = await doc.getOutline(); } catch { return []; }
  if (!outline) return [];
  const out: (OutlineEntry & { depth: number })[] = [];
  const pageOf = async (dest: unknown): Promise<number | null> => {
    try {
      const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!Array.isArray(explicit) || !explicit[0]) return null;
      const ref = explicit[0];
      const index = typeof ref === 'number' ? ref : await doc.getPageIndex(ref);
      return index + 1;
    } catch { return null; }
  };
  const walk = async (items: typeof outline, depth: number) => {
    for (const item of items ?? []) {
      if (out.length >= 600) return;
      const page = await pageOf(item.dest);
      const title = (item.title ?? '').replace(/\s+/g, ' ').trim();
      if (page && title) out.push({ title, page, depth });
      if (depth < 2 && item.items?.length) await walk(item.items, depth + 1);
    }
  };
  await walk(outline, 0);
  return out;
};

/** Renders one page into a canvas at `width` CSS pixels (times the device's pixel ratio, capped). */
export const renderPage = async (
  doc: PDFDocumentProxy,
  pageNo: number,
  canvas: HTMLCanvasElement,
  width: number,
  maxPixels = 4_000_000,
): Promise<{ cssWidth: number; cssHeight: number }> => {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const cssScale = width / base.width;
  let ratio = Math.min(window.devicePixelRatio || 1, 3);
  const area = base.width * base.height * (cssScale * ratio) ** 2;
  if (area > maxPixels) ratio *= Math.sqrt(maxPixels / area);
  const viewport = page.getViewport({ scale: cssScale * ratio });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('no canvas');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { cssWidth: width, cssHeight: (base.height / base.width) * width };
};

const toBlob = (canvas: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, type, q));

/** Page 1 as a small WebP (JPEG where WebP cannot be encoded), for the cover. */
export const renderThumb = async (doc: PDFDocumentProxy, width = 360): Promise<Blob | null> => {
  const canvas = document.createElement('canvas');
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const webp = await toBlob(canvas, 'image/webp', 0.82);
  return webp && webp.type === 'image/webp' ? webp : toBlob(canvas, 'image/jpeg', 0.84);
};

/** One page's text, joined the way books/anchors.ts anchors to it. */
export const textOfPage = async (doc: PDFDocumentProxy, pageNo: number): Promise<string> => {
  const page = await doc.getPage(pageNo);
  const content = await page.getTextContent();
  return pageText(content.items.filter((x): x is { str: string; hasEOL: boolean } & typeof x => 'str' in x)).text;
};

/* A page's text as lines, the way it is printed. pdf.js hands text over in
   pieces (a word can be three), so pieces are grouped by their baseline and
   ordered left to right, with a space only where the page leaves a gap. */
export const linesOfPage = async (doc: PDFDocumentProxy, pageNo: number): Promise<string[]> => {
  const page = await doc.getPage(pageNo);
  const content = await page.getTextContent();
  type Piece = { s: string; x: number; y: number; w: number; h: number };
  const pieces: Piece[] = [];
  for (const it of content.items) {
    if (!('str' in it) || !it.str) continue;
    const t = it.transform as number[];
    pieces.push({ s: it.str, x: t[4], y: t[5], w: it.width ?? 0, h: Math.abs(t[3]) || it.height || 10 });
  }
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Piece[][] = [];
  for (const p of pieces) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - p.y) <= Math.max(2, p.h * 0.45)) line.push(p);
    else lines.push([p]);
  }
  return lines.map(line => {
    line.sort((a, b) => a.x - b.x);
    let text = '';
    let end = -Infinity;
    for (const p of line) {
      const gap = p.x - end;
      if (text && gap > p.h * 0.18 && !/\s$/.test(text) && !/^\s/.test(p.s)) text += ' ';
      text += p.s;
      end = p.x + p.w;
    }
    return text.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
};

const FRONT_PAGES = 40;
const SEARCH_AHEAD = 60;

/* The printed Contents, read from the front of the book only: the first
   Contents page within the first 40, and the pages after it while they go on
   listing chapters. Printed page numbers become PDF pages through the PDF's
   page labels, else through one offset measured by finding the first
   chapter's title at the top of a page a little after its printed number. */
export const findContents = async (doc: PDFDocumentProxy, onProgress?: (done: number) => void): Promise<OutlineEntry[]> => {
  // Up to 40 pages of front matter in a textbook; a short file is not searched end to end for one.
  const front = Math.min(doc.numPages, FRONT_PAGES, Math.max(10, Math.ceil(doc.numPages * 0.1)));
  const pages: string[][] = [];
  let last = 0;
  for (let p = 1; p <= front; p++) {
    onProgress?.((p / front) * 0.6);
    let lines: string[];
    try { lines = await linesOfPage(doc, p); } catch { continue; }
    if (!pages.length) {
      if (isContentsPage(lines) && parseContents([lines]).length >= 2) { pages.push(lines); last = p; }
    } else if (parseContents([lines]).length >= 2) {
      pages.push(lines);
      last = p;
    } else break;
  }
  const entries = parseContents(pages);
  if (entries.length < 2) return [];

  let labels: (string | null)[] | null = null;
  try { labels = await doc.getPageLabels(); } catch { labels = null; }
  if (labels && entries.every(e => labels!.includes(String(e.printed)))) return toPdfPages(entries, doc.numPages, { labels });

  for (const e of entries.slice(0, 3)) {
    const from = Math.max(last + 1, e.printed);
    const to = Math.min(doc.numPages, e.printed + SEARCH_AHEAD);
    for (let p = from; p <= to; p++) {
      onProgress?.(0.6 + ((p - from) / Math.max(1, to - from)) * 0.4);
      try {
        const top = (await linesOfPage(doc, p)).slice(0, 8).join(' ');
        if (opensWith(top, e.title)) return toPdfPages(entries, doc.numPages, { offset: p - e.printed });
      } catch { /* try the next page */ }
    }
  }
  return [];
};

export interface PdfFacts {
  pages: number;
  title: string;
  /** Chapters only, from the bookmarks or the printed Contents. Empty for a one-chapter file. */
  chapters: OutlineEntry[];
  /** The top of page 1, to guess a one-chapter file's chapter from. */
  firstText: string;
  thumb: Blob | null;
}

/* The file's own title is used only when it looks like one: many PDFs carry
   "Microsoft Word - ch1.docx" or nothing at all, and the file name is better. */
const goodTitle = (t: unknown): string | null => {
  if (typeof t !== 'string') return null;
  const s = t.replace(/\s+/g, ' ').trim();
  if (s.length < 3 || s.length > 140 || /^(untitled|microsoft|document|\d+$)|\.(docx?|pdf|indd|tex)$/i.test(s)) return null;
  return s;
};

export const titleFromFileName = (name: string): string =>
  name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140) || 'Untitled';

export const inspectPdf = async (file: File, onProgress?: (done: number) => void): Promise<PdfFacts> => {
  const doc = await openPdf(await file.arrayBuffer());
  try {
    let title = titleFromFileName(file.name);
    try {
      const meta = await doc.getMetadata();
      title = goodTitle((meta.info as Record<string, unknown> | undefined)?.Title) ?? title;
    } catch { /* keep the file name */ }
    const [own, thumb, firstText] = await Promise.all([
      outlineOf(doc),
      renderThumb(doc).catch(() => null),
      linesOfPage(doc, 1).then(l => l.slice(0, 12).join('\n')).catch(() => ''),
    ]);
    // The book's own contents only: its bookmarks, else its printed Contents pages. Never every page.
    let chapters = pickChapterEntries(own, doc.numPages);
    if (chapters.length < 2 && doc.numPages >= 40) chapters = await findContents(doc, onProgress);
    return { pages: doc.numPages, title, chapters, firstText, thumb };
  } finally {
    void doc.destroy();
  }
};

/** A rectangle of a page (fractions) as an image, sharp enough to read a question: ~1600px across the page. */
export const renderSnip = async (
  doc: PDFDocumentProxy,
  pageNo: number,
  rect: [number, number, number, number],
  pageWidth = 1600,
): Promise<Blob | null> => {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: pageWidth / base.width });
  const full = document.createElement('canvas');
  full.width = Math.floor(viewport.width);
  full.height = Math.floor(viewport.height);
  const ctx = full.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, full.width, full.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const [x, y, w, h] = rect;
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w * full.width));
  out.height = Math.max(1, Math.round(h * full.height));
  out.getContext('2d')?.drawImage(full, x * full.width, y * full.height, out.width, out.height, 0, 0, out.width, out.height);
  const webp = await toBlob(out, 'image/webp', 0.9);
  return webp && webp.type === 'image/webp' ? webp : toBlob(out, 'image/jpeg', 0.9);
};
