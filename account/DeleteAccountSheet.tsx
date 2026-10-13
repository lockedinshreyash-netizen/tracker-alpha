import React, { useState } from 'react';
import { Field, Sheet, btn, tokens } from '../ui/kit';

/* The one screen in the app that cannot be undone, so it says exactly what
   goes, asks for the word rather than a tap (a tap is what a stray thumb
   does), and cannot be dismissed half-way through. */

const CONFIRM_WORD = 'DELETE';

const GOES = [
  'Your synced study history, plan, syllabus, tasks and mock tests',
  'Your decks, cards and review history',
  'Your profile, group chats and Ranks entries',
  'Your reminders, feedback and usage stats',
];

interface Props {
  email: string;
  dark: boolean;
  onClose: () => void;
  /** Resolves only when the account is gone; throws a message for the student. */
  onConfirm: () => Promise<void>;
}

const DeleteAccountSheet: React.FC<Props> = ({ email, dark, onClose, onConfirm }) => {
  const t = tokens(dark);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = word.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const close = () => { if (!busy) onClose(); };

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      // Success reloads the app; the sheet never needs to close itself.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t delete your account. Try again.');
      setBusy(false);
    }
  };

  const danger = dark ? 'text-rose-400' : 'text-rose-600';

  const header = (
    <div className="px-5 md:px-7 pt-6 pb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${danger}`}>Permanent</p>
        <p className={`font-display text-[22px] md:text-[26px] leading-tight mt-1.5 ${t.heading}`}>Delete your account</p>
        <p className={`text-[12px] font-ui mt-1.5 truncate ${t.muted}`}>{email}</p>
      </div>
      <button onClick={close} disabled={busy} aria-label="Close" className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 ${t.hover} ${t.muted}`}>✕</button>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-3">
      <button onClick={close} disabled={busy} className={`${btn} px-5 py-3.5 ${t.ghost}`}>Keep it</button>
      <button
        onClick={confirm}
        disabled={!ready}
        className={`${btn} px-6 py-3.5 ml-auto bg-rose-600 text-white hover:bg-rose-700`}
      >
        {busy ? 'Deleting…' : 'Delete forever'}
      </button>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={close} label="Delete your account" header={header} footer={footer}>
      <div className="px-5 md:px-7 py-6 space-y-6">
        <div>
          <p className={`text-[14px] font-ui font-bold ${t.heading}`}>This deletes, for good:</p>
          <ul className="mt-3 space-y-2">
            {GOES.map(line => (
              <li key={line} className={`flex gap-2.5 text-[13px] font-ui leading-snug ${t.body}`}>
                <span className={`mt-[7px] w-1 h-1 rounded-full shrink-0 ${dark ? 'bg-zinc-500' : 'bg-zinc-400'}`} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className={`rounded-lg border px-4 py-3.5 text-[12px] font-ui leading-relaxed ${t.inset} ${t.muted}`}>
          This device is cleared and signed out. Other devices keep what’s saved on them until you sign out
          there. Groups you own pass to another member. There is no undo, and we can’t bring it back.
        </div>

        <Field label={`Type ${CONFIRM_WORD} to confirm`} dark={dark}>
          <input
            value={word}
            onChange={e => setWord(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void confirm(); }}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={CONFIRM_WORD}
            aria-describedby={error ? 'delete-account-error' : undefined}
            className={`${t.input} !py-3 tracking-[0.12em]`}
          />
        </Field>

        {error && (
          <p id="delete-account-error" role="alert" className={`text-[13px] font-ui font-semibold ${danger}`}>{error}</p>
        )}
      </div>
    </Sheet>
  );
};

export default DeleteAccountSheet;
