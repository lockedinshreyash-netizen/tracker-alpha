/* ── The YouTube IFrame Player API, loaded once, on the first play ──
   Nothing from YouTube is fetched until a student presses play: no script, no
   iframe, no thumbnail (Alpha draws its own faces). The script is the official
   one from youtube.com; the player it builds is pointed at
   youtube-nocookie.com, which sets no tracking cookie until a video plays.

   Only the slice of the API Alpha calls is typed here. There is no
   @types/youtube dependency, and the surface is small enough that writing it
   down is clearer than importing a few thousand lines of declarations. */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getAvailablePlaybackRates(): number[];
  destroy(): void;
}

export interface YTEvent<T = unknown> { target: YTPlayer; data: T }

export interface YTPlayerOptions {
  host?: string;
  videoId: string;
  width?: string | number;
  height?: string | number;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: YTEvent) => void;
    onStateChange?: (e: YTEvent<number>) => void;
    onPlaybackRateChange?: (e: YTEvent<number>) => void;
    onError?: (e: YTEvent<number>) => void;
    onAutoplayBlocked?: (e: YTEvent) => void;
  };
}

export interface YTNamespace {
  Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YouTube's player states, from the IFrame API. */
export type PlayerState = 'unstarted' | 'ended' | 'playing' | 'paused' | 'buffering' | 'cued';

export const stateName = (code: number): PlayerState => {
  switch (code) {
    case 0: return 'ended';
    case 1: return 'playing';
    case 2: return 'paused';
    case 3: return 'buffering';
    case 5: return 'cued';
    default: return 'unstarted';
  }
};

const SRC = 'https://www.youtube.com/iframe_api';
const TIMEOUT_MS = 15_000;

let pending: Promise<YTNamespace> | null = null;

/* One promise for the whole app. A failure clears it, so the next press of
   "Try again" really tries again instead of replaying the same rejection. The
   global ready callback is chained, never replaced: anything else on the page
   that waited for it still hears it. */
export const loadIframeApi = (): Promise<YTNamespace> => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YTNamespace>((resolve, reject) => {
    const fail = (why: string) => {
      window.clearTimeout(timer);
      pending = null;
      reject(new Error(why));
    };
    const timer = window.setTimeout(() => fail('timeout'), TIMEOUT_MS);

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
      else fail('no player');
    };

    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const script = document.createElement('script');
      script.src = SRC;
      script.async = true;
      script.onerror = () => { script.remove(); fail('script'); };
      document.head.appendChild(script);
    }
  });
  return pending;
};
