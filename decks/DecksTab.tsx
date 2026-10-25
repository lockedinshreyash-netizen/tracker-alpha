/* ── Decks ──
   The container. It owns every fetch and every sheet; Library, DeckView,
   ReviewSession and the sheets are presentational and take narrow props, the
   shape schedule/PlanTab.tsx and mocks/MocksTab.tsx keep.

   Nothing here touches AppState. Decks live in their own tables
   (supabase/decks.sql) — a 1,500-card deck inside the synced blob would be
   re-uploaded on every state change — so no deck action ever fires
   triggerSync, and reviews go through decks/outbox.ts instead.

   Reached only through React.lazy from App.tsx: ts-fsrs, the CSV reader and
   (later, on demand) KaTeX never reach anyone who does not open this tab.

   Views: the library, a deck, a pack, a formula sheet and a kit (each in My
   Alpha). A pack is studied as one session across its decks. The store
   itself moved to its own tab (store/StoreTab.tsx); the sign here leads
   there, and what is taken there is opened here through `intent`. */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { pushToast } from '../notify/toastBus';
import type { ExamPreference } from '../types';
import {
  addPack, addToLibrary, createDeck, deckTags, deleteDeck, deleteNotes, deletePack, exploreDecks, explorePacks, fetchActivity,
  fetchAdminStats, fetchAllNotes, fetchNote, fetchSummaries, humanError, listNotes, packPreview, removeFromLibrary, removePack,
  resetDeckProgress, setDeckStatus, setNoteSuspended, setDeckCollection, setPackDecks, setPackStatus, suspendedNotes, updateDeck,
  updateDeckSettings, updatePack,
} from './api';
import { exportFileName, exportNotes } from './exportCsv';
import { flush } from './outbox';
import { deckAccent } from './theme';
import Library from './Library';
import DeckView, { DeckSource } from './DeckView';
import ReviewSession from './ReviewSession';
import CardEditor from './CardEditor';
import ImportSheet from './ImportSheet';
import { DeckDetailsSheet, SettingsSheet } from './DeckSheets';
import { COLLECTION_COPY } from './AudiencePicker';
import PackView from './PackView';
import { PackSheet } from './PackSheet';
import { packTotals } from './Packs';
import { checkout } from './store/checkout';
import { useReducedMotion } from './store/env';
import SheetView from './SheetView';
import KitView from './KitView';
import { addSheet, exploreKits, exploreSheets, removeKit, removeSheet } from '../store/api';
import type { StoreSection, Kit, KitItem, Sheet } from '../store/types';
import { KITS_LAUNCHED, STORE_LAUNCHED } from '../store/launch';

// Until the Alpha Store launches, the packs store lives here, as it did. Its
// rack physics and opening animation load only when it opens.
const PackStore = React.lazy(() => import('./store/PackStore'));
import type { AdminDeckStat, DeckStatus, DeckSummary, DecksIntent, ExploreDeck, Note, Pack } from './types';

interface Props {
  user: User | null;
  isAdmin: boolean;
  theme: 'dark' | 'light';
  examPreference: ExamPreference;
  onOpenAuth: () => void;
  /** Something to open once: a deck from the console, or what was just taken in the Store. */
  intent?: DecksIntent | null;
  onIntentHandled?: () => void;
  /** The store sign: the Alpha Store, on its Packs section. */
  onOpenStore: (section: StoreSection) => void;
}

type View =
  | { kind: 'library' }
  | { kind: 'deck'; id: string; fromPack?: string; fromKit?: string }
  | { kind: 'pack'; id: string; fromKit?: string }
  | { kind: 'sheet'; id: string; fromKit?: string }
  | { kind: 'kit'; id: string }
  /* The packs store inside Decks, used only while the Alpha Store is not launched. */
  | { kind: 'store' };
type Review = { deckId: string; tags: string[] | null } | { packId: string };
interface EditorState { deckId: string; note: Note | null; done?: (n: Note | null) => void }

const source: DeckSource = {
  activity: id => fetchActivity(id, 14),
  notes: (id, opts) => listNotes(id, opts),
  tags: id => deckTags(id),
  suspended: (id, noteIds) => suspendedNotes(id, noteIds),
};

const PACK_CONFIRM: Record<DeckStatus, string> = {
  published: 'Publish this pack? It goes on the store racks for every student, and its draft decks are published with it.',
  draft: 'Unpublish this pack? It leaves the store. Students who already have it keep it.',
  archived: 'Archive this pack? It leaves the store. Students who already have it keep studying it.',
};

const STATUS_CONFIRM: Record<DeckStatus, string> = {
  published: 'Publish this deck? Every student will see it in the Alpha library.',
  draft: 'Unpublish this deck? Students who have it lose it until you publish it again. Their progress is kept.',
  archived: 'Archive this deck? It leaves the library. Students who already have it keep studying it.',
};

const DecksTab: React.FC<Props> = ({ user, isAdmin, theme, examPreference, onOpenAuth, intent, onIntentHandled, onOpenStore }) => {
  const dark = theme === 'dark';
  const uid = user?.id ?? null;
  const reduced = useReducedMotion();
  const [allSummaries, setSummaries] = useState<DeckSummary[] | null>(null);
  /* A sheet's formulas (collection 'sheet') are a deck only to an
     administrator, who can open one from the console to fix a typo. They are
     never drawn on the shelf or counted as cards to study. */
  const summaries = useMemo(() => allSummaries?.filter(d => d.collection !== 'sheet') ?? null, [allSummaries]);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [explore, setExplore] = useState<ExploreDeck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[] | null>(null);
  const [view, setView] = useState<View>({ kind: 'library' });
  const [review, setReview] = useState<Review | null>(null);
  const [packSheet, setPackSheet] = useState<{ pack: Pack | null; decks: AdminDeckStat[] } | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [importing, setImporting] = useState<{ deckId: string | null } | null>(null);
  const [details, setDetails] = useState<{ deckId: string | null } | null>(null);
  const [settings, setSettings] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const saved = useRef(false);

  /* ── Data ── */
  const refresh = useCallback(async () => {
    if (!uid) return;
    try {
      const s = await fetchSummaries();
      setSummaries(s);
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, [uid]);

  const refreshExplore = useCallback(async () => {
    if (!uid) return;
    // A database that predates sheets and kits simply shows none.
    await Promise.all([
      exploreDecks().then(setExplore).catch(() => setExplore([])),
      explorePacks().then(setPacks).catch(() => setPacks([])),
      // Sheets and kits are the Alpha Store's; nothing asks for them before it launches.
      STORE_LAUNCHED ? exploreSheets().then(setSheets).catch(() => setSheets([])) : setSheets([]),
      STORE_LAUNCHED && KITS_LAUNCHED ? exploreKits().then(setKits).catch(() => setKits([])) : setKits([]),
    ]);
  }, [uid]);

  useEffect(() => {
    if (!uid) { setSummaries(null); setExplore(null); setPacks(null); setSheets(null); setKits(null); return; }
    // Answers left in the outbox by a tab closed mid-session land first, so
    // the counts drawn here already include them.
    flush(uid).finally(() => { void refresh(); });
    refreshExplore();
  }, [uid, refresh, refreshExplore]);

  // Something to open, once. The console asked for a deck: put it on the
  // shelf (admins can read every Alpha deck) and open it. The Store just gave
  // the student a pack, sheet or kit: load it and open its page.
  useEffect(() => {
    if (!intent || !uid) return;
    onIntentHandled?.();
    const go = async () => {
      if (intent.kind === 'deck') {
        await addToLibrary(intent.id).catch(() => undefined);
        await refresh();
      } else {
        await Promise.all([refresh(), refreshExplore()]);
      }
      setView({ kind: intent.kind, id: intent.id });
    };
    void go();
  }, [intent, uid, refresh, refreshExplore, onIntentHandled]);

  const deckById = useCallback((id: string) => allSummaries?.find(d => d.id === id) ?? null, [allSummaries]);
  const canEdit = useCallback((d: DeckSummary | null) => !!d && ((d.scope === 'personal' && d.ownerId === uid) || (d.scope === 'global' && isAdmin)), [uid, isAdmin]);
  const editable = useMemo(() => (summaries ?? []).filter(canEdit), [summaries, canEdit]);
  const current = view.kind === 'deck' ? deckById(view.id) : null;
  const packById = useCallback((id: string) => packs?.find(p => p.id === id) ?? null, [packs]);
  const sheetById = useCallback((id: string) => sheets?.find(x => x.id === id) ?? null, [sheets]);
  const kitById = useCallback((id: string) => kits?.find(k => k.id === id) ?? null, [kits]);
  const decksOfPack = useCallback((id: string) => (summaries ?? []).filter(d => d.packId === id), [summaries]);
  const reviewing = review && 'deckId' in review ? deckById(review.deckId) : null;
  const reviewingPack = review && 'packId' in review ? packById(review.packId) : null;

  // Tag suggestions for the editor come from the deck being edited.
  useEffect(() => {
    if (!editor) return;
    deckTags(editor.deckId).then(setTags).catch(() => setTags([]));
  }, [editor]);

  const fail = (e: unknown) => pushToast({ id: 'dk-error', title: humanError(e), tone: 'alert' });

  /* ── Actions ── */
  const onAddExplore = async (id: string) => {
    try {
      await addToLibrary(id);
      await refresh();
      refreshExplore();
      pushToast({ id: 'dk-added', title: 'Added to your decks.', tone: 'good' });
    } catch (e) { fail(e); }
  };

  const onStudyExplore = async (id: string) => {
    try {
      await addToLibrary(id);
      await refresh();
      refreshExplore();
      setReview({ deckId: id, tags: null });
    } catch (e) { fail(e); }
  };

  const onExport = async (d: DeckSummary) => {
    try {
      const notes = await fetchAllNotes(d.id);
      const blob = new Blob([exportNotes(notes)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFileName(d.title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      pushToast({ id: 'dk-export', title: `${notes.length.toLocaleString()} cards saved to a file.`, tone: 'good' });
    } catch (e) { fail(e); }
  };

  const onSetStatus = async (d: DeckSummary, status: DeckStatus) => {
    if (!window.confirm(STATUS_CONFIRM[status])) return;
    try {
      await setDeckStatus(d.id, status);
      await refresh();
      pushToast({ id: 'dk-status', title: status === 'published' ? 'Published. Every student can see it now.' : status === 'draft' ? 'Unpublished.' : 'Archived.', tone: 'good' });
    } catch (e) { fail(e); }
  };

  const onDelete = async (d: DeckSummary) => {
    const who = d.scope === 'global' ? ' Every student loses it, and their progress on it.' : '';
    if (!window.confirm(`Delete "${d.title}" and all ${d.total} cards?${who} This can't be undone.`)) return;
    try {
      await deleteDeck(d.id);
      setView({ kind: 'library' });
      await refresh();
    } catch (e) { fail(e); }
  };

  const onRemove = async (d: DeckSummary) => {
    if (!window.confirm(`Remove "${d.title}" from your decks? Your progress is kept if you add it back.`)) return;
    try {
      await removeFromLibrary(d.id);
      setView({ kind: 'library' });
      await refresh();
      refreshExplore();
    } catch (e) { fail(e); }
  };

  /* ── Packs ── */

  /** Take a pack. Resolves only once the server agrees it is yours. */
  const acquirePack = useCallback(async (pack: Pack) => {
    if (!pack.unlocked) {
      const paid = await checkout(pack);
      if ('message' in paid) throw new Error(paid.message);
    }
    try { await addPack(pack.id); } catch (e) { throw new Error(humanError(e)); }
  }, []);

  const loadPreview = useCallback((id: string) => packPreview(id), []);

  const studyPack = (pack: Pack) => {
    const ids = decksOfPack(pack.id).filter(d => (isAdmin || d.status !== 'draft') && d.due + d.newAvailable > 0);
    if (!ids.length) return;
    setReview({ packId: pack.id });
  };

  const onPackStatus = async (pack: Pack, status: DeckStatus) => {
    if (!window.confirm(PACK_CONFIRM[status])) return;
    try {
      await setPackStatus(pack.id, status, true);
      await refresh();
      refreshExplore();
      pushToast({ id: 'dk-pack', title: status === 'published' ? 'Pack published. It is on the racks now.' : status === 'draft' ? 'Pack unpublished.' : 'Pack archived.', tone: 'good' });
    } catch (e) { fail(e); }
  };

  const openPackSheet = async (pack: Pack | null) => {
    try { setPackSheet({ pack, decks: (await fetchAdminStats()).filter(d => d.collection !== 'sheet') }); } catch (e) { fail(e); }
  };

  /* ── Kits ── */

  /** Is this item of a kit on the caller's shelf? */
  const onShelf = (item: KitItem): boolean =>
    item.kind === 'pack' ? !!packById(item.id)?.inLibrary
      : item.kind === 'sheet' ? !!sheetById(item.id)?.inLibrary
        : !!deckById(item.id);

  const openKitItem = (kitId: string, item: KitItem) => setView({ kind: item.kind, id: item.id, fromKit: kitId });

  /** Something added to a kit after it was taken: already unlocked by the kit, so adding is free. */
  const addKitItem = async (item: KitItem) => {
    try {
      if (item.kind === 'pack') await addPack(item.id);
      else if (item.kind === 'sheet') await addSheet(item.id);
      else await addToLibrary(item.id);
      await refresh();
      await refreshExplore();
    } catch (e) { fail(e); }
  };

  /* ── Render ── */
  if (!user) {
    return (
      <Library dark={dark} isAdmin={false} signedIn={false} summaries={null} explore={null} error={null}
        onOpenDeck={() => undefined} onReview={() => undefined} onNewDeck={onOpenAuth} onImport={onOpenAuth}
        onAddExplore={async () => onOpenAuth()} onStudyExplore={onOpenAuth} onOpenAuth={onOpenAuth} onRetry={() => undefined} />
    );
  }

  const viewPack = view.kind === 'pack' ? packById(view.id) : null;
  const fromPack = view.kind === 'deck' && view.fromPack ? packById(view.fromPack) : null;

  return (
    <>
      {view.kind === 'store' ? (
        <React.Suspense fallback={<div className="h-[60vh]" aria-busy="true" />}>
          <PackStore
            packs={packs}
            dark={dark}
            examPreference={examPreference}
            isAdmin={isAdmin}
            owned={(packs ?? []).filter(p => p.inLibrary).length}
            onBack={() => setView({ kind: 'library' })}
            onOpenOwned={id => setView({ kind: 'pack', id })}
            acquire={acquirePack}
            loadPreview={loadPreview}
            onAcquired={async id => {
              await refresh();
              refreshExplore();
              setView({ kind: 'pack', id });
            }}
          />
        </React.Suspense>
      ) : view.kind === 'sheet' && sheetById(view.id) ? (
        <SheetView
          sheet={sheetById(view.id)!}
          dark={dark}
          backLabel={view.fromKit ? kitById(view.fromKit)?.title ?? 'Decks' : 'Decks'}
          onBack={() => setView(view.fromKit ? { kind: 'kit', id: view.fromKit } : { kind: 'library' })}
          onRemove={async () => {
            const sh = sheetById(view.id)!;
            if (!window.confirm(`Remove "${sh.title}" from My Alpha? It stays yours: add it back from the store any time.`)) return;
            try { await removeSheet(sh.id); setView({ kind: 'library' }); await refreshExplore(); } catch (e) { fail(e); }
          }}
        />
      ) : view.kind === 'kit' && kitById(view.id) ? (
        <KitView
          kit={kitById(view.id)!}
          dark={dark}
          reduced={reduced}
          onShelf={onShelf}
          onBack={() => setView({ kind: 'library' })}
          onOpenItem={item => openKitItem(view.id, item)}
          onAddItem={item => addKitItem(item)}
          onRemove={async () => {
            const k = kitById(view.id)!;
            if (!window.confirm(`Remove "${k.title}" and everything it brought from My Alpha? It stays yours, and your progress is kept: add it back from the store any time.`)) return;
            try { await removeKit(k.id); setView({ kind: 'library' }); await refresh(); await refreshExplore(); } catch (e) { fail(e); }
          }}
        />
      ) : view.kind === 'pack' && viewPack ? (
        <PackView
          pack={viewPack}
          decks={decksOfPack(viewPack.id)}
          dark={dark}
          isAdmin={isAdmin}
          onBack={() => setView(view.fromKit ? { kind: 'kit', id: view.fromKit } : { kind: 'library' })}
          onStudy={() => studyPack(viewPack)}
          onAdd={async () => {
            try { await acquirePack(viewPack); await refresh(); refreshExplore(); } catch (e) { pushToast({ id: 'dk-error', title: e instanceof Error ? e.message : humanError(e), tone: 'alert' }); }
          }}
          onRemove={async () => {
            if (!window.confirm(`Remove "${viewPack.title}" from My Alpha? Your progress is kept if you add it back.`)) return;
            try { await removePack(viewPack.id); setView({ kind: 'library' }); await refresh(); refreshExplore(); } catch (e) { fail(e); }
          }}
          onOpenDeck={id => setView({ kind: 'deck', id, fromPack: viewPack.id })}
          onReviewDeck={id => setReview({ deckId: id, tags: null })}
          onEdit={isAdmin ? () => void openPackSheet(viewPack) : undefined}
          onSetStatus={isAdmin ? st => void onPackStatus(viewPack, st) : undefined}
          onDelete={isAdmin ? async () => {
            if (!window.confirm(`Delete the pack "${viewPack.title}"? Its decks stay, as Alpha decks on their own. This can't be undone.`)) return;
            try { await deletePack(viewPack.id); setView({ kind: 'library' }); await refresh(); refreshExplore(); } catch (e) { fail(e); }
          } : undefined}
        />
      ) : view.kind === 'deck' && current ? (
        <DeckView
          deck={current}
          pack={current.packId ? packById(current.packId) : null}
          backLabel={fromPack ? fromPack.title : view.kind === 'deck' && view.fromKit ? kitById(view.fromKit)?.title ?? 'Decks' : 'Decks'}
          dark={dark}
          canEdit={canEdit(current)}
          isAdmin={isAdmin}
          source={source}
          version={version}
          onBack={() => setView(fromPack ? { kind: 'pack', id: fromPack.id } : view.kind === 'deck' && view.fromKit ? { kind: 'kit', id: view.fromKit } : { kind: 'library' })}
          onReview={t => setReview({ deckId: current.id, tags: t ?? null })}
          onAddCard={() => { saved.current = false; setEditor({ deckId: current.id, note: null }); }}
          onEditNote={n => { saved.current = false; setEditor({ deckId: current.id, note: n }); }}
          onDeleteNote={async n => { try { await deleteNotes([n.id]); void refresh(); } catch (e) { fail(e); throw e; } }}
          onSuspendNote={async (n, s) => { try { await setNoteSuspended(n.id, s); void refresh(); } catch (e) { fail(e); throw e; } }}
          onImport={() => setImporting({ deckId: current.id })}
          onExport={() => void onExport(current)}
          onSettings={() => setSettings(current.id)}
          onRemove={() => void onRemove(current)}
          onDelete={() => void onDelete(current)}
          onSetStatus={s => void onSetStatus(current, s)}
          onSetCollection={async c => {
            try {
              await setDeckCollection(current.id, c);
              await refresh();
              refreshExplore();
              pushToast({ id: 'dk-shelf', title: `Moved to ${COLLECTION_COPY[c].title}.`, tone: 'good' });
            } catch (e) { fail(e); }
          }}
        />
      ) : (
        <Library
          dark={dark}
          isAdmin={isAdmin}
          signedIn
          summaries={summaries}
          explore={explore}
          error={error}
          onOpenDeck={id => setView({ kind: 'deck', id })}
          onReview={id => setReview({ deckId: id, tags: null })}
          onNewDeck={() => setDetails({ deckId: null })}
          onImport={() => setImporting({ deckId: null })}
          onAddExplore={onAddExplore}
          onStudyExplore={id => void onStudyExplore(id)}
          onOpenAuth={onOpenAuth}
          onRetry={() => void refresh()}
          packs={packs}
          onOpenStore={() => {
            if (STORE_LAUNCHED) { onOpenStore('packs'); return; }
            refreshExplore();
            setView({ kind: 'store' });
          }}
          sheets={sheets}
          kits={kits}
          onOpenSheet={id => setView({ kind: 'sheet', id })}
          onOpenKit={id => setView({ kind: 'kit', id })}
          onOpenPack={id => setView({ kind: 'pack', id })}
          onReviewPack={id => { const pk = packById(id); if (pk) studyPack(pk); }}
        />
      )}

      {reviewingPack && uid && (() => {
        const decks = decksOfPack(reviewingPack.id).filter(d => (isAdmin || d.status !== 'draft') && d.due + d.newAvailable > 0);
        const first = decks[0];
        if (!first) return null;
        return (
          <ReviewSession
            uid={uid}
            deck={{ id: `pack:${reviewingPack.id}`, title: reviewingPack.title, desiredRetention: first.desiredRetention, subject: reviewingPack.subject, chapter: null, nextDue: packTotals(decksOfPack(reviewingPack.id)).nextDue }}
            deckIds={decks.map(d => d.id)}
            deckInfo={Object.fromEntries(decks.map(d => [d.id, { title: d.title, desiredRetention: d.desiredRetention, subject: d.subject }]))}
            resumeKey={`pack:${reviewingPack.id}`}
            dark={dark}
            onEdit={isAdmin ? (noteId, deckId, done) => {
              fetchNote(noteId)
                .then(note => { saved.current = false; setEditor({ deckId, note, done }); })
                .catch(e => { fail(e); done(null); });
            } : undefined}
            onExit={() => {
              setReview(null);
              void flush(uid).finally(() => { void refresh(); setVersion(v => v + 1); });
            }}
          />
        );
      })()}

      {review && reviewing && uid && (
        <ReviewSession
          uid={uid}
          deck={{ id: reviewing.id, title: reviewing.title, desiredRetention: reviewing.desiredRetention, subject: reviewing.subject, chapter: reviewing.chapter, nextDue: reviewing.nextDue }}
          dark={dark}
          tags={'tags' in review ? review.tags : null}
          onEdit={canEdit(reviewing) ? (noteId, deckId, done) => {
            fetchNote(noteId)
              .then(note => { saved.current = false; setEditor({ deckId, note, done }); })
              .catch(e => { fail(e); done(null); });
          } : undefined}
          onExit={() => {
            setReview(null);
            // Refresh after the session's last answers have landed, so the deck
            // page does not show cards as still due that were just answered.
            void flush(uid).finally(() => { void refresh(); setVersion(v => v + 1); });
          }}
        />
      )}

      {editor && (() => {
        const d = deckById(editor.deckId);
        return (
          <CardEditor
            deckId={editor.deckId}
            deckTitle={d?.title ?? ''}
            isGlobal={d?.scope === 'global'}
            dark={dark}
            accent={deckAccent(d?.subject ?? null, dark)}
            note={editor.note}
            suggestions={tags}
            onClose={() => {
              if (!saved.current) editor.done?.(null);
              setEditor(null);
              void refresh();
              setVersion(v => v + 1);
            }}
            onSaved={n => { saved.current = true; editor.done?.(n); }}
          />
        );
      })()}

      {importing && uid && (
        <ImportSheet
          uid={uid}
          dark={dark}
          isAdmin={isAdmin}
          decks={editable}
          presetDeckId={importing.deckId}
          onClose={() => setImporting(null)}
          onImported={async id => { await refresh(); setVersion(v => v + 1); setView({ kind: 'deck', id }); }}
        />
      )}

      {details && uid && (() => {
        const d = details.deckId ? deckById(details.deckId) : null;
        return (
          <DeckDetailsSheet
            dark={dark}
            isAdmin={isAdmin}
            examPreference={examPreference}
            initial={d ? { title: d.title, description: d.description, subject: d.subject, classId: d.classId, chapter: d.chapter } : null}
            initialCollection={d?.scope === 'global' ? d.collection : null}
            onClose={() => setDetails(null)}
            onSubmit={async (meta, audience) => {
              try {
                if (d) {
                  await updateDeck(d.id, meta);
                  if (d.scope === 'global' && isAdmin && audience.collection !== d.collection) await setDeckCollection(d.id, audience.collection);
                  await refresh();
                } else {
                  const id = await createDeck(uid, isAdmin ? audience.scope : 'personal', meta, audience.collection);
                  await refresh();
                  setView({ kind: 'deck', id });
                  saved.current = false;
                  setEditor({ deckId: id, note: null });
                }
              } catch (e) {
                throw new Error(humanError(e));
              }
            }}
          />
        );
      })()}

      {packSheet && (
        <PackSheet
          dark={dark}
          pack={packSheet.pack}
          decks={packSheet.decks}
          onClose={() => setPackSheet(null)}
          onSave={async (meta, deckIds) => {
            try {
              if (!packSheet.pack) throw new Error('Packs are made in the console.');
              await updatePack(packSheet.pack.id, meta);
              await setPackDecks(packSheet.pack.id, deckIds);
              await refresh();
              refreshExplore();
            } catch (e) {
              throw new Error(e instanceof Error && !('code' in e) ? e.message : humanError(e));
            }
          }}
        />
      )}

      {settings && (() => {
        const d = deckById(settings);
        if (!d) return null;
        return (
          <SettingsSheet
            deck={d}
            dark={dark}
            canEdit={canEdit(d)}
            onClose={() => setSettings(null)}
            onSave={async s => { try { await updateDeckSettings(d.id, s); await refresh(); } catch (e) { fail(e); } }}
            onReset={async () => { try { await resetDeckProgress(d.id); await refresh(); setVersion(v => v + 1); } catch (e) { fail(e); } }}
            onEditDetails={() => setDetails({ deckId: d.id })}
          />
        );
      })()}
    </>
  );
};

export default DecksTab;
