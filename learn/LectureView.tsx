/* ── One lecture: the screening room ──
   A lecture takes the whole screen (theater.css): the app's 1024px column
   left the video a third of a laptop wide. The room is always dark, lit only
   by the subject's colour from behind the screen. On a laptop: a top bar
   (back, the case's number and title, the clock, the notes panel switch),
   the screen sized to the room, the lecture's own timeline under it, the
   controls, and a panel of Notes and About that can be put away (T). On a
   phone it stacks and scrolls, the screen edge to edge.

   Before the first tap the screen shows this lecture's case on its subject's
   ground, never a YouTube thumbnail; nothing is fetched from YouTube until
   play (or until a mark's time is tapped, which plays from there).

   What is remembered, all in the encrypted library on this device:
   - where the student stopped: the player resumes three seconds early;
   - what was actually watched: WatchTracker (watch.ts) turns once-a-second
     readings into stretches, written every 15 seconds of play, on pause, on
     hide and on leaving, never per tick. A seek closes a stretch, so skipping
     to the end is not finishing. 90% watched puts the tick on the case;
   - bookmarks and notes, each at a second (MarksPanel.tsx), drawn on the
     timeline (LectureRail.tsx).

   Time studied is never logged by watching. Start the clock (the pill) is
   the student's own tap, the same stopwatch Today runs. Esc leaves the room
   when nothing else is open; the phone's back button does too (a history
   entry, kept by the shelf). */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './theater.css';
import { Overlay, btn, tokens } from '../ui/kit';
import YouTubePlayer from '../video/YouTubePlayer';
import PlayerControls from '../video/PlayerControls';
import { formatTime, resumeAt, watchUrl } from '../video/model';
import type { PlayerController } from '../video/controller';
import type { PlayerState } from '../video/youtube';
import { isArmed } from '../today/stopwatch';
import CdCase, { Art, paletteFor } from './CdCase';
import MarksPanel from './MarksPanel';
import LectureRail from './LectureRail';
import { ClockPill, type OtherSession } from './SessionStrip';
import EditSheet from './EditSheet';
import CollectionPicker from './CollectionPicker';
import { WatchTracker } from './watch';
import { discoverEnabled, refreshTitles } from './discover/api';
import {
  chapterName, codeOf, collectionsFor, coverArt, displayTitle, isComplete, live, marksFor, titleState, watchedFraction,
  type Lecture, type Library,
} from './model';
import type { LearnStore } from './store';
import type { ExamPreference, Subject, TimerState } from '../types';

interface Props {
  store: LearnStore;
  lecture: Lecture;
  dark: boolean;
  examPreference: ExamPreference;
  currentClass: 11 | 12;
  /** Where the case sat on the shelf, for the open animation. */
  fromRect: DOMRect | null;
  timer: TimerState;
  otherSession: OtherSession;
  onStartClock: (subject: Subject, chapter?: string) => boolean;
  onOpenToday: () => void;
  onWatching: (watching: boolean) => void;
  onBack: () => void;
  /** Open another lecture in this room (Up next). */
  onSwitch: (id: string) => void;
}

const FLUSH_EVERY_TICKS = 15;
const PANEL_KEY = 'learn_theater_panel_v1';
type Tab = 'notes' | 'about';

const ACCENT_RGB: Record<string, string> = {
  Physics: '74 144 226',
  Chemistry: '52 199 123',
  Maths: '155 89 226',
  Biology: '226 155 41',
};

const isTyping = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const readPanel = (): boolean => {
  try { return localStorage.getItem(PANEL_KEY) !== 'closed'; } catch { return true; }
};

/** What to watch after this one: the next on its first collection, else the next filed under its chapter. */
const upNext = (lib: Library, lecture: Lecture): Lecture | null => {
  for (const c of collectionsFor(lib, lecture.id)) {
    const i = c.lectureIds.indexOf(lecture.id);
    const next = c.lectureIds.slice(i + 1).map(id => lib.lectures[id]).find(l => l && !l.deletedAt);
    if (next) return next;
  }
  if (!lecture.chapterKey) return null;
  return live(lib.lectures)
    .filter(l => l.chapterKey === lecture.chapterKey && l.catalogueNo > lecture.catalogueNo && l.subject === lecture.subject)
    .sort((a, b) => a.catalogueNo - b.catalogueNo)[0] ?? null;
};

export default function LectureView({
  store, lecture, dark, examPreference, currentClass, fromRect, timer, otherSession, onStartClock, onOpenToday, onWatching, onBack, onSwitch,
}: Props) {
  const t = tokens(true);
  const lib = store.getLibrary();
  const marks = marksFor(lib, lecture.id);
  const progress = lib.progress[lecture.id] && !lib.progress[lecture.id].deletedAt ? lib.progress[lecture.id] : null;

  // Fixed for this visit: progress written while watching must not move the player.
  const [resumeFrom] = useState(() => (progress ? resumeAt(progress.position, progress.duration) : 0));
  const [seekStart, setSeekStart] = useState<number | null>(null);
  const [controller, setController] = useState<PlayerController | null>(null);
  const [pstate, setPstate] = useState<PlayerState>('unstarted');
  const [rate, setRate] = useState(1);
  const [plain, setPlain] = useState(false);
  const [composerAt, setComposerAt] = useState<number | null>(null);
  const [nudge, setNudge] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(readPanel);
  const [tab, setTab] = useState<Tab>('notes');
  const [frameH, setFrameH] = useState(0);
  const tracker = useRef(new WatchTracker());
  const lastTime = useRef(resumeFrom);
  const nudged = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const now = Date.now();
  const title = displayTitle(lecture, now);
  const code = codeOf(lecture);
  const chapter = chapterName(lecture.chapterKey);
  const art = coverArt(lecture.id);
  const pal = paletteFor(lecture.subject, 'ink');
  const done = isComplete(lib, lecture.id);
  const fraction = progress ? watchedFraction(progress) : 0;
  const next = upNext(lib, lecture);
  const playing = pstate === 'playing' || pstate === 'buffering';

  /* ── The room: the rail folds behind it, the page under it holds still ── */
  useEffect(() => {
    onWatching(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { onWatching(false); document.body.style.overflow = prev; };
  }, [onWatching]);

  useEffect(() => {
    try { localStorage.setItem(PANEL_KEY, panelOpen ? 'open' : 'closed'); } catch { /* private mode */ }
  }, [panelOpen]);

  /* ── The case on the shelf grows into the screen ── */
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!fromRect || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = el.getBoundingClientRect();
    if (!to.width || !to.height) return;
    const sx = fromRect.width / to.width;
    const sy = fromRect.height / to.height;
    el.animate(
      [
        { transform: `translate(${fromRect.left - to.left}px, ${fromRect.top - to.top}px) scale(${sx}, ${sy})`, opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 520, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    // Mount only: the rect is where the case was when it was tapped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The screen's height, so the case on its face is drawn to fit it.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── What was watched ── */
  const flush = useCallback(() => {
    for (const u of tracker.current.take()) store.recordWatch(lecture.id, u);
  }, [store, lecture.id]);

  useEffect(() => {
    if (!controller || pstate !== 'playing') return;
    let last = performance.now();
    let ticks = 0;
    const read = (dt: number) => {
      const time = controller.time();
      lastTime.current = time;
      tracker.current.tick(time, dt, controller.rate(), controller.duration());
    };
    read(0);
    const id = window.setInterval(() => {
      const n = performance.now();
      read((n - last) / 1000);
      last = n;
      if (++ticks % FLUSH_EVERY_TICKS === 0) flush();
    }, 1000);
    return () => window.clearInterval(id);
  }, [controller, pstate, flush]);

  useEffect(() => {
    if (!controller) return;
    if (pstate === 'paused' || pstate === 'ended' || pstate === 'buffering') {
      const time = pstate === 'ended' ? controller.duration() ?? controller.time() : controller.time();
      lastTime.current = time;
      tracker.current.stop(time);
      flush();
    }
  }, [controller, pstate, flush]);

  // Hiding the tab or leaving the page writes what is pending; so does leaving the lecture.
  useEffect(() => {
    const settle = () => { tracker.current.stop(lastTime.current); flush(); };
    const onVisibility = () => { if (document.hidden) settle(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', settle);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', settle);
      settle();
    };
  }, [flush]);

  /* ── A title from YouTube is refreshed before it is 30 days old ──
     (YouTube's policy for API data.) Asked once, on opening, for this
     lecture only; a title the student wrote is never touched, and a video
     YouTube no longer returns loses its title and shows its number. */
  useEffect(() => {
    if (lecture.titleSource !== 'youtube' || !discoverEnabled()) return;
    const state = titleState(lecture, Date.now());
    if (state !== 'stale' && state !== 'expired') return;
    let alive = true;
    void refreshTitles([lecture.videoId]).then(res => {
      if (!alive || !res.ok) return;
      const found = res.titles.find(x => x.id === lecture.videoId);
      if (found) store.refreshTitle(lecture.id, found.title);
    });
    return () => { alive = false; };
    // Once per lecture opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lecture.id]);

  /* ── The one reminder: first play with no clock running ── */
  useEffect(() => {
    if (pstate !== 'playing' || nudged.current) return;
    nudged.current = true;
    if (!isArmed(timer) && !otherSession) setNudge(true);
  }, [pstate, timer, otherSession]);

  /* ── Marks ── */
  const say = useCallback((text: string) => {
    setFlash(text);
    window.setTimeout(() => setFlash(f => (f === text ? null : f)), 2200);
  }, []);

  const bookmark = useCallback(() => {
    if (!controller) return;
    const at = controller.time();
    store.addMark({ lectureId: lecture.id, t: at, kind: 'bookmark' });
    say(`Bookmarked ${formatTime(at)}`);
  }, [controller, store, lecture.id, say]);

  const startNote = useCallback(() => {
    if (!controller) return;
    const at = controller.time();
    controller.pause();
    setPanelOpen(true);
    setTab('notes');
    setComposerAt(at);
  }, [controller]);

  const seek = useCallback((at: number) => {
    if (!controller) {
      // Not playing yet: play from that second.
      setSeekStart(Math.floor(at));
      return;
    }
    controller.seek(at);
    lastTime.current = at;
    if (pstate !== 'playing') tracker.current.moved(at);
  }, [controller, pstate]);

  // B, N, T and Esc, on Alpha's page (YouTube's keys apply once the player has focus).
  useEffect(() => {
    if (composerAt !== null || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'b' && controller) { e.preventDefault(); bookmark(); }
      else if (k === 'n' && controller) { e.preventDefault(); startNote(); }
      else if (k === 't') { e.preventDefault(); setPanelOpen(o => !o); }
      else if (e.key === 'Escape' && !confirming) { e.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, composerAt, editing, confirming, bookmark, startNote, onBack]);

  const caseSize = Math.max(96, Math.min(320, Math.round(frameH * 0.6)));
  const face = (
    <span className="absolute inset-0 flex items-center justify-center" style={{ background: `radial-gradient(120% 100% at 50% 40%, ${pal.ground} 0%, #050506 78%)` }}>
      <span className="absolute inset-0 opacity-[0.14]"><Art art={art} accent={pal.accent} ink={pal.ink} /></span>
      {/* Sits a little low, so the play button lands on its art, not its title. */}
      <span className="relative" style={{ filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.6))', transform: `translateY(${Math.round(caseSize * 0.14)}px)` }}>
        <CdCase code={code} title={title} subject={lecture.subject} art={art} chapter={chapter} size={caseSize} finish="ink" done={done} />
      </span>
      {resumeFrom > 0 && (
        <span className="absolute left-1/2 bottom-[7%] -translate-x-1/2 px-3 py-1.5 rounded-full font-ui text-[12px] font-bold text-white/90" style={{ background: 'rgba(0,0,0,0.55)' }}>
          Resumes at {formatTime(resumeFrom)}
        </span>
      )}
    </span>
  );

  const stripBtn = 'h-9 px-3.5 rounded-lg border border-white/[0.12] text-[12px] font-ui font-bold text-zinc-100 hover:bg-white/[0.07] disabled:opacity-40 transition-colors';

  const about = (
    <div className="space-y-7">
      <section className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">{code} · {lecture.subject}{chapter ? ` · ${chapter}` : ''}</p>
        <h2 className="font-accent text-[24px] leading-tight text-white" style={{ fontStyle: 'normal', overflowWrap: 'anywhere' }}>{title}</h2>
        {lecture.topic && <p className="text-[13px] font-ui text-zinc-400">{lecture.topic}</p>}
        <p className="text-[13px] font-ui text-zinc-400">
          {done ? 'Watched.' : fraction > 0.01 ? `${Math.round(fraction * 100)}% watched.` : 'Not started.'}
          {progress && progress.position > 10 && !done ? ` Stopped at ${formatTime(progress.position)}.` : ''}
        </p>
      </section>

      {next && (
        <button
          type="button"
          onClick={() => onSwitch(next.id)}
          className="w-full flex items-center gap-3 rounded-xl border border-white/[0.08] p-3 text-left hover:bg-white/[0.04] transition-colors"
        >
          <CdCase code={codeOf(next)} title={displayTitle(next, now)} subject={next.subject} art={coverArt(next.id)} size={56} finish="ink" />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Up next</span>
            <span className="block text-[14px] font-ui font-bold text-white truncate">{displayTitle(next, now)}</span>
            <span className="block text-[11px] font-ui text-zinc-500">{codeOf(next)}</span>
          </span>
        </button>
      )}

      <section className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Collections</p>
        <CollectionPicker store={store} lectureId={lecture.id} dark />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setEditing(true)} className={`${btn} h-10 px-4 ${t.ghost}`}>Edit</button>
        {confirming ? (
          <>
            <button type="button" onClick={() => { store.deleteLecture(lecture.id); onBack(); }} className={`${btn} h-10 px-4 ${t.primary}`}>Delete {code}</button>
            <button type="button" onClick={() => setConfirming(false)} className={`${btn} h-10 px-4 ${t.ghost}`}>Keep it</button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${btn} h-10 px-4 ${t.ghost}`}>Delete</button>
        )}
      </section>
      {confirming && <p className="text-[12px] font-ui text-zinc-400" role="status">Its bookmarks and notes go with it.</p>}

      <p className="text-[12px] font-ui text-zinc-500 leading-relaxed">
        Plays from YouTube, under the{' '}
        <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">YouTube Terms of Service</a>.{' '}
        <a href={watchUrl(lecture.videoId)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Open on YouTube</a>.
        Watching never logs time by itself.
      </p>
    </div>
  );

  const notes = (
    <MarksPanel
      bare
      marks={marks}
      dark
      composerAt={composerAt}
      onSaveNote={(at, text) => { store.addMark({ lectureId: lecture.id, t: at, kind: 'note', text }); setComposerAt(null); say(`Note saved at ${formatTime(at)}`); }}
      onCloseComposer={() => setComposerAt(null)}
      onSeek={seek}
      onEdit={(id, text) => store.updateMark(id, { text })}
      onDelete={id => store.deleteMark(id)}
    />
  );

  return (
    <Overlay>
      <div
        className="th"
        role="dialog"
        aria-modal="true"
        aria-label={`${code}, ${title}`}
        data-panel={panelOpen ? 'open' : 'closed'}
        data-playing={playing}
        style={{ ['--th-accent' as string]: ACCENT_RGB[lecture.subject] ?? ACCENT_RGB.Physics }}
      >
        <div className="th-glow" aria-hidden="true" />

        <header className="th-bar">
          <button type="button" className="th-ib" onClick={onBack} aria-label="Back to the shelf">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          </button>
          <div className="th-id">
            <span className="th-code">{code}</span>
            <span className="th-title">{title}</span>
          </div>
          <ClockPill
            timer={timer}
            otherSession={otherSession}
            nudge={nudge}
            onStart={() => onStartClock(lecture.subject, chapter ?? undefined)}
            onOpenToday={onOpenToday}
          />
          <button
            type="button"
            className="th-ib th-wide-only"
            aria-pressed={panelOpen}
            aria-label={panelOpen ? 'Hide notes (T)' : 'Show notes (T)'}
            title={panelOpen ? 'Hide notes (T)' : 'Show notes (T)'}
            onClick={() => setPanelOpen(o => !o)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M15 4v16" /></svg>
          </button>
        </header>

        <div className="th-body">
          <div className="th-stage">
            <div className="th-screen">
              <div ref={frameRef} className="th-frame" style={{ transformOrigin: '0 0' }}>
                <YouTubePlayer
                  key={seekStart === null ? 'resume' : `at-${seekStart}`}
                  videoId={lecture.videoId}
                  title={title}
                  dark
                  face={face}
                  startAt={seekStart ?? resumeFrom}
                  autoStart={seekStart !== null}
                  onController={setController}
                  onState={setPstate}
                  onRate={setRate}
                  onPlain={() => setPlain(true)}
                />
              </div>
              {plain ? (
                <p className="text-[13px] font-ui text-zinc-400">
                  Playing in YouTube's own player, so Alpha's timeline, bookmarks, notes and resume are off for this viewing.
                </p>
              ) : (
                <>
                  <LectureRail
                    controller={controller}
                    playing={playing}
                    knownDuration={progress?.duration ?? null}
                    resumeFrom={resumeFrom}
                    watched={progress?.watched ?? []}
                    marks={marks}
                    onSeek={seek}
                  />
                  <div className="th-controls">
                    <PlayerControls controller={controller} state={pstate} rate={rate} dark bare hideTime keys={composerAt === null && !editing}>
                      <span className="flex items-center gap-2">
                        <button type="button" className={stripBtn} disabled={!controller} onClick={bookmark} aria-keyshortcuts="B" title="Bookmark this second (B)">Bookmark</button>
                        <button type="button" className={stripBtn} disabled={!controller} onClick={startNote} aria-keyshortcuts="N" title="Write a note at this second (N)">Note</button>
                      </span>
                    </PlayerControls>
                    <span className="th-flash" role="status">{flash ?? ''}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="th-panel" aria-label="Notes and details">
            <div className="th-panel-inner">
              <div className="th-tabs" role="tablist">
                <button type="button" role="tab" className="th-tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')}>
                  Notes{marks.length > 0 && <span className="th-count">{marks.length}</span>}
                </button>
                <button type="button" role="tab" className="th-tab" aria-selected={tab === 'about'} onClick={() => setTab('about')}>About</button>
              </div>
              <div className="th-pane" role="tabpanel">{tab === 'notes' ? notes : about}</div>
            </div>
          </aside>
        </div>
      </div>

      {editing && (
        <EditSheet
          store={store}
          lecture={lecture}
          dark
          examPreference={examPreference}
          currentClass={currentClass}
          onClose={() => setEditing(false)}
        />
      )}
    </Overlay>
  );
}
