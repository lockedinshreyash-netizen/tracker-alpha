/* ── Bookmarks and notes ──
   Beside the player on a laptop, under it on a phone. Every mark is a second
   in the video: tapping its time jumps there. A bookmark is just the second;
   a note is the second plus the student's words, written in the composer
   that opens at the moment N or "Note" was pressed (the video pauses, so the
   lecture does not run on while they write).

   Everything is written to the encrypted library on the device. A note is
   saved once, when its editor closes with Save; a delete asks first. */

import React, { useEffect, useRef, useState } from 'react';
import { btn, tokens } from '../ui/kit';
import { formatTime, spokenTime } from '../video/model';
import { LIMITS, type Mark } from './model';

interface Props {
  marks: Mark[];
  dark: boolean;
  /** Open when a note is being written: the second it is for. */
  composerAt: number | null;
  onSaveNote: (t: number, text: string) => void;
  onCloseComposer: () => void;
  onSeek: (t: number) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export default function MarksPanel({ marks, dark, composerAt, onSaveNote, onCloseComposer, onSeek, onEdit, onDelete }: Props) {
  const t = tokens(dark);
  return (
    <section className={`rounded-xl border p-5 space-y-4 ${t.card}`} aria-label="Bookmarks and notes">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Bookmarks and notes
        </p>
        {marks.length > 0 && <span className={`text-[11px] font-ui ${t.faint}`}>{marks.length}</span>}
      </div>

      {composerAt !== null && (
        <NoteEditor
          key={`new-${composerAt}`}
          label={`Note at ${formatTime(composerAt)}`}
          dark={dark}
          initial=""
          onSave={text => onSaveNote(composerAt, text)}
          onCancel={onCloseComposer}
        />
      )}

      {marks.length ? (
        <ol className="space-y-1 -mx-2">
          {marks.map(m => (
            <MarkRow key={m.id} mark={m} dark={dark} onSeek={onSeek} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ol>
      ) : composerAt === null ? (
        <p className={`text-[13px] font-ui leading-relaxed ${t.muted}`}>
          Mark the second that matters. <span className={t.body}>B</span> bookmarks it, <span className={t.body}>N</span> writes a note at it.
          On a phone, tap Bookmark or Note under the player.
        </p>
      ) : null}
    </section>
  );
}

interface RowProps {
  mark: Mark;
  dark: boolean;
  onSeek: (t: number) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

const MarkRow = ({ mark, dark, onSeek, onEdit, onDelete }: RowProps) => {
  const t = tokens(dark);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing && mark.kind === 'note') {
    return (
      <li className="px-2 py-1">
        <NoteEditor
          label={`Note at ${formatTime(mark.t)}`}
          dark={dark}
          initial={mark.text ?? ''}
          onSave={text => { onEdit(mark.id, text); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className={`group flex items-start gap-3 rounded-lg px-2 py-2 ${t.hover}`}>
      <button
        type="button"
        onClick={() => onSeek(mark.t)}
        aria-label={`Jump to ${spokenTime(mark.t)}`}
        className={`shrink-0 mt-px px-2 py-0.5 rounded-md text-[12px] font-bold tabular-nums font-ui border ${dark ? 'border-white/[0.1] text-zinc-200 hover:bg-white/[0.06]' : 'border-zinc-200 text-zinc-800 hover:bg-zinc-100'}`}
      >
        {formatTime(mark.t)}
      </button>
      <div className="min-w-0 flex-1">
        {mark.kind === 'bookmark' ? (
          <span className={`text-[13px] font-ui ${t.muted}`}>Bookmark</span>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`text-left text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${t.body}`}
            aria-label={`Edit note at ${spokenTime(mark.t)}`}
          >
            {mark.text}
          </button>
        )}
      </div>
      {confirming ? (
        <span className="shrink-0 flex items-center gap-2 text-[12px] font-ui">
          <button type="button" className={`font-bold ${t.heading}`} onClick={() => onDelete(mark.id)}>Delete</button>
          <button type="button" className={t.muted} onClick={() => setConfirming(false)}>Keep</button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${mark.kind} at ${spokenTime(mark.t)}`}
          className={`shrink-0 w-8 h-8 -my-1 rounded-md flex items-center justify-center opacity-60 group-hover:opacity-100 focus:opacity-100 ${t.muted}`}
        >
          ×
        </button>
      )}
    </li>
  );
};

interface EditorProps {
  label: string;
  dark: boolean;
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

const NoteEditor = ({ label, dark, initial, onSave, onCancel }: EditorProps) => {
  const t = tokens(dark);
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const save = () => { if (text.trim()) onSave(text.trim()); };
  return (
    <div className="space-y-2">
      <label className={`block text-[11px] font-bold font-ui ${t.body}`}>
        {label}
        <textarea
          ref={ref}
          value={text}
          onChange={e => setText(e.target.value.slice(0, LIMITS.noteText))}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
          }}
          rows={3}
          placeholder="What matters at this second?"
          className={`${t.input} mt-2 resize-y min-h-[84px] font-normal`}
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-ui ${t.faint}`}>⌘↵ saves · Esc cancels</span>
        <span className="flex gap-2">
          <button type="button" onClick={onCancel} className={`${btn} h-9 px-3 ${t.ghost}`}>Cancel</button>
          <button type="button" onClick={save} disabled={!text.trim()} className={`${btn} h-9 px-3 ${t.primary}`}>Save</button>
        </span>
      </div>
    </div>
  );
};
