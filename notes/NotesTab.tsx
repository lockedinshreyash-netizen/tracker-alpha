/* ── The Notes tab ──
   Notes is opt-in (notes/pref.ts). Until the student turns it on, the tab is
   its cover page (Cover.tsx) and nothing else: no database is opened, no
   editor or Yjs is downloaded, nothing syncs. The workspace arrives in its
   own lazy chunk the moment it is switched on.

   Hooks stay above the branch: a hook below an early return is how this app
   once rendered a blank page. */

import React, { lazy, Suspense, useEffect } from 'react';
import './notes.css';
import Cover from './Cover';
import type { ChapterProgress, ExamPreference, Subject } from '../types';
import type { NotesRequest } from './NotesWorkspace';

export type { NotesRequest } from './NotesWorkspace';

/* Not `./Workspace`: macOS resolves that to workspace.ts, the page tree. */
const Workspace = lazy(() => import('./NotesWorkspace'));

interface Props {
  enabled: boolean;
  onEnable: () => void;
  onDisable: () => void;
  user: { id: string } | null;
  theme: 'dark' | 'light';
  examPreference: ExamPreference;
  progress: ChapterProgress[];
  activeSubjects: Subject[];
  railPx: number;
  onAddTask: (text: string, subject: Subject) => void;
  onOpenSyllabus: () => void;
  request: NotesRequest | null;
  onRequestHandled: () => void;
}

export default function NotesTab({ enabled, onEnable, ...rest }: Props) {
  const dark = rest.theme === 'dark';

  // The palette for this tab and its portalled menus (notes.css).
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.ntTheme = dark ? 'dark' : 'light';
    return () => { delete root.dataset.ntTheme; };
  }, [dark]);

  if (!enabled) return <Cover signedIn={!!rest.user} onEnable={onEnable} />;

  return (
    <Suspense fallback={<div className="nt-home" aria-busy="true" />}>
      <Workspace {...rest} />
    </Suspense>
  );
}
