/* ── The library store, on `?learn=debug` (DEV only) ──
   Two pretend accounts on one browser, and a pretend server that holds each
   one's key (in localStorage, under a debug key, because there is no
   `learn_keys` table until Phase 3). Everything the real store does happens
   for real: IndexedDB, AES-GCM, sign-out locking, the wrong-key check,
   export and import. Only the databases `alpha-learn-debug-*` are touched. */

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { LearnStore, LockedError } from './store';
import { generateRawKey, keyFromB64, keyToB64 } from './crypto';
import { dbNameFor, forgetLearnLibrary, lockLearnOnDevice } from './forget';
import { SUBJECTS, codeOf, chapterName, displayTitle, live, marksFor, type LearnSubject } from './model';
import { REFUSAL_COPY, parseVideoLink, formatTime } from '../video/model';

const OWNERS = ['debug-a', 'debug-b'] as const;
type Owner = typeof OWNERS[number];
const SERVER = 'learn_debug_server_keys_v1';

/* ── The pretend server ── */
const serverKeys = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(SERVER) || '{}'); } catch { return {}; }
};
const serverKeyFor = (owner: string): Uint8Array => {
  const keys = serverKeys();
  const have = keys[owner] && keyFromB64(keys[owner]);
  if (have) return have;
  const raw = generateRawKey();
  localStorage.setItem(SERVER, JSON.stringify({ ...keys, [owner]: keyToB64(raw) }));
  return raw;
};
const dropServerKey = (owner: string) => {
  const { [owner]: _gone, ...rest } = serverKeys();
  localStorage.setItem(SERVER, JSON.stringify(rest));
};

type View =
  | { kind: 'signed-out' }
  | { kind: 'opening' }
  | { kind: 'open'; store: LearnStore }
  | { kind: 'locked'; reason: 'no-key' | 'wrong-key' | 'error'; message: string };

interface Props { dark: boolean }

const DebugLibrary = ({ dark }: Props) => {
  const [owner, setOwner] = useState<Owner>('debug-a');
  const [offline, setOffline] = useState(false);
  const [view, setView] = useState<View>({ kind: 'signed-out' });
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog(l => [s, ...l].slice(0, 10));

  const signIn = useCallback(async (who: Owner) => {
    setView({ kind: 'opening' });
    try {
      const store = await LearnStore.open(who, async () => {
        if (offline) throw new Error('offline');
        note(`asked the server for ${who}'s key`);
        return serverKeyFor(who);
      });
      setView({ kind: 'open', store });
      note(`${who}: library open`);
    } catch (e) {
      const reason = e instanceof LockedError ? e.reason : 'error';
      setView({ kind: 'locked', reason, message: e instanceof Error ? e.message : String(e) });
      note(`${who}: ${reason}`);
    }
  }, [offline]);

  // Switching account is signing the other one in; the open store closes first.
  useEffect(() => () => { if (view.kind === 'open') view.store.close(); }, [view]);

  const signOut = async () => {
    await lockLearnOnDevice();
    setView({ kind: 'signed-out' });
    note('signed out: every library on this device locked');
  };

  const deleteAccount = () => {
    if (view.kind === 'open') view.store.close();
    dropServerKey(owner);
    forgetLearnLibrary(owner);
    setView({ kind: 'signed-out' });
    note(`${owner}: account deleted, server key destroyed`);
  };

  const replaceServerKey = () => {
    const keys = serverKeys();
    localStorage.setItem(SERVER, JSON.stringify({ ...keys, [owner]: keyToB64(generateRawKey()) }));
    note(`${owner}: server key replaced (cached key still on device)`);
  };

  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm';
  const ghost = `h-9 px-3 rounded-lg border text-xs font-bold disabled:opacity-40 ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`;
  const eyebrow = 'text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className={eyebrow}>Library store · Phase 2</p>
          <p className="text-sm text-zinc-500 mt-1">Real IndexedDB and real encryption, on two pretend accounts. Writes only to <code>{dbNameFor('debug-*')}</code>.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {OWNERS.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => { setOwner(o); void signIn(o); }}
              className={`h-9 px-3 rounded-lg text-xs font-bold ${owner === o && view.kind === 'open' ? (dark ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white') : ghost}`}
            >
              Sign in as {o === 'debug-a' ? 'A' : 'B'}
            </button>
          ))}
          <button type="button" className={ghost} onClick={() => void signOut()} disabled={view.kind !== 'open'}>Sign out</button>
          <label className="flex items-center gap-2 text-xs font-bold px-2">
            <input type="checkbox" checked={offline} onChange={e => setOffline(e.target.checked)} /> Offline
          </label>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${card}`}>
        {view.kind === 'signed-out' && <p className="text-sm text-zinc-500">Signed out. Sign in as A or B.</p>}
        {view.kind === 'opening' && <p className="text-sm text-zinc-500">Opening…</p>}
        {view.kind === 'locked' && (
          <div className="space-y-1">
            <p className="text-sm font-bold">Locked · {view.reason}</p>
            <p className="text-sm text-zinc-500">{view.message}</p>
          </div>
        )}
        {view.kind === 'open' && <OpenLibrary store={view.store} dark={dark} owner={owner} note={note} />}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
          <p className={eyebrow}>Try to break it</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={ghost} onClick={replaceServerKey}>Replace {owner === 'debug-a' ? 'A' : 'B'}'s server key</button>
            <button type="button" className={ghost} onClick={deleteAccount}>Delete {owner === 'debug-a' ? 'A' : 'B'}'s account</button>
          </div>
          <p className="text-xs text-zinc-500">
            Sign out, tick Offline, sign in: locked, no key. Replace the server key, sign out, sign in: locked, wrong key.
            A's rows can never be opened as B, and the other way round.
          </p>
        </div>
        <div className={`rounded-xl border p-4 space-y-2 ${card}`}>
          <p className={eyebrow}>Events</p>
          <ol className="font-mono text-xs space-y-1 text-zinc-500 min-h-[80px]">
            {log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>Sign in.</li>}
          </ol>
        </div>
      </div>
    </section>
  );
};

interface OpenProps {
  store: LearnStore;
  owner: Owner;
  dark: boolean;
  note: (s: string) => void;
}

const OpenLibrary = ({ store, owner, dark, note }: OpenProps) => {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const lib = store.getLibrary();
  const status = store.getStatus();
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<LearnSubject>('Physics');
  const [raw, setRaw] = useState<string | null>(null);
  const [exported, setExported] = useState('');
  const [importText, setImportText] = useState('');

  const parsed = parseVideoLink(link);
  const now = Date.now();
  const lectures = live(lib.lectures).sort((a, b) => a.addedAt - b.addedAt);

  const input = `w-full px-3 py-2 rounded-lg border text-sm font-ui outline-none focus:border-[#E10600] ${
    dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white placeholder:text-zinc-600' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
  }`;
  const ghost = `h-8 px-2.5 rounded-lg border text-xs font-bold disabled:opacity-40 ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`;

  const add = () => {
    if (!parsed.ok) return;
    const res = store.addLecture({
      videoId: parsed.id,
      title: title.trim() || 'Untitled lecture',
      titleSource: title.trim() ? 'student' : 'youtube',
      subject,
      chapterKey: subject === 'Physics' ? '11|Physics|Rotational Motion' : undefined,
    });
    note(res.duplicate ? `already on the shelf as ${codeOf(res.lecture)}` : `filed as ${codeOf(res.lecture)}`);
    if (!res.duplicate) { setLink(''); setTitle(''); }
  };

  /* Reads the first lecture's row straight from IndexedDB, past the store, to
     show what is actually on disk. */
  const peek = async () => {
    const req = indexedDB.open(dbNameFor(owner));
    req.onsuccess = () => {
      const db = req.result;
      const all = db.transaction('lectures').objectStore('lectures').getAll();
      all.onsuccess = () => {
        const row = (all.result as { id: string; iv: Uint8Array; data: ArrayBuffer }[])[0];
        db.close();
        if (!row) { setRaw('No rows yet.'); return; }
        const bytes = new Uint8Array(row.data);
        // Byte for byte: TextDecoder('latin1') is really windows-1252 in browsers, which btoa refuses.
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        const leaks = lectures.some(l => binary.includes(l.videoId) || (l.title && binary.includes(l.title)));
        setRaw(`id ${row.id} · ${bytes.length} bytes · ${btoa(binary).slice(0, 64)}… · title or video id visible: ${leaks ? 'YES' : 'no'}`);
      };
    };
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500 font-mono">
        {owner} · {lectures.length} lectures · counters {JSON.stringify(lib.counters)} · {status.saving ? 'saving…' : 'saved'}
        {status.error ? ` · error: ${status.error}` : ''}{status.unreadable ? ` · ${status.unreadable} unreadable` : ''}
      </p>

      <div className="grid gap-2 md:grid-cols-[2fr_2fr_1fr_auto]">
        <input className={input} value={link} onChange={e => setLink(e.target.value)} placeholder="YouTube link" aria-label="YouTube link" />
        <input className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (blank = from YouTube)" aria-label="Title" />
        <select className={input} value={subject} onChange={e => setSubject(e.target.value as LearnSubject)} aria-label="Subject">
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" disabled={!parsed.ok} onClick={add} className="h-10 px-4 rounded-lg text-xs font-bold text-white bg-[#E10600] hover:bg-[#c90500] disabled:opacity-40">
          Add
        </button>
      </div>
      {!parsed.ok && parsed.reason !== 'empty' && <p className="text-xs text-zinc-500">{REFUSAL_COPY[parsed.reason]}</p>}

      <ul className="space-y-1.5">
        {lectures.map(l => (
          <li key={l.id} className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${dark ? 'bg-white/[0.025]' : 'bg-zinc-50'}`}>
            <code className="text-xs font-bold w-20">{codeOf(l)}</code>
            <span className="text-sm flex-1 min-w-[160px]">
              {displayTitle(l, now)} <span className="text-zinc-500 text-xs">· {l.titleSource} · {chapterName(l.chapterKey) ?? 'no chapter'} · {marksFor(lib, l.id).length} marks</span>
            </span>
            <button type="button" className={ghost} onClick={() => store.addMark({ lectureId: l.id, t: 60, kind: 'bookmark' })}>+ Bookmark {formatTime(60)}</button>
            <button type="button" className={ghost} onClick={() => store.updateLecture(l.id, { title: `${displayTitle(l, now)} (edited)` })}>Edit title</button>
            <button type="button" className={ghost} onClick={() => store.updateLecture(l.id, { subject: l.subject === 'Physics' ? 'Chemistry' : 'Physics' })}>Move subject</button>
            <button type="button" className={ghost} onClick={() => { store.deleteLecture(l.id); note(`deleted ${codeOf(l)}`); }}>Delete</button>
          </li>
        ))}
        {!lectures.length && <li className="text-sm text-zinc-500">Empty shelf.</li>}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={ghost} onClick={() => void peek()}>Read the first row from disk</button>
        <button type="button" className={ghost} onClick={() => setExported(JSON.stringify(store.exportLibrary(), null, 2))}>Export</button>
      </div>
      {raw && <p className="text-xs font-mono break-all text-zinc-500">{raw}</p>}

      <div className="grid gap-3 md:grid-cols-2">
        <textarea className={`${input} h-40 font-mono text-xs`} readOnly value={exported} placeholder="Export appears here (plain JSON, on purpose)" aria-label="Export" />
        <div className="space-y-2">
          <textarea className={`${input} h-32 font-mono text-xs`} value={importText} onChange={e => setImportText(e.target.value)} placeholder="Paste an export to import" aria-label="Import" />
          <button
            type="button"
            className={ghost}
            disabled={!importText.trim()}
            onClick={() => {
              let rawJson: unknown;
              try { rawJson = JSON.parse(importText); } catch { note('import: not JSON'); return; }
              const res = store.importLibrary(rawJson);
              note(res.ok ? `import: ${JSON.stringify(res.report)}` : 'import: not an Alpha Learn export');
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugLibrary;
