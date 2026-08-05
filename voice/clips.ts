/* ── Clip playback ──
   Spoken replies are pre-rendered AAC files (see scripts/generate-voice.ts), so
   speaking is a cached HTTP fetch and an <audio> play — no model in the browser,
   no synthesis wait, and the same voice on every device.

   Clips are served from CLIP_BASE_URL. That points at the app's own /voice
   folder by default and can be redirected to Supabase Storage (or any CDN) with
   VITE_VOICE_CLIP_URL, so the audio can be updated without redeploying.

   Any miss — clip not generated yet, bucket unreachable, decode failure —
   returns false so the caller falls back to the browser's own voice. */

import { resolveClip } from './clipManifest';

const CONFIGURED = (import.meta as { env?: Record<string, string> }).env?.VITE_VOICE_CLIP_URL;

/** No trailing slash. */
export const CLIP_BASE_URL = (CONFIGURED || '/voice').replace(/\/+$/, '');

export const clipUrl = (id: string) => `${CLIP_BASE_URL}/${id}.m4a`;

/* Ids that 404'd once. Retrying them on every reply would add a failed request
   before every fallback. */
const missing = new Set<string>();

let current: HTMLAudioElement | null = null;

export const stopClip = () => {
  if (!current) return;
  try {
    current.pause();
    current.onended = null;
    current.onerror = null;
  } catch {
    /* already stopped */
  }
  current = null;
};

export interface ClipPlayback {
  /** Fires once audio is actually about to sound — pause the mic here. */
  onStart?: () => void;
  onDone?: () => void;
}

export type PlayResult =
  /** Audio is playing; `onDone` will fire. */
  | 'playing'
  /** Deliberately says nothing. The caller must not fall back. */
  | 'silent'
  /** Nothing matched, or the file is absent — fall back to the browser voice. */
  | 'no-clip';

/**
 * Play the clip for a display message.
 *
 * `onDone` fires only for the 'playing' result.
 */
export const playClip = async (message: string, handlers: ClipPlayback = {}): Promise<PlayResult> => {
  const resolved = resolveClip(message);
  if (!resolved) return 'no-clip';
  // Answers are read off the screen, not out loud — see the manifest.
  if (resolved.kind === 'silent') return 'silent';
  if (missing.has(resolved.id)) return 'no-clip';

  const url = clipUrl(resolved.id);
  const audio = new Audio();
  audio.preload = 'auto';
  audio.src = url;

  /* Wait for enough data before starting, so onStart lines up with real audio
     and the microphone isn't muted during a silent network wait. */
  const ready = await new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    audio.oncanplaythrough = () => finish(true);
    audio.onerror = () => finish(false);
    // A slow network shouldn't hold a reply hostage; fall back instead.
    setTimeout(() => finish(false), 3000);
    audio.load();
  });

  if (!ready) {
    missing.add(resolved.id);
    return 'no-clip';
  }

  stopClip();
  current = audio;

  const done = () => {
    if (current !== audio) return;
    current = null;
    handlers.onDone?.();
  };
  audio.onended = done;
  audio.onerror = done;

  try {
    handlers.onStart?.();
    await audio.play();
  } catch {
    // Autoplay refusal or a decode error — release the caller's pause.
    current = null;
    handlers.onDone?.();
  }
  return 'playing';
};

/**
 * Warm the browser cache for clips the user is about to hear anyway.
 *
 * Called once when voice is switched on: these are the replies that show up in
 * nearly every session, and fetching them up front removes the only latency
 * this design still has — the very first play of each clip.
 */
export const prefetchCommonClips = () => {
  const common = [
    'listening', 'mic-off', 'nothing-running', 'session-already-running',
    'task-added', 'whats-the-task', 'unknown-command',
    'session-started-physics', 'session-started-chemistry', 'session-started-maths',
    'opened-today', 'opened-syllabus', 'opened-streak', 'opened-questions', 'opened-review',
  ];
  for (const id of common) {
    if (missing.has(id)) continue;
    // fetch() rather than <audio>: same cache, no decoder work, no playback risk.
    fetch(clipUrl(id), { mode: 'cors' }).catch(() => { /* best effort */ });
  }
};
