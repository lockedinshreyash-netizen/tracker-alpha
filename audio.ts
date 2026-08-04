/* ── Sound cues ──
   One-shot HTMLAudioElement playbacks. No library: for a handful of one-shots
   a playback engine would be dead weight.

   Hard rule: audio is decoration. A missing file, a blocked autoplay, or a
   browser with no audio support must never interrupt anything — every path
   here fails silently. The app is designed to run fine with public/sounds/
   completely empty, which is how it ships until the files are sourced. */

export const SOUND_PREF_KEY = 'lockin_sound_enabled';

export type Cue =
  | 'ignite'
  | 'riser'
  | 'select'
  | 'lock'
  | 'phaseComplete'
  | 'breakOver';

/* Per-cue volume. A single shared level would make `select` — which fires on
   every tap — grating next to the ignition hit. */
const CUE_CONFIG: Record<Cue, { file: string; volume: number }> = {
  ignite: { file: '/sounds/ignite.mp3', volume: 0.55 },
  riser: { file: '/sounds/riser.mp3', volume: 0.40 },
  select: { file: '/sounds/select.mp3', volume: 0.22 },
  lock: { file: '/sounds/lock.mp3', volume: 0.50 },
  phaseComplete: { file: '/sounds/phase-complete.mp3', volume: 0.60 },
  breakOver: { file: '/sounds/break-over.mp3', volume: 0.55 },
};

/** Read the stored preference. Defaults to off — never surprise anyone with sound. */
export const getSoundPreference = (): boolean => {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) === 'true';
  } catch {
    return false;
  }
};

/* Seeded at module load. Onboarding's sound gate is the only thing that *sets*
   the preference, so without this every reload would silently mute Pomodoro. */
let enabled = getSoundPreference();

const cache = new Map<Cue, HTMLAudioElement>();

const create = (cue: Cue): HTMLAudioElement | null => {
  try {
    const { file, volume } = CUE_CONFIG[cue];
    const el = new Audio(file);
    el.volume = volume;
    el.preload = 'auto';
    // A missing file surfaces here; swallow it so nothing bubbles to the UI.
    el.addEventListener('error', () => { /* file absent — cue is a no-op */ });
    return el;
  } catch {
    return null;
  }
};

/**
 * Enable or disable cues. Playback additionally requires that the page has
 * seen a real user gesture — the onboarding sound gate, or simply pressing
 * Start on a timer, both satisfy that well before any cue needs to fire.
 * Enabling also warms the cache so the first cue isn't late.
 */
export const setSoundEnabled = (next: boolean) => {
  enabled = next;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, String(next));
  } catch {
    // Private/hardened modes can refuse writes; the in-memory flag still works.
  }

  if (!next) {
    stopAll();
    return;
  }

  (Object.keys(CUE_CONFIG) as Cue[]).forEach(cue => {
    if (cache.has(cue)) return;
    const el = create(cue);
    if (el) {
      cache.set(cue, el);
      try { el.load(); } catch { /* preload is best-effort */ }
    }
  });
};

export const isSoundEnabled = () => enabled;

/** Fire a cue. Silent no-op when disabled, unsupported, or the file is absent. */
export const play = (cue: Cue) => {
  if (!enabled) return;
  try {
    let el = cache.get(cue);
    if (!el) {
      el = create(cue) ?? undefined;
      if (!el) return;
      cache.set(cue, el);
    }
    el.currentTime = 0;
    // play() rejects on autoplay block or a failed load — both are fine.
    void el.play().catch(() => { /* cue skipped */ });
  } catch {
    /* cue skipped */
  }
};

export const stopAll = () => {
  cache.forEach(el => {
    try {
      el.pause();
      el.currentTime = 0;
    } catch {
      /* nothing to stop */
    }
  });
};

export const ignite = () => play('ignite');
export const riser = () => play('riser');
export const select = () => play('select');
export const lock = () => play('lock');
export const phaseComplete = () => play('phaseComplete');
export const breakOver = () => play('breakOver');
