/* ── Installing to the home screen ──

   Everything about install is platform-specific and none of it is symmetrical,
   so the asymmetry is modelled here once rather than re-derived at each call
   site.

   THE THING THAT WAS ACTUALLY BROKEN: Chrome fires `beforeinstallprompt` only
   for a page whose service worker has a `fetch` handler. `public/sw.js` was
   written deliberately without one, so the event had never fired, so the
   Header's Install button had never rendered on any device, ever. The fix is in
   the worker (a navigation-only offline fallback); this hook is the half that
   was already correct.

   THE THING THAT CANNOT BE FIXED: iOS has no install API. Safari never fires
   `beforeinstallprompt`, exposes no `prompt()`, and Apple provides no
   replacement — adding to the home screen is a Share-sheet action the user has
   to perform themselves. Any "install button" on an iPhone is a button that
   opens instructions, in every app on the web, including the ones that look
   like they have solved it. So `mode` says which of the two a caller is getting
   rather than pretending they are the same. */

import { useCallback, useEffect, useState } from 'react';

/** The event Chrome hands us. Not in lib.dom yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    /** Caught by the inline script in index.html, before React exists. */
    __installPrompt?: BeforeInstallPromptEvent | null;
  }
}

const earlyPrompt = (): BeforeInstallPromptEvent | null =>
  (typeof window !== 'undefined' ? window.__installPrompt ?? null : null);

/** A Chromium browser (Chrome, Edge, Samsung Internet, Opera, Brave): one that
    hands pages a real install prompt. Safari and Firefox (and every browser on
    iOS, all WebKit underneath) have no such event, so this is the whole test. */
const canPrompt = (): boolean =>
  typeof window !== 'undefined' && 'onbeforeinstallprompt' in window;

export type InstallMode =
  /** Chromium handed us a real prompt. One tap installs it. */
  | 'prompt'
  /** iOS. Share → Add to Home Screen, and there is no way around it. */
  | 'ios'
  /** Already on the home screen, or the browser cannot install at all. */
  | 'none';

const DISMISS_KEY = 'alpha_install_banner_dismissed_v1';

/* iPadOS 13+ reports itself as a Mac and is only distinguishable by the touch
   points — the long-standing sniff, and still the only one that works. */
export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  /* A touch device announcing Android is not an iPad, whatever its platform
     string says (devtools' phone emulation on a Mac reports MacIntel). */
  if (/android/i.test(navigator.userAgent)) return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

/** Running inside the Play Store app (a Trusted Web Activity, see twa/).
    Decided once, before first paint, by the inline script in index.html, which
    marks <html>; this only reads that mark, so the two cannot disagree. */
export const isAndroidApp = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('android-app');

/** Already installed: launched from the home screen rather than the browser. */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  /* The Play app is checked by name rather than trusted to the display mode:
     there is no display mode a TWA is promised to report, and offering to
     install the website inside the app it was installed as would be absurd. */
  return isAndroidApp()
    || window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true
    /* Safari's own, predating the standard and still the only one it sets. */
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
};

const wasDismissed = (): boolean => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    /* A hardened browser refusing storage should see the banner, not lose the
       feature. Showing it once more than intended is the cheaper failure. */
    return false;
  }
};

export interface InstallApi {
  mode: InstallMode;
  /**
   * This browser can install with one tap and the app is not installed yet,
   * whether or not the prompt has arrived. Chrome sends it only after the
   * visitor has spent 30 seconds on the site, so a quick onboarding often
   * reaches its end first: the install step is decided by this, and waits for
   * the prompt itself.
   */
  supported: boolean;
  /** True once the app is running from the home screen. */
  installed: boolean;
  /** The banner's own state — `mode` says whether install is possible at all. */
  bannerDismissed: boolean;
  dismissBanner: () => void;
  /**
   * Show the browser's install dialog. Resolves to what the user chose.
   *
   * Returns 'unavailable' on iOS rather than throwing: the caller is expected
   * to have shown the Share-sheet instructions instead, and this is the
   * backstop for the case where it did not.
   */
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export const useInstall = (): InstallApi => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(earlyPrompt);
  const [installed, setInstalled] = useState(isStandalone);
  /* Installed already, seen from a browser tab: the manifest lists the web app
     itself under related_applications, which is what lets Chrome answer. A
     device that has it never gets a prompt, and must not be asked to wait. */
  const [installedElsewhere, setInstalledElsewhere] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(wasDismissed);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      /* Without preventDefault Chrome shows its own mini-infobar and the event
         cannot be replayed later from our own button. */
      e.preventDefault();
      window.__installPrompt = e as BeforeInstallPromptEvent;
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      window.__installPrompt = null;
      setPromptEvent(null);
      setInstalled(true);
    };
    /* index.html may have caught it between the first render and now. */
    if (window.__installPrompt) setPromptEvent(window.__installPrompt);

    const related = (navigator as unknown as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps;
    related?.call(navigator).then(apps => { if (apps.length > 0) setInstalledElsewhere(true); }, () => { /* unknown is not installed */ });

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    /* Installing from the browser's own menu fires `appinstalled` in Chrome but
       nothing at all in some builds, and iOS fires nothing ever. The display
       mode is the one signal every platform agrees on, so it is watched
       directly — otherwise the banner would keep offering to install an app the
       user is already standing inside. */
    const standalone = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayChange = () => setInstalled(isStandalone());
    standalone?.addEventListener?.('change', onDisplayChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      standalone?.removeEventListener?.('change', onDisplayChange);
    };
  }, []);

  const dismissBanner = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // The banner simply returns on the next load.
    }
    setBannerDismissed(true);
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!promptEvent) return 'unavailable';
    try {
      await promptEvent.prompt();
    } catch {
      /* Refused before anything was shown (no user gesture left, most often).
         The event was not spent, so it is kept for the next tap. */
      return 'unavailable';
    }
    const { outcome } = await promptEvent.userChoice;
    /* Single-use by specification: an event that has been prompted cannot be
       prompted again, so keeping it would leave a button that silently does
       nothing the second time. */
    window.__installPrompt = null;
    setPromptEvent(null);
    return outcome;
  }, [promptEvent]);

  const mode: InstallMode = installed
    ? 'none'
    : promptEvent
      ? 'prompt'
      : isIOS()
        ? 'ios'
        : 'none';

  const supported = !installed && !installedElsewhere && (promptEvent !== null || canPrompt());

  return { mode, supported, installed, bannerDismissed, dismissBanner, install };
};
