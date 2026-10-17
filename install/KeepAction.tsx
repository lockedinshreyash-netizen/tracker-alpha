/* ── One action, every device ──
   What "keep Alpha" means on this device, said once and used by both the
   quick-settings row and KeepBanner: a label, a one-line note, what a tap
   does, and the sheet that tap may open. The onboarding step has its own,
   larger version of the same branches (onboarding/Install.tsx). */

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './guides.css';
import type { InstallApi } from './useInstall';
import { bookmarkKeys, readEnv } from './platform';
import { GuideSheet, InAppEscape, guideFor } from './Guides';
import { markKept } from './keepState';
import { holdTitle } from '../ui/tabTitle';

const APP_LINK = 'https://trackeralpha.in/?open=today';

/* The bookmark, made by the student's own hands: drag the chip to the bar, or
   press the shortcut while this is open and we answer it. */
const BookmarkSheet: React.FC<{ onDone: () => void; onClose: () => void }> = ({ onDone, onClose }) => {
  const keys = bookmarkKeys(readEnv());
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    const release = holdTitle();
    document.title = 'Tracker Alpha';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') setPressed(true);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); release(); };
  }, [onClose]);
  return createPortal(
    <div className="kg-root" role="dialog" aria-modal="true" aria-label="Bookmark Tracker Alpha">
      <div className="kg-scrim" onClick={onClose} />
      <div className="kg-sheet">
        <p className="kg-eyebrow">One drag</p>
        <h2 className="kg-title">Pin Alpha to your bookmarks bar</h2>
        <p className="kg-lead">One click away every time you open your browser.</p>
        {pressed ? (
          <p className="kg-lead" aria-live="polite" style={{ color: '#fff' }}>
            In the box that opened, pick <b>Bookmarks bar</b>, then <b>Done</b>. No bar? Press <b>{keys.bar}</b>.
          </p>
        ) : (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10, marginTop: 18 }}>
            <a
              className="kg-drag"
              href={APP_LINK}
              draggable
              onClick={e => e.preventDefault()}
              onDragEnd={e => { if (e.dataTransfer.dropEffect !== 'none') onDone(); }}
            >
              <img src="/icon-192.png" alt="" width={18} height={18} draggable={false} />
              Tracker Alpha
            </a>
            <p className="kg-note" style={{ margin: 0 }}>Drag it up onto the bar, or press <b>{keys.mod} D</b>.</p>
          </div>
        )}
        <button type="button" className="kg-primary" onClick={onDone}>{pressed ? 'Done, it’s bookmarked' : 'I’ve bookmarked it'}</button>
        <button type="button" className="kg-ghost" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
};

const InAppSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => createPortal(
  <div className="kg-root" role="dialog" aria-modal="true" aria-label="Open in your browser">
    <div className="kg-scrim" onClick={onClose} />
    <div className="kg-sheet"><InAppEscape ua={navigator.userAgent} compact /><button type="button" className="kg-ghost" onClick={onClose}>Close</button></div>
  </div>,
  document.body,
);

export interface KeepAction {
  /** Nothing to offer on this device. */
  none: boolean;
  label: string;
  note: string;
  button: string;
  run: () => void;
  /** Render this somewhere; it is null unless a sheet is open. */
  sheet: React.ReactNode;
}

export const useKeepAction = (install: InstallApi, onKept?: () => void): KeepAction => {
  const [open, setOpen] = useState(false);
  const env = readEnv();
  const method = install.keep;
  const phone = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

  const kept = useCallback((via: 'guide' | 'bookmark') => {
    markKept(via);
    setOpen(false);
    onKept?.();
  }, [onKept]);

  const run = useCallback(() => {
    if (method === 'prompt') {
      /* Not awaited before prompt(): it needs the user activation this tap carries. */
      void install.install().then(outcome => {
        if (outcome === 'accepted') { markKept('install'); onKept?.(); }
      });
      return;
    }
    setOpen(true);
  }, [method, install, onKept]);

  const guide = guideFor(method, env.ua);
  const sheet = !open ? null
    : method === 'bookmark' ? <BookmarkSheet onDone={() => kept('bookmark')} onClose={() => setOpen(false)} />
      : method === 'inapp' ? <InAppSheet onClose={() => setOpen(false)} />
        : guide ? <GuideSheet guide={guide} onDone={() => kept('guide')} onClose={() => setOpen(false)} />
          : null;

  const copy: Record<typeof method, [string, string, string]> = {
    prompt: [phone ? 'Put Alpha on your home screen' : 'Install Alpha on this computer', 'One tap. Opens like an app, no browser tabs.', 'Install'],
    'ios-share': ['Put Alpha on your home screen', 'Three taps. It’s also how iPhone gets reminders.', 'Show me'],
    'mac-dock': ['Add Alpha to your Dock', 'Opens like an app, in its own window.', 'Show me'],
    'firefox-android': ['Put Alpha on your home screen', 'Two taps from Firefox’s menu.', 'Show me'],
    bookmark: ['Pin Alpha to your bookmarks bar', 'One click away every time you open your browser.', 'Pin it'],
    inapp: ['Open Alpha in your browser', 'This app’s browser can’t keep your progress.', 'Open'],
    none: ['', '', ''],
  };
  const [label, note, button] = copy[method];
  return { none: method === 'none', label, note, button, run, sheet };
};
