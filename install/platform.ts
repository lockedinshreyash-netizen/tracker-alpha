/* ── How this device can keep Alpha in front of the student ──
   One answer per device, decided in one place. Retention dies the moment the
   tab closes, so every platform gets the lowest-friction way it has of putting
   Alpha back in front of the student, and the honest steps where it has no API:

     prompt           Chromium (Chrome, Edge, Samsung Internet, Opera, Brave).
                      A real install prompt: our tap plus the browser's confirm.
     ios-share        iPhone / iPad. No install API exists; Share → Add to Home
                      Screen, guided. Chrome on iOS 16.4+ can do it too.
     mac-dock         Safari 17+ on a Mac: File → Add to Dock.
     firefox-android  Firefox on Android: menu → Install.
     bookmark         Any other desktop browser (Firefox, older Safari): a
                      bookmark on the bar is the closest thing to an icon.
     inapp            Instagram, WhatsApp, Facebook, Snapchat, LinkedIn,
                      Telegram, Line webviews. Nothing can be kept from inside
                      one, and they often throw localStorage away: the only
                      useful move is out, into the real browser.
     none             Already installed, or running as the Play app.

   Pure: the user agent and capabilities come in as arguments, so the whole
   table is tested against real UA strings (install/tests/). `detectKeepMethod`
   at the bottom reads them from the live browser. */

export type KeepMethod = 'prompt' | 'ios-share' | 'mac-dock' | 'firefox-android' | 'bookmark' | 'inapp' | 'none';

export interface Env {
  ua: string;
  /** navigator.platform, for the iPadOS-as-Mac sniff. */
  platform: string;
  maxTouchPoints: number;
  /** 'onbeforeinstallprompt' in window. */
  canPrompt: boolean;
  /** Running from the home screen, the dock or the Play app. */
  standalone: boolean;
  /** getInstalledRelatedApps() found the app. */
  installedElsewhere: boolean;
}

const INAPP_RE = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Snapchat|LinkedInApp|Telegram|\bLine\/|MicroMessenger|; wv\)/i;

export const isAndroidUA = (ua: string): boolean => /android/i.test(ua);

/* iPadOS 13+ reports itself as a Mac with touch. A touch device announcing
   Android is never an iPad (devtools' phone emulation on a Mac reports
   MacIntel). */
export const isIOSEnv = (e: Pick<Env, 'ua' | 'platform' | 'maxTouchPoints'>): boolean => {
  if (isAndroidUA(e.ua)) return false;
  return /iphone|ipad|ipod/i.test(e.ua) || (e.platform === 'MacIntel' && e.maxTouchPoints > 1);
};

export const isInApp = (ua: string): boolean => INAPP_RE.test(ua);

const isFirefox = (ua: string): boolean => /firefox|fxios/i.test(ua);

/* Safari proper on a Mac: Version/x Safari, and none of the Chromium or
   Firefox tokens that also carry "Safari". */
const macSafariVersion = (ua: string): number | null => {
  if (!/Macintosh/i.test(ua) || /Chrome|Chromium|CriOS|Edg|OPR|Firefox/i.test(ua)) return null;
  const m = ua.match(/Version\/(\d+)/);
  return m && /Safari/i.test(ua) ? Number(m[1]) : null;
};

const isMobileUA = (ua: string): boolean => /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

export const keepMethodFor = (e: Env): KeepMethod => {
  if (e.standalone || e.installedElsewhere) return 'none';
  /* Before everything else: a webview may still expose an install event it can
     never honour, and its storage may not survive the day. */
  if (isInApp(e.ua)) return 'inapp';
  if (isIOSEnv(e)) return 'ios-share';
  if (e.canPrompt) return 'prompt';
  if (isAndroidUA(e.ua) && isFirefox(e.ua)) return 'firefox-android';
  const safari = macSafariVersion(e.ua);
  if (safari !== null && safari >= 17 && e.maxTouchPoints <= 1) return 'mac-dock';
  /* A phone browser with no prompt and no menu path we can name (an old
     Samsung, Opera Mini) has no keyboard shortcut to teach either. */
  return isMobileUA(e.ua) ? 'none' : 'bookmark';
};

/** Which modifier the bookmark shortcut uses on this keyboard. */
export const bookmarkKeys = (e: Pick<Env, 'ua' | 'platform'>): { mod: '⌘' | 'Ctrl'; bar: string } => {
  const mac = /Mac/i.test(e.platform) || /Macintosh/i.test(e.ua);
  return mac ? { mod: '⌘', bar: '⌘⇧B' } : { mod: 'Ctrl', bar: 'Ctrl+Shift+B' };
};

/* ── The live browser ──────────────────────────────────────────── */

export const readEnv = (overrides: Partial<Env> = {}): Env => {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const w = typeof window !== 'undefined' ? window : undefined;
  const standalone = !!w && (
    document.documentElement.classList.contains('android-app')
    || w.matchMedia?.('(display-mode: standalone)').matches === true
    || w.matchMedia?.('(display-mode: fullscreen)').matches === true
    || (nav as unknown as { standalone?: boolean })?.standalone === true
  );
  return {
    ua: nav?.userAgent ?? '',
    platform: nav?.platform ?? '',
    maxTouchPoints: nav?.maxTouchPoints ?? 0,
    canPrompt: !!w && 'onbeforeinstallprompt' in w,
    standalone,
    installedElsewhere: false,
    ...overrides,
  };
};

/* ── Leaving an in-app browser ──
   Android webviews honour an intent: URL and hand the page to Chrome. iOS
   webviews have no equivalent; the student has to use the webview's own menu,
   so the UI shows them where it is. */
export const chromeIntentUrl = (href: string): string => {
  const u = new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`;
};

/** Which app's webview this is, for copy that names the right menu. */
export const inAppName = (ua: string): string => {
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/WhatsApp/i.test(ua)) return 'WhatsApp';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Snapchat/i.test(ua)) return 'Snapchat';
  if (/LinkedInApp/i.test(ua)) return 'LinkedIn';
  if (/Telegram/i.test(ua)) return 'Telegram';
  if (/\bLine\//i.test(ua)) return 'Line';
  return 'this app';
};
