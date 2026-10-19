/* ── Between the DOM and the book's anchors ──

   Every highlightable unit is rendered as one element carrying `data-u` (its
   permanent id) whose text nodes are exactly the unit's plain text, in order.
   Nothing that is not the text may put a text node inside it: the note pin is
   an SVG button with an aria-label and no text, the drop cap is CSS. That is
   what makes this file small: the offset of a DOM point is the length of
   `Range(unit start → point).toString()`. */

import type { Anchor } from './model';

const unitOf = (node: Node, root: HTMLElement): HTMLElement | null => {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  const u = el?.closest<HTMLElement>('[data-u]') ?? null;
  return u && root.contains(u) ? u : null;
};

const offsetIn = (unitEl: HTMLElement, node: Node, offset: number): number => {
  const r = document.createRange();
  r.setStart(unitEl, 0);
  try {
    r.setEnd(node, offset);
  } catch {
    return 0;
  }
  return r.toString().length;
};

/**
 * A DOM point as an anchor. A point outside every unit (the chapter title,
 * the gap between paragraphs) snaps forward for a selection's start and
 * backward for its end, so dragging from a heading into a paragraph still
 * highlights the paragraph.
 */
export const pointToAnchor = (root: HTMLElement, node: Node, offset: number, dir: 'start' | 'end'): Anchor | null => {
  const inside = unitOf(node, root);
  if (inside) {
    const len = inside.textContent?.length ?? 0;
    return { u: inside.dataset.u!, o: Math.min(len, offsetIn(inside, node, offset)) };
  }
  const point = document.createRange();
  try { point.setStart(node, offset); } catch { return null; }
  const units = Array.from(root.querySelectorAll<HTMLElement>('[data-u]'));
  if (dir === 'start') {
    for (const el of units) {
      const r = document.createRange();
      r.selectNodeContents(el);
      if (r.compareBoundaryPoints(Range.START_TO_START, point) >= 0) return { u: el.dataset.u!, o: 0 };
    }
  } else {
    for (let i = units.length - 1; i >= 0; i--) {
      const r = document.createRange();
      r.selectNodeContents(units[i]);
      if (r.compareBoundaryPoints(Range.END_TO_START, point) <= 0) return { u: units[i].dataset.u!, o: units[i].textContent?.length ?? 0 };
    }
  }
  return null;
};

/** The current selection, if it lies (at least partly) in the page. */
export const selectionAnchors = (root: HTMLElement): { start: Anchor; end: Anchor; range: Range } | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer) && !range.intersectsNode(root)) return null;
  const start = pointToAnchor(root, range.startContainer, range.startOffset, 'start');
  const end = pointToAnchor(root, range.endContainer, range.endOffset, 'end');
  if (!start || !end) return null;
  return { start, end, range };
};

export const unitElement = (root: HTMLElement | null, id: string): HTMLElement | null =>
  root?.querySelector<HTMLElement>(`[data-u="${CSS.escape(id)}"]`) ?? null;

/** A DOM range for an anchor pair, for placing a popover over it. */
export const rangeFor = (root: HTMLElement, start: Anchor, end: Anchor): Range | null => {
  const a = unitElement(root, start.u);
  const b = unitElement(root, end.u);
  if (!a || !b) return null;
  const locate = (el: HTMLElement, o: number): [Node, number] => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let left = o;
    let last: Node = el;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const len = n.textContent?.length ?? 0;
      if (left <= len) return [n, left];
      left -= len;
      last = n;
    }
    return [last, last.nodeType === Node.TEXT_NODE ? last.textContent?.length ?? 0 : 0];
  };
  const r = document.createRange();
  r.setStart(...locate(a, start.o));
  r.setEnd(...locate(b, end.o));
  return r;
};
