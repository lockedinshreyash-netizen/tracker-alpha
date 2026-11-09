/* ── Books, Learn's second shelf ──
   The student's own PDFs (NCERT, modules, DPPs, notes) as objects on a
   shelf: hardcovers, spiral modules, stapled DPPs. The file stays on this
   device (books/files.ts); the record that describes it is sealed in Learn's
   store beside the lectures. This file is its own chunk, reached from
   Learn's Lectures · Books switch, and it never loads pdf.js: only adding a
   book or opening one does (books/pdf.ts).

   Adding a book is: drop or pick a PDF, it is read once (fingerprint, page
   count, outline or chapter headings, page 1), the chapter map is proposed,
   and the sheet asks only to confirm. */

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { PageHeader, Sheet, tokens, btn } from '../ui/kit';
import { getChaptersFor } from '../constants';
import { subjectsFor } from '../learn/LectureFields';
import type { LearnStore } from '../learn/store';
import type { ExamPreference } from '../types';
import { Cover, defaultDesign } from './Cover';
import { BookFields, type Draft } from './BookFields';
import { chapterRefs, proposeMap } from './mapping';
import {
  BOOK_LIMITS, BOOK_SUBJECTS, KIND_LABEL, chapterOfKey, fractionRead, liveBooks, marksOf,
  type Book, type BookKind, type BookSubject,
} from './model';
import {
  StorageFullError, askToPersist, deleteFile, filesOnDevice, getFile, fingerprintOf, forgetThumbUrl, formatBytes, saveFile, saveThumb,
  storageInfo, thumbUrl, type StorageInfo,
} from './files';
import './books.css';

interface Props {
  store: LearnStore;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  /** Lectures · Books, drawn in the header. */
  switcher: React.ReactNode;
  onOpen: (bookId: string, page?: number) => void;
}

/* ── Which files are here, and their first pages ── */

export const useFilesHere = (owner: string) => {
  const [here, setHere] = useState<Set<string> | null>(null);
  const refresh = useCallback(() => { filesOnDevice(owner).then(setHere, () => setHere(new Set())); }, [owner]);
  useEffect(refresh, [refresh]);
  return { here, refresh };
};

export const useThumb = (owner: string, fingerprint: string | null, wanted: boolean): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!wanted || !fingerprint) { setUrl(null); return; }
    let live = true;
    void thumbUrl(owner, fingerprint).then(u => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [owner, fingerprint, wanted]);
  return url;
};

const kickerOf = (b: Book): string | null =>
  b.sections.length === 1 ? chapterOfKey(b.sections[0].chapterKey) : b.classId ? `Class ${b.classId}${b.subject ? ` · ${b.subject}` : ''}` : null;

/* ── One book on the shelf ── */

const BookButton = ({ book, owner, missing, progress, width, onOpen, onEdit }: {
  book: Book; owner: string; missing: boolean; progress: number; width: number; onOpen: () => void; onEdit: () => void;
}) => {
  const thumb = useThumb(owner, book.fingerprint, !!book.cover.firstPage);
  return (
    <span className="bk-pick" style={{ width }}>
      <button type="button" className="ln-pick" onClick={onOpen} aria-label={`${missing ? 'Add the file for' : 'Read'} ${book.title}`}>
        <Cover
          id={book.id} title={book.title} kind={book.kind} subject={book.subject} cover={book.cover}
          width={width} kicker={kickerOf(book)} progress={progress} thumb={thumb} missing={missing}
        />
      </button>
      <span className="bk-meta">
        <span className="bk-meta-row">
          <span className="bk-meta-title">{book.title}</span>
          <button type="button" className="bk-edit" onClick={onEdit} aria-label={`Edit ${book.title}: title, chapters, cover`} title="Edit title, chapters, cover">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
        </span>
        <span className="bk-meta-sub">{missing ? 'File on another device' : `${KIND_LABEL[book.kind]} · ${book.pages} ${book.pages === 1 ? 'page' : 'pages'}`}</span>
      </span>
    </span>
  );
};

const Row = ({ label, dark, children }: { label: React.ReactNode; dark: boolean; children: React.ReactNode }) => (
  <section className="mk-rise">
    <div className={`mb-4 text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</div>
    <div className="ln-shelf-row bk-row">{children}</div>
    <div className="ln-ledge" />
  </section>
);

/* ── Reading a file ── */

type Adding =
  | { step: 'reading'; name: string; progress: number }
  | { step: 'form'; file: File; fingerprint: string; pages: number; thumb: Blob | null; thumbUrl: string | null; draft: Draft; id: string }
  | { step: 'error'; message: string };

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export default function BooksShelf({ store, dark, examPreference, currentClass, switcher, onOpen }: Props) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  const lib = store.getLibrary();
  const owner = store.owner;
  const t = tokens(dark);
  const { here, refresh } = useFilesHere(owner);
  const [adding, setAdding] = useState<Adding | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; open?: string } | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [dragging, setDragging] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 112 : 136));

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth < 640 ? 112 : 136);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { void storageInfo().then(setStorage); }, [here]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const books = liveBooks(lib);
  const refs = useMemo(
    () => chapterRefs(subjectsFor(examPreference) as BookSubject[], (c, s) => getChaptersFor(examPreference, c, s)),
    [examPreference],
  );

  /* A PDF in: read it, then open the sheet on what was found. The same file
     already on the shelf opens instead; one removed lately comes back. */
  const take = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!isPdf(file)) { setAdding({ step: 'error', message: "That isn't a PDF. Books takes PDFs only." }); return; }
    if (file.size > BOOK_LIMITS.bytes) { setAdding({ step: 'error', message: `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(BOOK_LIMITS.bytes)}.` }); return; }
    setAdding({ step: 'reading', name: file.name, progress: 0 });
    try {
      const fingerprint = await fingerprintOf(file);
      const known = Object.values(store.getLibrary().books).find(b => b.fingerprint === fingerprint);
      const { inspectPdf, titleFromFileName } = await import('./pdf');
      if (known && !known.deletedAt) {
        // Already on the shelf. If its file was on another device, it is here now.
        await saveFile(owner, fingerprint, file);
        refresh();
        setAdding(null);
        setToast({ text: `${known.title} is already on your shelf.`, open: known.id });
        return;
      }
      const facts = await inspectPdf(file, p => setAdding(a => (a?.step === 'reading' ? { ...a, progress: p } : a)));
      const proposal = proposeMap({ ...facts, title: facts.title || titleFromFileName(file.name) }, refs);
      const id = known?.id ?? `new_${fingerprint.slice(0, 10)}`;
      const kind: BookKind = facts.pages <= 12 ? 'dpp' : proposal.sections.length > 1 || facts.pages >= 120 ? 'book' : 'notes';
      const subject = proposal.subject;
      const draft: Draft = known
        ? { title: known.title, kind: known.kind, subject: known.subject, classId: known.classId ?? currentClass, sections: known.sections, cover: known.cover }
        : {
          title: facts.title,
          kind: proposal.sections.length === 1 && facts.pages < 60 ? (facts.pages <= 12 ? 'dpp' : 'notes') : kind,
          subject,
          classId: proposal.classId ?? currentClass,
          sections: proposal.sections,
          cover: { design: defaultDesign(id, subject), finish: dark ? 'ink' : 'paper' },
        };
      setAdding({
        step: 'form', file, fingerprint, pages: facts.pages, thumb: facts.thumb,
        thumbUrl: facts.thumb ? URL.createObjectURL(facts.thumb) : null, draft, id,
      });
    } catch (e) {
      setAdding({ step: 'error', message: e instanceof Error ? e.message : 'This PDF could not be read.' });
    }
  }, [owner, refs, currentClass, dark, refresh, store]);

  const save = async () => {
    if (adding?.step !== 'form') return;
    const { file, fingerprint, pages, thumb, draft } = adding;
    try {
      await saveFile(owner, fingerprint, file);
      if (thumb) await saveThumb(owner, fingerprint, thumb);
    } catch (e) {
      setAdding({ step: 'error', message: e instanceof StorageFullError ? 'This device is out of space for books. Remove one to make room.' : "Couldn't save the file on this device." });
      return;
    }
    forgetThumbUrl(owner, fingerprint);
    const first = books.length === 0;
    const res = store.addBook({
      title: draft.title, kind: draft.kind, subject: draft.subject, classId: draft.subject ? draft.classId : undefined,
      sections: draft.subject ? draft.sections : [], cover: draft.cover, fingerprint, pages, bytes: file.size,
    });
    if (adding.thumbUrl) URL.revokeObjectURL(adding.thumbUrl);
    setAdding(null);
    refresh();
    if (first) void askToPersist();
    if (res.status === 'restored') {
      store.updateBook(res.book.id, {
        title: draft.title, kind: draft.kind, subject: draft.subject ?? null, classId: draft.subject ? draft.classId : null,
        sections: draft.subject ? draft.sections : [], cover: draft.cover,
      });
      const n = marksOf(res.shelf, res.book.id).length;
      setToast({ text: `${res.book.title} is back${n ? `, with ${n} ${n === 1 ? 'mark' : 'marks'}` : ''}.`, open: res.book.id });
    } else if (res.status === 'added') {
      setToast({ text: `${res.book.title} is on your shelf.`, open: res.book.id });
    } else if (res.status === 'full') {
      setToast({ text: `Your shelf holds ${BOOK_LIMITS.books} books. Remove one to add another.` });
    }
  };

  const cancelAdd = () => {
    if (adding?.step === 'form' && adding.thumbUrl) URL.revokeObjectURL(adding.thumbUrl);
    setAdding(null);
  };

  /* Drop a PDF anywhere on the shelf. */
  useEffect(() => {
    let depth = 0;
    const hasFile = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFile(e)) return; depth++; setDragging(true); };
    const leave = (e: DragEvent) => { if (!hasFile(e)) return; depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const over = (e: DragEvent) => { if (hasFile(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void take(e.dataTransfer?.files?.[0]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [take]);

  const openBook = (b: Book) => {
    if (here && !here.has(b.fingerprint)) { setEditing(b.id); return; }
    onOpen(b.id);
  };

  const progressOf = (b: Book) => fractionRead(lib.bookProgress[b.id], 1, b.pages);
  const item = (b: Book) => (
    <BookButton
      key={b.id}
      book={b}
      owner={owner}
      missing={!!here && !here.has(b.fingerprint)}
      progress={progressOf(b)}
      width={width}
      onOpen={() => openBook(b)}
      onEdit={() => setEditing(b.id)}
    />
  );

  const recent = books.filter(b => b.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)).slice(0, 8);
  const bySubject = [...BOOK_SUBJECTS, null].map(s => ({
    subject: s,
    list: books.filter(b => (b.subject ?? null) === s).sort((a, b) => a.title.localeCompare(b.title)),
  })).filter(r => r.list.length);

  const used = books.reduce((n, b) => n + (here?.has(b.fingerprint) ? b.bytes : 0), 0);
  const editingBook = editing ? lib.books[editing] : null;

  return (
    <div className="space-y-10 pb-16">
      <PageHeader
        title="Learn"
        subtitle={books.length ? `${books.length} ${books.length === 1 ? 'book' : 'books'} on your shelf.` : 'Bring your own books.'}
        dark={dark}
        right={
          <div className="flex items-center gap-2">
            {switcher}
            <button type="button" onClick={() => pickRef.current?.click()} className={`${btn} h-11 px-5 ${t.primary}`}>Add a PDF</button>
          </div>
        }
      />

      {books.length ? (
        <>
          {recent.length > 0 && <Row label="Continue reading" dark={dark}>{recent.map(item)}</Row>}
          {bySubject.map(r => (
            <Row key={r.subject ?? 'none'} label={`${r.subject ?? 'Other'} · ${r.list.length}`} dark={dark}>{r.list.map(item)}</Row>
          ))}
        </>
      ) : (
        <EmptyShelf dark={dark} onPick={() => pickRef.current?.click()} />
      )}

      <footer className={`text-[12px] font-ui ${t.faint} space-y-1`}>
        <p>
          {books.length
            ? `Your PDFs use ${formatBytes(used)} on this device. They never leave it.`
            : 'Your PDFs stay on this device. Alpha never uploads them.'}
          {storage && storage.quota > 0 && storage.used / storage.quota > 0.8 ? ' This device is nearly full.' : ''}
        </p>
        <p>
          Need NCERT? It's free from{' '}
          <a className={`underline underline-offset-2 ${t.body}`} href="https://ncert.nic.in/textbook.php" target="_blank" rel="noreferrer noopener">ncert.nic.in</a>.
        </p>
      </footer>

      <input
        ref={pickRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose a PDF"
        onChange={e => { void take(e.target.files?.[0]); e.target.value = ''; }}
      />

      {dragging && (
        <div className="bk-drop" aria-hidden="true">
          <div className="bk-drop-card">Drop the PDF to put it on your shelf</div>
        </div>
      )}

      {adding && (
        <AddSheet
          adding={adding}
          exam={examPreference}
          dark={dark}
          onChange={draft => setAdding(a => (a?.step === 'form' ? { ...a, draft } : a))}
          onSave={() => void save()}
          onClose={cancelAdd}
        />
      )}

      {editingBook && !editingBook.deletedAt && (
        <EditSheet
          key={editingBook.id}
          store={store}
          book={editingBook}
          fileHere={!!here?.has(editingBook.fingerprint)}
          exam={examPreference}
          dark={dark}
          onAddFile={() => { setEditing(null); pickRef.current?.click(); }}
          onOpen={() => { setEditing(null); onOpen(editingBook.id); }}
          onRemoved={msg => { setEditing(null); refresh(); setToast({ text: msg }); }}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && (
        <div className="ln-toast" role="status">
          <span>{toast.text}</span>
          {toast.open && lib.books[toast.open] && !lib.books[toast.open].deletedAt && (
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => { setEditing(toast.open!); setToast(null); }}>Edit</button>
              <button type="button" onClick={() => { const id = toast.open!; setToast(null); openBook(lib.books[id]); }}>Read</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Nothing on the shelf yet ── */

const EmptyShelf = ({ dark, onPick }: { dark: boolean; onPick: () => void }) => {
  const t = tokens(dark);
  const finish = dark ? 'ink' : 'paper';
  return (
    <section className={`rounded-xl border p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-10 ${t.card}`}>
      <div className="bk-fan" aria-hidden="true">
        <span><Cover id="fan-a" title="Physics Part 1" kind="book" subject="Physics" cover={{ design: 'orbit-classic', finish }} width={104} kicker="Class 11" /></span>
        <span><Cover id="fan-b" title="Organic Module" kind="module" subject="Chemistry" cover={{ design: 'hex-band', finish }} width={104} kicker="Class 12" /></span>
        <span><Cover id="fan-c" title="DPP 07" kind="dpp" subject="Maths" cover={{ design: 'curve-classic', finish }} width={104} kicker="Integrals" /></span>
      </div>
      <div className="space-y-3 max-w-md">
        <h2 className={`font-display text-2xl ${t.heading}`}>Your books, inside Alpha.</h2>
        <p className={`text-sm font-ui ${t.body}`}>
          Add NCERT, your coaching modules and DPPs as PDFs. Highlight a line, turn it into a flashcard, send it to your notes, log a question you got wrong.
        </p>
        <p className={`text-sm font-ui ${t.muted}`}>The files stay on this device.</p>
        <button type="button" onClick={onPick} className={`${btn} h-11 px-5 ${t.primary}`}>Add your first PDF</button>
      </div>
    </section>
  );
};

/* ── Adding ── */

const AddSheet = ({ adding, exam, dark, onChange, onSave, onClose }: {
  adding: Adding; exam: ExamPreference; dark: boolean; onChange: (d: Draft) => void; onSave: () => void; onClose: () => void;
}) => {
  const t = tokens(dark);
  const header = (
    <div className="px-5 md:px-7 py-5">
      <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Add a book</p>
      <h2 className={`font-display text-xl mt-1 ${t.heading}`}>
        {adding.step === 'reading' ? 'Reading the file…' : adding.step === 'error' ? "Couldn't add it." : 'Check the details.'}
      </h2>
    </div>
  );
  const footer = adding.step === 'form' ? (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onClose} className={`${btn} h-11 px-5 ${t.ghost}`}>Cancel</button>
      <button type="button" onClick={onSave} disabled={!adding.draft.title.trim()} className={`${btn} h-11 px-6 ${t.primary}`}>Put it on the shelf</button>
    </div>
  ) : (
    <div className="flex justify-end">
      <button type="button" onClick={onClose} className={`${btn} h-11 px-5 ${t.ghost}`}>{adding.step === 'error' ? 'Close' : 'Cancel'}</button>
    </div>
  );
  return (
    <Sheet dark={dark} onClose={onClose} label="Add a book" width="md:w-[680px]" header={header} footer={footer}>
      <div className="px-5 md:px-7 py-6">
        {adding.step === 'reading' && (
          <div className="space-y-4">
            <p className={`text-sm font-ui ${t.body}`} style={{ overflowWrap: 'anywhere' }}>{adding.name}</p>
            <div className="bk-bar"><span style={{ width: `${Math.max(6, Math.round(adding.progress * 100))}%` }} /></div>
            <p className={`text-[12px] font-ui ${t.muted}`}>Finding its chapters. Nothing is uploaded.</p>
          </div>
        )}
        {adding.step === 'error' && <p className={`text-sm font-ui ${t.body}`}>{adding.message}</p>}
        {adding.step === 'form' && (
          <BookFields id={adding.id} draft={adding.draft} onChange={onChange} pages={adding.pages} exam={exam} dark={dark} thumb={adding.thumbUrl} />
        )}
      </div>
    </Sheet>
  );
};

/* ── Editing, and removing ── */

const EditSheet = ({ store, book, fileHere, exam, dark, onAddFile, onOpen, onRemoved, onClose }: {
  store: LearnStore; book: Book; fileHere: boolean; exam: ExamPreference; dark: boolean;
  onAddFile: () => void; onOpen: () => void; onRemoved: (message: string) => void; onClose: () => void;
}) => {
  const t = tokens(dark);
  const [draft, setDraft] = useState<Draft>({
    title: book.title, kind: book.kind, subject: book.subject, classId: book.classId ?? 11, sections: book.sections, cover: book.cover,
  });
  const [confirm, setConfirm] = useState(false);
  const thumb = useThumb(store.owner, book.fingerprint, true);
  const [finding, setFinding] = useState<'idle' | 'busy' | 'none' | 'done'>('idle');
  /** Bumped when the map is found again, so the fields start over on it (one chapter or several). */
  const [rev, setRev] = useState(0);

  /* Read the book's contents again with today's rules: its bookmarks or its
     printed Contents, never every page. Nothing is saved until Save. */
  const findAgain = async () => {
    setFinding('busy');
    try {
      const blob = await getFile(store.owner, book.fingerprint);
      if (!blob) { setFinding('none'); return; }
      const { inspectPdf } = await import('./pdf');
      const facts = await inspectPdf(new File([blob], `${book.title}.pdf`, { type: 'application/pdf' }));
      const refs = chapterRefs(subjectsFor(exam) as BookSubject[], (c, sub) => getChaptersFor(exam, c, sub));
      const p = proposeMap({ ...facts, title: book.title }, refs);
      if (!p.sections.length) { setFinding('none'); return; }
      setDraft(d => ({ ...d, subject: p.subject ?? d.subject, classId: p.classId ?? d.classId, sections: p.sections }));
      setRev(r => r + 1);
      setFinding('done');
    } catch {
      setFinding('none');
    }
  };

  const save = () => {
    store.updateBook(book.id, {
      title: draft.title, kind: draft.kind, subject: draft.subject ?? null, classId: draft.subject ? draft.classId : null,
      sections: draft.subject ? draft.sections : [], cover: draft.cover,
    });
    onClose();
  };

  const remove = async () => {
    try { await deleteFile(store.owner, book.fingerprint); } catch { /* the record still goes */ }
    forgetThumbUrl(store.owner, book.fingerprint);
    store.deleteBook(book.id);
    onRemoved(`${book.title} removed. Add the same PDF within 60 days to get your marks back.`);
  };

  const header = (
    <div className="px-5 md:px-7 py-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {KIND_LABEL[book.kind]} · {book.pages} pages · {formatBytes(book.bytes)}
        </p>
        <h2 className={`font-display text-xl mt-1 ${t.heading}`} style={{ overflowWrap: 'anywhere' }}>{book.title}</h2>
      </div>
      {fileHere
        ? <button type="button" onClick={onOpen} className={`${btn} h-10 px-4 shrink-0 ${t.primary}`}>Read</button>
        : <button type="button" onClick={onAddFile} className={`${btn} h-10 px-4 shrink-0 ${t.primary}`}>Add the file</button>}
    </div>
  );

  const footer = confirm ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className={`text-[12px] font-ui ${t.body}`}>Remove the book and its file from this device?</span>
      <span className="flex gap-2">
        <button type="button" onClick={() => setConfirm(false)} className={`${btn} h-10 px-4 ${t.ghost}`}>Keep it</button>
        <button type="button" onClick={() => void remove()} className={`${btn} h-10 px-4 ${t.primary}`}>Remove</button>
      </span>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={() => setConfirm(true)} className={`text-[12px] font-ui underline underline-offset-2 ${t.muted}`}>Remove book</button>
      <span className="flex gap-2">
        <button type="button" onClick={onClose} className={`${btn} h-11 px-5 ${t.ghost}`}>Cancel</button>
        <button type="button" onClick={save} disabled={!draft.title.trim()} className={`${btn} h-11 px-6 ${t.primary}`}>Save</button>
      </span>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={onClose} label={book.title} width="md:w-[680px]" header={header} footer={footer}>
      <div className="px-5 md:px-7 py-6 space-y-6">
        {!fileHere && (
          <p className={`rounded-lg border px-4 py-3 text-[13px] font-ui ${t.inset} ${t.body}`}>
            This book's file is on another device. Add the same PDF here to read it; your marks come with it.
          </p>
        )}
        {fileHere && (
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${t.inset}`}>
            <span className={`text-[13px] font-ui ${t.body}`} role="status">
              {finding === 'busy' ? 'Reading the contents…'
                : finding === 'done' ? (draft.sections.length === 1 ? 'Found 1 chapter. Check it, then Save.' : `Found ${draft.sections.length} chapters. Check them, then Save.`)
                  : finding === 'none' ? "Couldn't find a contents page. Add the chapters below."
                    : 'Chapters wrong? Alpha can read the contents again.'}
            </span>
            <button type="button" onClick={() => void findAgain()} disabled={finding === 'busy'} className={`${btn} h-9 px-4 ${t.ghost}`}>
              Find chapters again
            </button>
          </div>
        )}
        <BookFields key={rev} id={book.id} draft={draft} onChange={setDraft} pages={book.pages} exam={exam} dark={dark} thumb={thumb} />
      </div>
    </Sheet>
  );
};
