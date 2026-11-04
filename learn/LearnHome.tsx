/* ── Learn, switched on ──
   Opens this account's library (useLearnStore) and shows one of three things:
   the shelf, a lecture, or why the shelf is locked. The library is device-
   local and encrypted; nothing here touches AppState.

   The shelf is one row per subject, oldest number first, each row a ledge of
   cases you can scroll sideways on a phone. A case is a button: the whole
   case is the target, and the hover lift is CSS (learn.css), so a gesture
   never re-renders anything. */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PageHeader, tokens, btn } from '../ui/kit';
import CdCase from './CdCase';
import AddSheet from './AddSheet';
import LectureView from './LectureView';
import CollectionSheet from './CollectionSheet';
import EditSheet from './EditSheet';
import { discoverEnabled } from './discover/api';
import { useLearnStore, type LockWhy } from './useLearnStore';
import { serverKeySource } from './keys';
import { devKeyOn, devKeySource } from './devKey';
import { forgetLearnLibrary } from './forget';
import { askToPersist, readBackup, saveBackup } from './backup';
import type { LearnStore } from './store';
import { SUBJECTS, chapterName, codeOf, collectionsInOrder, coverArt, displayTitle, isComplete, live, watchedFraction, type Lecture } from './model';
import type { ChapterProgress, ExamPreference, Subject, TimerState } from '../types';
import type { OtherSession } from './SessionStrip';

/* Discover (one floating glass panel) arrives with its own chunk, the first time it is opened. */
const DiscoverPanel = lazy(() => import('./discover/DiscoverPanel'));

interface Props {
  user: { id: string } | null;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  onOpenAuth: () => void;
  onDisable: () => void;
  timer: TimerState;
  otherSession: OtherSession;
  onStartClock: (subject: Subject, chapter?: string) => boolean;
  onOpenToday: () => void;
  onWatching: (watching: boolean) => void;
  request: LearnRequest | null;
  onRequestHandled: () => void;
  /** Syllabus progress, for Discover's chapter list (read only). */
  progress: ChapterProgress[];
}

/** Open the shelf on one chapter: `11|Physics|Rotational Motion`. */
export interface LearnRequest { key: string; nonce: number }

/** What a lecture needs from App: the clock, and telling the rail to fold. */
type Session = Pick<Props, 'timer' | 'otherSession' | 'onStartClock' | 'onOpenToday' | 'onWatching'>;

export default function LearnHome({ user, dark, examPreference, currentClass, onOpenAuth, onDisable, request, onRequestHandled, progress, ...session }: Props) {
  const dev = import.meta.env.DEV && devKeyOn();
  const owner = user?.id ?? (dev ? 'dev-guest' : null);
  const source = useMemo(() => (dev && owner ? devKeySource(owner) : serverKeySource), [dev, owner]);
  const { opened, retry } = useLearnStore(owner, source);

  if (opened.kind === 'opening') return <div className="h-[60vh]" aria-busy="true" />;
  if (opened.kind === 'locked') {
    return (
      <Locked
        why={opened.why}
        dark={dark}
        onRetry={retry}
        onSignIn={onOpenAuth}
        onReset={owner ? () => { forgetLearnLibrary(owner); retry(); } : undefined}
      />
    );
  }
  return (
    <Shelf
      store={opened.store}
      dark={dark}
      examPreference={examPreference}
      currentClass={currentClass}
      onDisable={onDisable}
      session={session}
      request={request}
      onRequestHandled={onRequestHandled}
      progress={progress}
    />
  );
}

/* ── The shelf ── */

interface ShelfProps {
  store: LearnStore;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  onDisable: () => void;
  session: Session;
  request: LearnRequest | null;
  onRequestHandled: () => void;
  progress: ChapterProgress[];
}

/* A lecture is a history entry: the phone's back button (and the Play app's)
   closes it instead of leaving Alpha. The address never changes, so nothing
   about what is being watched reaches the browser's history list. */
const LECTURE_KEY = 'learnLecture';

const Shelf = ({ store, dark, examPreference, currentClass, onDisable, session, request, onRequestHandled, progress }: ShelfProps) => {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const lib = store.getLibrary();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fromRect, setFromRect] = useState<DOMRect | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const openLecture = useCallback((id: string, rect: DOMRect | null = null) => {
    setFromRect(rect);
    setOpenId(id);
    try { window.history.pushState({ ...(window.history.state ?? {}), [LECTURE_KEY]: id }, ''); } catch { /* sandboxed */ }
  }, []);

  /* Up next, from inside the room: the same history entry, a new lecture. */
  const switchLecture = useCallback((id: string) => {
    setFromRect(null);
    setOpenId(id);
    try { window.history.replaceState({ ...(window.history.state ?? {}), [LECTURE_KEY]: id }, ''); } catch { /* sandboxed */ }
  }, []);

  const closeLecture = useCallback(() => {
    if ((window.history.state as Record<string, unknown> | null)?.[LECTURE_KEY]) window.history.back();
    else setOpenId(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!(window.history.state as Record<string, unknown> | null)?.[LECTURE_KEY]) setOpenId(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const t = tokens(dark);
  const now = Date.now();

  const lectures = live(lib.lectures);
  const rows = SUBJECTS
    .map(subject => ({ subject, cases: lectures.filter(l => l.subject === subject).sort((a, b) => a.catalogueNo - b.catalogueNo) }))
    .filter(r => r.cases.length);

  const [editingCol, setEditingCol] = useState<string | null>(null);
  /** The chapter shelf on screen, from Syllabus's "Lectures". */
  const [chapterKey, setChapterKey] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    setChapterKey(request.key);
    if (openId) closeLecture();
    onRequestHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  /* Discover: one floating glass panel (DiscoverPanel), opened over whatever
     the shelf shows, and the toast a filed result leaves (Undo · Change
     chapter · Watch). `discovering` is the chapter it was opened for, or ''. */
  const discover = useMemo(() => discoverEnabled(), []);
  const [discovering, setDiscovering] = useState<string | null>(null);
  const [filed, setFiled] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileOne = useCallback((id: string) => {
    setFiled(id);
    setJustAdded(id);
    askToPersist();
  }, []);

  useEffect(() => {
    if (!filed) return;
    const id = window.setTimeout(() => setFiled(f => (f === filed ? null : f)), 9000);
    return () => window.clearTimeout(id);
  }, [filed]);

  useEffect(() => {
    if (!discover || openId) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setDiscovering(d => d ?? ''); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [discover, openId]);

  const openDiscover = (key: string | null) => setDiscovering(key ?? '');

  const renderCase = (l: Lecture) => (
    <CaseButton
      key={l.id}
      lecture={l}
      dark={dark}
      now={now}
      done={isComplete(lib, l.id)}
      fraction={lib.progress[l.id] && !lib.progress[l.id].deletedAt ? watchedFraction(lib.progress[l.id]) : 0}
      isNew={l.id === justAdded}
      onOpen={rect => openLecture(l.id, rect)}
    />
  );

  const open = openId ? lib.lectures[openId] : null;
  if (open && !open.deletedAt) {
    return (
      <LectureView
        key={open.id}
        store={store}
        lecture={open}
        dark={dark}
        examPreference={examPreference}
        currentClass={currentClass}
        fromRect={fromRect}
        onBack={closeLecture}
        onSwitch={switchLecture}
        {...session}
      />
    );
  }

  const subtitle = lectures.length
    ? `${lectures.length} ${lectures.length === 1 ? 'lecture' : 'lectures'} on your shelf.`
    : 'Your shelf is empty. Put a lecture on it.';

  let body: React.ReactNode;
  if (chapterKey) {
    body = (
      <ChapterShelf
        chapterKey={chapterKey}
        lectures={lectures}
        dark={dark}
        renderCase={renderCase}
        onBack={() => setChapterKey(null)}
        onAdd={() => setAdding(true)}
        onFind={discover ? () => openDiscover(chapterKey) : undefined}
      />
    );
  } else {
    body = (
      <div className="space-y-10 pb-16">
        <PageHeader
          title="Learn"
          subtitle={subtitle}
          dark={dark}
          right={
            <div className="flex items-center gap-2">
              {discover && (
                <button type="button" onClick={() => openDiscover(null)} className={`${btn} h-11 px-5 ${t.ghost}`} title="Find a lecture on YouTube (⌘K)">
                  Discover
                </button>
              )}
              <button type="button" onClick={() => setAdding(true)} className={`${btn} h-11 px-5 ${t.primary}`}>
                Add lecture
              </button>
            </div>
          }
        />

        {rows.length ? (
          <>
            <Collections
              store={store}
              dark={dark}
              renderCase={renderCase}
              onEdit={setEditingCol}
            />
            {rows.map(row => (
              <ShelfRow key={row.subject} label={`${row.subject} · ${row.cases.length}`} dark={dark}>
                {row.cases.map(renderCase)}
              </ShelfRow>
            ))}
          </>
        ) : (
          <section className={`rounded-xl border p-8 md:p-10 flex flex-col sm:flex-row items-start sm:items-center gap-8 ${t.card}`}>
            <div className="ln-empty-case" aria-hidden="true">+</div>
            <div className="space-y-3 max-w-md">
              <h2 className={`font-display text-2xl ${t.heading}`}>{discover ? 'Find your first lecture.' : 'Paste a YouTube lecture.'}</h2>
              <p className={`text-sm font-ui ${t.muted}`}>
                {discover
                  ? 'Pick the chapter you are on and choose a lecture. It goes on the shelf with its own number.'
                  : "It goes on the shelf under its chapter, with its own number. Shorts and playlists don't."}
              </p>
              <div className="flex flex-wrap gap-2">
                {discover && <button type="button" onClick={() => openDiscover(null)} className={`${btn} h-11 px-5 ${t.primary}`}>Find a lecture</button>}
                <button type="button" onClick={() => setAdding(true)} className={`${btn} h-11 px-5 ${discover ? t.ghost : t.primary}`}>
                  {discover ? 'Paste a link' : 'Add your first lecture'}
                </button>
              </div>
            </div>
          </section>
        )}

        <ShelfFooter store={store} dark={dark} onDisable={onDisable} />
      </div>
    );
  }

  const filedLecture = filed ? lib.lectures[filed] : null;
  const editingLecture = editingId ? lib.lectures[editingId] : null;

  return (
    <>
      {body}

      {discovering !== null && discover && (
        <Suspense fallback={null}>
          <DiscoverPanel
            key={discovering}
            store={store}
            dark={dark}
            examPreference={examPreference}
            progress={progress}
            chapterKey={discovering || null}
            onClose={() => setDiscovering(null)}
            onOpen={id => { setDiscovering(null); openLecture(id); }}
            onFiled={fileOne}
          />
        </Suspense>
      )}

      {editingCol && lib.collections[editingCol] && !lib.collections[editingCol].deletedAt && (
        <CollectionSheet store={store} collection={lib.collections[editingCol]} dark={dark} onClose={() => setEditingCol(null)} />
      )}

      {editingLecture && !editingLecture.deletedAt && (
        <EditSheet
          store={store}
          lecture={editingLecture}
          dark={dark}
          examPreference={examPreference}
          currentClass={currentClass}
          onClose={() => setEditingId(null)}
        />
      )}

      {adding && (
        <AddSheet
          store={store}
          dark={dark}
          examPreference={examPreference}
          currentClass={currentClass}
          preset={chapterKey ?? undefined}
          onClose={() => setAdding(false)}
          onAdded={id => { setAdding(false); setJustAdded(id); askToPersist(); }}
          onOpenExisting={id => { setAdding(false); openLecture(id); }}
        />
      )}

      {filedLecture && !filedLecture.deletedAt && (
        <div className="ln-toast" role="status">
          <span>Filed as <b>{codeOf(filedLecture)}</b>{chapterName(filedLecture.chapterKey) ? ` · ${chapterName(filedLecture.chapterKey)}` : ' · No chapter'}</span>
          <span className="flex items-center gap-3">
            <button type="button" onClick={() => { store.deleteLecture(filedLecture.id); setFiled(null); }}>Undo</button>
            <button type="button" onClick={() => { setEditingId(filedLecture.id); setFiled(null); }}>{filedLecture.chapterKey ? 'Change chapter' : 'Set chapter'}</button>
            <button type="button" onClick={() => { setFiled(null); setDiscovering(null); openLecture(filedLecture.id); }}>Watch</button>
          </span>
        </div>
      )}
    </>
  );
};

/* ── One chapter's shelf ──
   Where Syllabus's "Lectures" lands: the lectures filed under that chapter,
   and a way to add one already filed there. */

interface ChapterShelfProps {
  chapterKey: string;
  lectures: Lecture[];
  dark: boolean;
  renderCase: (l: Lecture) => React.ReactNode;
  onBack: () => void;
  onAdd: () => void;
  /** Discover on this chapter, when Discover is on. */
  onFind?: () => void;
}

const ChapterShelf = ({ chapterKey, lectures, dark, renderCase, onBack, onAdd, onFind }: ChapterShelfProps) => {
  const t = tokens(dark);
  const [cls, subject, chapter] = chapterKey.split('|');
  const here = lectures.filter(l => l.chapterKey === chapterKey).sort((a, b) => a.catalogueNo - b.catalogueNo);
  return (
    <div className="space-y-8 pb-16">
      <button type="button" onClick={onBack} className={`${btn} h-10 px-3 ${t.ghost}`}>‹ Shelf</button>
      <div className="mk-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{subject} · Class {cls}</p>
          <h1 className={`font-accent text-[30px] md:text-[40px] leading-tight ${t.heading}`} style={{ overflowWrap: 'anywhere' }}>{chapter}</h1>
          <p className={`text-[13px] font-ui ${t.muted}`}>
            {here.length ? `${here.length} ${here.length === 1 ? 'lecture' : 'lectures'} for this chapter.` : 'No lectures for this chapter yet.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onFind && <button type="button" onClick={onFind} className={`${btn} h-11 px-5 ${t.primary}`}>Find on YouTube</button>}
          <button type="button" onClick={onAdd} className={`${btn} h-11 px-5 ${onFind ? t.ghost : t.primary}`}>{onFind ? 'Paste a link' : 'Add a lecture'}</button>
        </div>
      </div>
      {here.length > 0 && (
        <ShelfRow label={`${subject} · ${chapter}`} dark={dark}>
          {here.map(renderCase)}
        </ShelfRow>
      )}
    </div>
  );
};

/* ── The foot of the shelf: where it lives, the backup, the off switch ──
   The library has no copy anywhere but this device, so the backup is said
   plainly and offered here, and restore is offered even on an empty shelf
   (a new laptop, a cleared browser). Backing up shows one line first: the
   file is not locked. */

interface FooterProps {
  store: LearnStore;
  dark: boolean;
  onDisable: () => void;
}

const ShelfFooter = ({ store, dark, onDisable }: FooterProps) => {
  const t = tokens(dark);
  const status = store.getStatus();
  const [backingUp, setBackingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const link = `font-bold underline underline-offset-2 hover:opacity-80 ${t.body}`;

  const save = () => {
    const how = saveBackup(store.exportLibrary());
    setBackingUp(false);
    setMessage(how === 'opened' ? 'Backup opened in a new tab. Save it from there.' : 'Backup saved. Keep the file private.');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    const raw = await readBackup(file);
    const res = raw === null ? null : store.importLibrary(raw);
    if (!res || !res.ok) { setMessage("That file isn't an Alpha Learn backup."); return; }
    const { added, updated, merged, renumbered, rejected } = res.report;
    if (!added && !updated && !rejected) {
      setMessage('Nothing new. Everything in that backup is already on your shelf.');
      return;
    }
    const parts = [
      added ? `${added} ${added === 1 ? 'lecture' : 'lectures'} added` : '',
      updated ? `${updated} updated` : '',
      merged ? `${merged} already here` : '',
      renumbered ? `${renumbered} given new numbers` : '',
      rejected ? `${rejected} damaged, skipped` : '',
    ].filter(Boolean);
    setMessage(`Restored. ${parts.join(', ')}.`);
  };

  return (
    <footer className={`space-y-3 pt-2 text-[12px] font-ui ${t.faint}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {status.error ? `Couldn't save on this device: ${status.error}` : 'Saved on this device only. Locked to your account.'}
          {status.unreadable ? ` ${status.unreadable} damaged ${status.unreadable === 1 ? 'entry was' : 'entries were'} skipped.` : ''}
        </span>
        <span className="flex flex-wrap items-center gap-4">
          <button type="button" className={link} onClick={() => { setMessage(null); setBackingUp(b => !b); }}>Back up</button>
          <button type="button" className={link} onClick={() => fileRef.current?.click()}>Restore</button>
          <button
            type="button"
            className="underline underline-offset-2 hover:opacity-80"
            onClick={() => { if (window.confirm('Turn off Learn? Your shelf stays on this device.')) onDisable(); }}
          >
            Turn off Learn
          </button>
        </span>
      </div>
      {backingUp && (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${t.inset}`}>
          <span className={t.body}>The backup file isn't locked: anyone with it can read your shelf and notes. Keep it somewhere private.</span>
          <button type="button" onClick={save} className={`${btn} h-9 px-4 ${t.primary}`}>Save backup</button>
        </div>
      )}
      {message && <p className={t.body} role="status">{message}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={e => { void restore(e.target.files?.[0]); e.target.value = ''; }}
        aria-label="Choose a backup file"
      />
    </footer>
  );
};

/* ── A shelf: a label, a row of cases, a ledge ── */

interface ShelfRowProps {
  label: React.ReactNode;
  dark: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}

const ShelfRow = ({ label, dark, right, children }: ShelfRowProps) => (
  <section className="mk-rise">
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <div className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</div>
      {right}
    </div>
    <div className="ln-shelf-row">{children}</div>
    <div className="ln-ledge" />
  </section>
);

/* ── Collections: shelves the student curates ──
   Above the subject shelves, oldest first. A collection is an order the
   student chose (before the mock, a weak chapter, a revision week); lectures
   are put on it from their own page, and arranged in its sheet. */

interface CollectionsProps {
  store: LearnStore;
  dark: boolean;
  renderCase: (l: Lecture) => React.ReactNode;
  onEdit: (id: string) => void;
}

const Collections = ({ store, dark, renderCase, onEdit }: CollectionsProps) => {
  const t = tokens(dark);
  const lib = store.getLibrary();
  const shelves = collectionsInOrder(lib);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const create = () => {
    const clean = name.trim();
    if (!clean) return;
    store.createCollection(clean);
    setName('');
    setNaming(false);
  };

  const linkBtn = `text-[12px] font-ui font-bold underline underline-offset-2 ${t.body}`;

  return (
    <div className="space-y-10">
      {shelves.map(c => {
        const cases = c.lectureIds.map(id => lib.lectures[id]).filter((l): l is Lecture => !!l && !l.deletedAt);
        return (
          <ShelfRow
            key={c.id}
            dark={dark}
            label={
              <span className="flex items-baseline gap-3 normal-case tracking-normal">
                <span className={`font-accent text-[20px] ${t.heading}`}>{c.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.06em]">{cases.length}</span>
              </span>
            }
            right={<button type="button" className={linkBtn} onClick={() => onEdit(c.id)}>Edit</button>}
          >
            {cases.length ? cases.map(renderCase) : (
              <span className="flex items-center gap-5 shrink-0">
                <span className="ln-empty-case" aria-hidden="true">+</span>
                <span className={`text-[13px] font-ui max-w-[240px] ${t.muted}`}>Open a lecture and put it on this shelf.</span>
              </span>
            )}
          </ShelfRow>
        );
      })}

      {naming ? (
        <form className="flex flex-wrap items-center gap-3" onSubmit={e => { e.preventDefault(); create(); }}>
          <input
            className={`${t.input} max-w-xs`}
            value={name}
            onChange={e => setName(e.target.value.slice(0, 80))}
            onKeyDown={e => { if (e.key === 'Escape') { setNaming(false); setName(''); } }}
            placeholder="Before the mock"
            aria-label="Collection name"
            autoFocus
          />
          <button type="submit" disabled={!name.trim()} className={`${btn} h-10 px-4 ${t.primary}`}>Create</button>
          <button type="button" onClick={() => { setNaming(false); setName(''); }} className={`${btn} h-10 px-4 ${t.ghost}`}>Cancel</button>
        </form>
      ) : (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-ui ${t.muted}`}>
          {!shelves.length && <span>Group lectures for a mock, a weak chapter, a revision week.</span>}
          <button type="button" className={linkBtn} onClick={() => setNaming(true)}>New collection</button>
        </div>
      )}
    </div>
  );
};

interface CaseProps {
  lecture: Lecture;
  dark: boolean;
  now: number;
  done: boolean;
  /** Share watched, for the thin line under a case that is started but not done. */
  fraction: number;
  isNew: boolean;
  onOpen: (rect: DOMRect | null) => void;
}

const CaseButton = ({ lecture, dark, now, done, fraction, isNew, onOpen }: CaseProps) => {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isNew) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [isNew]);
  const title = displayTitle(lecture, now);
  const code = codeOf(lecture);
  return (
    <span className="shrink-0">
      <button
        ref={ref}
        type="button"
        className="ln-pick"
        onClick={() => onOpen(ref.current?.querySelector('.ln-case')?.getBoundingClientRect() ?? null)}
        aria-label={`${code}, ${title}${done ? ', watched' : fraction > 0.01 ? `, ${Math.round(fraction * 100)}% watched` : ''}`}
      >
        <CdCase
          code={code}
          title={title}
          subject={lecture.subject}
          art={coverArt(lecture.id)}
          chapter={chapterName(lecture.chapterKey)}
          size={136}
          finish={dark ? 'ink' : 'paper'}
          done={done}
        />
      </button>
      {!done && fraction > 0.01 && (
        <span className="ln-progress" aria-hidden="true"><span style={{ width: `${Math.round(fraction * 100)}%` }} /></span>
      )}
      {isNew && <span className="ln-new">● New</span>}
    </span>
  );
};

/* ── Locked ── */

const LOCKED: Record<LockWhy, { title: string; body: string }> = {
  offline: { title: "You're offline.", body: 'Your shelf is locked until you sign in online once. Then it opens here, even offline.' },
  unreachable: { title: "Couldn't reach Alpha.", body: 'Your internet works, but Alpha did not answer. A blocker or network filter may be in the way. Try again.' },
  'not-set-up': { title: "Learn isn't switched on for Alpha yet.", body: "It's coming. Your shelf will be here." },
  'not-member': { title: 'Learn is for Alpha members.', body: 'Get in with an Access Pass and your shelf opens.' },
  'signed-out': { title: 'Sign in to open your shelf.', body: 'Your shelf is locked to your account.' },
  'wrong-key': { title: "This shelf can't be opened.", body: "It was locked with a key this account doesn't have. Start a new shelf on this device to keep going." },
  error: { title: "Couldn't open your shelf.", body: 'Try again.' },
};

interface LockedProps {
  why: LockWhy;
  dark: boolean;
  onRetry: () => void;
  onSignIn: () => void;
  onReset?: () => void;
}

const Locked = ({ why, dark, onRetry, onSignIn, onReset }: LockedProps) => {
  const t = tokens(dark);
  const copy = LOCKED[why];
  return (
    <div className="space-y-8 pb-16">
      <PageHeader title="Learn" dark={dark} />
      <section className={`rounded-xl border p-8 md:p-10 space-y-4 max-w-xl ${t.card}`} role="status">
        <h2 className={`font-display text-2xl ${t.heading}`}>{copy.title}</h2>
        <p className={`text-sm font-ui ${t.muted}`}>{copy.body}</p>
        <div className="flex flex-wrap gap-3 pt-1">
          {why === 'signed-out' && <button type="button" onClick={onSignIn} className={`${btn} h-11 px-5 ${t.primary}`}>Sign in</button>}
          {(why === 'offline' || why === 'unreachable' || why === 'error') && <button type="button" onClick={onRetry} className={`${btn} h-11 px-5 ${t.primary}`}>Try again</button>}
          {why === 'wrong-key' && onReset && (
            <button
              type="button"
              onClick={() => { if (window.confirm('Start a new shelf on this device? The locked one is deleted. It cannot be opened anyway.')) onReset(); }}
              className={`${btn} h-11 px-5 ${t.ghost}`}
            >
              Start a new shelf
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
