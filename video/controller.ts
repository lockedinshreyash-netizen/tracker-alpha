/* ── What the rest of Alpha may ask a player to do ──
   The library, the controls strip and the keyboard talk to this, never to
   YouTube's object. Another source (a Vimeo embed, Alpha's own video one day)
   would be one more adapter, with nothing above it changing. */

import { snapRate } from './model';
import { stateName, type PlayerState, type YTPlayer } from './youtube';

export interface PlayerController {
  play(): void;
  pause(): void;
  toggle(): void;
  seek(seconds: number): void;
  /** Seconds since the start of the video. */
  time(): number;
  /** Seconds, or null until the player knows (YouTube reports 0 before metadata). */
  duration(): number | null;
  rate(): number;
  /** A suggestion: the player may round it, so listen for the rate it confirms. */
  setRate(rate: number): void;
  rates(): number[];
  state(): PlayerState;
}

const safe = <T,>(read: () => T, fallback: T): T => {
  try { return read(); } catch { return fallback; }
};

export const youTubeController = (p: YTPlayer): PlayerController => {
  const api: PlayerController = {
    play: () => safe(() => p.playVideo(), undefined),
    pause: () => safe(() => p.pauseVideo(), undefined),
    toggle: () => (api.state() === 'playing' || api.state() === 'buffering' ? api.pause() : api.play()),
    seek: (s: number) => safe(() => p.seekTo(Math.max(0, s), true), undefined),
    time: () => safe(() => p.getCurrentTime() || 0, 0),
    duration: () => safe(() => p.getDuration() || null, null),
    rate: () => safe(() => p.getPlaybackRate() || 1, 1),
    setRate: (r: number) => safe(() => p.setPlaybackRate(snapRate(r, api.rates())), undefined),
    // Often just [1] until the video has started; the controls re-ask on every state change.
    rates: () => safe(() => {
      const list = p.getAvailablePlaybackRates();
      return list && list.length ? list : [1];
    }, [1]),
    state: () => safe(() => stateName(p.getPlayerState()), 'unstarted' as PlayerState),
  };
  return api;
};
