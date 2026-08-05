/* ── Voice input ──
   A thin wrapper over the browser's Web Speech API. No library: the whole
   surface we need is start/stop plus a transcript callback.

   Same hard rule as audio.ts — voice is an accessory input, never a
   dependency. An unsupported browser, a denied mic, or a dead speech service
   must degrade to "the button isn't there" or "a red line of text", never to a
   broken app. Every path below fails soft.

   Note on privacy: in Chrome/Edge this API streams audio to the browser
   vendor's speech service. Nothing is recorded or sent by this app itself, but
   the mic is not local-only, which is why it is strictly opt-in per session and
   never auto-starts on load. */

/* The DOM lib doesn't ship Web Speech types, so declare the slice we use. */
interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

const getCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

/** False on Firefox and most in-app browsers — callers should hide the UI. */
export const isVoiceSupported = (): boolean => getCtor() !== null;

export interface VoiceHandlers {
  /**
   * Fires for interim words too, so the UI can show speech as it lands.
   * `alternatives` holds the engine's ranked guesses for a final result, best
   * first — accented speech often puts the right words in a lower-ranked one.
   */
  onTranscript: (text: string, isFinal: boolean, alternatives?: string[]) => void;
  onListeningChange: (listening: boolean) => void;
  /** Only for failures worth showing; transient ones are swallowed. */
  onError: (message: string) => void;
}

export const VOICE_PREF_KEY = 'lockin_voice_enabled';

/** Whether the user has opted in to voice control. Defaults to off. */
export const getVoicePreference = (): boolean => {
  try {
    return window.localStorage.getItem(VOICE_PREF_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setVoicePreference = (next: boolean) => {
  try {
    window.localStorage.setItem(VOICE_PREF_KEY, String(next));
  } catch {
    // Private/hardened modes can refuse writes; the session still works.
  }
};

/**
 * Whether listening can resume on load without prompting.
 *
 * Only true when the mic was *already* granted for this origin — reopening the
 * app must never raise a permission prompt on its own, and a prompt shown
 * without a click would be dismissed by the browser anyway.
 */
export const canResumeWithoutPrompt = async (): Promise<boolean> => {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted';
  } catch {
    // Safari has no permissions query for the mic. Don't guess — wait for a tap.
    return false;
  }
};

const ERROR_COPY: Record<string, string> = {
  'not-allowed': 'MIC BLOCKED. ALLOW MICROPHONE ACCESS FOR THIS SITE.',
  'service-not-allowed': 'MIC BLOCKED BY THE BROWSER.',
  'audio-capture': 'NO MICROPHONE DETECTED.',
  network: 'SPEECH SERVICE UNREACHABLE.',
};

/* Errors that mean "stop trying" rather than "try again". */
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/**
 * A single continuous listening session.
 *
 * Chrome ends recognition on its own after a stretch of silence even with
 * `continuous = true`, so `onend` restarts it for as long as the user still
 * wants the mic on. Restarts are counted and backed off, so a permanently
 * failing service can't turn into a hot loop.
 */
export class VoiceListener {
  private recognition: SpeechRecognitionLike | null = null;
  private wantsToListen = false;
  private restarts = 0;
  private restartTimer: number | null = null;
  /* Highest index in the current session's cumulative results list that has
     already been reported as final. See the note in `onresult`. */
  private finalizedUpTo = -1;

  constructor(private handlers: VoiceHandlers) { }

  start() {
    if (this.wantsToListen) return;
    const Ctor = getCtor();
    if (!Ctor) {
      this.handlers.onError('VOICE INPUT ISN\'T SUPPORTED IN THIS BROWSER.');
      return;
    }

    this.wantsToListen = true;
    this.restarts = 0;
    this.spinUp(Ctor);
  }

  stop() {
    this.wantsToListen = false;
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.teardown();
    this.handlers.onListeningChange(false);
  }

  /* Detach before aborting: a discarded instance still fires `onend`
     asynchronously, and if the user has already toggled the mic back on that
     late event would report the *new* session as stopped. */
  private teardown() {
    const rec = this.recognition;
    this.recognition = null;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    rec.onstart = null;
    try {
      rec.abort();
    } catch {
      /* already torn down */
    }
  }

  get isListening() {
    return this.wantsToListen;
  }

  private spinUp(Ctor: RecognitionCtor) {
    this.teardown();

    let rec: SpeechRecognitionLike;
    try {
      rec = new Ctor();
    } catch {
      this.wantsToListen = false;
      this.handlers.onError('VOICE INPUT FAILED TO START.');
      this.handlers.onListeningChange(false);
      return;
    }

    // Indian English — the vocabulary here is subject names spoken by JEE/NEET
    // aspirants, and en-US mangles them noticeably more.
    rec.lang = 'en-IN';
    rec.continuous = true;
    rec.interimResults = true;
    // Extra guesses cost nothing and are the single biggest accuracy win for
    // accented speech — the parser tries each one.
    rec.maxAlternatives = 5;

    rec.onstart = () => {
      this.restarts = 0;
      // A restart begins a fresh results list, so the dedupe cursor resets too.
      this.finalizedUpTo = -1;
      this.handlers.onListeningChange(true);
    };

    rec.onresult = (event) => {
      /* `event.results` is cumulative for the whole session, and Chrome fires
         this handler with `resultIndex` pinned at 0 while an utterance grows.
         Trusting resultIndex therefore re-delivers results that were already
         final — which duplicated every non-idempotent command ("add task X"
         landed once per event). Track what has actually been reported instead. */
      let latestInterim = '';

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = (result[0]?.transcript ?? '').trim();
        if (!text) continue;

        if (!result.isFinal) {
          latestInterim = text;
          continue;
        }
        if (i <= this.finalizedUpTo) continue;
        this.finalizedUpTo = i;

        const alternatives: string[] = [];
        for (let a = 0; a < result.length; a++) {
          const alt = (result[a]?.transcript ?? '').trim();
          if (alt && !alternatives.includes(alt)) alternatives.push(alt);
        }
        this.handlers.onTranscript(text, true, alternatives);
      }

      if (latestInterim) this.handlers.onTranscript(latestInterim, false);
    };

    rec.onerror = (event) => {
      // Silence and self-aborts are normal punctuation in a long session.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (FATAL.has(event.error)) {
        this.wantsToListen = false;
        this.handlers.onError(ERROR_COPY[event.error] || 'VOICE INPUT FAILED.');
        return;
      }
      this.handlers.onError(ERROR_COPY[event.error] || 'VOICE INPUT HICCUPED. STILL LISTENING.');
    };

    rec.onend = () => {
      this.handlers.onListeningChange(false);
      if (!this.wantsToListen) return;

      // Immediate repeated ends mean something is wrong, not that the user
      // went quiet — back off, then give up rather than loop forever.
      this.restarts += 1;
      if (this.restarts > 8) {
        this.wantsToListen = false;
        this.handlers.onError('VOICE INPUT KEEPS DROPPING. TAP TO TRY AGAIN.');
        return;
      }
      const delay = Math.min(1000, 100 * this.restarts);
      this.restartTimer = window.setTimeout(() => {
        this.restartTimer = null;
        if (!this.wantsToListen) return;
        try {
          rec.start();
        } catch {
          // Already started, or the engine is wedged — rebuild from scratch.
          const Fresh = getCtor();
          if (Fresh) this.spinUp(Fresh);
        }
      }, delay);
    };

    this.recognition = rec;
    try {
      rec.start();
    } catch {
      this.wantsToListen = false;
      this.handlers.onError('VOICE INPUT FAILED TO START.');
      this.handlers.onListeningChange(false);
    }
  }
}
