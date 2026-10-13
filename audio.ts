/* ── Sound ──
   The app's one sound player, on Web Audio. What each sound is lives in
   sound/cues.ts; the files are made by film/scripts/render-sfx.ts.

   Why Web Audio rather than one <audio> per cue: a desktop student rates
   flashcards with 1–4 faster than an <audio> element can rewind, so the same
   sound has to be able to overlap itself; a combo has to be able to change
   pitch; and once a context is unlocked by one gesture it can play for the
   rest of the session without another. That last one matters most — the pack
   opening and the Pomodoro bell fire long after the click that caused them.

   Hard rule, unchanged: audio is decoration. A missing file, a refused
   context, a browser with no Web Audio — every path here fails silently and
   nothing waits on it.

   Never call into this from inside a setState updater. StrictMode runs those
   twice in development, and a sound is a side effect. */

import { CUES, CUE_IDS, cueFile, type Cue, type CueGroup } from './sound/cues';

export type { Cue };

export const SOUND_PREF_KEY = 'lockin_sound_enabled';
export const SOUND_VOLUME_KEY = 'lockin_sound_volume';

const DEFAULT_VOLUME = 0.7;
/** Two plays of one cue closer than this are one press bouncing. */
const DEBOUNCE_MS = 40;
/** Voices beyond this steal the oldest. Six is a chord plus a combo. */
const MAX_VOICES = 6;
/** A cue whose file is still loading plays if it arrives within this, else
 *  it is dropped — a "correct" ding half a second late is worse than none. */
const DEFAULT_LATE_MS = 250;
/** The first sound of a visit waits for the output device to start, which
 *  takes a few hundred milliseconds on a laptop. It gets more slack: it is
 *  the answer to the click that woke everything up. */
const UNLOCK_LATE_MS = 700;
/** The most a decode-time trim may skip: AAC's encoder delay, measured at
 *  42 ms mono and 65 ms stereo for these files, plus a little. */
const MAX_LEAD_S = 0.07;

/* ── Preferences ── device-local, never in AppState: whether this laptop is
   in a library is not something the phone should inherit. */

/** On unless this device was told otherwise. The onboarding gate's "Continue
 *  silently" and the mute button are the only things that write 'false'. */
export const getSoundPreference = (): boolean => {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
};

const readVolume = (): number => {
  try {
    const raw = window.localStorage.getItem(SOUND_VOLUME_KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
};

let enabled = typeof window === 'undefined' ? false : getSoundPreference();
let volume = typeof window === 'undefined' ? DEFAULT_VOLUME : readVolume();

/* ── Subscribers ── a module-level set, like notify/toastBus: the header and
   the settings row read this without a context re-rendering the app. */

export interface SoundSnapshot {
  enabled: boolean;
  volume: number;
}
let snapshot: SoundSnapshot = { enabled, volume };
const listeners = new Set<() => void>();

export const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const getSnapshot = () => snapshot;
const emit = () => {
  snapshot = { enabled, volume };
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      /* a listener's problem, not the sound's */
    }
  });
};

/* ── The context ── created on the first gesture, never before: a context
   made without one starts suspended and Chrome logs a warning for it. */

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;

/** The slider is linear; loudness is not. Squaring makes the middle of the
 *  slider sound like the middle. */
const curve = (v: number) => v * v;

const ensureContext = (): Ctx | null => {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = curve(volume);
    master.connect(ctx.destination);
    ctx.addEventListener?.('statechange', () => {
      if (ctx?.state === 'running') armAll();
    });
    return ctx;
  } catch {
    ctx = null;
    return null;
  }
};

const isRunning = () => !!ctx && ctx.state === 'running';

let resuming: Promise<void> | null = null;

/** Start (or restart) the context. Returns a promise that settles when it is
 *  running, or null when there is nothing to wait for. */
const resume = (): Promise<void> | null => {
  const c = ensureContext();
  if (!c || c.state === 'running') return null;
  if (resuming) return resuming;
  try {
    resuming = c
      .resume()
      .then(armAll, () => { /* refused: try again on the next gesture */ })
      .finally(() => { resuming = null; });
    return resuming;
  } catch {
    return null;
  }
};

/* ── Buffers ── */

interface Entry {
  buffer: AudioBuffer;
  /** Where the sound actually starts. AAC carries ~2,112 samples of encoder
   *  delay before the first one; skipping it is what makes a tap land on the
   *  press instead of 45 ms after it. */
  offset: number;
}

const buffers = new Map<Cue, Entry>();
const loading = new Map<Cue, Promise<Entry | null>>();
/* The core files' bytes, fetched while the page is idle — before any gesture,
   which decoding needs but fetching does not. Without this, the very first
   sound of a visit (usually Start) waited on the network and arrived late. */
const bytes = new Map<Cue, Promise<ArrayBuffer | null>>();

const fetchBytes = (cue: Cue): Promise<ArrayBuffer | null> => {
  const have = bytes.get(cue);
  if (have) return have;
  const p = fetch(cueFile(cue))
    .then(r => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  bytes.set(cue, p);
  return p;
};

const leadIn = (b: AudioBuffer): number => {
  const threshold = 0.003; // about −50 dB
  let first = b.length;
  for (let c = 0; c < b.numberOfChannels; c++) {
    const data = b.getChannelData(c);
    for (let i = 0; i < Math.min(first, data.length); i++) {
      if (Math.abs(data[i]) > threshold) {
        first = i;
        break;
      }
    }
  }
  if (first >= b.length) return 0;
  // A few samples of run-up so the attack is not shaved. Capped at the
  // encoder delay: a cue that opens on a quiet riser has real sound under the
  // threshold, and scanning alone would cut the first quarter-second of it.
  return Math.min(MAX_LEAD_S, Math.max(0, first - 32) / b.sampleRate);
};

const load = (cue: Cue): Promise<Entry | null> => {
  const have = buffers.get(cue);
  if (have) return Promise.resolve(have);
  const pending = loading.get(cue);
  if (pending) return pending;
  const c = ensureContext();
  if (!c) return Promise.resolve(null);
  const p = fetchBytes(cue)
    .then(ab => {
      // decodeAudioData detaches the buffer, so the bytes are used once.
      bytes.delete(cue);
      return ab ? c.decodeAudioData(ab) : Promise.reject(new Error('missing'));
    })
    .then(buffer => {
      const entry = { buffer, offset: leadIn(buffer) };
      buffers.set(cue, entry);
      return entry;
    })
    .catch(() => null)
    .finally(() => loading.delete(cue));
  loading.set(cue, p);
  return p;
};

/** Fetch a group (or a list of cues) ahead of need. Needs the context, so
 *  before the first gesture it quietly does nothing — the gesture will. */
export const preload = (what: CueGroup | Cue[]) => {
  if (!enabled || !ctx) {
    if (typeof what === 'string') wantedGroups.add(what);
    return;
  }
  const ids = typeof what === 'string' ? CUE_IDS.filter(id => CUES[id].group === what) : what;
  ids.forEach(id => void load(id));
};

/** Groups asked for before there was a context to load them into. */
const wantedGroups = new Set<CueGroup>(['core']);
const flushWanted = () => {
  const groups = [...wantedGroups];
  wantedGroups.clear();
  const run = () => groups.forEach(g => preload(g));
  const ric = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric.call(window, run, { timeout: 2000 });
  else window.setTimeout(run, 300);
};

/* ── Voices ── */

interface Voice {
  cue: Cue;
  src: AudioBufferSourceNode;
  gain: GainNode;
}
const voices: Voice[] = [];
const lastPlayed = new Map<Cue, number>();

const release = (v: Voice) => {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, 0.012);
    v.src.stop(t + 0.06);
  } catch {
    /* already stopped */
  }
};

const startVoice = (cue: Cue, entry: Entry, semitones: number, gainMul: number, when = 0): Voice | null => {
  if (!ctx || !master) return null;
  try {
    const def = CUES[cue];
    if (def.choke) voices.filter(v => v.cue === cue).forEach(release);
    while (voices.length >= MAX_VOICES) {
      const oldest = voices.shift();
      if (oldest) release(oldest);
    }
    const src = ctx.createBufferSource();
    src.buffer = entry.buffer;
    src.playbackRate.value = Math.pow(2, semitones / 12);
    const gain = ctx.createGain();
    gain.gain.value = def.gain * gainMul;
    src.connect(gain);
    gain.connect(master);
    const voice: Voice = { cue, src, gain };
    src.onended = () => {
      const i = voices.indexOf(voice);
      if (i >= 0) voices.splice(i, 1);
      try {
        gain.disconnect();
      } catch {
        /* gone */
      }
    };
    src.start(when || ctx.currentTime, entry.offset);
    voices.push(voice);
    return voice;
  } catch {
    return null;
  }
};

export interface PlayOptions {
  /** Shift by semitones (the combo). Use `comboSemitones` from sound/cues. */
  semitones?: number;
  /** Extra gain on top of the catalog's, 0–1. */
  gain?: number;
  /** How late a still-loading cue may be and still play, in ms. */
  late?: number;
}

/** Fire a cue. Silent no-op when disabled, locked, hidden, or missing. */
export const play = (cue: Cue, opts: PlayOptions = {}) => {
  if (!enabled || typeof window === 'undefined') return;
  const def = CUES[cue];
  if (!def) return;
  // A tab nobody is looking at stays quiet, except for the bell it was left to ring.
  if (document.hidden && !def.background) return;
  // Not running yet: usually the very click that is unlocking it, whose
  // resume is still in flight. Wait for that, within the same lateness.
  if (!isRunning()) {
    const waiting = ctx ? resume() : null;
    if (!waiting) return;
    const asked = performance.now();
    lastPlayed.set(cue, asked);
    // Decode while the output device spins up; the two take about as long.
    void Promise.all([waiting, load(cue)]).then(([, e]) => {
      const late = Math.max(opts.late ?? DEFAULT_LATE_MS, UNLOCK_LATE_MS);
      if (e && enabled && isRunning() && performance.now() - asked <= late) startVoice(cue, e, opts.semitones ?? 0, opts.gain ?? 1);
    });
    return;
  }

  const now = performance.now();
  if (now - (lastPlayed.get(cue) ?? -Infinity) < DEBOUNCE_MS) return;
  lastPlayed.set(cue, now);

  const semitones = opts.semitones ?? 0;
  const gainMul = opts.gain ?? 1;
  const entry = buffers.get(cue);
  if (entry) {
    startVoice(cue, entry, semitones, gainMul);
    return;
  }
  const late = opts.late ?? DEFAULT_LATE_MS;
  void load(cue).then(e => {
    if (e && enabled && performance.now() - now <= late) startVoice(cue, e, semitones, gainMul);
  });
};

export const stopAll = () => {
  [...voices].forEach(release);
  voices.length = 0;
};

/* ── Scheduling ──
   A sound placed on the audio clock in advance. For the Pomodoro bell on a
   desktop: Chrome throttles timers in a tab hidden for five minutes to once a
   minute, so a bell left to a setTimeout can ring up to a minute late. The
   audio clock is not throttled. Each schedule is an intent; it is (re)armed
   whenever the context becomes able to play, so a block started before the
   first gesture of a reloaded page still rings on time once one happens. */

interface Intent {
  cue: Cue;
  epochMs: number;
  voice: Voice | null;
  /** Audio-clock time the voice starts at. */
  at: number;
}
const intents = new Map<string, Intent>();

const arm = (key: string) => {
  const it = intents.get(key);
  if (!it || it.voice || !enabled || !isRunning() || !ctx) return;
  const delay = (it.epochMs - Date.now()) / 1000;
  // Too close to bother: the ordinary path will ring it.
  if (delay < 0.1) return;
  void load(it.cue).then(entry => {
    const cur = intents.get(key);
    if (!entry || !ctx || cur !== it || it.voice || !enabled) return;
    const d = (it.epochMs - Date.now()) / 1000;
    if (d < 0.1) return;
    it.at = ctx.currentTime + d;
    it.voice = startVoice(it.cue, entry, 0, 1, it.at);
  });
};

function armAll() {
  if (!isRunning()) return;
  intents.forEach((_, key) => arm(key));
  if (wantedGroups.size) flushWanted();
}

const disarm = (it: Intent) => {
  if (!it.voice || !ctx) return;
  // Already ringing: let it finish.
  if (ctx.currentTime >= it.at) return;
  try {
    it.voice.src.stop();
  } catch {
    /* not started */
  }
  it.voice = null;
};

/** Ring `cue` at wall-clock `epochMs`. Replaces any schedule under `key`. */
export const scheduleAt = (cue: Cue, epochMs: number, key: string) => {
  const prev = intents.get(key);
  if (prev) {
    if (prev.cue === cue && prev.epochMs === epochMs) return;
    disarm(prev);
  }
  intents.set(key, { cue, epochMs, voice: null, at: 0 });
  arm(key);
};

/** Withdraw a schedule that has not started. One already ringing is left to finish. */
export const cancelScheduled = (key: string) => {
  const it = intents.get(key);
  if (!it) return;
  disarm(it);
  intents.delete(key);
};

/**
 * The moment has arrived through the ordinary path. Returns true if the
 * scheduled sound has rung (or is about to), so the caller must not ring it
 * again. If it has not — the clock stopped while the laptop slept — it is
 * withdrawn and false is returned, so the caller rings it now.
 */
export const claimScheduled = (key: string): boolean => {
  const it = intents.get(key);
  intents.delete(key);
  if (!it?.voice || !ctx) return false;
  if (ctx.currentTime >= it.at - 0.25) return true;
  disarm(it);
  return false;
};

/* ── Switches ── */

/**
 * Enable or disable sound on this device. Called from a click, which is the
 * gesture that unlocks the context, so enabling also starts the context and
 * the core download.
 */
export const setSoundEnabled = (next: boolean) => {
  enabled = next;
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, String(next));
  } catch {
    // Private and hardened modes can refuse writes; the in-memory flag still works.
  }
  if (!next) {
    stopAll();
    intents.forEach(disarm);
  } else {
    wantedGroups.add('core');
    wantedGroups.add('onboarding');
    resume();
    if (isRunning()) armAll();
  }
  emit();
};

/** The mute button and `M`. Turning sound on answers with a tap, so you know it worked. */
export const toggleSound = () => {
  setSoundEnabled(!enabled);
  if (enabled) play('tap');
};

export const isSoundEnabled = () => enabled;

/** Whether a sound asked for right now would actually be heard. */
export const canPlayNow = () => enabled && isRunning();

export const setVolume = (v: number) => {
  volume = Math.max(0, Math.min(1, v));
  try {
    window.localStorage.setItem(SOUND_VOLUME_KEY, String(Math.round(volume * 100) / 100));
  } catch {
    /* in-memory only */
  }
  if (master && ctx) {
    try {
      master.gain.setTargetAtTime(curve(volume), ctx.currentTime, 0.02);
    } catch {
      master.gain.value = curve(volume);
    }
  }
  emit();
};

export const getVolume = () => volume;

/** For the `?sfx=debug` page: decode a cue and report what came back. */
export const inspect = async (cue: Cue) => {
  const e = await load(cue);
  return e ? { seconds: e.buffer.duration, offset: e.offset, channels: e.buffer.numberOfChannels, rate: e.buffer.sampleRate } : null;
};

/** For the `?sfx=debug` page. */
export const contextState = () => ctx?.state ?? 'none';

/* ── Unlock ── the first press or key anywhere starts the context. Listeners
   stay until it is actually running: some browsers refuse the first resume. */

const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;
const onGesture = () => {
  if (!enabled) return;
  resume();
  if (isRunning()) {
    UNLOCK_EVENTS.forEach(e => window.removeEventListener(e, onGesture, true));
    armAll();
  }
};
if (typeof window !== 'undefined') {
  UNLOCK_EVENTS.forEach(e => window.addEventListener(e, onGesture, true));
}

let prefetched = false;
/**
 * Fetch the core sounds' bytes ahead of the first gesture. App calls this once
 * the app itself is on screen — never from the landing page, where most
 * visitors are reading, not studying, and 150 kB of sounds they may never hear
 * would be a tax on a page whose whole job is to load fast.
 */
export const prefetchCore = () => {
  if (prefetched || typeof window === 'undefined') return;
  prefetched = true;
  const run = () => {
    if (!enabled) {
      prefetched = false;
      return;
    }
    CUE_IDS.filter(id => CUES[id].group === 'core').forEach(id => void fetchBytes(id));
  };
  const ric = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  // After the app has booted, never in its way.
  window.setTimeout(() => (ric ? ric.call(window, run, { timeout: 4000 }) : run()), 1500);
};

/**
 * Download cues' bytes before there is an audio context to decode them into
 * (no gesture yet). The onboarding gate calls this so the cold open's score
 * arrives while the student is reading, not after they tap.
 */
export const prefetch = (cues: Cue[]) => {
  if (typeof window === 'undefined') return;
  cues.forEach(id => void fetchBytes(id));
};

/**
 * Resolves true once a cue is decoded and can start on the dot, or false after
 * `ms`. For sound that has to line up with something else: the cold open waits
 * on this before it starts the film, so the score and the picture begin
 * together instead of the score being dropped as late.
 */
export const ready = (cue: Cue, ms: number): Promise<boolean> =>
  Promise.race([
    load(cue).then(e => !!e).catch(() => false),
    new Promise<boolean>(resolve => window.setTimeout(() => resolve(false), ms)),
  ]);

/* ── The original cue names, kept so existing callers need not change ── */

export const ignite = () => play('ignite', { late: 600 });
export const riser = () => play('riser', { late: 400 });
export const select = () => play('tap');
export const lock = () => play('lock', { late: 400 });
export const phaseComplete = () => play('block-done', { late: 1500 });
export const breakOver = () => play('break-over', { late: 1500 });
