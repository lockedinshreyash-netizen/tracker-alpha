/* ── What this device has already done to keep Alpha close ──
   Per device, in localStorage, never AppState: a bookmark on the laptop says
   nothing about the phone. Read by KeepBanner to stop asking, and by the
   analytics ping to measure which fallback brings students back.

   Bookmarks and calendar events cannot be detected, only the gesture that
   made them (the shortcut pressed, the link dragged, the calendar button
   tapped), so "kept" means "did the thing", not "verified it worked". */

export type KeptVia = 'install' | 'bookmark' | 'calendar' | 'guide';

const KEY = 'alpha_keep_v1';

export interface KeepState {
  via: KeptVia[];
  /** Times the re-ask banner has been shown, and when it last was. */
  asked: number;
  lastAsked: number;
}

const EMPTY: KeepState = { via: [], asked: 0, lastAsked: 0 };

export const readKeep = (): KeepState => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<KeepState> | null;
    if (!raw || typeof raw !== 'object') return EMPTY;
    return {
      via: Array.isArray(raw.via) ? raw.via.filter((v): v is KeptVia => ['install', 'bookmark', 'calendar', 'guide'].includes(v as string)) : [],
      asked: Number.isFinite(raw.asked) ? Number(raw.asked) : 0,
      lastAsked: Number.isFinite(raw.lastAsked) ? Number(raw.lastAsked) : 0,
    };
  } catch {
    return EMPTY;
  }
};

const write = (s: KeepState) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: the banner may ask once more */ }
};

export const markKept = (via: KeptVia): void => {
  const s = readKeep();
  if (!s.via.includes(via)) write({ ...s, via: [...s.via, via] });
};

export const markAsked = (now = Date.now()): void => {
  const s = readKeep();
  /* One ask, however many times the screen that asks happens to mount. */
  if (now - s.lastAsked < 60_000) return;
  write({ ...s, asked: s.asked + 1, lastAsked: now });
};

/* ── The re-ask rule ──
   At most three times, at least three days apart, and never again once the
   device has kept Alpha some way. A banner that keeps coming back is an ad. */
export const ASK_MAX = 3;
export const ASK_GAP_MS = 3 * 86_400_000;

export const shouldAsk = (s: KeepState, now = Date.now()): boolean =>
  s.via.length === 0 && s.asked < ASK_MAX && now - s.lastAsked >= ASK_GAP_MS;
