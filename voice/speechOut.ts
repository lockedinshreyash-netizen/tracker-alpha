/* ── Spoken replies ──
   A thin wrapper over the browser's SpeechSynthesis. Same hard rule as audio.ts
   and speech.ts: this is an accessory. A browser without the API, a missing
   voice, or an utterance that never fires `onend` must degrade to silence and
   nothing else.

   The important detail is not the speaking — it's that the microphone is still
   open while we talk. Whatever the app says would otherwise be transcribed
   straight back in as a command, so callers pause the listener around output
   (see `speak`'s onStart/onDone). */

import { playClip, prefetchCommonClips, stopClip } from './clips';

export { prefetchCommonClips };

export const SPEAK_PREF_KEY = 'lockin_voice_speak';

export const isSpeechOutSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

/** Spoken replies are on by default — the app only talks after you talk to it. */
export const getSpeakPreference = (): boolean => {
  try {
    return window.localStorage.getItem(SPEAK_PREF_KEY) !== 'false';
  } catch {
    return true;
  }
};

export const setSpeakPreference = (next: boolean) => {
  try {
    window.localStorage.setItem(SPEAK_PREF_KEY, String(next));
  } catch {
    // Private/hardened modes can refuse writes; the session flag still applies.
  }
};

/* Voices populate asynchronously in Chrome, so the first lookup often returns
   an empty list. Cache once they arrive. */
export const VOICE_NAME_KEY = 'lockin_voice_name';

/* macOS ships a pile of joke voices, and "any English voice" is how you end up
   being read your study stats by a robot called Zarvox. These never appear. */
const NOVELTY = new Set([
  'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'fred',
  'good news', 'jester', 'junior', 'kathy', 'organ', 'ralph', 'superstar',
  'trinoids', 'whisper', 'wobble', 'zarvox', 'princess', 'deranged', 'hysterical',
]);

/* Higher is better. The one thing that matters: never pick by locale alone.
   Matching the recognition locale sounds like the right instinct and is not —
   on a Mac the only en-IN voice is Rishi, a legacy formant voice that sounds
   robotic next to almost anything else installed. */
const qualityScore = (voice: SpeechSynthesisVoice): number => {
  const name = voice.name.toLowerCase();

  // Chrome's server-rendered voices, and Edge/Windows neural voices.
  if (name.startsWith('google')) return 100;
  if (/natural|neural|online/.test(name)) return 95;
  if (name.startsWith('microsoft')) return 70;

  // The decent local voices, in rough order of how natural they sound.
  const LOCAL_GOOD = ['samantha', 'serena', 'daniel', 'karen', 'moira', 'tessa', 'fiona', 'alex', 'allison', 'ava', 'susan', 'tom'];
  const idx = LOCAL_GOOD.findIndex(good => name.startsWith(good));
  if (idx >= 0) return 60 - idx;

  // Newer macOS "casual" voices — usable, but not something to land on by default.
  if (/\(english/.test(name)) return 20;

  return 30;
};

/** Locale tie-break only, once quality is equal. */
const langScore = (lang: string = ''): number => {
  const order = ['en-gb', 'en-us', 'en-au', 'en-ie', 'en-in', 'en-za'];
  const i = order.indexOf(lang.toLowerCase());
  return i < 0 ? 0 : order.length - i;
};

const allVoices = (): SpeechSynthesisVoice[] => {
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
};

/** Selectable English voices, best first. Novelty voices are dropped entirely. */
export const listVoices = (): SpeechSynthesisVoice[] =>
  allVoices()
    .filter(v => v.lang?.toLowerCase().startsWith('en'))
    .filter(v => !NOVELTY.has(v.name.toLowerCase()))
    .sort((a, b) => (qualityScore(b) - qualityScore(a)) || (langScore(b.lang) - langScore(a.lang)) || a.name.localeCompare(b.name));

export const getPreferredVoiceName = (): string => {
  try {
    return window.localStorage.getItem(VOICE_NAME_KEY) || '';
  } catch {
    return '';
  }
};

export const setPreferredVoiceName = (name: string) => {
  try {
    window.localStorage.setItem(VOICE_NAME_KEY, name);
  } catch {
    /* preference just won't persist */
  }
};

/** The user's pick if it's still installed, otherwise the best available. */
const resolveVoice = (): SpeechSynthesisVoice | null => {
  const ranked = listVoices();
  if (!ranked.length) return null; // list not populated yet — try again next call
  const preferred = getPreferredVoiceName();
  return (preferred && ranked.find(v => v.name === preferred)) || ranked[0];
};

/**
 * The on-screen copy is deliberately shouted and abbreviated ("DAILY TARGET:
 * 12H."). Read aloud verbatim that becomes "twelve h", so rewrite the few
 * patterns the app actually produces into something sayable.
 */
export const toSpeech = (message: string): string => {
  let text = message;

  // Letters, not a word — "J E E" reads correctly, "JEE" does not.
  text = text.replace(/\bJEE\b/g, 'J E E');

  text = text
    .replace(/[“”]/g, '')
    .replace(/[’]/g, "'")
    .replace(/→/g, ' is now ')
    .replace(/&/g, ' and ')
    .replace(/\bLOCK-IN\b/gi, 'lock in')
    // "31/100" → "31 out of 100"
    .replace(/(\d+)\s*\/\s*(\d+)/g, '$1 out of $2')
    // "+20 PHYSICS QUESTIONS" → "added 20 physics questions"
    .replace(/^\+\s*(\d)/, 'added $1')
    // "12H" / "2.5H" → "12 hours" / "2.5 hours"
    .replace(/(\d+(?:\.\d+)?)\s*H\b/g, (_m, n: string) => `${n} ${parseFloat(n) === 1 ? 'hour' : 'hours'}`);

  // Lowercase last: some engines spell out all-caps tokens letter by letter.
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
};

interface SpeakOptions {
  /** Fires just before audio starts — pause the microphone here. */
  onStart?: () => void;
  /** Always fires exactly once: on end, on error, or via the watchdog. */
  onDone?: () => void;
}

let activeDone: (() => void) | null = null;
let watchdog: number | null = null;

const settle = () => {
  if (watchdog !== null) {
    window.clearTimeout(watchdog);
    watchdog = null;
  }
  const done = activeDone;
  activeDone = null;
  if (done) done();
};

/* Bumped on every new request so a clip that loads after the user has moved on
   can't start playing over the top of a newer reply. */
let speakToken = 0;

/** Stop any in-progress speech and release the caller's pause immediately. */
export const cancelSpeech = () => {
  speakToken++;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* nothing playing */
  }
  stopClip();
  settle();
};

/**
 * Speak a line.
 *
 * Tries the pre-rendered clip for this message first — that is the good voice,
 * and it plays immediately with no synthesis. Anything without a clip (task
 * names and other free-form text) falls back to the browser's own voice.
 *
 * `onDone` is guaranteed to run even if the engine never reports finishing —
 * Chrome drops `onend` often enough that leaving the mic paused on its word
 * would strand voice control entirely.
 */
export const speak = (message: string, options: SpeakOptions = {}) => {
  const text = toSpeech(message);
  if (!text) {
    options.onDone?.();
    return;
  }

  // Whatever was queued is stale the moment a new command lands.
  cancelSpeech();
  const token = speakToken;

  /* Registered before playback can possibly end, so there is no window in which
     the clip finishes and finds nothing to release the microphone with. */
  activeDone = options.onDone ?? null;

  void playClip(message, {
    onStart: options.onStart,
    onDone: () => {
      if (token !== speakToken) return;
      settle();
    },
  }).then(result => {
    if (token !== speakToken) return;
    if (result === 'playing') {
      // A stalled element still needs a backstop; clips are only seconds long.
      watchdog = window.setTimeout(settle, 15000);
      return;
    }
    if (result === 'silent') {
      // Deliberately says nothing — release the microphone straight away.
      settle();
      return;
    }
    // Unrecognised message — hand ownership to the browser's own voice.
    activeDone = null;
    speakWithSystem(text, options);
  });
};

const speakWithSystem = (text: string, options: SpeakOptions) => {
  if (!isSpeechOutSupported()) {
    options.onDone?.();
    return;
  }

  let utterance: SpeechSynthesisUtterance;
  try {
    utterance = new window.SpeechSynthesisUtterance(text);
  } catch {
    options.onDone?.();
    return;
  }

  const voice = resolveVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  // Left at natural defaults — pushing rate or pitch is what makes a decent
  // voice sound synthetic.
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  activeDone = options.onDone ?? null;
  utterance.onend = settle;
  utterance.onerror = settle;

  /* Rough upper bound on how long this can take (~12 chars/second), plus
     headroom. If the engine goes quiet without telling us, this releases. */
  const budget = Math.min(15000, 1500 + text.length * 90);
  watchdog = window.setTimeout(settle, budget);

  try {
    options.onStart?.();
    window.speechSynthesis.speak(utterance);
  } catch {
    settle();
  }
};
