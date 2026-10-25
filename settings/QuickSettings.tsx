/* ── Quick settings ──
   The gear in the bottom-right corner, where the voice mic used to be, and
   the glass pane it opens: the handful of switches people reach for mid-day
   (notifications, sound, dark mode, class), the account, and a way to the
   rest. Class is here on every tab but Syllabus, which has its own switch in
   the corner (ClassSwitch.tsx) because that is the tab it changes most. It
   replaced the web-page header that carried the same controls as a
   row of bordered buttons over every tab: a native app keeps them one tap
   away, not in front of the content.

   Both the button and the pane are liquid glass (ui/LiquidGlass.tsx). The
   pane's dimming is a SIBLING behind it, never an ancestor, and it enters
   with `lg-pop` (a transform), never a fade: opacity on an ancestor would
   make it a backdrop root and the glass would refract nothing. The pane
   scrolls on an inner wrapper so the glass layers stay put. Geometry lives in
   index.css (`.qs-*`) for the reason the feedback dock gives. */

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import * as sfx from '../audio';
import { useSound } from '../sound/useSound';
import LiquidGlass from '../ui/LiquidGlass';
import { Segmented, Switch } from '../ui/kit';
import { Avatar } from '../profile/Avatar';
import type { Profile } from '../profile/profileApi';
import { notificationPermission, requestNotificationPermission, type PermissionState } from '../notify/system';
import type { InstallApi } from '../install/useInstall';
import { isAndroidApp } from '../install/useInstall';
import { useKeepAction } from '../install/KeepAction';
import type { ReminderPrefs, SyncStatus } from '../types';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentClass: 11 | 12;
  onClassChange: (c: 11 | 12) => void;
  /** False on Syllabus, where the corner switch is drawn instead. */
  showClass?: boolean;
  reminders: ReminderPrefs;
  onChangeReminders: (patch: Partial<ReminderPrefs>) => void;
  user: User | null;
  profile: Profile | null;
  syncStatus: SyncStatus;
  onSignIn: () => void;
  onOpenProfile: () => void;
  install: InstallApi;
  /** The full settings, on Review. */
  onOpenAll: () => void;
  /** The Support Alpha page: one quiet line under All settings, never a row with a switch. */
  onOpenSupport?: () => void;
  /** The festive theme an administrator has switched on, or null when none is
   *  live — and then there is no row at all, because there is nothing to turn off. */
  festive?: { theme: 'dussehra' | 'diwali' | 'christmas'; label: string; on: boolean; onToggle: (on: boolean) => void } | null;
}

/* ── Glyphs, in the rail's stroke language ── */

const Icon: React.FC<{ d: string; size?: number }> = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const GEAR = 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z';
const CLOSE = 'M18 6L6 18M6 6l12 12';
const BELL = 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0';
const SPEAKER = 'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14';
const MUTED = 'M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6';
const MOON = 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z';
const CAP = 'M2 9l10-5 10 5-10 5L2 9zM6 11v5c3 2 9 2 12 0v-5';
const DOWNLOAD = 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3';
const CHEVRON = 'M9 18l6-6-6-6';
const SPARKLE = 'M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z';

const GoogleMark = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/* Module level: defined inside the component it would be a new type on every
   render, remounting each row (and its switch) per tap. */
const Row: React.FC<{ dark: boolean; icon: string; color: string; label: string; note?: string; first?: boolean; children: React.ReactNode }> = ({ dark, icon, color, label, note, first, children }) => (
  <div className={`flex items-center gap-3 px-3.5 py-3 ${first ? '' : `border-t ${dark ? 'border-white/[0.06]' : 'border-black/[0.06]'}`}`}>
    <span className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0 text-white" style={{ background: color }}>
      <Icon d={icon} size={17} />
    </span>
    <span className="flex-1 min-w-0">
      <span className={`block text-[15px] font-semibold font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>{label}</span>
      {note && <span className="block text-[12px] font-ui text-zinc-500 truncate">{note}</span>}
    </span>
    {children}
  </div>
);

const SYNC_LABEL: Record<SyncStatus, string> = {
  local: 'On this device',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync paused. Retrying',
};
const SYNC_DOT: Record<SyncStatus, string> = {
  local: '#71717A',
  syncing: '#FAB005',
  synced: '#34C77B',
  error: '#E10600',
};

const QuickSettings: React.FC<Props> = ({
  theme, onToggleTheme, currentClass, onClassChange, showClass = true, reminders, onChangeReminders,
  user, profile, syncStatus, onSignIn, onOpenProfile, install, onOpenAll, onOpenSupport, festive = null,
}) => {
  const dark = theme === 'dark';
  const sound = useSound();
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>(notificationPermission);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Read fresh each time it opens: the permission can change in system settings.
  useEffect(() => {
    if (!open) return;
    setPermission(notificationPermission());
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toggle = () => { sfx.select(); setOpen(o => !o); };

  /* Notifications: the reminder engine, plus the system permission it needs
     to reach a hidden tab. Same semantics as ReminderSettings' own switch:
     turning it on asks once, and reminders still work as in-app toasts if the
     answer is no. Off also withdraws closed-app push. */
  const setNotifications = async (want: boolean) => {
    if (!want) {
      onChangeReminders({ enabled: false, push: false });
      if (reminders.push) {
        const { disablePush } = await import('../notify/push');
        void disablePush();
      }
      return;
    }
    setBusy(true);
    setPermission(await requestNotificationPermission());
    setBusy(false);
    onChangeReminders({ enabled: true });
  };

  const notifyNote = permission === 'denied'
    ? 'Blocked in your phone’s settings'
    : permission === 'unsupported'
      ? 'Shown inside the app only'
      : 'Reminders for task deadlines';

  /* Every device that has some way to keep Alpha close, not only those with an
     install prompt: a guided Add to Home Screen, the Dock, a bookmark, or out
     of an in-app browser (install/KeepAction.tsx). */
  const keepAction = useKeepAction(install);
  const showInstall = !keepAction.none && !install.installed && !isAndroidApp();

  const ink = dark ? 'text-white' : 'text-zinc-900';
  const muted = 'text-zinc-500';
  const group = `rounded-2xl overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-white/60'}`;

  return (
    <>
      {keepAction.sheet}
      <div className="qs-dock">
        <LiquidGlass
          as="button"
          dark={dark}
          radius={24}
          variant="bar"
          bezel={12}
          strength={12}
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Close settings' : 'Settings'}
          className={`qs-button flex items-center justify-center active:scale-95 transition-transform ${dark ? 'text-white' : 'text-zinc-900'}`}
        >
          <span className={`flex transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
            <Icon d={open ? CLOSE : GEAR} size={20} />
          </span>
        </LiquidGlass>
      </div>

      {open && (
        <>
          <div className="qs-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <LiquidGlass
            dark={dark}
            radius={28}
            variant="panel"
            bezel={18}
            strength={20}
            className="qs-panel lg-pop"
            role="dialog"
            aria-label="Settings"
          >
            <div ref={panelRef} tabIndex={-1} className="qs-scroll outline-none no-scrollbar">
              <div className="flex items-center justify-between px-1 pb-3">
                <h2 className={`font-display text-[22px] leading-none ${ink}`}>Settings</h2>
              </div>

              {/* ── Account ── */}
              {user ? (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenProfile(); }}
                  className={`${group} w-full flex items-center gap-3 px-3.5 py-3 text-left active:scale-[0.99] transition-transform`}
                >
                  <Avatar profile={profile} name={profile?.display_name ?? user.email ?? ''} size={40} />
                  <span className="flex-1 min-w-0">
                    <span className={`block text-[15px] font-bold font-ui truncate ${ink}`}>{profile?.display_name ?? 'Your profile'}</span>
                    <span className={`flex items-center gap-1.5 text-[12px] font-ui ${muted}`}>
                      <i className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: SYNC_DOT[syncStatus] }} />
                      {SYNC_LABEL[syncStatus]}
                    </span>
                  </span>
                  <span className={muted}><Icon d={CHEVRON} size={16} /></span>
                </button>
              ) : (
                <div className={`${group} px-3.5 py-3.5`}>
                  <p className={`text-[15px] font-bold font-ui ${ink}`}>Guest</p>
                  <p className={`text-[12px] font-ui mt-0.5 ${muted}`}>Everything stays on this device. Sign in to sync and join Ranks and Groups.</p>
                  <button
                    type="button"
                    onClick={() => { setOpen(false); onSignIn(); }}
                    className="mt-3 w-full h-11 rounded-xl bg-white text-zinc-900 flex items-center justify-center gap-2 text-[14px] font-bold font-ui active:scale-[0.98] transition-transform shadow-sm"
                  >
                    <GoogleMark /> Continue with Google
                  </button>
                </div>
              )}

              {/* ── Switches ── */}
              <div className={`${group} mt-3`}>
                <Row dark={dark} first icon={BELL} color="#E8590C" label="Notifications" note={notifyNote}>
                  <Switch dark={dark} label="Notifications" on={reminders.enabled} disabled={busy} onToggle={v => { void setNotifications(v); }} />
                </Row>
                <Row dark={dark} icon={sound.enabled ? SPEAKER : MUTED} color="#4C6EF5" label="Sound" note="Taps, the timer and the streak">
                  <Switch dark={dark} label="Sound" on={sound.enabled} onToggle={() => sfx.toggleSound()} />
                </Row>
                <Row dark={dark} icon={MOON} color="#7048E8" label="Dark mode">
                  <Switch dark={dark} label="Dark mode" on={dark} onToggle={() => { sfx.select(); onToggleTheme(); }} />
                </Row>
                {/* Only while a theme is live. Off holds for this theme on this
                    device; the next theme asks again (festive/useFestiveTheme). */}
                {festive && (
                  <Row
                    dark={dark}
                    icon={SPARKLE}
                    color={festive.theme === 'christmas' ? '#2F9E44' : '#F08C00'}
                    label="Festive theme"
                    note={festive.on ? `${festive.label} decorations` : `${festive.label} decorations are hidden`}
                  >
                    <Switch dark={dark} label="Festive theme" on={festive.on} onToggle={v => { sfx.select(); festive.onToggle(v); }} />
                  </Row>
                )}
              </div>

              {/* ── Class ── */}
              {showClass && (
                <div className={`${group} mt-3`}>
                  <Row dark={dark} first icon={CAP} color="#12B886" label="Class">
                    <Segmented
                      dark={dark}
                      label="Class"
                      value={String(currentClass) as '11' | '12'}
                      options={[{ value: '11', label: '11' }, { value: '12', label: '12' }]}
                      onChange={v => { sfx.select(); onClassChange(v === '12' ? 12 : 11); }}
                    />
                  </Row>
                </div>
              )}

              {/* ── Install, where the browser can ── */}
              {showInstall && (
                <div className={`${group} mt-3`}>
                  <Row dark={dark} first icon={DOWNLOAD} color="#22B8CF" label={keepAction.label} note={keepAction.note}>
                    <button
                      type="button"
                      onClick={keepAction.run}
                      className={`h-8 px-3.5 rounded-full text-[13px] font-bold font-ui ${dark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'}`}
                    >
                      {keepAction.button}
                    </button>
                  </Row>
                </div>
              )}

              <button
                type="button"
                onClick={() => { setOpen(false); onOpenAll(); }}
                className={`${group} mt-3 w-full flex items-center justify-between px-3.5 h-12 text-[15px] font-semibold font-ui ${ink} active:scale-[0.99] transition-transform`}
              >
                All settings
                <span className={muted}><Icon d={CHEVRON} size={16} /></span>
              </button>

              {/* Seen every time the pane opens, asking nothing: plain muted
                  text, no icon, no colour. */}
              {onOpenSupport && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onOpenSupport(); }}
                  className={`mt-2 mx-auto flex items-center justify-center px-3 h-10 text-[13px] font-semibold font-ui ${muted} ${dark ? 'hover:text-zinc-300' : 'hover:text-zinc-800'} transition-colors`}
                >
                  Support Alpha
                </button>
              )}
            </div>
          </LiquidGlass>
        </>
      )}
    </>
  );
};

export default QuickSettings;
