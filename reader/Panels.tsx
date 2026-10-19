import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HIGHLIGHT_COLORS, MAX_NOTE, type Highlight, type HighlightColor } from './model';
import {
  LEADING_NAMES, MEASURE_NAMES, PAGE_THEMES, SIZES, type ReaderSettings,
} from './settings';
import { SWATCH } from './Page';
import { IconCheck, IconClose, IconCopy, IconNote, IconSearch, IconShare, IconTrash } from './icons';

const COLOR_NAME: Record<HighlightColor, string> = { yellow: 'Yellow', green: 'Green', blue: 'Blue', pink: 'Pink' };

/* ─── Placement ───
   Above the anchor unless there is no room (or this is a touch screen,
   where the OS puts its own copy/paste callout above a selection — ours
   goes below so the two never stack). Clamped inside the window and clear
   of the top bar. */
export const place = (rect: DOMRect, w: number, h: number, below: boolean, topClear = 64) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 12;
  let top = below ? rect.bottom + gap : rect.top - h - gap;
  if (!below && top < topClear) top = rect.bottom + gap;
  if (below && top + h > vh - 12) top = Math.max(topClear, rect.top - h - gap);
  const left = Math.min(vw - w - 10, Math.max(10, rect.left + rect.width / 2 - w / 2));
  return { left, top: Math.min(vh - h - 10, Math.max(10, top)) };
};

const useMeasured = <T extends HTMLElement>(deps: unknown[]) => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (ref.current) setSize({ w: ref.current.offsetWidth, h: ref.current.offsetHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return [ref, size] as const;
};

export const coarse = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/* ─── The selection toolbar ─── */

export const SelectionTools = ({ rect, lastColor, short, canShare, onColor, onNote, onCopy, onShare, onSearch }: {
  rect: DOMRect;
  lastColor: HighlightColor;
  short: boolean;
  canShare: boolean;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onCopy: () => void;
  onShare: () => void;
  onSearch: () => void;
}) => {
  const [ref, size] = useMeasured<HTMLDivElement>([rect.top, rect.left, short, canShare]);
  const pos = size ? place(rect, size.w, size.h, coarse()) : { left: -9999, top: -9999 };
  return (
    <div
      ref={ref}
      className="rd-tools"
      role="toolbar"
      aria-label="Highlight"
      style={pos}
      // Keep the selection alive: a pointerdown here must not clear it.
      onPointerDown={e => e.preventDefault()}
      onMouseDown={e => e.preventDefault()}
    >
      {HIGHLIGHT_COLORS.map(c => (
        <button
          key={c}
          type="button"
          className="rd-swatch"
          aria-label={`Highlight ${COLOR_NAME[c].toLowerCase()}`}
          aria-pressed={c === lastColor}
          style={{ ['--sw' as string]: SWATCH[c] }}
          onClick={() => onColor(c)}
        >
          <i />
        </button>
      ))}
      <span className="rd-tools-sep" />
      <button type="button" className="rd-tool" onClick={onNote}><IconNote />Note</button>
      <button type="button" className="rd-tool" onClick={onCopy} aria-label="Copy"><IconCopy /></button>
      {canShare && <button type="button" className="rd-tool" onClick={onShare} aria-label="Share"><IconShare /></button>}
      {short && <button type="button" className="rd-tool" onClick={onSearch} aria-label="Search the book for this"><IconSearch /></button>}
    </div>
  );
};

/* ─── Tapping a highlight ─── */

export const HighlightMenu = ({ rect, highlight, onColor, onNote, onCopy, onDelete }: {
  rect: DOMRect;
  highlight: Highlight;
  onColor: (c: HighlightColor) => void;
  onNote: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) => {
  const [ref, size] = useMeasured<HTMLDivElement>([rect.top, rect.left, highlight.note]);
  const pos = size ? place(rect, size.w, size.h, coarse()) : { left: -9999, top: -9999 };
  return (
    <div ref={ref} className="rd-pop rd-hlmenu" style={pos} role="menu" aria-label="Highlight">
      <div className="rd-hlmenu-row">
        {HIGHLIGHT_COLORS.map(c => (
          <button
            key={c}
            type="button"
            className="rd-swatch"
            aria-label={COLOR_NAME[c]}
            aria-pressed={c === highlight.color}
            style={{ ['--sw' as string]: SWATCH[c] }}
            onClick={() => onColor(c)}
          >
            <i />
          </button>
        ))}
      </div>
      {highlight.note && <div className="rd-hlmenu-note">{highlight.note}</div>}
      <button type="button" className="rd-menu-item" onClick={onNote}><IconNote />{highlight.note ? 'Edit note' : 'Add a note'}</button>
      <button type="button" className="rd-menu-item" onClick={onCopy}><IconCopy />Copy</button>
      <button type="button" className="rd-menu-item rd-danger" onClick={onDelete}><IconTrash />Remove highlight</button>
    </div>
  );
};

/* ─── The note editor ───
   Closing it in any way keeps what was typed: the scrim, Escape and Done all
   save. A note is the student's own writing, and writing lost to a stray tap
   is the one thing a notebook must never do. Nothing reaches AppState until
   the editor closes, so typing is not a sync per keystroke. */

export const NoteSheet = ({ highlight, onSave }: {
  highlight: Highlight;
  onSave: (note: string) => void;
}) => {
  const [draft, setDraft] = useState(highlight.note ?? '');
  const ref = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onSave(draftRef.current); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSave(draftRef.current);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey, true); };
  }, [onSave]);

  const left = MAX_NOTE - draft.length;
  return (
    <>
      <div className="rd-scrim" onClick={() => onSave(draftRef.current)} />
      <div className="rd-sheet rd-note" role="dialog" aria-label="Note">
        <div className="rd-sheet-head">
          <h3>{highlight.note ? 'Your note' : 'Add a note'}</h3>
          <button type="button" className="rd-btn rd-primary" onClick={() => onSave(draft)}><IconCheck />Done</button>
        </div>
        <div className="rd-quote-card" style={{ ['--sw' as string]: SWATCH[highlight.color] }}>
          <i />
          <p>{highlight.quote}</p>
        </div>
        <textarea
          ref={ref}
          value={draft}
          maxLength={MAX_NOTE}
          placeholder="What does this mean for you? What will you do about it?"
          onChange={e => setDraft(e.target.value)}
        />
        <div className="rd-sheet-foot">
          <span>{left < 400 ? `${left} characters left` : 'Saved when you close it'}</span>
          {highlight.note && (
            <button type="button" className="rd-btn" onClick={() => onSave('')}><IconTrash />Delete note</button>
          )}
        </div>
      </div>
    </>
  );
};

/* ─── Reading settings ─── */

export const SettingsPanel = ({ settings, current, anchor, onChange, onClose }: {
  settings: ReaderSettings;
  current: string;
  anchor: DOMRect | null;
  onChange: (p: Partial<ReaderSettings>) => void;
  onClose: () => void;
}) => {
  const desktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const style = desktop && anchor
    ? { top: anchor.bottom + 10, left: Math.min(window.innerWidth - 354, Math.max(10, anchor.right - 344)) }
    : {};
  return (
    <>
      <div className="rd-scrim" style={{ background: desktop ? 'transparent' : undefined }} onClick={onClose} />
      <div className="rd-pop rd-settings" style={style} role="dialog" aria-label="Reading settings">
        <div className="rd-set-row">
          <p className="rd-set-label">Page</p>
          <div className="rd-themes">
            {PAGE_THEMES.map(t => (
              <button
                key={t.id}
                type="button"
                className="rd-theme"
                aria-pressed={current === t.id}
                style={{ ['--t-bg' as string]: t.bg, ['--t-ink' as string]: t.ink }}
                onClick={() => onChange({ theme: t.id })}
              >
                <b>Aa</b>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rd-set-row">
          <p className="rd-set-label">Typeface</p>
          <div className="rd-seg">
            <button type="button" className="rd-face-serif" aria-pressed={settings.font === 'serif'} onClick={() => onChange({ font: 'serif' })}>Literata</button>
            <button type="button" aria-pressed={settings.font === 'sans'} onClick={() => onChange({ font: 'sans' })}>Satoshi</button>
          </div>
        </div>

        <div className="rd-set-row">
          <p className="rd-set-label">Text size <span>{SIZES[settings.size]}px</span></p>
          <div className="rd-size">
            <button type="button" aria-label="Smaller text" disabled={settings.size === 0} onClick={() => onChange({ size: settings.size - 1 })} style={{ fontSize: 14 }}>A</button>
            <div className="rd-dots" aria-hidden>
              {SIZES.map((_, i) => <i key={i} data-on={i <= settings.size} data-at={i === settings.size} />)}
            </div>
            <button type="button" aria-label="Larger text" disabled={settings.size === SIZES.length - 1} onClick={() => onChange({ size: settings.size + 1 })} style={{ fontSize: 21 }}>A</button>
          </div>
        </div>

        <div className="rd-set-row">
          <p className="rd-set-label">Line spacing</p>
          <div className="rd-seg">
            {LEADING_NAMES.map((n, i) => (
              <button key={n} type="button" aria-pressed={settings.leading === i} onClick={() => onChange({ leading: i })}>{n}</button>
            ))}
          </div>
        </div>

        {desktop && (
          <div className="rd-set-row">
            <p className="rd-set-label">Line length</p>
            <div className="rd-seg">
              {MEASURE_NAMES.map((n, i) => (
                <button key={n} type="button" aria-pressed={settings.width === i} onClick={() => onChange({ width: i })}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <div className="rd-set-row">
          <div className="rd-switch">
            <span>Justify text</span>
            <button type="button" aria-label="Justify text" aria-pressed={settings.justify} onClick={() => onChange({ justify: !settings.justify })} />
          </div>
        </div>

        {!desktop && (
          <button type="button" className="rd-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} onClick={onClose}>
            <IconClose />Close
          </button>
        )}
      </div>
    </>
  );
};

/* ─── Toast ─── */

export interface ToastState { text: string; undo?: () => void }

export const Toast = ({ toast, onDone }: { toast: ToastState; onDone: () => void }) => {
  useEffect(() => {
    const t = window.setTimeout(onDone, toast.undo ? 5000 : 2200);
    return () => window.clearTimeout(t);
  }, [toast, onDone]);
  return (
    <div className="rd-toast" role="status" style={toast.undo ? undefined : { paddingRight: 18 }}>
      {toast.text}
      {toast.undo && <button type="button" onClick={() => { toast.undo!(); onDone(); }}>Undo</button>}
    </div>
  );
};
