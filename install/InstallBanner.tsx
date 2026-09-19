import React, { useEffect, useState } from 'react';
import { InstallApi } from './useInstall';

interface Props {
  install: InstallApi;
  theme: 'dark' | 'light';
}

/* Mobile only. On a laptop the app is already where you want it and a banner
   across the bottom is an interruption with nothing behind it — the Header's
   Install button covers that case. 768px is the app's own `md` breakpoint. */
const MOBILE = '(max-width: 767px)';

const useIsMobile = (): boolean => {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(MOBILE).matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(MOBILE);
    if (!mq) return;
    const on = () => setMobile(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return mobile;
};

/* Long enough that it arrives after the app has painted and reads as the app
   offering something, rather than as an ad that beat the content to the screen. */
const APPEAR_AFTER_MS = 1_200;

const ShareGlyph: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13" />
    <path d="m8 7 4-4 4 4" />
    <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

const PlusSquareGlyph: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

/**
 * "Put Alpha on your home screen" — once, on a phone, with a button that works.
 *
 * On Android and every Chromium browser the button is real: it calls the
 * captured `beforeinstallprompt`, the OS install sheet opens, and one tap
 * installs the app. That is now possible for the first time — see the comment
 * at the top of `useInstall.ts` and the fetch handler in `public/sw.js`.
 *
 * On iPhone it cannot be. Apple exposes no install API of any kind: adding to
 * the home screen is a Share-sheet action the user performs, and no website can
 * trigger it. So iOS gets the same prominent button, and it opens two labelled
 * steps with the real glyphs rather than a paragraph of prose. That is the
 * closest thing to a working button that exists on that platform — every app
 * that appears to do better is doing exactly this.
 *
 * Dismissal is permanent, because a banner that comes back is an ad. The
 * Header keeps an Install button for anyone who changes their mind.
 */
const InstallBanner: React.FC<Props> = ({ install, theme }) => {
  const dark = theme === 'dark';
  const mobile = useIsMobile();
  const [shown, setShown] = useState(false);
  const [iosSheet, setIosSheet] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), APPEAR_AFTER_MS);
    return () => window.clearTimeout(t);
  }, []);

  if (!mobile || !shown || install.bannerDismissed || install.mode === 'none') return null;

  const ios = install.mode === 'ios';

  const onPrimary = () => {
    if (ios) { setIosSheet(true); return; }
    /* Not awaited: `prompt()` needs the user activation this click carries, and
       an await before it would spend it. The hook clears the event itself. */
    void install.install().then(outcome => {
      /* Accepting installs the app and `appinstalled` hides this anyway.
         Declining retires the event, so the banner has nothing left to offer
         and should get out of the way rather than sit there inert. */
      if (outcome !== 'unavailable') install.dismissBanner();
    });
  };

  const panel = dark ? 'bg-[#111114] border-white/[0.10]' : 'bg-white border-[#E3E0D9]';
  const ink = dark ? 'text-white' : 'text-[#17150F]';
  const muted = dark ? 'text-zinc-400' : 'text-[#6B675C]';

  return (
    <>
      {/* Above the toast host (45) and the mic (40), below every modal. It sits
          on the safe-area inset so it clears an iPhone's home indicator. */}
      <div
        className="fixed inset-x-0 bottom-0 z-[55] p-3 pointer-events-none"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        role="dialog"
        aria-label="Install Tracker Alpha"
      >
        <div className={`toast-in pointer-events-auto rounded-2xl border shadow-2xl backdrop-blur-xl p-4 ${panel}`}>
          <div className="flex items-start gap-3">
            <img
              src="/icon-192.png"
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-[13px] font-bold font-ui leading-snug ${ink}`}>
                Put Alpha on your home screen
              </p>
              {/* The iPhone line is the strongest reason to install and the
                  weakest thing to say on Android, where notifications work in
                  the browser regardless. Said only where it is true. */}
              <p className={`text-[11px] font-ui mt-0.5 leading-snug ${muted}`}>
                {ios
                  ? 'Opens full screen, works offline, and it is the only way an iPhone can send you reminders.'
                  : 'Opens full screen, launches from your app drawer, and works offline.'}
              </p>
            </div>
            <button
              onClick={install.dismissBanner}
              aria-label="Not now"
              className={`shrink-0 -mt-1 -mr-1 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-60 ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <button
            onClick={onPrimary}
            className="mt-3 w-full px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] rounded-xl bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
          >
            {ios ? 'Show me how' : 'Install app'}
          </button>
        </div>
      </div>

      {/* ── iOS ──
          Two steps, each with the glyph the user is hunting for, because
          "Share → Add to Home Screen" is unreadable to somebody who does not
          already know which icon Share is. */}
      {iosSheet && (
        <div
          className="fixed inset-0 z-[86] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIosSheet(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Add to Home Screen"
        >
          <div
            onClick={e => e.stopPropagation()}
            className={`w-full max-w-md rounded-t-2xl border p-7 animate-in slide-in-from-bottom-4 duration-300 ${panel}`}
            style={{ paddingBottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#E10600] font-ui">
              Two taps
            </p>
            <h2 className={`mt-4 text-xl font-black uppercase tracking-tight leading-tight ${ink}`}>
              Add Alpha to your home screen
            </h2>
            <div className="accent-line mt-4 mb-6" />

            <ol className="space-y-4">
              {[
                { n: 1, glyph: <ShareGlyph />, label: 'Share', tail: 'in the Safari toolbar' },
                { n: 2, glyph: <PlusSquareGlyph />, label: 'Add to Home Screen', tail: 'then Add' },
              ].map(step => (
                <li key={step.n} className="flex items-center gap-3.5">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dark ? 'bg-white/[0.06] text-white' : 'bg-[#F2F0EC] text-[#17150F]'}`}>
                    {step.glyph}
                  </span>
                  <span className={`text-[13px] font-ui leading-snug ${muted}`}>
                    Tap <span className={`font-bold ${ink}`}>{step.label}</span> {step.tail}
                  </span>
                </li>
              ))}
            </ol>

            <p className={`mt-6 text-[11px] font-ui leading-relaxed ${dark ? 'text-zinc-600' : 'text-[#8A8577]'}`}>
              Apple gives websites no way to do this for you — on iPhone, every app
              that offers to install itself is showing you these same two steps.
            </p>

            <button
              onClick={() => { setIosSheet(false); install.dismissBanner(); }}
              className="mt-6 w-full px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.12em] rounded-xl bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallBanner;
