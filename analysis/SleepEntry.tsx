import React, { useMemo, useState } from 'react';
import { SleepLog, SleepState } from '../types';
import { getISTDateString, istInstant } from '../utils';
import { clockOf } from '../insight/observe';

interface Props {
  sleep: SleepState;
  theme: 'dark' | 'light';
  onLogSleep: (log: SleepLog) => void;
  onClearNight: (date: string) => void;
}

const parseClock = (value: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/**
 * Bed and wake clock times turned into two instants.
 *
 * `date` is the study day being woken **into**, so the wake time simply lands
 * on it. The bed time is then whichever of the two candidate instants comes
 * before that — going to bed after waking up is not a thing, so a bedtime that
 * resolves later than the wake instant is the previous evening and steps back
 * one day.
 *
 * That single rule covers both real cases without branching on them. A 23:30
 * bedtime resolves to the evening *after* the wake instant and steps back to
 * the evening before it; a 01:00 bedtime resolves past the 04:00 rollover and
 * steps back onto the same calendar night. Anything left over is a typo, and it
 * is caught by the duration bounds below rather than quietly repaired — an
 * impossible night should be shown to the student, not guessed at.
 */
const toInstants = (date: string, bed: number, wake: number): { bedAt: number; wakeAt: number } => {
  const toDayMinute = (clock: number) => (clock - 4 * 60 + 1440) % 1440;
  const wakeAt = istInstant(date, toDayMinute(wake));
  const bedAt = istInstant(date, toDayMinute(bed));
  return bedAt < wakeAt ? { bedAt, wakeAt } : { bedAt: bedAt - 86_400_000, wakeAt };
};

export const fmtDuration = (ms: number): string => {
  const mins = Math.round(ms / 60_000);
  return `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, '0')}m`;
};

/**
 * Logging last night, inside the Observatory.
 *
 * It used to live on Today, and it did not belong there: Today answers "what do
 * I need to do today", and sleep is an input to a study, not a task. Moving it
 * here puts the entry beside the only thing that ever reads it — and Today gets
 * a small dismissable nudge instead, for the mornings it has not been filled in.
 *
 * Four numbers, two of them optional. That restraint is the feature: a tracker
 * that also wants mood, caffeine and screen time is a chore inside a week, and
 * then the data stops arriving — which is worse than never having asked.
 */
const SleepEntry: React.FC<Props> = ({ sleep, theme, onLogSleep, onClearNight }) => {
  const dark = theme === 'dark';
  const today = getISTDateString();

  const tonight = useMemo(
    () => sleep.logs.find(l => l.date === today) ?? null,
    [sleep.logs, today],
  );

  const [bed, setBed] = useState('23:30');
  const [wake, setWake] = useState('07:00');
  const [quality, setQuality] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const b = parseClock(bed);
    const w = parseClock(wake);
    if (b === null || w === null) {
      setError('Enter both times.');
      return;
    }
    const { bedAt, wakeAt } = toInstants(today, b, w);
    const span = wakeAt - bedAt;
    if (span < 30 * 60_000 || span > 16 * 3_600_000) {
      setError(`That works out at ${fmtDuration(span)}. Check the times.`);
      return;
    }
    setError(null);
    onLogSleep({ date: today, bedAt, wakeAt, quality: quality ?? undefined });
  };

  if (tonight) {
    return (
      <div
        className="flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'var(--o-sunk)', borderRadius: 16, padding: '18px 20px' }}
      >
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="o-num" style={{ fontSize: 24 }}>
            {fmtDuration(tonight.wakeAt - tonight.bedAt)}
          </span>
          <span className="o-body truncate" style={{ fontSize: 13.5 }}>
            {clockOf(tonight.bedAt)} – {clockOf(tonight.wakeAt)}
            {tonight.quality ? ` · felt ${tonight.quality}/5` : ''}
          </span>
        </div>
        <button onClick={() => onClearNight(today)} className="o-chip shrink-0" style={{ cursor: 'pointer' }}>
          Change
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ background: 'var(--o-sunk)', borderRadius: 16, padding: 20 }}>
      <p className="o-label mb-4">Last night</p>

      <div className="flex flex-wrap items-end gap-4 md:gap-6">
        <Field label="To bed" value={bed} onChange={setBed} dark={dark} />
        <Field label="Woke" value={wake} onChange={setWake} dark={dark} />

        <div>
          <p className="o-label mb-2.5">How it felt</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setQuality(q => (q === v ? null : v))}
                aria-pressed={quality === v}
                className="transition-colors"
                style={{
                  width: 34, height: 34, borderRadius: 999,
                  fontSize: 13, fontWeight: 700,
                  border: '1px solid var(--o-line)',
                  background: quality !== null && quality >= v ? 'var(--o-accent)' : 'var(--o-card)',
                  color: quality !== null && quality >= v ? '#FFFFFF' : 'var(--o-ink-3)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className="o-btn ml-auto" style={{ padding: '13px 30px' }}>
          Save
        </button>
      </div>

      {error && <p className="o-body o-accent mt-4" style={{ fontSize: 13.5 }}>{error}</p>}
    </form>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  dark: boolean;
}> = ({ label, value, onChange, dark }) => (
  <div>
    <p className="o-label mb-2.5">{label}</p>
    <input
      type="time"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="tabular-nums focus:outline-none"
      style={{
        padding: '11px 14px',
        borderRadius: 12,
        fontSize: 15,
        fontWeight: 600,
        border: '1px solid var(--o-line)',
        background: 'var(--o-card)',
        color: 'var(--o-ink)',
        colorScheme: dark ? 'dark' : 'light',
      }}
    />
  </div>
);

export default SleepEntry;
