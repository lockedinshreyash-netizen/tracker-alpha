import React, { memo, useMemo } from 'react';
import type { BookBlock, BookChapter } from '../content/book';
import { segments, type Mark, type HighlightColor, minutesFor } from './model';
import { IconCheck, IconNoteFill } from './icons';

const NO_MARKS: Mark[] = [];
export const SWATCH: Record<HighlightColor, string> = {
  yellow: 'var(--sw-yellow)', green: 'var(--sw-green)', blue: 'var(--sw-blue)', pink: 'var(--sw-pink)',
};

/* ─── One unit's text: inline marks, highlights, search hits, note pins ─── */

interface TextProps {
  raw: string;
  marks: Mark[];
  freshId: string | null;
  activeId: string | null;
}

const UnitText = memo<TextProps>(({ raw, marks, freshId, activeId }) => {
  const pieces = useMemo(() => segments(raw, marks), [raw, marks]);
  return (
    <>
      {pieces.map((p, i) => {
        let node: React.ReactNode = p.text;
        if (p.b) node = <strong>{node}</strong>;
        if (p.i) node = <em>{node}</em>;
        if (p.hl) {
          node = (
            <mark
              className={`rd-hl${p.hl.id === freshId ? ' rd-new' : ''}`}
              data-h={p.hl.id}
              data-c={p.hl.color}
              data-active={p.hl.id === activeId ? 'true' : undefined}
            >
              {node}
            </mark>
          );
        } else if (p.search) {
          node = <mark className="rd-search">{node}</mark>;
        }
        return (
          <React.Fragment key={i}>
            {node}
            {p.noteAfter && (
              <button
                type="button"
                className="rd-pin"
                data-pin={p.noteAfter}
                aria-label="Open note"
                style={{ ['--pin' as string]: SWATCH[p.hl?.color ?? 'yellow'] }}
              >
                <IconNoteFill />
              </button>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}, (a, b) => a.raw === b.raw && a.marks === b.marks
  && (a.freshId === b.freshId || !a.marks.some(m => m.id === a.freshId || m.id === b.freshId))
  && (a.activeId === b.activeId || !a.marks.some(m => m.id === a.activeId || m.id === b.activeId)));

/* ─── The page ─── */

export interface PageProps {
  chapter: BookChapter;
  index: number;
  total: number;
  next: BookChapter | null;
  marks: Map<string, Mark[]>;
  bookmarked: Set<string>;
  doneActions: Set<string>;
  freshId: string | null;
  activeId: string | null;
  serif: boolean;
  justify: boolean;
  entering: boolean;
  chapterHighlights: number;
  finish: { highlights: number; notes: number; actionsDone: number; actionsTotal: number };
  onToggleAction: (id: string) => void;
  onNext: () => void;
  onOpenNotebook: () => void;
  onRestart: () => void;
}

const Page = ({
  chapter, index, total, next, marks, bookmarked, doneActions, freshId, activeId, serif, justify, entering,
  chapterHighlights, finish, onToggleAction, onNext, onOpenNotebook, onRestart,
}: PageProps) => {
  const text = (id: string, raw: string) => (
    <UnitText raw={raw} marks={marks.get(id) ?? NO_MARKS} freshId={freshId} activeId={activeId} />
  );
  const bm = (id: string) => (bookmarked.has(id) ? ' rd-bm' : '');
  const firstP = chapter.blocks.find(b => b.kind === 'p');
  const dropCap = firstP?.kind === 'p' && /^[\p{L}]/u.test(firstP.text) ? firstP.id : null;

  /* Consecutive set-off lines (the chat messages, the breathing loop) sit
     together inside one rule. */
  const groups: Array<BookBlock | BookBlock[]> = [];
  chapter.blocks.forEach(b => {
    const last = groups[groups.length - 1];
    if (b.kind === 'line' && Array.isArray(last)) last.push(b);
    else groups.push(b.kind === 'line' ? [b] : b);
  });

  const block = (b: BookBlock): React.ReactNode => {
    switch (b.kind) {
      case 'p':
        return <p key={b.id} data-u={b.id} className={`rd-p${b.id === dropCap ? ' rd-first' : ''}${bm(b.id)}`}>{text(b.id, b.text)}</p>;
      case 'h':
        return <h2 key={b.id} data-u={b.id} className={`rd-h${bm(b.id)}`}>{text(b.id, b.text)}</h2>;
      case 'h3':
        return <h3 key={b.id} data-u={b.id} className={`rd-h3${bm(b.id)}`}>{text(b.id, b.text)}</h3>;
      case 'quote':
        return <blockquote key={b.id} className="rd-quote"><p data-u={b.id} className={bm(b.id).trim()}>{text(b.id, b.text)}</p></blockquote>;
      case 'line':
        return <p key={b.id} data-u={b.id} className={`rd-line${bm(b.id)}`}>{text(b.id, b.text)}</p>;
      case 'action': {
        const done = doneActions.has(b.id);
        return (
          <aside key={b.id} className="rd-action" data-done={done}>
            <div className="rd-action-head">
              <span className="rd-action-label">{b.label}</span>
              <button type="button" className="rd-tick" aria-pressed={done} onClick={() => onToggleAction(b.id)}>
                <i>{done && <IconCheck />}</i>
                {done ? 'Done' : 'Mark done'}
              </button>
            </div>
            <p data-u={b.id} className={`rd-action-text${bm(b.id)}`}>{text(b.id, b.text)}</p>
          </aside>
        );
      }
      case 'list': {
        const Tag = b.ordered ? 'ol' : 'ul';
        return (
          <Tag key={b.id} className={`rd-list${b.ordered ? ' rd-ol' : ''}`}>
            {b.items.map(it => (
              <li key={it.id}>
                <span data-u={it.id} className={bm(it.id).trim() || undefined}>{text(it.id, it.text)}</span>
                {it.sub && (
                  <ul className="rd-sub">
                    {it.sub.map(s => <li key={s.id}><span data-u={s.id} className={bm(s.id).trim() || undefined}>{text(s.id, s.text)}</span></li>)}
                  </ul>
                )}
              </li>
            ))}
          </Tag>
        );
      }
      case 'fragment':
        return (
          <div key={b.id} className="rd-fragment">
            <p className="rd-kicker">{b.label}</p>
            <h2>{b.title}</h2>
          </div>
        );
    }
  };

  return (
    <article
      className={`rd-page${serif ? '' : ' rd-sans'}${justify ? ' rd-justify' : ''}`}
      data-entering={entering}
      lang="en-IN"
    >
      {chapter.part && (
        <section className="rd-part" aria-label={chapter.part.title}>
          <h2 className="rd-part-title">{chapter.part.title}</h2>
          {chapter.part.intro.map((t, i) => {
            const id = `${chapter.id}.part${i}`;
            return <p key={id} data-u={id} className={bm(id).trim() || undefined}>{text(id, t)}</p>;
          })}
        </section>
      )}

      <header className="rd-opener">
        <p className="rd-kicker">{chapter.number}</p>
        <h1 className="rd-title">{chapter.title}</h1>
        <div className="rd-meta">
          <span>{minutesFor(chapter)} min read</span>
          <span aria-hidden>·</span>
          <span>{index + 1} of {total}</span>
        </div>
      </header>

      {groups.map((g, i) => (Array.isArray(g)
        ? <div key={`lines-${i}`} className="rd-lines">{g.map(block)}</div>
        : block(g)))}

      <footer className="rd-end">
        {next ? (
          <>
            <p className="rd-end-eyebrow">End of {chapter.number.toLowerCase().startsWith('chapter') ? chapter.number : chapter.title.replace(/\.$/, '')}</p>
            <button type="button" className="rd-next" onClick={onNext}>
              <small>Up next · {next.number}</small>
              <strong>{next.title}</strong>
              <span>{minutesFor(next)} min read<em>Keep reading</em></span>
            </button>
            {chapterHighlights > 0 && (
              <p className="rd-end-note">
                You marked {chapterHighlights} passage{chapterHighlights === 1 ? '' : 's'} in this chapter.{' '}
                <button type="button" onClick={onOpenNotebook} className="rd-link" style={{ border: 0, background: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}>
                  Open your notebook
                </button>
              </p>
            )}
          </>
        ) : (
          <div className="rd-finish">
            <p className="rd-end-eyebrow">The end</p>
            <h2>You finished LOCK IN.</h2>
            <p>Most people never get to this page. Now do the part no book can do for you.</p>
            <div className="rd-stats">
              <div><b>{finish.highlights}</b><span>Highlights</span></div>
              <div><b>{finish.notes}</b><span>Notes</span></div>
              <div><b>{finish.actionsDone}/{finish.actionsTotal}</b><span>Action steps</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="rd-btn rd-primary" onClick={onOpenNotebook}>Open your notebook</button>
              <button type="button" className="rd-btn" onClick={onRestart}>Back to the start</button>
            </div>
          </div>
        )}
      </footer>
    </article>
  );
};

export default memo(Page);
