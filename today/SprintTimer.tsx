import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SprintRecord, SprintRuntime, Subject, Task } from '../types';
import { SUBJECT_COLORS } from '../schedule/colors';
import { Card, Chip, Eyebrow, btn, tokens } from '../ui/kit';
import { formatCountdown, formatDuration } from './pomodoro';
import {
  EXTEND_MINUTES, MAX_ITEMS, PRESET_MINUTES, extendRoomMs, finalMs, isFinished, leftFraction, leftMs,
  openTasks, parseMinutes, sprintStats, statusOf, workedMs,
} from './sprint';
import { SprintApi } from './useSprint';

/* ── Alpha Sprints on the Today card ──
   A view over the engine in App (today/useSprint.ts), in three states: set up
   a sprint, run it, and the result of the one that just ended. Recent sprints
   sit under the set-up. Explicit prop types rather than React.FC, so tsc
   checks the wiring (see the note in CLAUDE.md). */

const INTRO_KEY = 'alpha_sprint_intro_v1';
const dot = (s?: Subject) => (SUBJECT_COLORS[s ?? 'General'] ?? SUBJECT_COLORS.General).dot;
const mins = (ms: number) => formatDuration(ms);

interface Props {
  runtime: SprintRuntime | null;
  records: SprintRecord[];
  tasks: Task[];
  api: SprintApi;
  activeSubjects: Subject[];
  defaultSubject: Subject;
  theme: 'dark' | 'light';
  onBackToTasks: () => void;
}

export default function SprintTimer({ runtime, records, tasks, api, activeSubjects, defaultSubject, theme, onBackToTasks }: Props) {
  const dark = theme === 'dark';
  if (runtime) return <ActiveSprint runtime={runtime} tasks={tasks} api={api} dark={dark} />;
  return (
    <div className="space-y-6">
      {api.result
        ? <SprintResult record={api.result} tasks={tasks} api={api} dark={dark} onBackToTasks={onBackToTasks} />
        : <SprintSetup tasks={tasks} api={api} activeSubjects={activeSubjects} defaultSubject={defaultSubject} dark={dark} />}
      <SprintHistory records={records} dark={dark} />
    </div>
  );
}

/* ── Set-up ── */

interface Pick { key: string; text: string; taskId?: string; subject?: Subject }

function SprintSetup({ tasks, api, activeSubjects, defaultSubject, dark }: {
  tasks: Task[]; api: SprintApi; activeSubjects: Subject[]; defaultSubject: Subject; dark: boolean;
}) {
  const t = tokens(dark);
  const [intro, setIntro] = useState(() => { try { return localStorage.getItem(INTRO_KEY) !== 'seen'; } catch { return false; } });
  const closeIntro = () => {
    setIntro(false);
    try { localStorage.setItem(INTRO_KEY, 'seen'); } catch { /* shown again next visit, no harm */ }
  };

  const open = useMemo(() => openTasks(tasks), [tasks]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [typed, setTyped] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [preset, setPreset] = useState<number | 'custom'>(25);
  const [custom, setCustom] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [subject, setSubject] = useState<Subject | null>(null);

  /* A card deleted or finished on the board while it was picked here drops out. */
  useEffect(() => {
    setPicks(p => p.filter(x => !x.taskId || open.some(o => o.id === x.taskId)));
  }, [open]);

  const full = picks.length >= MAX_ITEMS;
  const minutes = preset === 'custom' ? parseMinutes(custom) : preset;
  const customBad = preset === 'custom' && custom.trim() !== '' && minutes === null;
  const firstSubject = picks.find(p => p.subject && activeSubjects.includes(p.subject))?.subject;
  const countsAs: Subject = subject ?? firstSubject ?? (activeSubjects.includes(defaultSubject) ? defaultSubject : activeSubjects[0] ?? 'General');
  const canStart = picks.length > 0 && minutes !== null;

  const togglePick = (task: Task) => {
    setPicks(p => p.some(x => x.taskId === task.id)
      ? p.filter(x => x.taskId !== task.id)
      : p.length >= MAX_ITEMS ? p : [...p, { key: task.id, text: task.text, taskId: task.id, subject: task.subject }]);
  };
  const addTyped = () => {
    const text = typed.trim();
    if (!text || full) return;
    setPicks(p => [...p, { key: `typed-${Date.now()}`, text }]);
    setTyped('');
  };
  const start = () => {
    if (!canStart || minutes === null) return;
    api.start({ items: picks.map(({ text, taskId, subject: s }) => ({ text, taskId, subject: s })), note, subject: countsAs, minutes });
  };

  const shown = showAll ? open : open.slice(0, 6);
  const typedPicks = picks.filter(p => !p.taskId);

  return (
    <section
      data-onboarding-target="session-timer"
      className={`mk-rise px-5 py-8 md:p-12 rounded-xl border relative overflow-hidden ${t.card}`}
      style={{ animationDelay: '120ms' }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none transition-[background] duration-700"
        style={{ background: `radial-gradient(80% 60% at 50% 0%, ${dot(countsAs)}${dark ? '1f' : '14'}, transparent 70%)` }}
      />
      <div className="relative z-10 max-w-xl mx-auto">
        {intro && (
          <div className={`mk-fade mb-8 p-5 rounded-xl border ${t.inset}`} role="note">
            <Eyebrow dark={dark}>New · Sprint</Eyebrow>
            <p className={`font-display text-[22px] leading-tight mt-2 ${t.heading}`}>
              Beat the clock<span className="text-[#E10600]">.</span>
            </p>
            <p className={`text-[13px] font-ui mt-2 leading-relaxed ${t.body}`}>
              Work grows to fill the time you give it. <span className="font-accent italic">So give it less.</span>
            </p>
            <ul className={`text-[13px] font-ui mt-3 space-y-1 ${t.muted}`}>
              <li>Pick one or two tasks.</li>
              <li>Set a tight time. Finish before zero.</li>
              <li>Your time still counts towards today.</li>
            </ul>
            <button type="button" onClick={closeIntro} className={`${btn} mt-4 px-4 py-2.5 ${t.ghost}`}>Got it</button>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow dark={dark}>What will you finish?</Eyebrow>
          <span className={`text-[11px] font-ui tabular-nums ${full ? t.body : t.faint}`}>{picks.length} of {MAX_ITEMS}</span>
        </div>

        {open.length > 0 && (
          <ul className={`mt-3 rounded-xl border divide-y overflow-hidden ${dark ? 'border-white/[0.06] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
            {shown.map(task => {
              const on = picks.some(p => p.taskId === task.id);
              const locked = !on && full;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => togglePick(task)}
                    disabled={locked}
                    aria-pressed={on}
                    aria-label={task.text}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-40 ${on ? (dark ? 'bg-white/[0.04]' : 'bg-zinc-50') : t.hover}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${on ? (dark ? 'bg-white border-white' : 'bg-zinc-900 border-zinc-900') : dark ? 'border-zinc-700' : 'border-zinc-300'}`}
                    >
                      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#000' : '#fff'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot(task.subject) }} />
                    <span className={`flex-1 min-w-0 text-[14px] font-ui font-semibold truncate ${t.heading}`}>{task.text}</span>
                    {task.column === 'doing' && <span className={`text-[10px] font-ui font-bold uppercase tracking-[0.06em] ${t.faint}`}>Doing</span>}
                  </button>
                </li>
              );
            })}
            {open.length > 6 && (
              <li>
                <button type="button" onClick={() => setShowAll(v => !v)} className={`w-full px-4 py-2.5 text-[12px] font-ui font-semibold ${t.muted} ${t.hover}`}>
                  {showAll ? 'Show fewer' : `Show ${open.length - 6} more`}
                </button>
              </li>
            )}
          </ul>
        )}

        {typedPicks.length > 0 && (
          <ul className="mt-3 space-y-2">
            {typedPicks.map(p => (
              <li key={p.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${t.inset}`}>
                <span aria-hidden="true" className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center ${dark ? 'bg-white' : 'bg-zinc-900'}`}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={dark ? '#000' : '#fff'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
                <span className={`flex-1 min-w-0 text-[14px] font-ui font-semibold truncate ${t.heading}`}>{p.text}</span>
                <button type="button" onClick={() => setPicks(ps => ps.filter(x => x.key !== p.key))} aria-label={`Remove ${p.text}`} className={`w-7 h-7 rounded-md flex items-center justify-center ${t.muted} ${t.hover}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); addTyped(); }}>
          <input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            maxLength={200}
            disabled={full}
            placeholder={full ? 'Two is the limit. Finish these first.' : open.length ? 'Or type something else' : 'e.g. Solve 15 Electrostatics PYQs'}
            aria-label="Something to finish in this sprint"
            className={`${t.input} disabled:opacity-50`}
          />
          <button type="submit" disabled={full || !typed.trim()} className={`${btn} px-4 shrink-0 ${t.ghost}`}>Add</button>
        </form>

        {noteOpen ? (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            autoFocus
            placeholder="A note for yourself. Optional."
            aria-label="Note"
            className={`${t.input} mt-3 resize-none`}
          />
        ) : (
          <button type="button" onClick={() => setNoteOpen(true)} className={`mt-3 text-[12px] font-ui font-semibold ${t.muted} hover:text-[#E10600] transition-colors`}>
            + Add a note
          </button>
        )}

        <Eyebrow dark={dark} className="mt-8">How long?</Eyebrow>
        <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Time limit">
          {PRESET_MINUTES.map(m => (
            <Chip key={m} on={preset === m} onClick={() => setPreset(m)} dark={dark} className="!px-4 !py-2 tabular-nums">{m} min</Chip>
          ))}
          <Chip on={preset === 'custom'} onClick={() => setPreset('custom')} dark={dark} className="!px-4 !py-2">Custom</Chip>
        </div>
        {preset === 'custom' && (
          <div className="mt-3 flex items-center gap-3 mk-fade">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              step={1}
              value={custom}
              onChange={e => setCustom(e.target.value)}
              autoFocus
              placeholder="20"
              aria-label="Minutes"
              aria-invalid={customBad}
              className={`${t.input} !w-28 tabular-nums`}
            />
            <span className={`text-[13px] font-ui ${customBad ? 'text-[#E10600]' : t.muted}`}>
              {customBad ? 'Whole minutes, 1 to 180.' : 'minutes'}
            </span>
          </div>
        )}

        <Eyebrow dark={dark} className="mt-8">Counts as</Eyebrow>
        <div className="flex flex-wrap gap-2 mt-3">
          {activeSubjects.map(s => (
            <Chip key={s} on={countsAs === s} onClick={() => setSubject(s)} dark={dark} color={dot(s)}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot(s) }} />
              {s}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={start}
          disabled={!canStart}
          className={`${btn} w-full mt-10 py-5 md:py-6 !text-[12px] !tracking-[0.3em] !rounded-xl ${t.primary}`}
        >
          {minutes !== null ? `Start sprint · ${minutes} min` : 'Start sprint'}
        </button>
        {!picks.length && (
          <p className={`text-[12px] font-ui text-center mt-3 ${t.faint}`}>Pick a task first. A sprint is for finishing something.</p>
        )}
      </div>
    </section>
  );
}

/* ── Running ── */

function ActiveSprint({ runtime, tasks, api, dark }: { runtime: SprintRuntime; tasks: Task[]; api: SprintApi; dark: boolean }) {
  const t = tokens(dark);
  const [now, setNow] = useState(Date.now());
  const [confirmQuit, setConfirmQuit] = useState(false);
  const running = runtime.runStartedAt !== null;

  /* Only the clock on screen; the sprint itself is run by the engine in App. */
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [running, runtime.runStartedAt]);

  /* Space pauses and resumes, as on the Pomodoro. Not while typing or on a button. */
  const apiRef = useRef(api);
  apiRef.current = api;
  const statusRef = useRef<string>('running');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code !== 'Space' && e.key !== ' ') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || el?.isContentEditable) return;
      if (statusRef.current === 'over' || statusRef.current === 'stale') return;
      e.preventDefault();
      if (statusRef.current === 'paused') apiRef.current.resume(); else apiRef.current.pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const status = statusOf(runtime, now);
  statusRef.current = status;
  const over = status === 'over' || status === 'stale';
  const left = leftMs(runtime, now);
  const fraction = leftFraction(runtime, now);
  const final = finalMs(runtime);
  const room = extendRoomMs(runtime, now);
  const items = runtime.items;
  const open = items.filter(i => !i.doneAt);
  const color = dot(runtime.subject);
  const accent = over ? '#E10600' : color;

  const doneLabel = items.length === 1 ? (over ? 'Done, late' : 'Done') : open.length === items.length ? 'Both done' : 'Done';

  const heading = over
    ? "Time's up"
    : status === 'paused'
      ? 'Paused'
      : `Sprint · ${mins(runtime.allowedMs)}${runtime.extendedMs > 0 ? ` +${mins(runtime.extendedMs)}` : ''}`;

  const extendRow = (
    <div className="flex items-center gap-1.5" role="group" aria-label="Add time">
      {EXTEND_MINUTES.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => api.extend(m)}
          disabled={m * 60_000 > room}
          aria-label={`Add ${m} minutes`}
          className={`${btn} px-3 py-2.5 tabular-nums ${t.ghost}`}
        >
          +{m}
        </button>
      ))}
    </div>
  );

  return (
    <section
      data-onboarding-target="session-timer"
      className={`mk-rise isolate px-5 py-10 md:p-16 text-center rounded-xl border relative overflow-hidden transition-all duration-500 ${t.card}`}
      style={{ animationDelay: '60ms', borderColor: `${accent}66` }}
      aria-label="Sprint in progress"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 pointer-events-none transition-[background] duration-700"
        style={{ background: `radial-gradient(95% 75% at 50% 0%, ${color}${dark ? (running ? '3d' : '1f') : (running ? '29' : '14')}, transparent 72%)` }}
      />
      {running && !over && <div className="absolute top-5 right-5 animate-ping w-2 h-2 bg-[#E10600] rounded-full" />}

      <p className={`text-[10px] uppercase font-bold tracking-[0.06em] font-ui ${over ? 'text-[#E10600]' : t.muted}`} aria-live="polite">{heading}</p>

      {/* What this is for, before how long is left. */}
      <div className="mt-5 max-w-lg mx-auto">
        {items.length === 1 ? (
          <h2 className={`font-display text-[22px] md:text-[28px] leading-tight break-words ${t.heading}`}>{items[0].text}</h2>
        ) : (
          <ul className="space-y-2 text-left">
            {items.map(i => (
              <li key={i.id}>
                <ItemTick item={i} tasks={tasks} dark={dark} onToggle={() => api.toggle(i.id)} />
              </li>
            ))}
          </ul>
        )}
        {runtime.note && <p className={`text-[13px] font-ui mt-3 ${t.muted}`}>{runtime.note}</p>}
        {items.length === 1 && <BoardNote item={items[0]} tasks={tasks} dark={dark} />}
      </div>

      <p
        className={`text-[18vw] md:text-[104px] tabular-nums leading-none num-timer mt-8 transition-opacity ${over ? 'text-[#E10600]' : t.heading} ${status === 'paused' ? 'opacity-40' : ''}`}
        role="timer"
        aria-label={over ? `${formatCountdown(-left)} over` : `${formatCountdown(left)} left`}
      >
        {over ? `+${formatCountdown(-left)}` : formatCountdown(left)}
      </p>

      <div className="max-w-md mx-auto mt-6">
        <div className={`h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`} role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
          <div className="h-full rounded-full bg-[#E10600] transition-[width] duration-300 ease-linear" style={{ width: `${fraction * 100}%` }} />
        </div>
        <p className={`text-[11px] font-ui mt-2 tabular-nums ${t.faint}`}>
          {over
            ? `${mins(final)} given. Finish it, add time, or call it.`
            : `${workedMs(runtime, now) >= 60_000 ? `${mins(workedMs(runtime, now))} in · ` : ''}${mins(final)} given`}
        </p>
      </div>

      {confirmQuit ? (
        <div className={`mt-10 max-w-md mx-auto p-5 rounded-xl border text-left mk-fade ${t.inset}`} role="alertdialog" aria-label="Give up this sprint?">
          <p className={`text-[14px] font-ui font-bold ${t.heading}`}>Give up this sprint?</p>
          <p className={`text-[13px] font-ui mt-1 ${t.muted}`}>
            {workedMs(runtime, now) >= 60_000 ? `Your ${mins(workedMs(runtime, now))} still count towards today.` : 'Under a minute in, so nothing gets logged.'} Your tasks stay as they are.
          </p>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => { setConfirmQuit(false); api.abandon(); }} className={`${btn} flex-1 py-3 ${t.ghost}`}>Give up</button>
            <button type="button" onClick={() => setConfirmQuit(false)} className={`${btn} flex-1 py-3 ${t.primary}`} autoFocus>Keep going</button>
          </div>
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center gap-5">
          {status === 'paused' ? (
            <button type="button" onClick={api.resume} className={`${btn} w-full max-w-md py-5 md:py-6 !text-[12px] !tracking-[0.3em] !rounded-xl ${t.primary}`}>Resume</button>
          ) : (
            <button type="button" onClick={api.completeAll} className={`${btn} w-full max-w-md py-5 md:py-6 !text-[12px] !tracking-[0.3em] !rounded-xl ${t.primary}`}>{doneLabel}</button>
          )}

          {over ? (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {room >= EXTEND_MINUTES[0] * 60_000 && extendRow}
              <button type="button" onClick={api.restart} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Restart {mins(runtime.allowedMs)}</button>
              <button type="button" onClick={api.end} className={`${btn} px-4 py-2.5 ${t.ghost}`}>End sprint</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {status === 'paused'
                ? <button type="button" onClick={api.completeAll} className={`${btn} px-4 py-2.5 ${t.ghost}`}>{doneLabel}</button>
                : <button type="button" onClick={api.pause} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Pause</button>}
              {room >= EXTEND_MINUTES[0] * 60_000 && extendRow}
            </div>
          )}

          {!over && (
            <button type="button" onClick={() => setConfirmQuit(true)} className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui ${t.muted} hover:text-[#E10600] transition-colors`}>
              Give up
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ItemTick({ item, tasks, dark, onToggle }: { item: SprintRuntime['items'][number]; tasks: Task[]; dark: boolean; onToggle: () => void }) {
  const t = tokens(dark);
  const done = !!item.doneAt;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${t.inset}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Not done: ${item.text}` : `Done: ${item.text}`}
        onClick={onToggle}
        className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${done ? 'bg-[#E10600] border-[#E10600]' : dark ? 'border-zinc-600 hover:border-zinc-400' : 'border-zinc-300 hover:border-zinc-500'}`}
      >
        {done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
      </button>
      <span className="flex-1 min-w-0">
        <span className={`block text-[15px] font-ui font-bold break-words ${done ? `line-through ${t.faint}` : t.heading}`}>{item.text}</span>
        <BoardNote item={item} tasks={tasks} dark={dark} inline />
      </span>
    </div>
  );
}

/** What happened to the card on the board, when it is not what the sprint expects. */
function BoardNote({ item, tasks, dark, inline }: { item: SprintRuntime['items'][number]; tasks: Task[]; dark: boolean; inline?: boolean }) {
  if (!item.taskId || item.doneAt) return null;
  const task = tasks.find(x => x.id === item.taskId);
  const text = !task ? 'Removed from your board' : task.completed ? 'Already done on your board' : null;
  if (!text) return null;
  return <span className={`${inline ? 'block mt-0.5' : 'block mt-2'} text-[11px] font-ui ${tokens(dark).faint}`}>{text}</span>;
}

/* ── The result ── */

const OUTCOME_TITLE: Record<SprintRecord['outcome'], (n: number) => string> = {
  on_time: n => (n > 1 ? 'Both done' : 'Task completed'),
  late: n => (n > 1 ? 'Both done, late' : 'Done, late'),
  expired: () => 'Time ran out',
  abandoned: () => 'Sprint given up',
};

function SprintResult({ record, tasks, api, dark, onBackToTasks }: {
  record: SprintRecord; tasks: Task[]; api: SprintApi; dark: boolean; onBackToTasks: () => void;
}) {
  const t = tokens(dark);
  const finished = isFinished(record.outcome);
  const doneCount = record.items.filter(i => i.doneAt).length;
  const diff = record.finalMs - record.workedMs;
  const verdict = record.outcome === 'on_time'
    ? diff >= 60_000 ? `Finished ${mins(diff)} early.` : 'Right on the buzzer.'
    : record.outcome === 'late'
      ? `Finished ${mins(-diff)} over.`
      : record.items.length > 1 && doneCount > 0 ? `${doneCount} of ${record.items.length} done.` : 'Not finished.';
  const moved = record.items.filter(i => i.taskId && i.movedFrom && tasks.some(x => x.id === i.taskId && x.completed));

  return (
    <section className={`mk-rise px-5 py-10 md:p-14 rounded-xl border ${t.card}`} aria-live="polite">
      <div className="max-w-lg mx-auto">
        <Eyebrow dark={dark} className={finished ? '!text-[#E10600]' : ''}>{OUTCOME_TITLE[record.outcome](record.items.length)}</Eyebrow>
        <ul className="mt-4 space-y-2">
          {record.items.map(i => (
            <li key={i.id} className="flex items-start gap-3">
              <span aria-hidden="true" className={`mt-1.5 w-4 h-4 shrink-0 rounded-full flex items-center justify-center ${i.doneAt ? 'bg-[#E10600]' : dark ? 'border-2 border-zinc-700' : 'border-2 border-zinc-300'}`}>
                {i.doneAt && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
              </span>
              <span className={`font-display text-[20px] md:text-[24px] leading-tight break-words ${i.doneAt ? t.heading : t.muted}`}>{i.text}</span>
            </li>
          ))}
        </ul>

        <p className={`font-accent italic text-[20px] mt-5 ${t.body}`}>{verdict}</p>

        <dl className="grid grid-cols-2 gap-2.5 mt-6">
          <div className={`p-4 rounded-xl border ${t.inset}`}>
            <dt><Eyebrow dark={dark}>Time given</Eyebrow></dt>
            <dd className={`num-stat text-[24px] mt-1.5 ${t.heading}`}>{mins(record.allowedMs)}</dd>
            {record.extensions > 0 && <dd className={`text-[11px] font-ui mt-1 ${t.muted}`}>Extended to {mins(record.finalMs)}</dd>}
          </div>
          <div className={`p-4 rounded-xl border ${t.inset}`}>
            <dt><Eyebrow dark={dark}>Actual time</Eyebrow></dt>
            <dd className={`num-stat text-[24px] mt-1.5 ${t.heading}`}>{record.workedMs >= 60_000 ? mins(record.workedMs) : '<1 min'}</dd>
            {record.pausedMs >= 60_000 && <dd className={`text-[11px] font-ui mt-1 ${t.muted}`}>Plus {mins(record.pausedMs)} paused</dd>}
          </div>
        </dl>

        <p className={`text-[12px] font-ui mt-4 ${t.muted}`}>
          {record.workedMs >= 60_000 ? `${mins(record.workedMs)} logged to ${record.subject}.` : 'Under a minute, so nothing was logged.'}
        </p>

        {moved.map(i => (
          <p key={i.id} className={`text-[12px] font-ui mt-2 ${t.muted}`}>
            “{i.text}” moved to Done on your board.{' '}
            <button type="button" onClick={() => api.undoMove(i.id)} className="underline font-semibold hover:text-[#E10600] transition-colors">Undo</button>
          </p>
        ))}

        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <button type="button" onClick={api.clearResult} className={`${btn} flex-1 py-4 !text-[11px] !tracking-[0.2em] !rounded-xl ${t.primary}`}>Another sprint</button>
          <button type="button" onClick={() => { api.clearResult(); onBackToTasks(); }} className={`${btn} flex-1 py-4 !text-[11px] !tracking-[0.2em] !rounded-xl ${t.ghost}`}>Back to tasks</button>
        </div>
      </div>
    </section>
  );
}

/* ── History ── */

const OUTCOME_TAG: Record<SprintRecord['outcome'], string> = {
  on_time: 'On time',
  late: 'Late',
  expired: 'Ran out',
  abandoned: 'Gave up',
};

const dayLabel = (ms: number) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(ms));

function SprintHistory({ records, dark }: { records: SprintRecord[]; dark: boolean }) {
  const t = tokens(dark);
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => sprintStats(records), [records]);
  const recent = useMemo(() => [...records].sort((a, b) => b.endedAt - a.endedAt).slice(0, 10), [records]);

  const tiles: { label: string; value: string }[] = [
    { label: 'Finished', value: String(stats.completed) },
    { label: 'Focused', value: stats.focusedMs >= 60_000 ? mins(stats.focusedMs) : '0 min' },
    ...(stats.onTimeRate !== null ? [{ label: 'On time', value: `${Math.round(stats.onTimeRate * 100)}%` }] : []),
    ...(stats.avgCompletedMs !== null ? [{ label: 'Avg finish', value: mins(stats.avgCompletedMs) }] : []),
    ...(stats.savedMs >= 60_000 ? [{ label: 'Time saved', value: mins(stats.savedMs) }] : []),
  ];

  return (
    <Card dark={dark} delay={180} className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex justify-between items-center px-5 md:px-6 py-4 ${t.hover} transition-colors`}
        aria-expanded={open}
      >
        <span className="flex items-baseline gap-3">
          <Eyebrow dark={dark}>Your sprints</Eyebrow>
          <span className={`text-[11px] font-ui tabular-nums ${t.faint}`}>
            {stats.ended ? `${stats.completed} finished · ${stats.onTime} on time` : 'None yet'}
          </span>
        </span>
        <svg className={`transition-transform ${open ? 'rotate-180' : ''} ${t.faint}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={`border-t ${t.rule}`}>
          {records.length === 0 ? (
            <p className={`text-[13px] font-ui py-8 px-6 text-center ${t.muted}`}>No sprints yet. Your first one shows up here.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 p-5 md:px-6">
                {tiles.map(tile => (
                  <div key={tile.label} className={`p-4 rounded-xl border ${t.inset}`}>
                    <Eyebrow dark={dark}>{tile.label}</Eyebrow>
                    <p className={`num-stat text-[22px] mt-1.5 ${t.heading}`}>{tile.value}</p>
                  </div>
                ))}
              </div>
              {stats.ended < 3 && (
                <p className={`text-[11px] font-ui px-5 md:px-6 -mt-2 pb-4 ${t.faint}`}>Your on-time rate shows after three sprints.</p>
              )}
              <ul className={`divide-y border-t ${dark ? 'divide-white/[0.05] border-white/[0.05]' : 'divide-zinc-100 border-zinc-100'}`}>
                {recent.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-4 px-5 md:px-6 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot(r.subject) }} />
                      <div className="min-w-0">
                        <p className={`text-[13px] font-ui font-bold truncate ${t.heading}`}>{r.items.map(i => i.text).join(' · ')}</p>
                        <p className={`text-[11px] font-ui ${t.muted}`}>
                          {dayLabel(r.endedAt)} · {r.workedMs >= 60_000 ? mins(r.workedMs) : '<1 min'} of {mins(r.finalMs)}
                          {r.extensions > 0 ? ` (first ${mins(r.allowedMs)})` : ''}
                          {r.items.length > 1 && !isFinished(r.outcome) ? ` · ${r.items.filter(i => i.doneAt).length} of ${r.items.length} done` : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-ui font-bold uppercase tracking-[0.06em] ${r.outcome === 'on_time' ? t.heading : t.faint}`}>{OUTCOME_TAG[r.outcome]}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
