import React, { useEffect, useState } from 'react';
import type { InstallApi } from './useInstall';
import { useKeepAction } from './KeepAction';
import { markAsked, readKeep, shouldAsk } from './keepState';

interface Props {
  install: InstallApi;
  theme: 'dark' | 'light';
}

/* Long enough that it arrives after the app has painted and reads as the app
   offering something, rather than an ad that beat the content to the screen. */
const APPEAR_AFTER_MS = 1_500;

/**
 * "Keep Alpha one tap away", for everyone who skipped the onboarding step.
 *
 * Replaced InstallBanner, which was mobile-only, Chromium-or-iPhone-only and
 * shown once ever. Retention dies when the tab closes, so this asks on every
 * device in the form that device has (install/platform.ts): one-tap install, a
 * guided Add to Home Screen or Add to Dock, a bookmark, or the way out of an
 * in-app browser.
 *
 * It is still not an ad: at most three times, three days apart, and never
 * again once this device has kept Alpha some way (install/keepState.ts). The
 * onboarding step counts as the first ask, so it does not reappear the
 * moment onboarding ends.
 */
const KeepBanner: React.FC<Props> = ({ install, theme }) => {
  const dark = theme === 'dark';
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);
  const action = useKeepAction(install, () => setClosed(true));

  useEffect(() => {
    if (action.none || !shouldAsk(readKeep())) return;
    const t = window.setTimeout(() => { markAsked(); setShown(true); }, APPEAR_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [action.none]);

  if (action.none || install.installed) return <>{action.sheet}</>;
  if (!shown || closed) return <>{action.sheet}</>;

  const panel = dark ? 'bg-[#111114] border-white/[0.10]' : 'bg-white border-zinc-200';
  const ink = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-600';

  return (
    <>
      {action.sheet}
      {/* Above the toast host and below every modal. Clear of an iPhone's home
          indicator, and on a laptop centred between the feedback bubble and
          the settings gear. */}
      <div
        className="fixed inset-x-0 bottom-0 z-[55] p-3 pointer-events-none md:flex md:justify-center"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-label={action.label}
      >
        <div className={`toast-in pointer-events-auto w-full md:max-w-md rounded-2xl border shadow-2xl p-4 ${panel}`}>
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="" aria-hidden="true" width={40} height={40} className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`text-[14px] font-bold font-ui leading-snug ${ink}`}>{action.label}</p>
              <p className={`text-[12px] font-ui mt-0.5 leading-snug ${muted}`}>
                So you actually open it tomorrow. {action.note}
              </p>
            </div>
            <button
              onClick={() => setClosed(true)}
              aria-label="Not now"
              className={`shrink-0 -mt-1 -mr-1 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-60 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <button
            onClick={action.run}
            className="mt-3 w-full px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] rounded-xl bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
          >
            {action.button}
          </button>
        </div>
      </div>
    </>
  );
};

export default KeepBanner;
