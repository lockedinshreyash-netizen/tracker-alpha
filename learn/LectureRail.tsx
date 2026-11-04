/* ── The lecture's timeline ──
   Under the screen, never over it (nothing may be drawn on YouTube's player).
   It shows what YouTube's own bar cannot: the stretches this student has
   actually watched, shaded in the subject's colour, and every bookmark and
   note as a tick at its second, with the note on hover. A click or a drag
   seeks; a tick jumps to its mark.

   It is the only part of the room that moves with playback, so it polls the
   player itself, four times a second while playing and not at all otherwise:
   nothing above it re-renders with the clock. */

import React, { useEffect, useRef, useState } from 'react';
import { formatTime, spokenTime } from '../video/model';
import type { PlayerController } from '../video/controller';
import type { Mark, Range } from './model';

interface Props {
  controller: PlayerController | null;
  playing: boolean;
  /** Seconds, from the store, for before the player knows. */
  knownDuration: number | null;
  /** Where the student will resume, shown before playing. */
  resumeFrom: number;
  watched: Range[];
  marks: Mark[];
  onSeek: (t: number) => void;
}

export default function LectureRail({ controller, playing, knownDuration, resumeFrom, watched, marks, onSeek }: Props) {
  const [, setTick] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [dragAt, setDragAt] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!controller || !playing) return;
    const id = window.setInterval(() => setTick(t => t + 1), 250);
    return () => window.clearInterval(id);
  }, [controller, playing]);

  const duration = (controller?.duration() ?? null) || knownDuration || 0;
  const now = dragAt ?? (controller ? controller.time() : resumeFrom);
  const pct = (s: number) => (duration > 0 ? Math.max(0, Math.min(100, (s / duration) * 100)) : 0);

  const fractionAt = (clientX: number): number => {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r || !r.width) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!duration || e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragAt(fractionAt(e.clientX) * duration);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setHoverX(fractionAt(e.clientX));
    if (dragAt !== null) setDragAt(fractionAt(e.clientX) * duration);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragAt === null) return;
    const at = fractionAt(e.clientX) * duration;
    setDragAt(null);
    onSeek(at);
  };

  return (
    <div className="th-rail">
      <span className="th-rail-time" aria-hidden="true">{formatTime(now)}</span>
      <div
        ref={trackRef}
        className="th-track"
        role="slider"
        tabIndex={-1}
        aria-label="Lecture timeline"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(now)}
        aria-valuetext={duration ? `${spokenTime(now)} of ${spokenTime(duration)}` : spokenTime(now)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDragAt(null)}
        onPointerLeave={() => setHoverX(null)}
      >
        {duration > 0 && watched.map(([a, b]) => (
          <span key={`${a}-${b}`} className="th-seen" style={{ left: `${pct(a)}%`, width: `${Math.max(0.3, pct(b) - pct(a))}%` }} />
        ))}
        {duration > 0 && <span className="th-head" style={{ left: `${pct(now)}%` }} />}
        {hoverX !== null && duration > 0 && dragAt === null && (
          <span className="th-hover" style={{ left: `${hoverX * 100}%` }}>{formatTime(hoverX * duration)}</span>
        )}
        {duration > 0 && marks.map(m => (
          <button
            key={m.id}
            type="button"
            className="th-mark"
            data-kind={m.kind}
            style={{ left: `${pct(m.t)}%` }}
            aria-label={`${m.kind === 'note' ? 'Note' : 'Bookmark'} at ${spokenTime(m.t)}`}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onSeek(m.t); }}
          >
            <span className="th-tip"><b>{formatTime(m.t)}</b>{m.kind === 'note' ? m.text : 'Bookmark'}</span>
          </button>
        ))}
      </div>
      <span className="th-rail-time" aria-hidden="true">{duration ? formatTime(duration) : '–:––'}</span>
    </div>
  );
}
