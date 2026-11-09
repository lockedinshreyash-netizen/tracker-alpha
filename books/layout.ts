/* ── How pages are laid out in the reading room ──
   Pure and tested. Three ways to read, chosen per device (`bk_layout_v1`):

   scroll   one long column, the way the room first shipped;
   flip     one page at a time, turned sideways like a book's leaf;
   spread   two pages side by side, as a printed book lies open. The first
            page stands alone (a cover, or a chapter's opener on its right-
            hand page), then 2–3, 4–5…, so left and right pages land where
            the printer put them.

   A "view" is the pages on screen at once: [3] when flipping, [2, 3] in a
   spread. Paged layouts are sized to fit the stage whole (height and width),
   then multiplied by the zoom; past 100% the stage scrolls inside. */

export type PageLayout = 'scroll' | 'flip' | 'spread';
export const LAYOUTS: PageLayout[] = ['scroll', 'flip', 'spread'];

export const viewsOf = (total: number, layout: PageLayout): number[][] => {
  const n = Math.max(1, Math.floor(total));
  if (layout !== 'spread') return Array.from({ length: n }, (_, i) => [i + 1]);
  const out: number[][] = [[1]];
  for (let p = 2; p <= n; p += 2) out.push(p + 1 <= n ? [p, p + 1] : [p]);
  return out;
};

/** Which view holds a page. */
export const viewIndexOf = (views: number[][], page: number): number => {
  const i = views.findIndex(v => v.includes(page));
  if (i >= 0) return i;
  return page < 1 ? 0 : views.length - 1;
};

export interface Fit {
  /** Each page's drawn width, in order. */
  widths: number[];
  height: number;
  /** All pages and the gutters between them. */
  total: number;
}

/* The pages of one view, at one height, fitted inside the stage (less a
   margin), then zoomed. Pages of different shapes share a height, as an open
   book's leaves do. */
export const fitView = (
  aspects: number[],
  stageW: number,
  stageH: number,
  zoom: number,
  gap = 16,
  margin = 24,
): Fit => {
  const ratios = aspects.map(a => (a > 0 && Number.isFinite(a) ? a : 1.414));
  const widthPerHeight = ratios.reduce((s, r) => s + 1 / r, 0);
  const gaps = gap * (ratios.length - 1);
  const byH = Math.max(80, stageH - margin * 2);
  const byW = Math.max(80, stageW - margin * 2 - gaps) / widthPerHeight;
  const height = Math.round(Math.min(byH, byW) * zoom);
  const widths = ratios.map(r => Math.round(height / r));
  return { widths, height, total: widths.reduce((s, w) => s + w, 0) + gaps };
};

/* A swipe turns the page when it travels a fifth of the stage, or is quick
   and travels a little. Anything else springs back. */
export const swipeTurns = (dx: number, stageW: number, msTaken: number): -1 | 0 | 1 => {
  const far = Math.abs(dx) > stageW * 0.2;
  const quick = Math.abs(dx) > 40 && msTaken < 260;
  if (!far && !quick) return 0;
  return dx < 0 ? 1 : -1;
};
