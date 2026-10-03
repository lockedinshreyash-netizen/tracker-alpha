import React, { useMemo, useState } from 'react';
import { MAX_HIDE_DAYS, MAX_REASON, nextRollover } from './api';
import { btn, tokens } from '../groups/ui';

type Preset = 'rollover' | '1h' | '24h' | '7d' | 'custom';

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: 'rollover', label: 'Until next rollover' },
  { id: '1h', label: '1 hour' },
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: 'custom', label: 'Pick a time' },
];

const HOUR = 3_600_000;

/** When the hide ends, in IST — the clock every race date is on. */
export const formatUntil = (at: Date | string): string =>
  `${new Date(at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })} IST`;

/** `<input type="datetime-local">` speaks local wall time without a zone. */
const toLocalInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  name: string;
  /**
   * What the hide does, after "{name} won't be told and will still see
   * themselves". Defaults to the race; a group hide says where instead.
   */
  means?: string;
  onConfirm: (until: Date, note: string) => Promise<void>;
  onCancel: () => void;
  dark: boolean;
}

/**
 * Hide a racer from everyone else, for a set time, without telling them.
 *
 * Always timed — there is no "forever" here, because a silent measure with no
 * end is one nobody remembers to lift. Anything open-ended is a ban, and a ban
 * tells the person. The note is for staff; the form says so, since the
 * Remove form right beside it says the opposite about its reason box.
 */
const HideForm: React.FC<Props> = ({ name, means, onConfirm, onCancel, dark }) => {
  const t = tokens(dark);
  const [preset, setPreset] = useState<Preset>('rollover');
  const [custom, setCustom] = useState(() => toLocalInput(new Date(Date.now() + 2 * HOUR)));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const until = useMemo((): Date | null => {
    const now = Date.now();
    switch (preset) {
      case 'rollover': return nextRollover();
      case '1h': return new Date(now + HOUR);
      case '24h': return new Date(now + 24 * HOUR);
      case '7d': return new Date(now + 7 * 24 * HOUR);
      case 'custom': {
        const at = new Date(custom);
        return Number.isNaN(at.getTime()) ? null : at;
      }
    }
  }, [preset, custom]);

  const problem = !until
    ? 'Pick a date and time.'
    : until.getTime() <= Date.now()
      ? 'That time has already passed.'
      : until.getTime() > Date.now() + MAX_HIDE_DAYS * 24 * HOUR
        ? `A hide can last ${MAX_HIDE_DAYS} days at most. For longer, ban them instead.`
        : null;

  const submit = async () => {
    if (!until || problem) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(until, note);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const chip = (on: boolean) =>
    `px-3 py-2 text-[10px] font-bold uppercase tracking-[0.06em] rounded-md border transition-all font-ui ${on
      ? 'bg-[#E10600] border-[#E10600] text-white'
      : dark ? 'border-white/[0.08] text-zinc-400 hover:border-white/[0.16]' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300'}`;

  return (
    <div className={`mt-3 p-4 rounded-lg border space-y-3 ${t.inset}`}>
      <p className={`text-[11px] font-ui leading-relaxed ${t.muted}`}>
        {name} won’t be told and will still see themselves as normal. {means ?? 'Everyone else won’t see them on the board, or their race chat, until the time runs out.'}
      </p>

      <div>
        <span className={`block text-[10px] font-bold uppercase tracking-[0.06em] mb-2 font-ui ${t.muted}`}>Hide for</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.id} type="button" onClick={() => setPreset(p.id)} className={chip(preset === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <input
            type="datetime-local"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            className={`${t.input} mt-2`}
          />
        )}
        <p className={`text-[11px] font-ui mt-2 ${problem ? 'text-[#E10600]' : t.body}`}>
          {problem ?? `Hidden until ${formatUntil(until!)}`}
        </p>
      </div>

      <label className="block">
        <span className={`block text-[10px] font-bold uppercase tracking-[0.06em] mb-2 font-ui ${t.muted}`}>
          Note <span className="normal-case tracking-normal font-medium">(optional · only staff see this)</span>
        </span>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={MAX_REASON}
          placeholder="e.g. 9h in one sitting — checking it"
          className={t.input}
        />
      </label>

      {error && <p className="text-[11px] font-ui text-[#E10600]">{error}</p>}

      <div className="flex items-center justify-end gap-4 pt-1">
        <button onClick={onCancel} disabled={busy} className={`text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-current`}>
          Cancel
        </button>
        <button onClick={() => void submit()} disabled={busy || !!problem} className={`px-5 py-2.5 ${btn} ${busy || problem ? t.disabled : t.primary}`}>
          {busy ? 'Hiding…' : 'Hide'}
        </button>
      </div>
    </div>
  );
};

export default HideForm;
