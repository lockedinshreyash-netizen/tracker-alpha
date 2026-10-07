/* ── Making a card ──
   Built for "a useful card in seconds": type the sentence, select the words,
   press Hide. They become a chip in the deck's colour, numbered so blanks
   can be told apart. However many blanks there are, it is ONE card, studied
   with every blank hidden at once. The preview on the right is a miniature
   of that real review card — same renderer, same colour. "Save & add another" keeps the mode and tags so the next card
   starts where this one ended.

   Nobody here is asked to know the storage format. The fields are
   decks/RichField.tsx; what they store is the portable {{c1::…}} text that
   import reads and export writes, and the student never has to see it. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Segmented, Sheet } from '../ui/kit';
import { CardFace } from './CardFace';
import { ALL_BLANKS, blankCount, isCloze, ordinals, parseCloze } from './cloze';
import { DuplicateNoteError, addNote, humanError, updateNote } from './api';
import { uploadEditorImage } from './media';
import { MAX_FIELD, MAX_TAGS, parseTags } from './anki';
import { room } from './theme';
import { Key, pill } from './ui';
import RichField, { RichFieldApi } from './RichField';
import type { DraftNote, Note, NoteKind } from './types';

interface Props {
  deckId: string;
  deckTitle: string;
  /** An Alpha-wide deck: edits reach every student. */
  isGlobal: boolean;
  dark: boolean;
  /** The deck's colour: the chips, and the preview's answer line. */
  accent: string;
  /** Present when editing an existing note. */
  note?: Note | null;
  /** Prefill for a new note — e.g. a card made from a mistake. */
  initial?: Partial<DraftNote>;
  suggestions?: string[];
  onClose: () => void;
  onSaved: (note: Note) => void;
  /** Design board only: save without a database. */
  save?: (draft: DraftNote) => Promise<Note>;
}

type Field = 'front' | 'back';

const Tool: React.FC<{ label: string; hint: string; onClick: () => void; dark: boolean; disabled?: boolean; children: React.ReactNode; wide?: boolean }> = ({ label, hint, onClick, dark, disabled, children, wide }) => (
  <button
    type="button"
    // Keep the field's selection: a mousedown on a button would move it.
    onMouseDown={e => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={hint}
    aria-label={label}
    className={`h-9 ${wide ? 'px-3' : 'w-9'} rounded-lg flex items-center justify-center gap-1.5 text-[13px] font-semibold font-ui transition-colors disabled:opacity-30 ${
      dark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-900/[0.05]'}`}
  >
    {children}
  </button>
);

const CardEditor: React.FC<Props> = ({ deckId, deckTitle, isGlobal, dark, accent, note, initial, suggestions = [], onClose, onSaved, save: saveOverride }) => {
  const r = room(dark);
  const [kind, setKind] = useState<NoteKind>(note?.kind ?? initial?.kind ?? 'cloze');
  const [front, setFront] = useState(note?.front ?? initial?.front ?? '');
  const [back, setBack] = useState(note?.back ?? initial?.back ?? '');
  const [tags, setTags] = useState<string[]>(note?.tags ?? initial?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [answerSide, setAnswerSide] = useState(false);
  const [busy, setBusy] = useState<'save' | 'another' | 'image' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const frontApi = useRef<RichFieldApi>(null);
  const backApi = useRef<RichFieldApi>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<Field>('front');

  useEffect(() => { frontApi.current?.focus(); }, []);
  useEffect(() => { if (!tip) return; const id = window.setTimeout(() => setTip(null), 3200); return () => window.clearTimeout(id); }, [tip]);

  const ords = useMemo(() => (kind === 'cloze' ? ordinals(front) : [0]), [kind, front]);
  const parsed = useMemo(() => parseCloze(front), [front]);
  const blanks = kind === 'cloze' ? blankCount(front) : 0;

  const problem = front.length > MAX_FIELD || back.length > MAX_FIELD
    ? 'This card is too long.'
    : kind === 'cloze' && parsed.errors.length ? parsed.errors[0] : null;
  const ready = !!front.trim() && !problem && (kind === 'cloze' ? isCloze(front) : !!back.trim());
  const canSave = ready && !busy;
  const nudge = !front.trim() || problem
    ? null
    : kind === 'cloze' && !ords.length
      ? 'Now select the words to hide and press Hide.'
      : kind === 'basic' && !back.trim() ? 'Add the answer on the back.' : null;

  const fieldApi = () => (lastField.current === 'front' ? frontApi.current : backApi.current);
  const hide = (same: boolean) => {
    if (kind !== 'cloze') setKind('cloze');
    const msg = frontApi.current?.cloze(same) ?? null;
    if (msg) setTip(msg);
  };
  const hint = () => { const msg = frontApi.current?.hint() ?? null; if (msg) setTip(msg); };

  const insertImage = async (file: File) => {
    setBusy('image');
    setError(null);
    try {
      const name = await uploadEditorImage(deckId, file);
      fieldApi()?.insertImage(name);
    } catch (e) {
      setError(e instanceof Error && !(e as { code?: string }).code ? e.message : humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const onShortcut = (e: React.KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.shiftKey && e.code === 'KeyC') { e.preventDefault(); hide(false); }
  };

  /* ── Tags ── */
  const addTags = (raw: string) => {
    setTags(parseTags(`${tags.join(' ')} ${raw}`).slice(0, MAX_TAGS));
    setTagInput('');
  };
  const tagMatches = suggestions.filter(s => !tags.includes(s) && (!tagInput || s.toLowerCase().includes(tagInput.toLowerCase()))).slice(0, 8);

  /* ── Save ── */
  const save = async (another: boolean) => {
    if (!canSave) return;
    const draft: DraftNote = { kind, front: front.trim(), back: back.trim(), tags: parseTags(`${tags.join(' ')} ${tagInput}`) };
    setBusy(another ? 'another' : 'save');
    setError(null);
    try {
      const saved = saveOverride ? await saveOverride(draft) : note ? await updateNote(note.id, draft) : await addNote(deckId, draft);
      onSaved(saved);
      if (another && !note) {
        setFront('');
        setBack('');
        setTagInput('');
        setTags(draft.tags);
        setAnswerSide(false);
        setSavedCount(c => c + 1);
        window.setTimeout(() => frontApi.current?.focus(), 0);
      } else {
        onClose();
      }
    } catch (e) {
      setError(e instanceof DuplicateNoteError ? e.message : humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const label = `block text-[10px] font-bold uppercase tracking-[0.08em] font-ui mb-2.5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const muted = 'text-zinc-500';

  return (
    <Sheet
      dark={dark}
      onClose={onClose}
      label={note ? 'Edit card' : 'New card'}
      width="md:w-[1000px]"
      header={
        <div className="px-5 md:px-7 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={`font-display text-[20px] leading-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>{note ? 'Edit card' : 'New card'}</p>
            <p className={`text-[12px] font-ui truncate mt-0.5 ${muted}`}>
              {deckTitle}
              {savedCount > 0 && <span className="text-[#1baf7a] font-semibold"> · {savedCount} added</span>}
            </p>
          </div>
          <Segmented
            dark={dark}
            label="Card type"
            value={kind}
            onChange={setKind}
            options={[{ value: 'cloze', label: 'Fill the blank', hint: 'Hide words in a sentence' }, { value: 'basic', label: 'Question', hint: 'A question on the front, the answer on the back' }]}
          />
        </div>
      }
      footer={
        <div className="flex items-center gap-2 font-ui">
          {error
            ? <p className="flex-1 text-[13px] text-rose-500 min-w-0">{error}</p>
            : <p className={`flex-1 text-[12px] hidden md:flex items-center gap-1.5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}><Key dark={dark}>⌘</Key><Key dark={dark}>↵</Key> to save</p>}
          {!error && <span className="flex-1 md:hidden" />}
          <button onClick={onClose} className={pill.quiet(dark)}>{note ? 'Cancel' : 'Close'}</button>
          {!note && (
            <button onClick={() => void save(true)} disabled={!canSave} className={`${pill.ghost(dark)} hidden sm:inline-flex`}>
              {busy === 'another' ? 'Saving…' : 'Save & add another'}
            </button>
          )}
          <button onClick={() => void save(false)} disabled={!canSave} className={pill.red}>
            {busy === 'save' ? 'Saving…' : note ? 'Save changes' : 'Save card'}
          </button>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[1.08fr_1fr] min-h-full">
        {/* ── Writing ── */}
        <div className="px-5 md:px-7 py-6 space-y-6" onKeyDownCapture={onShortcut}>
          <div className={`flex items-center gap-1 -mx-1.5 pb-3 border-b ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
            {kind === 'cloze' && (
              <>
                <button
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => hide(false)}
                  title="Hide the selected words (⌘⇧C)"
                  className={`h-9 pl-2.5 pr-3.5 rounded-lg flex items-center gap-2 text-[13px] font-bold font-ui transition-all active:scale-[0.97] ${dark ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                >
                  <span className="inline-block w-5 h-3.5 rounded-[4px]" style={{ background: `color-mix(in srgb, ${accent} 30%, transparent)`, boxShadow: `inset 0 -2px 0 ${accent}` }} />
                  Hide
                </button>
                <Tool dark={dark} label="Add a hint" hint="Add a hint to the last hidden words" onClick={hint} disabled={!ords.length} wide>Hint</Tool>
                <span className={`w-px h-5 mx-1 ${dark ? 'bg-white/10' : 'bg-zinc-200'}`} />
              </>
            )}
            <Tool dark={dark} label="Bold" hint="Bold (⌘B)" onClick={() => fieldApi()?.format('bold')}><b className="text-[14px]">B</b></Tool>
            <Tool dark={dark} label="Italic" hint="Italic (⌘I)" onClick={() => fieldApi()?.format('italic')}><i className="font-accent text-[15px]">I</i></Tool>
            <Tool dark={dark} label="Underline" hint="Underline (⌘U)" onClick={() => fieldApi()?.format('underline')}><u className="text-[14px]">U</u></Tool>
            <Tool dark={dark} label="List" hint="Make a list" onClick={() => fieldApi()?.format('list')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
            </Tool>
            <Tool dark={dark} label="Add a picture" hint="Add a picture" onClick={() => fileRef.current?.click()} disabled={busy === 'image'}>
              {busy === 'image'
                ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>}
            </Tool>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void insertImage(f); }} />
          </div>

          <div>
            <label className={label} htmlFor="dk-front">{kind === 'cloze' ? 'Sentence' : 'Question'}</label>
            <RichField
              id="dk-front"
              ref={frontApi}
              value={front}
              onChange={setFront}
              onFocus={() => { lastField.current = 'front'; }}
              onSubmit={() => void save(!note)}
              dark={dark}
              accent={accent}
              clozes={kind === 'cloze'}
              deckId={deckId}
              minHeight={132}
              label={kind === 'cloze' ? 'Sentence' : 'Question'}
              placeholder={kind === 'cloze' ? 'Aldehydes can be reduced to primary alcohols using LiAlH₄.' : 'What reduces aldehydes to primary alcohols?'}
            />
            <p className={`text-[12px] font-ui mt-2.5 min-h-[18px] ${problem ? 'text-rose-500' : tip ? (dark ? 'text-amber-300' : 'text-amber-700') : muted}`}>
              {problem ?? tip ?? nudge ?? (kind === 'cloze' && ords.length ? 'Tap a highlighted part to change it or add a hint.' : '')}
            </p>
          </div>

          <div>
            <label className={label} htmlFor="dk-back">
              {kind === 'cloze' ? 'Extra' : 'Answer'} {kind === 'cloze' && <span className="normal-case tracking-normal font-semibold opacity-70">· optional, shown after the answer</span>}
            </label>
            <RichField
              id="dk-back"
              ref={backApi}
              value={back}
              onChange={setBack}
              onFocus={() => { lastField.current = 'back'; }}
              onSubmit={() => void save(!note)}
              dark={dark}
              accent={accent}
              clozes={false}
              deckId={deckId}
              minHeight={76}
              label={kind === 'cloze' ? 'Extra' : 'Answer'}
              placeholder={kind === 'cloze' ? 'Ketones give secondary alcohols.' : 'LiAlH₄'}
            />
          </div>

          <div>
            <p className={label}>Tags</p>
            <div className={`flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded-xl ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.08]' : 'bg-white ring-1 ring-inset ring-zinc-200'}`}>
              {tags.map(tg => (
                <span key={tg} className={`inline-flex items-center gap-1 pl-2.5 pr-1 h-7 rounded-full text-[12px] font-ui font-semibold ${dark ? 'bg-white/[0.07] text-zinc-200' : 'bg-zinc-100 text-zinc-700'}`}>
                  #{tg}
                  <button type="button" aria-label={`Remove tag ${tg}`} onClick={() => setTags(tags.filter(x => x !== tg))} className={`w-5 h-5 rounded-full flex items-center justify-center ${muted} hover:text-[#E10600]`}>×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => { const v = e.target.value; if (/[\s,]$/.test(v)) addTags(v); else setTagInput(v); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); addTags(tagInput); }
                  if (e.key === 'Backspace' && !tagInput && tags.length) setTags(tags.slice(0, -1));
                }}
                onBlur={() => { if (tagInput.trim()) addTags(tagInput); }}
                placeholder={tags.length ? 'Add another' : 'organic, reduction…'}
                aria-label="Add a tag"
                className={`flex-1 min-w-[120px] h-7 bg-transparent outline-none text-[13px] font-ui ${dark ? 'text-white placeholder:text-zinc-700' : 'text-zinc-900 placeholder:text-zinc-300'}`}
              />
            </div>
            {tagMatches.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {tagMatches.map(s => (
                  <button key={s} type="button" onClick={() => addTags(s)} className={`h-7 px-2.5 rounded-full text-[12px] font-ui font-semibold transition-colors ${dark ? 'text-zinc-400 bg-white/[0.04] hover:text-white' : 'text-zinc-500 bg-zinc-100 hover:text-zinc-900'}`}>+ #{s}</button>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* ── The card, as it will be studied ── */}
        <div className="px-5 md:px-7 py-6 lg:border-l flex flex-col" style={{ background: r.page, borderColor: r.rule }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className={`text-[10px] font-bold uppercase tracking-[0.08em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Preview</p>
            <Segmented
              dark={dark}
              label="Preview side"
              value={answerSide ? 'a' : 'q'}
              onChange={v => setAnswerSide(v === 'a')}
              options={[{ value: 'q', label: 'Question' }, { value: 'a', label: 'Answer' }]}
            />
          </div>
          <div className="relative flex-1 min-h-[260px]">
            <div aria-hidden className="absolute inset-x-4 -bottom-2 top-2 rounded-[22px]" style={{ background: r.layer, boxShadow: r.layerShadow }} />
            <div className="relative h-full min-h-[260px] rounded-[22px] flex items-center justify-center px-7 py-10 text-center" style={{ background: r.card, boxShadow: r.cardShadow }}>
              {front.trim() && !problem && (kind === 'basic' || ords.length) ? (
                <CardFace kind={kind} front={front} back={back} ord={ALL_BLANKS} revealed={answerSide} deckId={deckId} dark={dark} accent={accent} size="medium" />
              ) : (
                <p className={`text-[14px] font-ui max-w-[240px] ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  {kind === 'cloze' ? 'Write a sentence, then hide the words you want to remember.' : 'Your card shows up here as you type.'}
                </p>
              )}
            </div>
          </div>
          <p className={`text-[12px] font-ui mt-5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {blanks > 1 ? `One card, ${blanks} blanks — all hidden together. This is exactly what you'll study.` : 'One card. This is exactly what you\'ll study.'}
          </p>
        </div>
      </div>
    </Sheet>
  );
};

export default CardEditor;
