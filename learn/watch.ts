/* ── What was actually watched ──
   The player has no event for time passing, so the lecture page polls it
   once a second while it plays and feeds each reading in here. The tracker
   turns readings into stretches: a reading close after the last one extends
   the stretch; a jump (a seek, a ±10s, a bookmark tap) closes it and opens a
   new one, so skipping to the end is never counted as watching it.

   `take()` hands over what has accumulated as one WatchUpdate for the store
   and keeps the open stretch's start where it was taken, so taking often
   loses nothing and counts nothing twice. Pure: no timers, no player, no
   clock; the page decides when to tick and when to take. */

import type { WatchUpdate } from './model';

/** A reading further than this from the expected time is a jump, not playback. */
const JUMP_S = 3;

export class WatchTracker {
  private from: number | null = null;
  private last: number | null = null;
  private closed: [number, number][] = [];
  private position = 0;
  private duration: number | null = null;
  private rate = 1;
  private dirty = false;

  /** One reading of the player. `dt` is real seconds since the previous reading. */
  tick(time: number, dt: number, rate: number, duration: number | null): void {
    if (!Number.isFinite(time) || time < 0) return;
    this.rate = rate > 0 ? rate : this.rate;
    if (duration && duration > 0) this.duration = duration;
    const expected = this.last === null ? null : this.last + Math.max(0, dt) * this.rate;
    if (this.from === null || this.last === null || expected === null || Math.abs(time - expected) > JUMP_S || time < this.last) {
      this.close();
      this.from = time;
    }
    this.last = time;
    this.position = time;
    this.dirty = true;
  }

  /** Playback stopped (pause, end, buffering): the open stretch ends at the last reading. */
  stop(time?: number): void {
    if (time !== undefined && Number.isFinite(time) && time >= 0) {
      if (this.last !== null && time >= this.last && time - this.last <= JUMP_S) this.last = time;
      this.position = time;
      this.dirty = true;
    }
    this.close();
  }

  /** A seek while paused moves the resume point without counting anything as watched. */
  moved(time: number): void {
    if (!Number.isFinite(time) || time < 0) return;
    this.close();
    this.position = time;
    this.dirty = true;
  }

  private close(): void {
    if (this.from !== null && this.last !== null && this.last > this.from) this.closed.push([this.from, this.last]);
    this.from = null;
    this.last = null;
  }

  /** Everything since the last take, as updates for the store; empty when nothing changed. */
  take(): WatchUpdate[] {
    if (!this.dirty) return [];
    const ranges = [...this.closed];
    this.closed = [];
    if (this.from !== null && this.last !== null && this.last > this.from) {
      ranges.push([this.from, this.last]);
      this.from = this.last;
    }
    this.dirty = false;
    const base = { position: this.position, duration: this.duration, rate: this.rate };
    if (!ranges.length) return [base];
    return ranges.map(([from, to]) => ({ ...base, from, to }));
  }
}
