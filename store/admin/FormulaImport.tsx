/* ── Console → Store → Import formulas ──
   Administrators only. Drop a formulas file (Name, Formula, Tags; one per
   line), see them rendered as they will read, then decide what they are for:

   - A FORMULA SHEET. They become a section of a sheet: a new sheet, or one
     more section on an existing one. Stored as a deck with `collection =
     'sheet'`, which students can only ever read through the sheet, never
     study as cards (supabase/decks.sql §11).
   - A FLASHCARD DECK. They become an Alpha deck (a new one on Essentials or
     More from Alpha, or more cards in an existing one), studied with spaced
     repetition like any other.

   One screen, the deck importer's (decks/ImportSheet.tsx) manners: nothing is
   written until Import, duplicates are counted first and skipped (same text
   already there, or twice in the file), and what is new always lands as a
   draft, published from the console. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet as SheetShell } from '../../ui/kit';
import { createDeck, existingKeys, hashNotes, humanError, importNotes, type HashedNote } from '../../decks/api';
import { deckAccent } from '../../decks/theme';
import { Icon, pill } from '../../decks/ui';
import type { AdminDeckStat, DeckCollection, DeckSubject } from '../../decks/types';
import type { ImportRow } from '../../decks/anki';
import { createSheet, setSheetDecks } from '../api';
import { readFormulaFile, sectionFromFile, toFormulaNotes, type FormulaFile } from '../formulas';
import { Formula } from '../sheets/Formula';
import type { Sheet } from '../types';
import { Segment, SubjectPick, choice as choiceBase, inputCls as inputBase, labelCls } from './fields';

const inputCls = (dark: boolean) => `${inputBase(dark)} h-11 text-[14px]`;
const choice = (on: boolean, dark: boolean) => `${choiceBase(on, dark)} !px-4 !py-3.5`;

const MAX_FILE = 5 * 1024 * 1024;

export type FormulaTarget = 'sheet' | 'deck';

export interface ImportDone {
  target: FormulaTarget;
  /** The sheet (target sheet) or the deck (target deck) the formulas went to. */
  id: string;
  title: string;
  inserted: number;
  duplicates: number;
}

interface Props {
  uid: string;
  dark: boolean;
  /** Every sheet and every Alpha deck, from the console. */
  sheets: Sheet[];
  decks: AdminDeckStat[];
  /** Open with this sheet chosen (from a sheet's editor). */
  presetSheetId?: string | null;
  onClose: () => void;
  onDone: (done: ImportDone) => void;
}

const EXAMPLE = [
  ['Kinetic energy', '$K = \\tfrac12 mv^2$', 'mechanics'],
  ['Ideal gas law', '$PV = nRT$', 'gases'],
  ['Snell’s law', '$n_1 \\sin\\theta_1 = n_2 \\sin\\theta_2$', 'optics'],
];

const FormulaImport = ({ uid, dark, sheets, decks, presetSheetId, onClose, onDone }: Props) => {
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const muted = 'text-zinc-500';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const tile = `rounded-2xl px-4 py-4 ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`;

  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<FormulaFile | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [header, setHeader] = useState(false);
  const [dollars, setDollars] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Where they go.
  const flashDecks = useMemo(() => decks.filter(d => d.collection !== 'sheet'), [decks]);
  const [target, setTarget] = useState<FormulaTarget | null>(presetSheetId ? 'sheet' : null);
  const [sheetDest, setSheetDest] = useState<'new' | 'existing'>(presetSheetId ? 'existing' : sheets.length ? 'existing' : 'new');
  const [sheetId, setSheetId] = useState<string>(presetSheetId ?? sheets[0]?.id ?? '');
  const [deckDest, setDeckDest] = useState<'new' | 'existing'>('new');
  const [deckId, setDeckId] = useState<string>(flashDecks[0]?.id ?? '');
  const [title, setTitle] = useState('');      // a new sheet's or deck's name
  const [section, setSection] = useState('');  // the section on a sheet
  const [subject, setSubject] = useState<DeckSubject | null>(null);
  const [shelf, setShelf] = useState<DeckCollection>('more');

  const [checked, setChecked] = useState<{ fresh: HashedNote[]; duplicates: number; problems: Extract<ImportRow, { status: 'problem' }>[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (file ? toFormulaNotes(file, header, dollars) : []), [file, header, dollars]);
  const ok = useMemo(() => rows.flatMap(r => (r.status === 'ok' ? [r.note] : [])), [rows]);
  const existingDeck = target === 'deck' && deckDest === 'existing' ? deckId : null;

  const take = async (f: File) => {
    setError(null);
    setFatal(null);
    setChecked(null);
    setFileName(f.name);
    if (f.size > MAX_FILE) { setFatal('That file is over 5 MB. Split it into smaller files.'); setFile(null); return; }
    const parsed = readFormulaFile(await f.text());
    if (parsed.fatal) { setFatal(parsed.fatal); setFile(null); return; }
    setFile(parsed);
    setHeader(parsed.headerGuess);
    setDollars(parsed.dollars);
    const name = sectionFromFile(f.name);
    setSection(name);
    setTitle(name);
  };

  // Duplicates: within the file, and against the deck it is going into.
  useEffect(() => {
    if (!file) return;
    let live = true;
    setChecking(true);
    (async () => {
      const hashed = await hashNotes(ok);
      const seen = new Set<string>();
      const existing = existingDeck ? await existingKeys(existingDeck, hashed) : { hashes: new Set<string>(), guids: new Set<string>() };
      const fresh: HashedNote[] = [];
      let duplicates = 0;
      for (const n of hashed) {
        if (seen.has(n.contentHash) || existing.hashes.has(n.contentHash)) duplicates += 1;
        else fresh.push(n);
        seen.add(n.contentHash);
      }
      if (live) setChecked({ fresh, duplicates, problems: rows.filter((x): x is Extract<ImportRow, { status: 'problem' }> => x.status === 'problem') });
    })()
      .catch(e => { if (live) setError(humanError(e)); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [file, ok, rows, existingDeck]);

  const busy = progress !== null;
  const ready = !!checked && checked.fresh.length > 0 && !busy && !checking && !!target && (
    target === 'sheet'
      ? (sheetDest === 'new' ? !!title.trim() && !!section.trim() : !!sheetId && !!section.trim())
      : (deckDest === 'new' ? !!title.trim() : !!deckId)
  );

  const run = async () => {
    if (!checked || !ready || !target) return;
    setError(null);
    setProgress(0);
    try {
      if (target === 'sheet') {
        const sid = sheetDest === 'new'
          ? await createSheet({ title: title.trim(), description: null, subject, examLine: null, access: 'free', priceInr: null })
          : sheetId;
        const sheet = sheets.find(s => s.id === sid);
        const deck = await createDeck(uid, 'global', { title: section.trim(), description: null, subject: subject ?? sheet?.subject ?? null, classId: null, chapter: null }, 'sheet');
        const totals = await importNotes(deck, checked.fresh, n => setProgress(n));
        await setSheetDecks(sid, [...(sheet?.decks.map(d => d.id) ?? []), deck]);
        onDone({ target, id: sid, title: sheetDest === 'new' ? title.trim() : sheet?.title ?? 'the sheet', inserted: totals.inserted, duplicates: totals.duplicates + checked.duplicates });
      } else {
        const did = deckDest === 'new'
          ? await createDeck(uid, 'global', { title: title.trim(), description: null, subject, classId: null, chapter: null }, shelf)
          : deckId;
        const totals = await importNotes(did, checked.fresh, n => setProgress(n));
        onDone({ target, id: did, title: deckDest === 'new' ? title.trim() : flashDecks.find(d => d.id === did)?.title ?? 'the deck', inserted: totals.inserted, duplicates: totals.duplicates + checked.duplicates });
      }
    } catch (e) {
      setError(humanError(e));
      setProgress(null);
    }
  };

  const count = checked?.fresh.length ?? 0;
  return (
    <SheetShell
      dark={dark}
      onClose={busy ? () => undefined : onClose}
      label="Import formulas"
      width="md:w-[760px]"
      header={
        <div className="px-5 md:px-7 py-4">
          <p className={`font-display text-[20px] leading-tight ${heading}`}>Import formulas</p>
          <p className={`text-[12px] font-ui mt-0.5 ${muted}`}>From a CSV file. Then choose: a formula sheet, or a flashcard deck.</p>
        </div>
      }
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className={`flex-1 text-[13px] min-w-0 ${error ? 'text-rose-500' : faint}`}>
            {error ?? (busy ? `Adding ${progress?.toLocaleString()} of ${count.toLocaleString()}…` : file && !target ? 'Choose what these formulas are for.' : 'New sheets and decks start as drafts.')}
          </p>
          <button onClick={onClose} disabled={busy} className={pill.quiet(dark)}>Cancel</button>
          {file && (
            <button onClick={() => void run()} disabled={!ready} className={pill.red}>
              {checking || !checked ? 'Checking…' : `Import ${count.toLocaleString()} ${count === 1 ? 'formula' : 'formulas'}`}
            </button>
          )}
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6 space-y-8 font-ui">
        {/* ── The file ── */}
        {!fileName ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void take(f); }}
            className={`rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${dragging ? 'border-[#E10600] bg-[#E10600]/[0.04]' : dark ? 'border-white/[0.09]' : 'border-zinc-200'}`}
          >
            <p className={`font-display text-[22px] ${heading}`}>Drop a formulas file here</p>
            <p className={`text-[14px] mt-2 ${muted}`}>A CSV file. One formula on each line: name, formula, tags.</p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => fileRef.current?.click()} className={pill.ghost(dark)}>Choose a file</button>
              <button onClick={() => setShowExample(s => !s)} className={pill.quiet(dark)}>{showExample ? 'Hide example' : 'What goes in it?'}</button>
            </div>
            {showExample && (
              <div className={`mk-sheet mt-6 mx-auto max-w-[520px] text-left rounded-2xl overflow-hidden ${dark ? 'ring-1 ring-white/[0.08]' : 'ring-1 ring-zinc-200'}`}>
                <div className={`grid grid-cols-[1fr_1.4fr_0.7fr] text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2.5 ${dark ? 'bg-white/[0.03] text-zinc-500' : 'bg-zinc-50 text-zinc-400'}`}>
                  <span>Name</span><span>Formula</span><span>Tags</span>
                </div>
                {EXAMPLE.map((row, i) => (
                  <div key={i} className={`grid grid-cols-[1fr_1.4fr_0.7fr] gap-2 px-4 py-2.5 text-[12px] border-t ${dark ? 'border-white/[0.05] text-zinc-300' : 'border-zinc-100 text-zinc-700'}`}>
                    {row.map((c, j) => <span key={j} className="truncate font-mono text-[11px]">{c}</span>)}
                  </div>
                ))}
                <p className={`px-4 py-3 text-[12px] leading-relaxed border-t ${dark ? 'border-white/[0.05] text-zinc-500' : 'border-zinc-100 text-zinc-500'}`}>
                  Write maths between <span className="font-mono">$…$</span> (or <span className="font-mono">$$…$$</span> for a line of its own). A first row of column names is fine. Tags are optional.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-3.5 ${tile}`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-white text-zinc-700 shadow-sm'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] font-bold truncate ${heading}`}>{fileName}</p>
              {file && <p className={`text-[12px] ${muted}`}>{file.delimiterName.charAt(0).toUpperCase() + file.delimiterName.slice(1)} file</p>}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={pill.quiet(dark)}>Change</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,text/csv,text/plain" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void take(f); }} />

        {fatal && (
          <div className="rounded-2xl px-5 py-4 bg-rose-500/10">
            <p className={`text-[14px] font-bold ${dark ? 'text-rose-300' : 'text-rose-700'}`}>We couldn't read this file.</p>
            <p className={`text-[13px] mt-1 ${dark ? 'text-rose-300/80' : 'text-rose-700/80'}`}>{fatal}</p>
          </div>
        )}

        {file && (
          <>
            {/* ── What is in it ── */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Formulas found', value: ok.length + (checked?.problems.length ?? 0), tone: heading },
                { label: 'New', value: checked ? checked.fresh.length : null, tone: heading },
                { label: 'Already there', value: checked ? checked.duplicates : null, tone: faint },
              ].map(s => (
                <div key={s.label} className={tile}>
                  <p className={`num-hero text-[30px] md:text-[34px] ${s.tone}`}>{s.value === null ? '…' : s.value.toLocaleString()}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] mt-2.5 ${faint}`}>{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Toggle dark={dark} on={header} onToggle={setHeader} label="First row is column names" />
              <Toggle dark={dark} on={dollars} onToggle={setDollars} label="$…$ is maths" />
            </div>

            {checked && checked.problems.length > 0 && (
              <div className={`rounded-2xl px-5 py-3.5 text-[13px] ${dark ? 'bg-amber-400/[0.06] text-amber-300' : 'bg-amber-50 text-amber-800'}`}>
                {checked.problems.length} {checked.problems.length === 1 ? 'line needs' : 'lines need'} fixing and won't be imported: {checked.problems.slice(0, 3).map(p => `line ${p.line}`).join(', ')}{checked.problems.length > 3 ? '…' : ''}.
              </div>
            )}

            {/* ── How they read ── */}
            {ok.length > 0 && (
              <div>
                <p className={labelCls(dark)}>How they read</p>
                <div
                  className={`rounded-2xl border p-5 ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100'}`}
                  style={{
                    ['--sh-ink' as string]: dark ? '#fafafa' : '#18181b',
                    ['--sh-muted' as string]: dark ? '#a1a1aa' : '#71717a',
                    ['--sh-rule' as string]: dark ? 'rgba(255,255,255,0.07)' : 'rgba(24,24,27,0.08)',
                    ['--sh-accent' as string]: deckAccent(subject, dark),
                  }}
                >
                  {ok.slice(0, 6).map((n, i) => (
                    <div key={i} className="py-2.5 border-b last:border-0" style={{ borderColor: 'var(--sh-rule)' }}>
                      <Formula entry={{ deckId: '', kind: n.kind, front: n.front, back: n.back }} images={false} />
                    </div>
                  ))}
                  {ok.length > 6 && <p className={`text-[12px] pt-3 ${faint}`}>and {(ok.length - 6).toLocaleString()} more</p>}
                </div>
              </div>
            )}

            {/* ── What they are for ── */}
            <div role="radiogroup" aria-label="What are these formulas for?">
              <p className={labelCls(dark)}>What are these formulas for?</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                <button type="button" role="radio" aria-checked={target === 'sheet'} onClick={() => setTarget('sheet')} className={choice(target === 'sheet', dark)}>
                  <span className={`block text-[15px] font-bold ${heading}`}>A formula sheet</span>
                  <span className="block text-[12px] mt-1 text-zinc-500 leading-snug">Read on one page, in the store and in Decks. Never studied as cards.</span>
                </button>
                <button type="button" role="radio" aria-checked={target === 'deck'} onClick={() => setTarget('deck')} className={choice(target === 'deck', dark)}>
                  <span className={`block text-[15px] font-bold ${heading}`}>A flashcard deck</span>
                  <span className="block text-[12px] mt-1 text-zinc-500 leading-snug">Studied with spaced repetition, like any Alpha deck. Name on the front, formula on the back.</span>
                </button>
              </div>
            </div>

            {target === 'sheet' && (
              <div className="space-y-5 mk-sheet">
                <Segment<'new' | 'existing'> dark={dark} value={sheetDest} onChange={setSheetDest} options={[['existing', 'Add to a sheet', !sheets.length], ['new', 'New sheet', false]]} />
                {sheetDest === 'existing' ? (
                  <div>
                    <label className={labelCls(dark)} htmlFor="fi-sheet">Sheet</label>
                    <select id="fi-sheet" value={sheetId} onChange={e => setSheetId(e.target.value)} className={`${inputCls(dark)} cursor-pointer`}>
                      {sheets.map(s => <option key={s.id} value={s.id}>{s.title}{s.status === 'draft' ? ' (draft)' : ''}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={labelCls(dark)} htmlFor="fi-title">Sheet name</label>
                    <input id="fi-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Physics formulas" className={inputCls(dark)} />
                  </div>
                )}
                <div>
                  <label className={labelCls(dark)} htmlFor="fi-section">Section on the sheet</label>
                  <input id="fi-section" value={section} maxLength={120} onChange={e => setSection(e.target.value)} placeholder="Kinematics" className={inputCls(dark)} />
                </div>
                <SubjectPick dark={dark} value={subject} onChange={setSubject} />
              </div>
            )}

            {target === 'deck' && (
              <div className="space-y-5 mk-sheet">
                <Segment<'new' | 'existing'> dark={dark} value={deckDest} onChange={setDeckDest} options={[['new', 'New Alpha deck', false], ['existing', 'Add to an Alpha deck', !flashDecks.length]]} />
                {deckDest === 'existing' ? (
                  <div>
                    <label className={labelCls(dark)} htmlFor="fi-deck">Deck</label>
                    <select id="fi-deck" value={deckId} onChange={e => setDeckId(e.target.value)} className={`${inputCls(dark)} cursor-pointer`}>
                      {flashDecks.map(d => <option key={d.id} value={d.id}>{d.title}{d.status === 'draft' ? ' (draft)' : ''}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className={labelCls(dark)} htmlFor="fi-deck-title">Deck name</label>
                      <input id="fi-deck-title" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Kinematics formulas" className={inputCls(dark)} />
                    </div>
                    <SubjectPick dark={dark} value={subject} onChange={setSubject} />
                    <div>
                      <p className={labelCls(dark)}>Where should students find it?</p>
                      <Segment<DeckCollection> dark={dark} value={shelf} onChange={setShelf} options={[['essentials', 'Alpha Essentials', false], ['more', 'More from Alpha', false]]} />
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SheetShell>
  );
};

/* ── Small controls ── */

const Toggle = ({ dark, on, onToggle, label }: { dark: boolean; on: boolean; onToggle: (v: boolean) => void; label: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onToggle(!on)}
    className={`inline-flex items-center gap-2 h-9 pl-2.5 pr-3.5 rounded-full text-[13px] font-semibold transition-colors ${on
      ? (dark ? 'bg-white text-black' : 'bg-zinc-900 text-white')
      : dark ? 'text-zinc-400 ring-1 ring-inset ring-white/[0.08]' : 'text-zinc-600 ring-1 ring-inset ring-zinc-200'}`}
  >
    <span className={`w-5 h-5 rounded-full flex items-center justify-center ${on ? (dark ? 'bg-black text-white' : 'bg-white text-zinc-900') : dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>{on ? Icon.check : null}</span>
    {label}
  </button>
);

export default FormulaImport;
