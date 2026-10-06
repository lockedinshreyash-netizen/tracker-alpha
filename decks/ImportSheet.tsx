/* ── Import a deck ──
   One screen, not a wizard: drop the file, see what is in it, pick where it
   goes, press Import. The common case asks nothing at all — the columns are
   read from the file itself (it understands Anki's own export directives, and
   otherwise reads front, back, tags), the header row is guessed and shown as a
   toggle, and duplicates are counted before anything is written.

   The screen never names another app. A student who has never seen a deck
   file gets a three-line example of one; a student who has one just drops it.

   Duplicates are never overwritten. A card already in the deck (same text, or
   same id from the file) is skipped and reported, and so is a second copy
   inside the same file, so importing the same file twice adds nothing.

   A student imports only into their own decks. An administrator also chooses
   "Just me" or "Everyone on Alpha", and an Alpha-wide import always lands as a
   draft. The database enforces both; this screen only declines to offer what
   it would refuse. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Sheet } from '../ui/kit';
import { AnkiFile, ImportRow, readAnkiFile, toNotes } from './anki';
import { HashedNote, ImportTotals, createDeck, existingKeys, hashNotes, humanError, importNotes } from './api';
import { mediaNames } from './html';
import { uploadNamedMedia } from './media';
import { CardFace } from './CardFace';
import { STATE_COLOR, deckAccent, room } from './theme';
import { Icon, StackArt, pill } from './ui';
import { AudiencePicker, DEFAULT_AUDIENCE, type Audience } from './AudiencePicker';
import type { DeckSummary } from './types';

interface Props {
  uid: string;
  dark: boolean;
  isAdmin: boolean;
  /** Decks this person may add cards to. */
  decks: DeckSummary[];
  /** Open with this deck chosen as the destination. */
  presetDeckId?: string | null;
  onClose: () => void;
  onImported: (deckId: string) => void;
}

interface Checked {
  fresh: HashedNote[];
  duplicates: number;
  problems: Extract<ImportRow, { status: 'problem' }>[];
}

const MAX_FILE = 25 * 1024 * 1024;

const titleFromFile = (name: string) =>
  name.replace(/\.(csv|txt|tsv)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Imported cards';

/** A file turning into a deck: the picture on the empty drop zone. */
const FileToDeck: React.FC<{ dark: boolean }> = ({ dark }) => {
  const r = room(dark);
  const ink = dark ? '#52525b' : '#d4d4d8';
  return (
    <svg width="220" height="96" viewBox="0 0 220 96" fill="none" aria-hidden>
      <path d="M12 10h40l14 14v62a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" fill={r.card} stroke={r.rule} strokeWidth="1.5" />
      <path d="M52 10v14h14" stroke={r.rule} strokeWidth="1.5" />
      {[38, 50, 62, 74].map((y, i) => <rect key={y} x="18" y={y} width={i === 3 ? 22 : 38} height="4" rx="2" fill={ink} />)}
      <path d="M88 50h34" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
      <path d="m118 44 7 6-7 6" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(140 6)">
        <rect x="14" y="16" width="60" height="62" rx="9" fill={r.layer2} stroke={r.rule} />
        <rect x="7" y="9" width="70" height="66" rx="10" fill={r.layer} stroke={r.rule} />
        <rect x="0" y="2" width="80" height="70" rx="11" fill={r.card} stroke={r.rule} />
        <rect x="12" y="30" width="22" height="5" rx="2.5" fill={ink} />
        <rect x="38" y="28" width="28" height="9" rx="3" fill="rgba(52,199,123,0.18)" />
        <rect x="38" y="35" width="28" height="2" rx="1" fill="#34C77B" />
        <rect x="12" y="44" width="46" height="5" rx="2.5" fill={ink} />
      </g>
    </svg>
  );
};

const ImportSheet: React.FC<Props> = ({ uid, dark, isAdmin, decks, presetDeckId, onClose, onImported }) => {
  const r = room(dark);
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const muted = 'text-zinc-500';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<AnkiFile | null>(null);
  const [garbled, setGarbled] = useState(false);
  const [header, setHeader] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [dest, setDest] = useState<'new' | 'existing'>(presetDeckId ? 'existing' : 'new');
  const [deckId, setDeckId] = useState<string>(presetDeckId ?? decks[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState<Audience>(DEFAULT_AUDIENCE);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [checking, setChecking] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [showExample, setShowExample] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(ImportTotals & { deckId: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (parsed ? toNotes(parsed, header) : []), [parsed, header]);
  const ok = useMemo(() => rows.flatMap(x => (x.status === 'ok' ? [x.note] : [])), [rows]);
  const target = dest === 'existing' ? decks.find(d => d.id === deckId) ?? null : null;
  const accent = deckAccent(target?.subject ?? null, dark);

  /* ── Read the file ── */
  const take = async (file: File) => {
    setError(null);
    setFatal(null);
    setResult(null);
    setChecked(null);
    setFileName(file.name);
    if (file.size > MAX_FILE) { setFatal('That file is over 25 MB. Split it into smaller files.'); setParsed(null); return; }
    const text = await file.text();
    const f = readAnkiFile(text);
    setGarbled((text.match(/�/g) ?? []).length > 0);
    if (!presetDeckId) setTitle(titleFromFile(file.name));
    if (f.fatal) { setFatal(f.fatal); setParsed(null); return; }
    setParsed(f);
    setHeader(f.headerGuess);
  };

  /* ── Count duplicates against the destination ── */
  useEffect(() => {
    if (!parsed) return;
    let live = true;
    setChecking(true);
    (async () => {
      const hashed = await hashNotes(ok);
      // Within the file first: the second copy of a row is a duplicate too.
      const seenHash = new Set<string>();
      const seenGuid = new Set<string>();
      let existing = { hashes: new Set<string>(), guids: new Set<string>() };
      if (dest === 'existing' && deckId) existing = await existingKeys(deckId, hashed);
      const fresh: HashedNote[] = [];
      let duplicates = 0;
      for (const n of hashed) {
        const dup = seenHash.has(n.contentHash) || existing.hashes.has(n.contentHash) || (!!n.guid && (seenGuid.has(n.guid) || existing.guids.has(n.guid)));
        seenHash.add(n.contentHash);
        if (n.guid) seenGuid.add(n.guid);
        if (dup) duplicates += 1;
        else fresh.push(n);
      }
      if (!live) return;
      setChecked({ fresh, duplicates, problems: rows.filter((x): x is Extract<ImportRow, { status: 'problem' }> => x.status === 'problem') });
    })()
      .catch(e => { if (live) setError(humanError(e)); })
      .finally(() => { if (live) setChecking(false); });
    return () => { live = false; };
  }, [parsed, ok, rows, dest, deckId]);

  /* ── Import ── */
  const run = async () => {
    if (!checked || !checked.fresh.length) return;
    setError(null);
    setProgress(0);
    try {
      const id = dest === 'new'
        ? await createDeck(uid, isAdmin ? audience.scope : 'personal', { title: title.trim() || titleFromFile(fileName ?? ''), description: null, subject: null, classId: null, chapter: null }, audience.collection)
        : deckId;
      const totals = await importNotes(id, checked.fresh, n => setProgress(n));
      setResult({ ...totals, duplicates: totals.duplicates + checked.duplicates, deckId: id });
    } catch (e) {
      setError(humanError(e));
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;
  const found = ok.length + (checked?.problems.length ?? 0);
  const canImport = !!checked && checked.fresh.length > 0 && !busy && !checking && (dest === 'new' ? !!title.trim() : !!deckId);
  const finish = () => { if (result) onImported(result.deckId); onClose(); };

  const head = (
    <div className="px-5 md:px-7 py-4">
      <p className={`font-display text-[20px] leading-tight ${heading}`}>{result ? 'Imported' : 'Import a deck'}</p>
      <p className={`text-[12px] font-ui mt-0.5 ${muted}`}>{result ? 'Your cards are ready to study.' : 'From a deck file — CSV or plain text.'}</p>
    </div>
  );

  /* ── Done ── */
  if (result) {
    return (
      <Sheet dark={dark} onClose={finish} label="Import finished" header={head} width="md:w-[620px]"
        footer={<div className="flex justify-end"><button onClick={finish} className={pill.red}>Open deck {Icon.arrow}</button></div>}>
        <div className="px-5 md:px-7 py-10 space-y-8 font-ui">
          <div className="text-center mk-rise">
            <div className="flex justify-center mb-6"><StackArt dark={dark} accent={STATE_COLOR(dark).due} size={110} /></div>
            <p className={`num-hero text-[64px] ${heading}`}>{result.inserted.toLocaleString()}</p>
            <p className={`text-[15px] mt-3 ${muted}`}>{result.inserted === 1 ? 'card' : 'cards'} added.</p>
            {(result.duplicates > 0 || result.failed > 0) && (
              <p className={`text-[13px] mt-2 ${faint}`}>
                {result.duplicates > 0 && `${result.duplicates.toLocaleString()} were already there, so we skipped them.`}
                {result.failed > 0 && ` ${result.failed} couldn't be saved.`}
              </p>
            )}
          </div>
          <MediaStep deckId={result.deckId} names={Array.from(new Set(checked?.fresh.flatMap(n => mediaNames(`${n.front}${n.back}`)) ?? []))} dark={dark} />
        </div>
      </Sheet>
    );
  }

  const tile = `rounded-2xl px-4 py-4 ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`;

  return (
    <Sheet
      dark={dark}
      onClose={busy ? () => undefined : onClose}
      label="Import a deck"
      width="md:w-[720px]"
      header={head}
      footer={
        <div className="flex items-center gap-2 font-ui">
          <p className={`flex-1 text-[13px] min-w-0 ${error ? 'text-rose-500' : faint}`}>
            {error ?? (busy && checked ? `Adding ${progress?.toLocaleString()} of ${checked.fresh.length.toLocaleString()}…` : '')}
          </p>
          <button onClick={onClose} disabled={busy} className={pill.quiet(dark)}>Cancel</button>
          {parsed && (
            <button onClick={() => void run()} disabled={!canImport} className={pill.red}>
              {checking || !checked ? 'Checking…' : `Import ${checked.fresh.length.toLocaleString()} ${checked.fresh.length === 1 ? 'card' : 'cards'}`}
            </button>
          )}
        </div>
      }
    >
      <div className="px-5 md:px-7 py-6 space-y-7 font-ui">
        {/* The file */}
        {!fileName ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void take(f); }}
            className={`rounded-3xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
              dragging ? 'border-[#E10600] bg-[#E10600]/[0.04]' : dark ? 'border-white/[0.09]' : 'border-zinc-200'}`}
          >
            <div className="flex justify-center"><FileToDeck dark={dark} /></div>
            <p className={`font-display text-[22px] mt-6 ${heading}`}>Drop your deck file here</p>
            <p className={`text-[14px] mt-2 ${muted}`}>A CSV or text file. One card on each line.</p>
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => fileRef.current?.click()} className={pill.ghost(dark)}>Choose a file</button>
              <button onClick={() => setShowExample(s => !s)} className={pill.quiet(dark)}>{showExample ? 'Hide example' : 'What goes in it?'}</button>
            </div>
            {showExample && (
              <div className={`mk-sheet mt-6 mx-auto max-w-[460px] text-left rounded-2xl overflow-hidden ${dark ? 'ring-1 ring-white/[0.08]' : 'ring-1 ring-zinc-200'}`}>
                <div className={`grid grid-cols-[1.6fr_1fr_0.8fr] text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2.5 ${dark ? 'bg-white/[0.03] text-zinc-500' : 'bg-zinc-50 text-zinc-400'}`}>
                  <span>Front</span><span>Back</span><span>Tags</span>
                </div>
                {[
                  ['Aldehydes are reduced by {{c1::LiAlH₄}}', '', 'organic'],
                  ['Unit of magnetic flux?', 'weber', 'physics'],
                  ['d/dx of sin x', 'cos x', 'maths'],
                ].map((row, i) => (
                  <div key={i} className={`grid grid-cols-[1.6fr_1fr_0.8fr] gap-2 px-4 py-2.5 text-[12px] border-t ${dark ? 'border-white/[0.05] text-zinc-300' : 'border-zinc-100 text-zinc-700'}`}>
                    {row.map((c, j) => <span key={j} className="truncate font-mono text-[11px]">{c || <span className={faint}>—</span>}</span>)}
                  </div>
                ))}
                <p className={`px-4 py-3 text-[12px] leading-relaxed border-t ${dark ? 'border-white/[0.05] text-zinc-500' : 'border-zinc-100 text-zinc-500'}`}>
                  Put the word to hide inside <span className="font-mono">{'{{c1::…}}'}</span> to make a fill-the-blank card. Back and tags are optional.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl ${tile}`}>
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-white/[0.05] text-zinc-300' : 'bg-white text-zinc-700 shadow-sm'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-[14px] font-bold truncate ${heading}`}>{fileName}</p>
              {parsed && <p className={`text-[12px] ${muted}`}>{parsed.delimiterName.charAt(0).toUpperCase() + parsed.delimiterName.slice(1)} file{parsed.html ? ', with formatting' : ''}</p>}
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
        {garbled && (
          <p className={`text-[13px] ${dark ? 'text-amber-300' : 'text-amber-700'}`}>Some letters didn't read correctly. Save the file as UTF-8 and try again.</p>
        )}

        {parsed && (
          <>
            {/* What is in it */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Cards found', value: found, tone: heading },
                { label: 'New', value: checked ? checked.fresh.length : null, tone: heading },
                { label: 'Already there', value: checked ? checked.duplicates : null, tone: faint },
              ].map(s => (
                <div key={s.label} className={tile}>
                  <p className={`num-hero text-[30px] md:text-[34px] ${s.tone}`}>{s.value === null ? '…' : s.value.toLocaleString()}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] mt-2.5 ${faint}`}>{s.label}</p>
                </div>
              ))}
            </div>

            {checked && checked.problems.length > 0 && (
              <div className={`rounded-2xl ${dark ? 'bg-amber-400/[0.06]' : 'bg-amber-50'}`}>
                <button onClick={() => setShowProblems(s => !s)} className={`w-full flex items-center justify-between px-5 py-3.5 text-[13px] font-semibold ${dark ? 'text-amber-300' : 'text-amber-800'}`}>
                  {checked.problems.length} {checked.problems.length === 1 ? 'line needs' : 'lines need'} fixing — they won't be imported
                  <span>{showProblems ? 'Hide' : 'Show'}</span>
                </button>
                {showProblems && (
                  <div className={`max-h-52 overflow-y-auto border-t divide-y ${dark ? 'border-amber-400/10 divide-amber-400/10' : 'border-amber-100 divide-amber-100'}`}>
                    {checked.problems.map(p => (
                      <div key={p.line} className="px-5 py-2.5 text-[12px]">
                        <span className={`font-bold ${heading}`}>Line {p.line}</span>
                        <span className={muted}> — {p.reason}</span>
                        {p.preview && <p className={`truncate mt-0.5 font-mono text-[11px] ${faint}`}>{p.preview}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* A look at the cards */}
            {ok.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${faint}`}>First cards</p>
                  {!parsed.anki && parsed.rows.length > 1 && (
                    <label className={`inline-flex items-center gap-2 text-[12px] cursor-pointer ${muted}`}>
                      <input type="checkbox" checked={header} onChange={e => setHeader(e.target.checked)} className="accent-[#E10600]" />
                      First line is column names
                    </label>
                  )}
                </div>
                <ul className={`rounded-2xl overflow-hidden divide-y ${dark ? 'ring-1 ring-white/[0.06] divide-white/[0.05]' : 'ring-1 ring-zinc-100 divide-zinc-100'}`} style={{ background: r.card }}>
                  {ok.slice(0, 6).map((n, i) => (
                    <li key={i} className="px-5 py-3.5">
                      <div className="dk-row"><CardFace kind={n.kind} front={n.front} back="" ord={1} revealed={false} browse deckId={null} dark={dark} accent={accent} size="small" /></div>
                      <div className={`flex gap-3 mt-1 text-[11px] ${faint}`}>
                        {n.kind === 'basic' && n.back && <span className="truncate">→ {n.back.replace(/<[^>]*>/g, ' ')}</span>}
                        {n.tags.slice(0, 3).map(tg => <span key={tg}>#{tg}</span>)}
                      </div>
                    </li>
                  ))}
                  {ok.length > 6 && <li className={`px-5 py-3 text-[12px] ${faint}`}>and {(ok.length - 6).toLocaleString()} more</li>}
                </ul>
              </div>
            )}

            {/* Where they go */}
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.08em] mb-3 ${faint}`}>Put them in</p>
              <div className="grid grid-cols-2 gap-2.5">
                {([['new', 'A new deck'], ['existing', 'A deck I have']] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setDest(v)} disabled={v === 'existing' && !decks.length} aria-pressed={dest === v}
                    className={`h-12 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-30 ${dest === v
                      ? dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'
                      : dark ? 'text-zinc-300 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.03]' : 'text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="mt-4">
                {dest === 'new' ? (
                  <div className="space-y-4">
                    <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Deck name" aria-label="Deck name"
                      className={`w-full h-12 px-4 rounded-xl text-[16px] font-semibold outline-none ${dark ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25] placeholder:text-zinc-700' : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-300'}`} />
                    {isAdmin && <AudiencePicker value={audience} onChange={setAudience} dark={dark} />}
                  </div>
                ) : (
                  <select value={deckId} onChange={e => setDeckId(e.target.value)} aria-label="Deck"
                    className={`w-full h-12 px-4 rounded-xl text-[15px] font-semibold outline-none ${dark ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08]' : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200'}`}>
                    {decks.map(d => <option key={d.id} value={d.id}>{d.title}{d.scope === 'global' ? ` — Alpha deck${d.status === 'draft' ? ' (draft)' : ''}` : ''}</option>)}
                  </select>
                )}
                {target?.scope === 'global' && target.status === 'published' && (
                  <p className={`text-[12px] mt-2.5 ${dark ? 'text-amber-300' : 'text-amber-700'}`}>This deck is live. New cards reach every student who has it.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
};

/* After the cards: the pictures they mention, matched by file name. */
const MediaStep: React.FC<{ deckId: string; names: string[]; dark: boolean }> = ({ deckId, names, dark }) => {
  const [done, setDone] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  if (!names.length) return null;
  const wanted = new Set(names);
  const upload = async (files: File[]) => {
    setBusy(true);
    const errs: string[] = [];
    for (const f of files) {
      if (!wanted.has(f.name)) continue;
      try {
        await uploadNamedMedia(deckId, f);
        setDone(d => (d.includes(f.name) ? d : [...d, f.name]));
      } catch (e) {
        errs.push(e instanceof Error ? e.message : `${f.name} failed.`);
      }
    }
    const unmatched = files.filter(f => !wanted.has(f.name)).length;
    if (unmatched) errs.push(`${unmatched} ${unmatched === 1 ? 'file isn\'t' : 'files aren\'t'} used by these cards.`);
    setErrors(errs);
    setBusy(false);
  };
  const left = names.filter(n => !done.includes(n));
  return (
    <div className={`rounded-2xl p-5 ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); void upload(Array.from(e.dataTransfer.files)); }}>
      <p className={`text-[14px] font-bold ${dark ? 'text-white' : 'text-zinc-900'}`}>
        {left.length ? `${names.length} ${names.length === 1 ? 'card uses a picture' : 'pictures are used by these cards'}` : 'All pictures added'}
      </p>
      {left.length > 0 && (
        <>
          <p className="text-[13px] mt-1 text-zinc-500">Drop the picture files here. Their names must match. You can skip this.</p>
          <button onClick={() => ref.current?.click()} disabled={busy} className={`mt-4 ${pill.ghost(dark)}`}>{busy ? 'Uploading…' : 'Choose pictures'}</button>
          <input ref={ref} type="file" multiple accept="image/*" className="hidden" onChange={e => { const fs: File[] = e.target.files ? Array.from(e.target.files) : []; e.target.value = ''; void upload(fs); }} />
        </>
      )}
      <p className={`text-[12px] mt-3 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{done.length} of {names.length} added</p>
      {errors.map((er, i) => <p key={i} className="text-[12px] text-rose-500 mt-1">{er}</p>)}
    </div>
  );
};

export default ImportSheet;
