/* ── One formula, as a sheet prints it ──
   The one place a sheet entry becomes pixels: the store's paper preview, the
   detail teaser and the reader in Decks all draw entries through here.

   A basic note reads like a label and its formula on one line ("Kinetic
   energy … K = ½mv²"), wrapping the formula under the label when it is long.
   A fill-the-blank note is the whole sentence with every answer marked
   (`renderAllAnswers`, the deck browser's `data-cloze="mark"`), its back a
   footnote under it.

   Every path goes through the deck sanitiser (decks/html.ts) on every render,
   and maths is rendered after, over text nodes, by the same lazy KaTeX the
   cards use (decks/math.ts). Colours arrive as custom properties from the
   surface it sits on (--sh-ink, --sh-muted, --sh-rule, --sh-accent), so the
   same entry reads on paper in the store and on the app's own card in Decks. */

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { renderAllAnswers } from '../../decks/cloze';
import { mediaNames, sanitize } from '../../decks/html';
import { useMediaUrls } from '../../decks/media';
import type { NoteKind } from '../../decks/types';

// Spelled out here, not imported from decks/math.ts, which would pull KaTeX into this chunk.
const hasMath = (s: string) => /\\\(|\\\[/.test(s);

const MathHtml = ({ html, className }: { html: string; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    if (!hasMath(html)) return;
    let live = true;
    import('../../decks/math').then(m => { if (live && ref.current === el) m.renderMath(el); }).catch(() => { /* raw TeX stays readable */ });
    return () => { live = false; };
  }, [html]);
  return <div ref={ref} className={className} />;
};

export interface FormulaEntry {
  deckId: string;
  kind: NoteKind;
  front: string;
  back: string;
}

interface Props {
  entry: FormulaEntry;
  /** Show images. Off for the store's tiny paper preview, where they would only be noise. */
  images?: boolean;
  className?: string;
}

export const Formula = ({ entry, images = true, className = '' }: Props) => {
  const names = useMemo(
    () => (images ? Array.from(new Set(mediaNames(`${entry.front}${entry.back}`))) : []),
    [entry.front, entry.back, images],
  );
  const urls = useMediaUrls(images ? entry.deckId : null, names);
  const key = Object.keys(urls).sort().join('|');
  const resolve = (n: string) => urls[n] ?? null;

  const front = useMemo(
    () => sanitize(entry.kind === 'cloze' ? renderAllAnswers(entry.front) : entry.front, resolve),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.kind, entry.front, key],
  );
  const back = useMemo(
    () => (entry.back.trim() ? sanitize(entry.back, resolve) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entry.back, key],
  );

  if (entry.kind === 'cloze') {
    return (
      <div className={`sh-f sh-cloze ${className}`}>
        <MathHtml html={front} className="sh-sentence" />
        {back && <MathHtml html={back} className="sh-note" />}
      </div>
    );
  }
  return (
    <div className={`sh-f sh-basic ${className}`}>
      <MathHtml html={front} className="sh-label" />
      {back ? <MathHtml html={back} className="sh-back" /> : null}
    </div>
  );
};
