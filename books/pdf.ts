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
import { headingIn } from './mapping';

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

/** A PDF's outline, flattened to the first two levels, each entry resolved to a 1-based page. */
export const outlineOf = async (doc: PDFDocumentProxy): Promise<OutlineEntry[]> => {
  let outline: Awaited<ReturnType<PDFDocumentProxy['getOutline']>> = null;
  try { outline = await doc.getOutline(); } catch { return []; }
  if (!outline) return [];
  const out: OutlineEntry[] = [];
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
      if (out.length >= 300) return;
      const page = await pageOf(item.dest);
      const title = (item.title ?? '').replace(/\s+/g, ' ').trim();
      if (page && title) out.push({ title, page });
      if (depth < 1 && item.items?.length) await walk(item.items, depth + 1);
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

/* NCERT's own PDFs carry no outline, but every chapter opens with a heading
   like "CHAPTER TWO / MOTION IN A STRAIGHT LINE" (or "Chapter 2" and the
   title) in the first lines of its page. Reading the top of every page finds
   them, so a whole book can still be mapped to the syllabus in one pass. */

export const headingsOf = async (doc: PDFDocumentProxy, onProgress?: (done: number) => void, limit = 800): Promise<OutlineEntry[]> => {
  const out: OutlineEntry[] = [];
  const n = Math.min(doc.numPages, limit);
  for (let p = 1; p <= n; p++) {
    try {
      const top = (await textOfPage(doc, p)).slice(0, 220);
      const title = headingIn(top);
      if (title && !out.some(e => e.page === p)) out.push({ title, page: p });
    } catch { /* an unreadable page names nothing */ }
    if (p % 10 === 0) onProgress?.(p / n);
  }
  return out;
};

export interface PdfFacts {
  pages: number;
  title: string;
  outline: OutlineEntry[];
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
      textOfPage(doc, 1).then(t => t.slice(0, 400)).catch(() => ''),
    ]);
    // No outline in the file: look for chapter headings instead (only worth it past a chapter's length).
    const outline = own.length || doc.numPages < 40 ? own : await headingsOf(doc, onProgress);
    return { pages: doc.numPages, title, outline, firstText, thumb };
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
