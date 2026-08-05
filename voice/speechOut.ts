/* ── Spoken replies ──
   A thin wrapper over the browser's SpeechSynthesis. Same hard rule as audio.ts
   and speech.ts: this is an accessory. A browser without the API, a missing
   voice, or an utterance that never fires `onend` must degrade to silence and
   nothing else.

   The important detail is not the speaking — it's that the microphone is still
   open while we talk. Whatever the app says would otherwise be transcribed
   straight back in as a command, so callers pause the listener around output
   (see `speak`'s onStart/onDone). */

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
let cachedVoice: SpeechSynthesisVoice | null | undefined;

const pickVoice = (): SpeechSynthesisVoice | null => {
  if (cachedVoice !== undefined) return cachedVoice;
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = window.speechSynthesis.getVoices();
  } catch {
    voices = [];
  }
  if (!voices.length) return null; // not ready yet — try again next time

  // Match the recognition side: Indian English first, then other English.
  cachedVoice =
    voices.find(v => v.lang === 'en-IN') ||
    voices.find(v => v.lang?.startsWith('en-IN')) ||
    voices.find(v => v.lang === 'en-GB') ||
    voices.find(v => v.lang?.startsWith('en')) ||
    null;
  return cachedVoice;
};

if (isSpeechOutSupported()) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = undefined;
      pickVoice();
    };
  } catch {
    /* voice list stays whatever the first lookup found */
  }
}

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

/** Stop any in-progress speech and release the caller's pause immediately. */
export const cancelSpeech = () => {
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* nothing playing */
  }
  settle();
};

/**
 * Speak a line. Silent no-op when unsupported or when the text is empty.
 *
 * `onDone` is guaranteed to run even if the engine never reports finishing —
 * Chrome drops `onend` often enough that leaving the mic paused on its word
 * would strand voice control entirely.
 */
export const speak = (message: string, options: SpeakOptions = {}) => {
  const text = toSpeech(message);
  if (!isSpeechOutSupported() || !text) {
    options.onDone?.();
    return;
  }

  // Whatever was queued is stale the moment a new command lands.
  cancelSpeech();

  let utterance: SpeechSynthesisUtterance;
  try {
    utterance = new window.SpeechSynthesisUtterance(text);
  } catch {
    options.onDone?.();
    return;
  }

  const voice = pickVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'en-IN';
  }
  utterance.rate = 1.05;
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
