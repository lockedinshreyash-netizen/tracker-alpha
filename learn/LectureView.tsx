/* ── One lecture ──
   The case, the player, the strip under it, the clock, and the marks. Before
   the first tap the player shows this lecture's own art on its subject's
   ground, never a YouTube thumbnail; nothing is fetched from YouTube until
   play (or until a mark's time is tapped, which plays from there).

   What is remembered, all of it in the encrypted library on this device:
   - where the student stopped: the player resumes three seconds early;
   - what was actually watched: WatchTracker (watch.ts) turns once-a-second
     readings into stretches, written every 15 seconds of play, on pause, on
     hide and on leaving, never per tick. A seek closes a stretch, so skipping
     to the end is not finishing. 90% watched puts the tick on the case;
   - bookmarks and notes, each at a second (MarksPanel.tsx).

   Time studied is never logged by watching. Start the clock (SessionStrip)
   is the student's own tap, the same stopwatch Today runs.

   The rail folds while a lecture is open (onWatching), and the case flies
   from where it sat on the shelf into the header (fromRect), unless the
   student prefers reduced motion. */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { btn, tokens } from '../ui/kit';
import YouTubePlayer from '../video/YouTubePlayer';
import PlayerControls from '../video/PlayerControls';
import { formatTime, resumeAt } from '../video/model';
import type { PlayerController } from '../video/controller';
import type { PlayerState } from '../video/youtube';
import { isArmed } from '../today/stopwatch';
import CdCase, { Art, paletteFor } from './CdCase';
import MarksPanel from './MarksPanel';
import SessionStrip, { type OtherSession } from './SessionStrip';
import EditSheet from './EditSheet';
import CollectionPicker from './CollectionPicker';
import { WatchTracker } from './watch';
import { chapterName, codeOf, coverArt, displayTitle, isComplete, marksFor, watchedFraction, type Lecture } from './model';
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
}

const FLUSH_EVERY_TICKS = 15;

const isTyping = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export default function LectureView({
  store, lecture, dark, examPreference, currentClass, fromRect, timer, otherSession, onStartClock, onOpenToday, onWatching, onBack,
}: Props) {
  const t = tokens(dark);
  const lib = store.getLibrary();
  const marks = marksFor(lib, lecture.id);
  const progress = lib.progress[lecture.id] && !lib.progress[lecture.id].deletedAt ? lib.progress[lecture.id] : null;

  // Fixed for this visit: progress written while watching must not move the player.
  const [resumeFrom] = useState(() => (progress ? resumeAt(progress.position, progress.duration) : 0));
  const [seekStart, setSeekStart] = useState<number | null>(null);
  const [controller, setController] = useState<PlayerController | null>(null);
  const [pstate, setPstate] = useState<PlayerState>('unstarted');
  const [rate, setRate] = useState(1);
  const [composerAt, setComposerAt] = useState<number | null>(null);
  const [nudge, setNudge] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const tracker = useRef(new WatchTracker());
  const lastTime = useRef(resumeFrom);
  const nudged = useRef(false);
  const caseRef = useRef<HTMLSpanElement>(null);

  const now = Date.now();
  const title = displayTitle(lecture, now);
  const code = codeOf(lecture);
  const chapter = chapterName(lecture.chapterKey);
  const art = coverArt(lecture.id);
  const pal = paletteFor(lecture.subject, 'ink');
  const done = isComplete(lib, lecture.id);
  const fraction = progress ? watchedFraction(progress) : 0;

  /* ── The rail folds while a lecture is open ── */
  useEffect(() => {
    onWatching(true);
    return () => onWatching(false);
  }, [onWatching]);

  /* ── The case flies in from the shelf ── */
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const el = caseRef.current;
    if (!fromRect || !el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = el.getBoundingClientRect();
    if (!to.width) return;
    const dx = fromRect.left - to.left;
    const dy = fromRect.top - to.top;
    const s = fromRect.width / to.width;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
    // Mount only: the rect is where the case was when it was tapped.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!controller || composerAt !== null || editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); bookmark(); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); startNote(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, composerAt, editing, bookmark, startNote]);

  const face = (
    <span className="absolute inset-0 flex items-center justify-center" style={{ background: `radial-gradient(120% 90% at 70% 20%, ${pal.ground} 0%, #08080A 75%)` }}>
      <span className="absolute inset-0 opacity-60"><Art art={art} accent={pal.accent} ink={pal.ink} /></span>
      <span className="absolute left-5 bottom-4 font-ui text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: pal.mute }}>
        {code}{resumeFrom > 0 ? ` · resumes at ${formatTime(resumeFrom)}` : ''}
      </span>
    </span>
  );

  const ghostSm = `${btn} h-10 px-3 ${t.ghost}`;
  const stripBtn = `h-9 px-3 rounded-lg border text-[12px] font-ui font-bold transition-colors disabled:opacity-40 ${
    dark ? 'border-white/[0.1] text-zinc-200 hover:bg-white/[0.06]' : 'border-zinc-200 text-zinc-800 hover:bg-zinc-50'
  }`;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className={ghostSm} aria-label="Back to the shelf">‹ Shelf</button>
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-ui ${t.body}`}>Delete {code} and its marks?</span>
            <button type="button" onClick={() => setConfirming(false)} className={ghostSm}>Keep it</button>
            <button type="button" onClick={() => { store.deleteLecture(lecture.id); onBack(); }} className={`${btn} h-10 px-3 ${t.primary}`}>Delete</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(true)} className={ghostSm}>Edit</button>
            <button type="button" onClick={() => setConfirming(true)} className={ghostSm}>Delete</button>
          </div>
        )}
      </div>

      <header className="flex items-center gap-5">
        <span ref={caseRef} className="block shrink-0" style={{ transformOrigin: '0 0' }}>
          <CdCase code={code} title={title} subject={lecture.subject} art={art} size={88} finish={dark ? 'ink' : 'paper'} done={done} />
        </span>
        <div className="min-w-0 space-y-1.5">
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {code} · {lecture.subject}{chapter ? ` · ${chapter}` : ''}
          </p>
          <h1 className={`font-accent text-[26px] md:text-[34px] leading-tight ${t.heading}`} style={{ fontStyle: 'normal', overflowWrap: 'anywhere' }}>{title}</h1>
          <p className={`text-[13px] font-ui ${t.muted}`}>
            {[lecture.topic, done ? 'Watched' : fraction > 0.01 ? `${Math.round(fraction * 100)}% watched` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <CollectionPicker store={store} lectureId={lecture.id} dark={dark} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
        <div className="space-y-3 min-w-0">
          <YouTubePlayer
            key={seekStart === null ? 'resume' : `at-${seekStart}`}
            videoId={lecture.videoId}
            title={title}
            dark={dark}
            face={face}
            startAt={seekStart ?? resumeFrom}
            autoStart={seekStart !== null}
            onController={setController}
            onState={setPstate}
            onRate={setRate}
          />
          <PlayerControls controller={controller} state={pstate} rate={rate} dark={dark} keys={composerAt === null && !editing}>
            <span className="flex items-center gap-2 w-full sm:w-auto">
              <button type="button" className={stripBtn} disabled={!controller} onClick={bookmark} aria-keyshortcuts="B">Bookmark</button>
              <button type="button" className={stripBtn} disabled={!controller} onClick={startNote} aria-keyshortcuts="N">Note</button>
              <span className={`text-[12px] font-ui ${t.muted}`} role="status">{flash ?? ''}</span>
            </span>
          </PlayerControls>
          <SessionStrip
            timer={timer}
            otherSession={otherSession}
            subject={lecture.subject}
            chapter={chapter}
            dark={dark}
            nudge={nudge}
            onStart={() => onStartClock(lecture.subject, chapter ?? undefined)}
            onOpenToday={onOpenToday}
          />
          <p className={`text-[12px] font-ui ${t.faint}`}>
            Plays from YouTube, under the{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">YouTube Terms of Service</a>.
            Watching never logs time by itself.
          </p>
        </div>

        <div className="lg:sticky lg:top-6">
          <MarksPanel
            marks={marks}
            dark={dark}
            composerAt={composerAt}
            onSaveNote={(at, text) => { store.addMark({ lectureId: lecture.id, t: at, kind: 'note', text }); setComposerAt(null); say(`Note saved at ${formatTime(at)}`); }}
            onCloseComposer={() => setComposerAt(null)}
            onSeek={seek}
            onEdit={(id, text) => store.updateMark(id, { text })}
            onDelete={id => store.deleteMark(id)}
          />
        </div>
      </div>

      {editing && (
        <EditSheet
          store={store}
          lecture={lecture}
          dark={dark}
          examPreference={examPreference}
          currentClass={currentClass}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
