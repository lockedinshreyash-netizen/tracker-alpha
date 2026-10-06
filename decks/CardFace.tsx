/* ── One card, rendered ──
   The single place a card becomes pixels — review, editor preview, browser,
   the onboarding fan — so a preview is exactly what will be studied. Every
   path goes through the sanitiser (decks/html.ts) on every render; maths is
   rendered after, over text nodes only, and only when the card has some. */

import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { renderAllAnswers, renderCloze } from './cloze';
import { mediaNames, sanitize } from './html';
import { useMediaUrls } from './media';
import type { NoteKind } from './types';

const hasMath = (s: string) => /\\\(|\\\[/.test(s);

export const faceVars = (dark: boolean, accent?: string): React.CSSProperties => ({
  ['--dk-ink' as string]: dark ? '#FAFAFA' : '#09090B',
  ['--dk-blank-bg' as string]: dark ? 'rgba(255,255,255,0.055)' : 'rgba(24,24,27,0.045)',
  ['--dk-blank-line' as string]: dark ? 'rgba(255,255,255,0.3)' : 'rgba(24,24,27,0.3)',
  ['--dk-blank-ink' as string]: dark ? '#A1A1AA' : '#71717A',
  ['--dk-accent' as string]: accent ?? (dark ? '#FAFAFA' : '#09090B'),
  ['--dk-rule' as string]: dark ? 'rgba(255,255,255,0.12)' : 'rgba(24,24,27,0.12)',
  ['--dk-muted' as string]: dark ? '#71717A' : '#A1A1AA',
  ['--dk-shimmer' as string]: dark ? 'rgba(255,255,255,0.05)' : 'rgba(24,24,27,0.05)',
});

const Html: React.FC<{ html: string; className?: string }> = ({ html, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = html;
    if (!hasMath(html)) return;
    let live = true;
    import('./math').then(m => { if (live && ref.current === el) m.renderMath(el); }).catch(() => { /* raw TeX stays readable */ });
    return () => { live = false; };
  }, [html]);
  return <div ref={ref} className={className} />;
};

export const CardFace: React.FC<{
  kind: NoteKind;
  front: string;
  back: string;
  /** The cloze number this card asks about; 0 for a basic card. */
  ord: number;
  revealed: boolean;
  deckId: string | null;
  dark: boolean;
  /** The deck's colour, for the line drawn under a revealed answer. */
  accent?: string;
  size?: 'large' | 'medium' | 'small';
  /** Every answer shown and marked: the browser's view of a whole note. */
  browse?: boolean;
  className?: string;
}> = ({ kind, front, back, ord, revealed, deckId, dark, accent, size = 'large', browse = false, className = '' }) => {
  const names = useMemo(() => Array.from(new Set(mediaNames(`${front}${back}`))), [front, back]);
  const urls = useMediaUrls(deckId, names);
  const resolve = (n: string) => urls[n] ?? null;
  const key = Object.keys(urls).sort().join('|');

  const main = useMemo(
    () => sanitize(kind === 'cloze' ? (browse ? renderAllAnswers(front) : renderCloze(front, ord, revealed)) : front, resolve),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, front, ord, revealed, browse, key],
  );
  const extra = useMemo(
    () => (revealed && back.trim() ? sanitize(back, resolve) : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [revealed, back, key],
  );

  const sizeClass = size === 'small' ? 'dk-small' : size === 'medium' ? 'dk-medium' : '';

  return (
    <div className={`dk-face font-ui ${sizeClass} ${className}`} style={faceVars(dark, accent)}>
      <Html html={main} />
      {extra && (
        kind === 'basic' ? (
          /* A basic card's back IS the answer: it gets the weight and the ink line. */
          <div className="dk-in mt-[0.9em]">
            <div className="mx-auto mb-[0.9em] h-px w-12" style={{ background: 'var(--dk-rule)' }} />
            <Html html={extra} className="font-bold" />
          </div>
        ) : (
          /* A cloze card's back is Anki's "Back Extra": a footnote to the answer. */
          <div className="dk-in mt-[1.1em] pt-[0.9em] border-t text-[0.62em] leading-relaxed font-normal" style={{ borderColor: 'var(--dk-rule)', color: 'var(--dk-muted)' }}>
            <Html html={extra} />
          </div>
        )
      )}
    </div>
  );
};
