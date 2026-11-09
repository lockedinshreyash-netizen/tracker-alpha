/* ── A text layer's DOM, as the offsets books/anchors.ts speaks ──
   pdf.js's TextLayer writes one span per text item, in order, with a <br>
   after every item that ends a line (and nests marked content in spans of
   their own). So walking a layer's text nodes and <br>s in document order,
   counting a <br> as "\n", gives exactly `pageText(items).text`: the same
   string search and heading-detection read. That is the whole contract. */

const isBr = (n: Node): boolean => n.nodeType === 1 && (n as Element).tagName === 'BR';

const walker = (layer: Element) =>
  document.createTreeWalker(layer, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === 3 || isBr(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  });

const lengthOf = (n: Node): number => (isBr(n) ? 1 : (n.nodeValue ?? '').length);

/** The layer's text, the anchors' string. */
export const layerText = (layer: Element): string => {
  const w = walker(layer);
  let s = '';
  for (let n = w.nextNode(); n; n = w.nextNode()) s += isBr(n) ? '\n' : n.nodeValue ?? '';
  return s;
};

/** A DOM point (as a Selection reports it) as an offset into the layer's text. */
export const offsetAt = (layer: Element, node: Node, offset: number): number => {
  if (node.nodeType !== 3) {
    // An element boundary: the point sits before its child at `offset`, or after its last child.
    const child = node.childNodes[offset];
    if (child) {
      const w = walker(layer);
      let acc = 0;
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n === child || child.contains(n)) return acc;
        if (child.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) return acc;
        acc += lengthOf(n);
      }
      return acc;
    }
    if (node === layer || !node.parentNode) return layerText(layer).length;
    const index = Array.prototype.indexOf.call(node.parentNode.childNodes, node) as number;
    return offsetAt(layer, node.parentNode, index + 1);
  }
  const w = walker(layer);
  let acc = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n === node) return acc + offset;
    acc += lengthOf(n);
  }
  return acc;
};

/** A DOM Range over [start, end) of the layer's text, or null when it holds no text. */
export const rangeAt = (layer: Element, start: number, end: number): Range | null => {
  const w = walker(layer);
  let acc = 0;
  let sNode: Node | null = null;
  let sOff = 0;
  let eNode: Node | null = null;
  let eOff = 0;
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const len = lengthOf(n);
    if (!isBr(n)) {
      if (!sNode && start < acc + len) { sNode = n; sOff = Math.max(0, start - acc); }
      if (end <= acc + len && end > acc) { eNode = n; eOff = end - acc; }
    }
    acc += len;
    if (eNode) break;
  }
  if (!sNode || !eNode) return null;
  const r = document.createRange();
  r.setStart(sNode, sOff);
  r.setEnd(eNode, eOff);
  return r;
};

/* A range's boxes as fractions of the page, one per line: the boxes of
   neighbouring spans on one line are joined, so a highlight paints as a
   strip rather than a row of tiles. */
export const rectsOf = (range: Range, page: Element): [number, number, number, number][] => {
  const box = page.getBoundingClientRect();
  if (!box.width || !box.height) return [];
  const raw = Array.from(range.getClientRects())
    .filter(r => r.width > 0.5 && r.height > 0.5)
    .map(r => ({ l: r.left - box.left, t: r.top - box.top, r: r.right - box.left, b: r.bottom - box.top }))
    .sort((a, b) => a.t - b.t || a.l - b.l);
  const lines: { l: number; t: number; r: number; b: number }[] = [];
  for (const x of raw) {
    const line = lines.find(y => Math.min(y.b, x.b) - Math.max(y.t, x.t) > Math.min(y.b - y.t, x.b - x.t) * 0.5);
    if (line) {
      line.l = Math.min(line.l, x.l); line.r = Math.max(line.r, x.r);
      line.t = Math.min(line.t, x.t); line.b = Math.max(line.b, x.b);
    } else lines.push({ ...x });
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return lines.slice(0, 60).map(x => {
    const l = clamp(x.l / box.width);
    const t = clamp(x.t / box.height);
    return [l, t, clamp(x.r / box.width) - l, clamp(x.b / box.height) - t] as [number, number, number, number];
  }).filter(([, , w, h]) => w > 0 && h > 0);
};
