/* ── Creating a deck, and a deck's study settings ──
   Two short sheets. Creating asks for a name and nothing else is required:
   a subject and a chapter are offered (they tie the deck to the rest of
   Alpha — the chapter is the same one the Syllabus and Mocks tabs use) but a
   deck called "Things I keep forgetting" has neither, and that is fine.

   "Who is this deck for?" appears for administrators only. A student never
   sees a choice they could not make. */

import React, { useState } from 'react';
import { Sheet } from '../ui/kit';
import { SingleChapterPicker } from '../mocks/ChapterPicker';
import type { ExamPreference, Subject } from '../types';
import { AudiencePicker, DEFAULT_AUDIENCE, type Audience } from './AudiencePicker';
import { deckAccent } from './theme';
import { pill } from './ui';
import type { DeckCollection, DeckMeta, DeckSubject, DeckSummary } from './types';

const inputCls = (dark: boolean) => `w-full rounded-xl px-4 outline-none font-ui ${dark
  ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25] placeholder:text-zinc-700'
  : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-300'}`;
const labelCls = (dark: boolean) => `block text-[10px] font-bold uppercase tracking-[0.08em] font-ui mb-2.5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;

const Head: React.FC<{ title: string; line: string; dark: boolean }> = ({ title, line, dark }) => (
  <div className="px-5 md:px-7 py-4">
    <p className={`font-display text-[20px] leading-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>{title}</p>
    <p className="text-[12px] font-ui mt-0.5 text-zinc-500">{line}</p>
  </div>
);

/* ── Create / edit details ── */

export const DeckDetailsSheet: React.FC<{
  dark: boolean;
  isAdmin: boolean;
  examPreference: ExamPreference;
  /** Present when editing an existing deck's details. */
  initial?: DeckMeta | null;
  /** Editing an Alpha deck: its current shelf, which an admin may change. */
  initialCollection?: DeckCollection | null;
  onClose: () => void;
  onSubmit: (meta: DeckMeta, audience: Audience) => Promise<void>;
}> = ({ dark, isAdmin, examPreference, initial, initialCollection, onClose, onSubmit }) => {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [subject, setSubject] = useState<DeckSubject | null>(initial?.subject ?? null);
  const [chapter, setChapter] = useState<{ classId: 11 | 12; subject: Subject; chapter: string } | null>(
    initial?.chapter && initial.subject && initial.classId ? { classId: initial.classId, subject: initial.subject, chapter: initial.chapter } : null,
  );
  const [audience, setAudience] = useState<Audience>(
    initialCollection ? { scope: 'global', collection: initialCollection } : DEFAULT_AUDIENCE,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjects = (examPreference === 'NEET' ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Maths']) as DeckSubject[];

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        subject: chapter ? (chapter.subject as DeckSubject) : subject,
        classId: chapter?.classId ?? null,
        chapter: chapter?.chapter ?? null,
      }, audience);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label={editing ? 'Deck details' : 'Create a deck'}
      width="md:w-[600px]"
      header={<Head dark={dark} title={editing ? 'Deck details' : 'Create a deck'} line={editing ? 'Rename it, or link it to a chapter.' : 'Give it a name. You can add cards next.'} />}
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className="flex-1 text-[13px] text-rose-500 min-w-0">{error}</p>
          <button onClick={onClose} className={pill.quiet(dark)}>Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim() || busy} className={pill.red}>{busy ? 'Saving…' : editing ? 'Save' : 'Create deck'}</button>
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6 space-y-7 font-ui">
        <div>
          <label className={labelCls(dark)} htmlFor="dk-title">Name</label>
          <input
            id="dk-title"
            autoFocus
            value={title}
            maxLength={120}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            placeholder="Organic reactions"
            className={`${inputCls(dark)} h-14 text-[20px] font-bold`}
          />
        </div>

        <div>
          <label className={labelCls(dark)} htmlFor="dk-desc">About <span className="normal-case tracking-normal font-semibold opacity-70">· optional</span></label>
          <input id="dk-desc" value={description} maxLength={600} onChange={e => setDescription(e.target.value)} placeholder="What's in this deck?" className={`${inputCls(dark)} h-11 text-[14px]`} />
        </div>

        <div>
          <p className={labelCls(dark)}>Subject <span className="normal-case tracking-normal font-semibold opacity-70">· optional</span></p>
          <div className="flex flex-wrap gap-2">
            {subjects.map(s => {
              const on = (chapter?.subject ?? subject) === s;
              const c = deckAccent(s, dark);
              return (
                <button key={s} type="button" aria-pressed={on}
                  onClick={() => { setSubject(on ? null : s); if (chapter && chapter.subject !== s) setChapter(null); }}
                  className={`h-10 pl-3 pr-4 rounded-full flex items-center gap-2 text-[13px] font-semibold transition-all ${on ? '' : dark ? 'text-zinc-400 ring-1 ring-inset ring-white/[0.08] hover:text-zinc-200' : 'text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:text-zinc-900'}`}
                  style={on ? { background: `${c}22`, boxShadow: `inset 0 0 0 1.5px ${c}`, color: dark ? '#fff' : '#18181b' } : undefined}>
                  <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {(subject || chapter) && (
          <div className="mk-sheet">
            <p className={labelCls(dark)}>Chapter <span className="normal-case tracking-normal font-semibold opacity-70">· optional — links this deck to your syllabus</span></p>
            <SingleChapterPicker
              subjects={[(chapter?.subject ?? subject) as Subject]}
              pref={examPreference}
              value={chapter}
              onChange={c => setChapter(c as typeof chapter)}
              dark={dark}
            />
          </div>
        )}

        {/* Creating: who it is for, then (for everyone) which shelf. Editing an
            Alpha deck: the shelf only — scope is fixed once a deck exists. */}
        {isAdmin && (!editing || initialCollection) && (
          <AudiencePicker value={audience} onChange={setAudience} dark={dark} shelfOnly={editing} />
        )}
      </div>
    </Sheet>
  );
};

/* ── Study settings ── */

const Choice: React.FC<{ options: { v: number; label: string }[]; value: number; onChange: (v: number) => void; dark: boolean }> = ({ options, value, onChange, dark }) => (
  <div className={`grid gap-1 p-1 rounded-xl ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-100/70'}`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map(o => {
      const on = o.v === value;
      return (
        <button key={o.v} type="button" aria-pressed={on} onClick={() => onChange(o.v)}
          className={`h-10 rounded-lg text-[14px] font-bold transition-all ${on ? (dark ? 'bg-[#2a2a31] text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : dark ? 'text-zinc-500 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-900'}`}>
          {o.label}
        </button>
      );
    })}
  </div>
);

export const SettingsSheet: React.FC<{
  deck: DeckSummary;
  dark: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSave: (s: { newPerDay: number; maxReviews: number; desiredRetention: number }) => Promise<void>;
  onReset: () => Promise<void>;
  onEditDetails: () => void;
}> = ({ deck, dark, canEdit, onClose, onSave, onReset, onEditDetails }) => {
  const [newPerDay, setNewPerDay] = useState(deck.newPerDay);
  const [maxReviews, setMaxReviews] = useState(deck.maxReviews);
  const [retention, setRetention] = useState(Math.round(deck.desiredRetention * 100));
  const [busy, setBusy] = useState(false);
  const newOptions = [5, 10, 20, 30, 50];
  const reviewOptions = [100, 200, 500, 9999];
  const sub = dark ? 'text-zinc-500' : 'text-zinc-500';

  const save = async () => {
    setBusy(true);
    try {
      await onSave({ newPerDay, maxReviews, desiredRetention: retention / 100 });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label="Study settings"
      width="md:w-[560px]"
      header={<Head dark={dark} title="Study settings" line={deck.title} />}
      footer={
        <div className="flex items-center gap-2 font-ui justify-end">
          <button onClick={onClose} className={pill.quiet(dark)}>Cancel</button>
          <button onClick={() => void save()} disabled={busy} className={pill.red}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6 space-y-8 font-ui">
        <div>
          <p className={labelCls(dark)}>New cards a day</p>
          <Choice dark={dark} value={newOptions.includes(newPerDay) ? newPerDay : -1} onChange={setNewPerDay} options={newOptions.map(v => ({ v, label: String(v) }))} />
          <p className={`text-[12px] mt-2.5 ${sub}`}>Each new card comes back a few times in the next weeks. 20 a day is a good start.</p>
        </div>
        <div>
          <p className={labelCls(dark)}>Most reviews a day</p>
          <Choice dark={dark} value={reviewOptions.includes(maxReviews) ? maxReviews : -1} onChange={setMaxReviews} options={reviewOptions.map(v => ({ v, label: v >= 9999 ? 'No limit' : String(v) }))} />
          <p className={`text-[12px] mt-2.5 ${sub}`}>A cap for busy days. Anything over it waits for tomorrow.</p>
        </div>
        <div>
          <p className={labelCls(dark)}>How much to remember</p>
          <Choice dark={dark} value={retention} onChange={setRetention} options={[{ v: 85, label: '85%' }, { v: 90, label: '90%' }, { v: 95, label: '95%' }]} />
          <p className={`text-[12px] mt-2.5 ${sub}`}>Higher means you see cards more often, and forget fewer. 90% suits most people.</p>
        </div>

        <div className={`pt-6 border-t space-y-1 ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          {canEdit && (
            <button onClick={() => { onClose(); onEditDetails(); }} className={`w-full text-left h-11 px-3 -mx-3 rounded-lg text-[14px] font-semibold ${dark ? 'text-zinc-200 hover:bg-white/[0.04]' : 'text-zinc-800 hover:bg-zinc-50'}`}>
              Rename or change subject
            </button>
          )}
          <button
            onClick={async () => {
              if (!window.confirm('Start this deck over? Every card goes back to new. This only affects you.')) return;
              await onReset();
              onClose();
            }}
            className="w-full text-left h-11 px-3 -mx-3 rounded-lg text-[14px] font-semibold text-rose-500 hover:bg-rose-500/10"
          >
            Start this deck over
          </button>
        </div>
      </div>
    </Sheet>
  );
};
