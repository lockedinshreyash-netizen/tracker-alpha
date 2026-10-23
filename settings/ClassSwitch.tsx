/* ── The class switch ──
   Class 11 or 12, in the top-right corner of every tab. It used to be a row
   in quick settings, behind the gear, where nobody looked for it.

   It changes only what you see: the chapters in Syllabus, the chapter picker
   in Plan, Today's next-up suggestions (and the syllabus part of the Lock-In
   score). Progress is stored per class (`progress[].classId`), so switching
   loses nothing, and the note says so in as many words, because "will I lose
   my Class 11 ticks?" is the question that stops people tapping it.

   One control, two placements: inside the phone's capsule (Sidebar.tsx), and
   on a laptop as its own liquid glass pill in the corner opposite the rail,
   above the settings gear. One tap switches and nothing asks first: it is a
   view, and switching back is the same tap. The note grows out of it on
   hover, on keyboard focus or on a tap of the word "Class", and after every
   switch says what just changed, then folds back by itself. It is a portal
   (the capsule's glass would clip it), takes no pointer, and so never covers
   anything you meant to tap. Glass enters and leaves by transform, never a
   fade (index.css). Geometry is CSS (`.cls-*`), for the reason the docks give. */

import React, { useEffect, useId, useRef, useState } from 'react';
import * as sfx from '../audio';
import LiquidGlass from '../ui/LiquidGlass';
import { Overlay } from '../ui/kit';

type ClassNo = 11 | 12;
type Note = { kind: 'hint' } | { kind: 'switched'; to: ClassNo };

interface Props {
  dark: boolean;
  value: ClassNo;
  onChange: (c: ClassNo) => void;
  /** `capsule`: inside the phone's top bar. `corner`: its own glass pill, top right, laptop and up. */
  placement: 'capsule' | 'corner';
}

const CLASSES: ClassNo[] = [11, 12];
const HINT_DELAY_MS = 350;
const TAP_HINT_MS = 5000;
const SWITCHED_MS = 4500;
const OUT_MS = 180;

const DESCRIPTION = 'Picks the chapters in Syllabus, Plan and Today. Progress in both classes is saved.';

const noteText = (note: Note): { title: string; body: string } =>
  note.kind === 'hint'
    ? { title: 'Your class', body: DESCRIPTION }
    : {
        title: `Switched to Class ${note.to}`,
        body: `Syllabus, Plan and Today now show Class ${note.to} chapters. Your Class ${note.to === 12 ? 11 : 12} progress is saved.`,
      };

export default function ClassSwitch({ dark, value, onChange, placement }: Props) {
  const descId = `cls${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [note, setNote] = useState<Note | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [live, setLive] = useState('');
  const noteRef = useRef<Note | null>(null);
  const timers = useRef<{ show?: number; hide?: number; out?: number }>({});
  const radios = useRef<Record<ClassNo, HTMLButtonElement | null>>({ 11: null, 12: null });

  const clearTimers = () => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.hide);
    window.clearTimeout(timers.current.out);
  };
  useEffect(() => clearTimers, []);

  const close = () => {
    if (!noteRef.current) return;
    clearTimers();
    setLeaving(true);
    timers.current.out = window.setTimeout(() => {
      noteRef.current = null;
      setNote(null);
      setLeaving(false);
    }, OUT_MS);
  };

  /** Without `ms` it stays until `close` (a hover, a keyboard focus). */
  const open = (n: Note, ms?: number) => {
    clearTimers();
    noteRef.current = n;
    setNote(n);
    setLeaving(false);
    if (ms) timers.current.hide = window.setTimeout(close, ms);
  };

  const showingSwitch = () => noteRef.current?.kind === 'switched';
  const showingHint = () => noteRef.current?.kind === 'hint';

  const pick = (c: ClassNo) => {
    if (c === value) return;
    sfx.select();
    onChange(c);
    open({ kind: 'switched', to: c }, SWITCHED_MS);
    setLive(`Class ${c}. ${noteText({ kind: 'switched', to: c }).body}`);
  };

  /* A mouse hovering is asking what this is. A finger cannot hover, so on a
     touch screen the word "Class" is the question instead. */
  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || showingSwitch()) return;
    window.clearTimeout(timers.current.show);
    timers.current.show = window.setTimeout(() => open({ kind: 'hint' }), HINT_DELAY_MS);
  };
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    window.clearTimeout(timers.current.show);
    if (showingHint()) close();
  };
  const tapWord = () => {
    sfx.select();
    if (showingHint()) close();
    else open({ kind: 'hint' }, TAP_HINT_MS);
  };

  const onFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
    let keyboard = false;
    try { keyboard = e.currentTarget.matches(':focus-visible'); } catch { /* old engine: no hint on focus */ }
    if (keyboard && !showingSwitch()) open({ kind: 'hint' });
  };
  const onBlur = () => { if (showingHint()) close(); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next: ClassNo | null = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = 11;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = 12;
    else if (e.key === 'Escape') { close(); return; }
    if (next === null) return;
    e.preventDefault();
    pick(next);
    radios.current[next]?.focus();
  };

  const word = dark ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-500 hover:text-zinc-800';
  const track = dark ? 'bg-white/[0.08]' : 'bg-black/[0.05]';

  const control = (
    <div className="flex items-center gap-2" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <button
        type="button"
        onClick={tapWord}
        aria-expanded={note?.kind === 'hint'}
        aria-describedby={descId}
        className={`cls-word text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-colors ${word}`}
      >
        Class
      </button>
      <div role="radiogroup" aria-label="Class" aria-describedby={descId} onKeyDown={onKeyDown} className={`cls-track relative flex rounded-full ${track}`}>
        <span
          aria-hidden="true"
          className="cls-thumb"
          style={{ background: dark ? '#ffffff' : '#18181b', transform: value === 12 ? 'translateX(100%)' : 'none' }}
        />
        {CLASSES.map(c => {
          const on = c === value;
          return (
            <button
              key={c}
              ref={el => { radios.current[c] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Class ${c}`}
              tabIndex={on ? 0 : -1}
              onClick={() => pick(c)}
              onFocus={onFocus}
              onBlur={onBlur}
              className={`cls-seg relative text-[13px] font-bold font-ui tabular-nums transition-colors duration-200 ${
                on
                  ? dark ? 'text-zinc-900' : 'text-white'
                  : dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>
      <span id={descId} className="sr-only">{DESCRIPTION}</span>
      <span className="sr-only" aria-live="polite">{live}</span>
    </div>
  );

  const text = note ? noteText(note) : null;

  return (
    <>
      {placement === 'corner' ? (
        <LiquidGlass dark={dark} radius={22} variant="bar" bezel={12} strength={10} className="cls-corner">
          {control}
        </LiquidGlass>
      ) : (
        <div className="cls-capsule">{control}</div>
      )}

      {text && (
        <Overlay>
          <div className={`cls-note cls-note--${placement}`} aria-hidden="true">
            <LiquidGlass
              dark={dark}
              radius={18}
              variant="panel"
              bezel={12}
              strength={10}
              className={leaving ? 'cls-out' : 'cd-pop'}
            >
              {/* A little more body than the glass's own tint: this is two lines
                  to read over whatever the page has under the corner, with no
                  scrim behind it. Inset 1px so the rim's light still shows. */}
              <div
                className="px-4 py-3 m-px"
                style={{ borderRadius: 17, background: dark ? 'rgba(20, 20, 24, 0.42)' : 'rgba(255, 255, 255, 0.55)' }}
              >
                <p className={`text-[13px] font-bold font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>{text.title}</p>
                <p className={`text-[12px] font-ui leading-snug mt-1 ${dark ? 'text-zinc-300' : 'text-zinc-600'}`}>{text.body}</p>
              </div>
            </LiquidGlass>
          </div>
        </Overlay>
      )}
    </>
  );
}
