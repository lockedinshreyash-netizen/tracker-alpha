/* ── The workspace pill ──
   Notes' own navigation, apart from Alpha's: a liquid glass capsule floating
   at the bottom centre of the page column, the way a dock sits under the
   work. Pages · Search · Home · New. Pages raises a glass panel with the page
   tree just above the pill.

   Bottom centre because every other edge is taken: the phone's capsule is on
   top, the class switch and the settings gear are on the right, the rail is
   on the left. Between the feedback launcher (bottom-left) and the gear
   (bottom-right) there is a dock-shaped gap, and on a phone four icons fit it.

   It gets out of the way while you write: on a phone the editor's own bar
   takes the bottom edge while the keyboard is up, and on a laptop the pill
   slides down until the mouse moves. Moved by transform, never faded: opacity
   on an ancestor of the glass would leave it nothing to refract. */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import LiquidGlass from '../ui/LiquidGlass';
import NotesNav from './NotesNav';
import type { Tree } from './workspace';

interface Props {
  dark: boolean;
  railPx: number;
  tree: Tree;
  openId: string | null;
  isHome: boolean;
  /** Writing: the pill steps aside. */
  away: boolean;
  panelOpen: boolean;
  onPanel: (open: boolean) => void;
  onSearch: () => void;
  onHome: () => void;
  onNew: (parent: string | null) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onMove: (id: string, parent: string | null, index: number) => void;
  onRestore: (id: string) => void;
  onPurge: (id: string) => void;
  onImport: (files: File[]) => void;
  sync: { state: string; label: string };
  onDisable: () => void;
}

const icon = {
  pages: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h5" /></svg>,
  search: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></svg>,
  home: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>,
};

export default function WorkspaceBar(props: Props) {
  const { dark, railPx, isHome, away, panelOpen, onPanel, onSearch, onHome, onNew, sync } = props;

  useEffect(() => {
    if (!panelOpen) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onPanel(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [panelOpen, onPanel]);

  const item = (label: string, glyph: React.ReactNode, run: () => void, opts: { on?: boolean; primary?: boolean } = {}) => (
    <button
      type="button"
      className={`nt-pill-btn${opts.primary ? ' is-primary' : ''}`}
      data-on={opts.on ?? false}
      aria-label={label}
      title={label === 'Search' ? `Search  ${typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}` : undefined}
      aria-pressed={opts.on}
      onClick={run}
    >
      {glyph}
      <span className="nt-pill-label">{label}</span>
    </button>
  );

  /* Siblings, not nested: a transform on the dock (sliding away) would become
     the containing block of a fixed panel inside it. `display: contents`
     carries --rail to all three without laying anything out. */
  return createPortal(
    <div style={{ display: 'contents', ['--rail' as string]: `${railPx}px` }}>
      {panelOpen && (
        <>
          <div className="nt-panel-scrim" onMouseDown={() => onPanel(false)} />
          <LiquidGlass dark={dark} radius={22} variant="panel" className="nt-panel lg-pop">
            <div className="nt-panel-scroll">
              <NotesNav
                tree={props.tree}
                openId={props.openId}
                expanded={props.expanded}
                onToggle={props.onToggle}
                onOpen={id => { props.onOpen(id); onPanel(false); }}
                onNew={parent => { onNew(parent); onPanel(false); }}
                onMove={props.onMove}
                onRestore={props.onRestore}
                onPurge={props.onPurge}
                onImport={files => { props.onImport(files); onPanel(false); }}
                sync={sync}
                onDisable={() => { onPanel(false); props.onDisable(); }}
              />
            </div>
          </LiquidGlass>
        </>
      )}

      <div className={`nt-dock${away && !panelOpen ? ' is-away' : ''}`}>
        <LiquidGlass as="nav" dark={dark} radius={27} variant="panel" chroma={1} bezel={18} className="nt-pill" aria-label="Notes workspace">
          {item('Pages', icon.pages, () => onPanel(!panelOpen), { on: panelOpen })}
          {item('Search', icon.search, onSearch)}
          {item('Home', icon.home, onHome, { on: isHome && !panelOpen })}
          <span className="nt-pill-rule" aria-hidden="true" />
          {item('New page', icon.plus, () => onNew(null), { primary: true })}
          <span className="nt-pill-sync" data-state={sync.state} title={sync.label} aria-label={sync.label} />
        </LiquidGlass>
      </div>
    </div>,
    document.body,
  );
}
