/* ── Maths in anything pasted ──
   A paste from a web page, a PDF, a ChatGPT answer or another note arrives
   as text with the TeX still in it: "$v = u + at$", "\(F = ma\)". The input
   rules only fire on typing, so without this the equation stayed as dollar
   signs. Every pasted slice is walked once: each text run is split into
   text and inline equations (the scanner the flashcards use), and a
   paragraph that is nothing but $$…$$ or \[…\] becomes a display equation.
   Code (code blocks, inline code) is left exactly as pasted. */

import { Fragment, Slice, type Node as PMNode, type Schema } from '@tiptap/pm/model';
import { displayOnly, splitMath } from './markdown';

const isCode = (node: PMNode) => node.type.spec.code || node.marks.some(m => m.type.spec.code);

const mapText = (node: PMNode, schema: Schema): PMNode[] => {
  const runs = splitMath(node.text ?? '');
  if (runs.length === 1 && runs[0].t === 'text') return [node];
  return runs.map(r => (r.t === 'text'
    ? schema.text(r.v, node.marks)
    : schema.nodes.mathInline.create({ latex: r.latex })));
};

const mapFragment = (frag: Fragment, schema: Schema, openStart: number, openEnd: number): Fragment => {
  const out: PMNode[] = [];
  frag.forEach((node, _offset, index) => {
    if (isCode(node)) { out.push(node); return; }
    if (node.isText) { out.push(...mapText(node, schema)); return; }
    // A paragraph cut open at the slice's edge must stay a paragraph, or the paste would not fit.
    const open = (index === 0 && openStart > 0) || (index === frag.childCount - 1 && openEnd > 0);
    if (node.type.name === 'paragraph' && !open && node.childCount > 0 && Array.from({ length: node.childCount }, (_, i) => node.child(i)).every(c => c.isText && !isCode(c))) {
      const latex = displayOnly(node.textContent);
      if (latex !== null && schema.nodes.mathBlock) { out.push(schema.nodes.mathBlock.create({ latex })); return; }
    }
    out.push(node.copy(mapFragment(node.content, schema, index === 0 ? Math.max(0, openStart - 1) : 0, index === frag.childCount - 1 ? Math.max(0, openEnd - 1) : 0)));
  });
  return Fragment.from(out);
};

export const mathifySlice = (slice: Slice, schema: Schema): Slice => {
  if (!schema.nodes.mathInline || !/\$|\\\(|\\\[/.test(slice.content.textBetween(0, slice.content.size, '\n', ' '))) return slice;
  try {
    return new Slice(mapFragment(slice.content, schema, slice.openStart, slice.openEnd), slice.openStart, slice.openEnd);
  } catch {
    return slice;
  }
};
