import React, { useState } from 'react';
import { MAX_REASON } from './api';
import { btn, tokens } from '../groups/ui';

interface Props {
  /** Who is being removed, as the remover sees them. */
  name: string;
  /** "this group", "today's race" — for the button and the ban line. */
  from: string;
  /** What a ban means here, in one line. */
  banMeans: string;
  /** Throws on failure, with an already-readable message. */
  onConfirm: (reason: string, ban: boolean) => Promise<void>;
  onCancel: () => void;
  dark: boolean;
}

/**
 * Remove someone, and say why.
 *
 * Inline under the row it acts on rather than a sheet: it is used inside the
 * Explore sheet as well as on plain lists, and a sheet over a sheet is two
 * Escape handlers fighting over one keypress. It replaced two `window.confirm`
 * buttons (Remove / Remove & ban) — the confirm dialog had nowhere to type a
 * reason, and the ban is one tick box on the same decision.
 *
 * The reason is optional, and the form says plainly that the person will read
 * it. That sentence is what keeps it a reason and not a parting shot.
 */
const RemoveForm: React.FC<Props> = ({ name, from, banMeans, onConfirm, onCancel, dark }) => {
  const t = tokens(dark);
  const [reason, setReason] = useState('');
  const [ban, setBan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason, ban);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className={`mt-3 p-4 rounded-lg border space-y-3 ${t.inset}`}>
      <label className="block">
        <span className={`block text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>
          Reason <span className="normal-case tracking-normal font-medium">(optional · {name} will see this)</span>
        </span>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          maxLength={MAX_REASON}
          rows={3}
          autoFocus
          placeholder="e.g. Kept posting off-topic links after being asked to stop."
          className={`${t.input} resize-none`}
        />
      </label>

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={ban}
          onChange={e => setBan(e.target.checked)}
          className="mt-0.5 accent-[#E10600]"
        />
        <span className={`text-[12px] font-ui leading-snug ${t.body}`}>
          Also ban them
          <span className={`block text-[10px] ${t.muted}`}>{banMeans}</span>
        </span>
      </label>

      {error && <p className="text-[11px] font-ui text-[#E10600]">{error}</p>}

      <div className="flex items-center justify-end gap-4 pt-1">
        <button onClick={onCancel} disabled={busy} className={`text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-current`}>
          Cancel
        </button>
        <button onClick={() => void submit()} disabled={busy} className={`px-5 py-2.5 ${btn} ${busy ? t.disabled : t.primary}`}>
          {busy ? 'Removing…' : ban ? `Remove & ban` : `Remove from ${from}`}
        </button>
      </div>
    </div>
  );
};

export default RemoveForm;
