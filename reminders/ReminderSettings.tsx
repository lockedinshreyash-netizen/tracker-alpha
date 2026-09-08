import React, { useEffect, useState } from 'react';
import { ReminderPrefs } from '../types';
import { formatClock, fromClockValue, toClockValue } from '../schedule/schedule';
import { PermissionState, notificationPermission, requestNotificationPermission } from '../notify/system';

interface Props {
  prefs: ReminderPrefs;
  theme: 'dark' | 'light';
  /** Push needs an account to deliver to. Signed out, the toggle explains itself. */
  signedIn: boolean;
  onChange: (patch: Partial<ReminderPrefs>) => void;
}

/* Push is only offered where it can actually work. A control that cannot do
   anything is worse than no control — the user turns it on, nothing arrives,
   and they conclude the whole feature is broken. */
const pushSupported = (): boolean =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && !!import.meta.env.VITE_VAPID_PUBLIC_KEY;

const ReminderSettings: React.FC<Props> = ({ prefs, theme, signedIn, onChange }) => {
  const dark = theme === 'dark';
  const [permission, setPermission] = useState<PermissionState>(notificationPermission);
  const [busy, setBusy] = useState(false);

  /* A permission revoked in browser settings turns PUSH off, and only push —
     that is the part which genuinely cannot work any more.
     
     It deliberately does not touch `enabled`. Reminders do not need
     notification permission to be useful: a visible tab gets a toast, which is
     where most of them land anyway. Switching the whole feature off because the
     lock-screen half of it became unavailable would silently stop deadlines the
     user set, and they would find out by missing one. */
  useEffect(() => {
    if (prefs.push && permission === 'denied') onChange({ push: false });
  }, [prefs.push, permission, onChange]);

  const enable = async (want: boolean) => {
    if (!want) { onChange({ enabled: false, push: false }); return; }
    setBusy(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setBusy(false);
    /* Granted or not, reminders still work — a visible tab gets a toast. The
       permission only decides whether a hidden tab gets a system notification
       too, so refusing it is not a reason to refuse the feature. */
    onChange({ enabled: true });
  };

  const togglePush = async (want: boolean) => {
    if (!want) {
      onChange({ push: false });
      const { disablePush } = await import('../notify/push');
      void disablePush();
      return;
    }
    setBusy(true);
    const { enablePush } = await import('../notify/push');
    const ok = await enablePush();
    setBusy(false);
    onChange({ push: ok });
    if (!ok) setPermission(notificationPermission());
  };

  const card = `p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`;
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const rowNote = `text-[9px] uppercase font-medium mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-500'}`;

  const Switch: React.FC<{ on: boolean; disabled?: boolean; onToggle: (v: boolean) => void; label: string }> =
    ({ on, disabled, onToggle, label }) => (
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onToggle(!on)}
        className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-40 ${on ? 'bg-[#E10600]' : dark ? 'bg-[#27272a]' : 'bg-zinc-300'}`}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
          style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
    );

  return (
    <div className={card}>
      <div className="flex justify-between items-start gap-6">
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase font-ui">Deadline Reminders</h4>
          <p className={`text-[11px] font-bold mt-1 uppercase ${muted}`}>
            Only for tasks you gave a date
          </p>
          {/* The boundary, said out loud where the switch is. */}
          <p className={rowNote}>
            The app never invents a reminder. If you never set a due date, nothing here ever fires.
          </p>
        </div>
        <Switch on={prefs.enabled} disabled={busy} onToggle={enable} label="Deadline reminders" />
      </div>

      {prefs.enabled && (
        <div className={`mt-6 pt-6 border-t space-y-5 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <div className="flex justify-between items-center gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase font-ui">Default time</p>
              <p className={rowNote}>
                When a task with a date but no time speaks. Currently {formatClock(prefs.defaultMinute)}.
              </p>
            </div>
            <input
              type="time"
              value={toClockValue(prefs.defaultMinute)}
              onChange={e => {
                const m = fromClockValue(e.target.value);
                if (m !== null) onChange({ defaultMinute: m });
              }}
              aria-label="Default reminder time"
              className={`text-[12px] font-bold p-2.5 rounded-lg border focus:outline-none font-ui ${dark ? 'bg-black/30 border-white/[0.06] text-white' : 'bg-[#F2F0EC] border-zinc-200 text-[#17150F]'}`}
            />
          </div>

          <div className="flex justify-between items-center gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase font-ui">Warn me the day before</p>
              <p className={rowNote}>A deadline you hear about on the day is a deadline you already lost.</p>
            </div>
            <Switch
              on={prefs.leadMinutes >= 1440}
              onToggle={v => onChange({ leadMinutes: v ? 1440 : 0 })}
              label="Warn a day early"
            />
          </div>

          <div className="flex justify-between items-center gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase font-ui">Planned blocks</p>
              <p className={rowNote}>Ten minutes before a block on your plan starts. Never mid-session.</p>
            </div>
            <Switch
              on={prefs.planBlocks}
              onToggle={v => onChange({ planBlocks: v })}
              label="Planned block reminders"
            />
          </div>

          <div className="flex justify-between items-center gap-6">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase font-ui">When the app is closed</p>
              <p className={rowNote}>
                {!signedIn
                  ? 'Sign in to be reminded when the app is closed.'
                  : permission === 'denied'
                    ? 'Your browser is blocking notifications for this site. Change it in site settings.'
                    : !pushSupported()
                      ? 'This browser cannot deliver notifications to a closed app.'
                      : 'Delivered even with every tab shut. On iPhone, add the app to your home screen first.'}
              </p>
            </div>
            <Switch
              on={prefs.push}
              disabled={busy || !signedIn || !pushSupported() || permission === 'denied'}
              onToggle={togglePush}
              label="Closed-app reminders"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;
