/* ── Support Alpha ──
   A page, not a prompt. It is reached only by someone who went looking: the
   quiet line in quick settings, the last row of Settings, the site footers, or
   /?open=support. It is not in the rail, it never opens by itself, and opening
   it does not become the tab Alpha reopens on (App's openSupport leaves
   `lastUsedTab` alone).

   Four parts, in the brief's order: a letter, the way to chip in, a note for
   the founder, and one closing line. The words are support/content.ts, shared
   with the static /support/ page; the payment details are support/config.ts.

   The payment card is always dark, in both themes. The FamPay QR is a dark
   image with its own glow, and on a white card it read as a screenshot pasted
   in; on a dark plate it reads as the object it is. The image itself is never
   cropped, rounded, filtered or recoloured — anything that changes its pixels
   is a chance to stop it scanning.

   Inside the Play app the payment card is not drawn at all (Google Play's
   payment rules; see store/checkout.ts). The letter, the note and the closing
   stay.

   The note box is a ruled letter, not a chat: it must not look like Feedback,
   which is a support inbox with categories and replies. "Message received"
   appears only after send_founder_note has returned the stored row's id. */

import React, { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Eyebrow, Switch, btn, tokens } from '../ui/kit';
import { isAndroidApp } from '../install/useInstall';
import { SUPPORT_COPY as C } from './content';
import { SUPPORT_QR, SUPPORT_QR_SIZE, UPI_ID, supportReady, upiLink } from './config';
import { NOTE_MAX, NoteError, ackReplies, isUnseen, listMyNotes, sendFounderNote, type MyNote } from './api';

interface Props {
  theme: 'dark' | 'light';
  user: User | null;
  onSignIn: () => void;
  /** Replies have been seen here; App clears the line on Today. */
  onRepliesSeen?: () => void;
  /** Arrived from "… replied to your note" on Today: scroll to Your notes. */
  focusNotes?: boolean;
  onNotesFocused?: () => void;
}

const RED = '#E10600';
const DRAFT_KEY = 'support_note_draft_v1';

const Stop = () => <span style={{ color: RED }}>.</span>;

/* ── The letter ── */

const Letter = ({ dark }: { dark: boolean }) => {
  const t = tokens(dark);
  return (
    <header className="pt-2 md:pt-4">
      <div className="mk-rise flex items-center gap-3">
        <span aria-hidden="true" className="block h-px w-8" style={{ background: RED }} />
        <Eyebrow dark={dark}>{C.eyebrow}</Eyebrow>
      </div>
      <h1
        className={`mk-rise font-display mt-6 text-[46px] sm:text-[60px] md:text-[80px] leading-[0.92] ${t.heading}`}
        style={{ fontWeight: 900, letterSpacing: '-0.045em', animationDelay: '60ms' }}
      >
        {C.title}
        <span className="block font-accent mt-1" style={{ fontWeight: 400, letterSpacing: '-0.03em', fontSize: '1.04em' }}>
          {C.accent}<Stop />
        </span>
      </h1>

      <div className="mt-10 md:mt-14 grid md:grid-cols-[120px_minmax(0,1fr)] gap-6 md:gap-10">
        {/* The margin of the page: a thin rule, and on a laptop the date line
            a letter would carry. Nothing in it is information, so it is hidden
            from screen readers. */}
        <div aria-hidden="true" className="hidden md:block pt-2">
          <span className={`block h-full w-px ml-auto ${dark ? 'bg-white/[0.08]' : 'bg-zinc-200'}`} />
        </div>
        <div className="max-w-[36rem]">
          {C.letter.map((p, i) => (
            <p
              key={i}
              className={`mk-rise font-ui ${i === 0 ? `text-[19px] md:text-[22px] leading-[1.5] ${t.heading}` : `mt-5 text-[16px] md:text-[17px] leading-[1.7] ${t.body}`}`}
              style={{ animationDelay: `${120 + i * 50}ms`, fontWeight: i === 0 ? 500 : 400 }}
            >
              {p}
            </p>
          ))}
          <div className="mk-rise mt-9 flex items-end justify-between gap-6 flex-wrap" style={{ animationDelay: '280ms' }}>
            <div>
              <p className={`font-accent text-[30px] leading-none ${t.heading}`}>{C.signature}</p>
              <p className={`mt-2 text-[11px] font-ui ${t.muted}`}>{C.signatureRole}</p>
            </div>
            <p className={`inline-flex items-center gap-2 text-[12px] font-ui ${t.muted}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${dark ? 'bg-zinc-600' : 'bg-zinc-300'}`} />
              {C.optional}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};

/* ── The way to chip in ── */

const useCoarsePointer = (): boolean => {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const q = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(q.matches);
    on();
    q.addEventListener?.('change', on);
    return () => q.removeEventListener?.('change', on);
  }, []);
  return coarse;
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* Older WebViews: a hidden textarea and the legacy command. */
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const done = document.execCommand('copy');
      el.remove();
      return done;
    } catch {
      return false;
    }
  }
};

const SupportCard = ({ delay }: { delay: number }) => {
  const [qrFailed, setQrFailed] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const coarse = useCoarsePointer();
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!UPI_ID) return;
    const ok = await copyText(UPI_ID);
    setCopied(ok ? 'done' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied('idle'), 1800);
  };

  const ready = supportReady();

  return (
    <section
      aria-labelledby="support-h"
      className="mk-rise relative isolate overflow-hidden rounded-2xl p-6 sm:p-8 md:p-9 text-white"
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(180deg, #131317 0%, #0B0B0D 100%)',
        boxShadow: '0 0 0 1px rgba(255,255,255,0.07) inset, 0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 60px -36px rgba(0,0,0,0.65)',
      }}
    >
      {/* One soft red bloom in the corner, the landing page's light source. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -z-10"
        style={{ right: '-35%', top: '-45%', width: '90%', aspectRatio: '1', background: 'radial-gradient(closest-side, rgba(225,6,0,0.22), rgba(225,6,0,0.05) 55%, transparent 72%)' }}
      />

      <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">Chip in</p>
      <h2 id="support-h" className="font-display text-[28px] md:text-[32px] leading-none mt-3" style={{ fontWeight: 900, letterSpacing: '-0.035em' }}>
        {C.supportTitle}<Stop />
      </h2>
      <p className="text-[14px] md:text-[15px] font-ui leading-[1.6] text-zinc-400 mt-3 max-w-[30rem]">{C.supportBody}</p>

      {!ready ? (
        <div className="mt-8 rounded-xl border border-dashed border-white/[0.14] px-5 py-10 text-center">
          <p className="text-[13px] font-ui text-zinc-400">{C.setup}</p>
        </div>
      ) : (
        <>
          {SUPPORT_QR && (
            <figure className="mt-8 flex flex-col items-center">
              {/* The plate. Its colours were sampled from the image's own edges
                  (near-black at the top, warming toward FamPay's glow at the
                  bottom), so the image's border disappears into it and the QR
                  reads as one tile. The image itself is untouched. */}
              <div
                className="relative w-full max-w-[300px] rounded-[26px] p-[18px]"
                style={{
                  background: 'linear-gradient(180deg, #171715 0%, #1a1917 55%, #241d19 100%)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.07) inset, 0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 48px -28px rgba(0,0,0,0.8)',
                }}
              >
                {qrFailed ? (
                  <div
                    role="img"
                    aria-label="QR code unavailable"
                    className="w-full rounded-2xl border border-dashed border-white/[0.16] flex items-center justify-center px-6 text-center"
                    style={{ aspectRatio: `${SUPPORT_QR_SIZE.width} / ${SUPPORT_QR_SIZE.height}` }}
                  >
                    <p className="text-[13px] font-ui text-zinc-400 leading-[1.5]">{C.qrFailed}</p>
                  </div>
                ) : (
                  <img
                    src={SUPPORT_QR}
                    width={SUPPORT_QR_SIZE.width}
                    height={SUPPORT_QR_SIZE.height}
                    alt={UPI_ID ? `UPI QR code for ${UPI_ID}` : 'UPI QR code for Tracker Alpha'}
                    decoding="async"
                    onError={() => setQrFailed(true)}
                    className="block w-full h-auto select-none"
                    draggable={false}
                  />
                )}
              </div>
              {!qrFailed && <figcaption className="mt-4 text-[12px] font-ui text-zinc-400">{C.scan}</figcaption>}
            </figure>
          )}

          {UPI_ID && (
            <div className="mt-7">
              {SUPPORT_QR && (
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-white/[0.08]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">{C.orPayTo}</span>
                  <span className="h-px flex-1 bg-white/[0.08]" />
                </div>
              )}
              {!SUPPORT_QR && <p className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-zinc-500">UPI ID</p>}
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.08] pl-4 pr-1.5 py-1.5">
                <span className="sr-only">UPI ID: </span>
                <code className="flex-1 min-w-0 truncate text-[15px] font-mono text-white select-all">{UPI_ID}</code>
                <button
                  type="button"
                  onClick={() => { void copy(); }}
                  className={`${btn} h-9 px-3.5 !normal-case !tracking-normal !text-[12px] !font-semibold border border-white/[0.12] text-zinc-100 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60`}
                >
                  {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
                </button>
              </div>
              <span className="sr-only" role="status" aria-live="polite">{copied === 'done' ? 'UPI ID copied' : ''}</span>

              {/* A phone cannot scan its own screen, so on a touch screen the
                  same id opens the student's UPI app directly. */}
              {coarse && (
                <a
                  href={upiLink(UPI_ID)}
                  className="mt-3 w-full h-12 rounded-xl bg-white text-zinc-900 flex items-center justify-center gap-2 text-[14px] font-bold font-ui active:scale-[0.98] transition-transform"
                >
                  Open in a UPI app
                </a>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

/* ── The note ── */

const readDraft = (): string => {
  try { return sessionStorage.getItem(DRAFT_KEY) ?? ''; } catch { return ''; }
};
const writeDraft = (v: string) => {
  try { if (v) sessionStorage.setItem(DRAFT_KEY, v); else sessionStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
};

const LINE = 30;

const NoteCard = ({ dark, user, onSignIn, delay, onSent }: { dark: boolean; user: User | null; onSignIn: () => void; delay: number; onSent?: () => void }) => {
  const t = tokens(dark);
  /* The draft survives the Google sign-in round trip (same tab, so
     sessionStorage), which is the one moment a guest's words would be lost. */
  const [text, setText] = useState(readDraft);
  const [signed, setSigned] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const change = (v: string) => {
    const next = v.slice(0, NOTE_MAX);
    setText(next);
    writeDraft(next);
    if (error) setError(null);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { onSignIn(); return; }
    if (status === 'sending') return;
    setStatus('sending');
    setError(null);
    try {
      await sendFounderNote(text, signed);
      setStatus('sent');
      onSent?.();
      setText('');
      writeDraft('');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof NoteError ? err.message : 'Couldn’t send it. Try again in a moment.');
    }
  };

  useEffect(() => { if (status === 'sent') doneRef.current?.focus(); }, [status]);

  const left = NOTE_MAX - text.length;
  const empty = text.trim().length === 0;
  const rule = dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.08)';

  return (
    <section
      aria-labelledby="note-h"
      className={`mk-rise rounded-2xl border p-6 sm:p-8 md:p-9 flex flex-col ${t.card}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <Eyebrow dark={dark}>Write in</Eyebrow>
      <h2 id="note-h" className={`font-display text-[28px] md:text-[32px] leading-none mt-3 ${t.heading}`} style={{ fontWeight: 900, letterSpacing: '-0.035em' }}>
        {C.noteTitle}<Stop />
      </h2>
      <p className={`text-[14px] md:text-[15px] font-ui leading-[1.6] mt-3 ${t.muted}`}>{C.noteBody}</p>

      {status === 'sent' ? (
        <div
          ref={doneRef}
          tabIndex={-1}
          role="status"
          className="mk-fade flex-1 flex flex-col items-center justify-center text-center py-12 outline-none"
        >
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="24" fill="none" stroke={dark ? 'rgba(255,255,255,0.12)' : 'rgba(24,24,27,0.1)'} strokeWidth="1.5" />
            <path className="mk-draw" d="M16 27l7 7 13-15" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={{ ['--mk-len' as string]: 1 } as React.CSSProperties} />
          </svg>
          <p className={`mt-5 text-[17px] font-ui font-bold ${t.heading}`}>{C.noteReceived}</p>
          <p className={`mt-1 font-accent text-[20px] leading-snug ${t.body}`}>{C.noteThanks}</p>
          <button
            type="button"
            onClick={() => { setStatus('idle'); requestAnimationFrame(() => fieldRef.current?.focus()); }}
            className={`mt-6 text-[13px] font-ui font-semibold underline underline-offset-4 ${t.muted} ${dark ? 'hover:text-white' : 'hover:text-zinc-900'}`}
          >
            Write another
          </button>
        </div>
      ) : (
        <form onSubmit={send} className="mt-7 flex-1 flex flex-col" noValidate>
          <label htmlFor="founder-note" className="sr-only">Your note to the founder</label>
          {/* A ruled sheet: the lines are a background on the field itself,
              attached locally so they scroll with what is written. */}
          <textarea
            id="founder-note"
            ref={fieldRef}
            value={text}
            onChange={e => change(e.target.value)}
            maxLength={NOTE_MAX}
            rows={7}
            placeholder={C.notePlaceholder}
            aria-describedby="founder-note-count founder-note-error"
            aria-invalid={error ? true : undefined}
            className={`w-full flex-1 resize-none rounded-xl border px-4 font-ui text-[15px] outline-none transition-colors focus:border-[#E10600] ${
              dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white placeholder:text-zinc-600' : 'bg-[#FCFCFB] border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
            }`}
            style={{
              lineHeight: `${LINE}px`,
              paddingTop: 10,
              paddingBottom: 10,
              minHeight: LINE * 7 + 20,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${LINE - 1}px, ${rule} ${LINE - 1}px, ${rule} ${LINE}px)`,
              backgroundPosition: '0 10px',
              backgroundAttachment: 'local',
            }}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className={`text-[11px] font-ui ${t.faint}`}>Optional. Say whatever you like.</span>
            <span
              id="founder-note-count"
              className={`text-[11px] font-ui tabular-nums ${left <= 50 ? (dark ? 'text-amber-400' : 'text-amber-600') : t.faint}`}
              aria-label={`${text.length} of ${NOTE_MAX} characters`}
            >
              {text.length} / {NOTE_MAX}
            </span>
          </div>

          {user && (
            <div className={`mt-5 flex items-center justify-between gap-4 pt-5 border-t ${t.rule}`}>
              <div className="min-w-0">
                <p className={`text-[13px] font-ui font-semibold ${t.heading}`} id="sign-label">Sign it with my name</p>
                <p className={`text-[12px] font-ui mt-0.5 ${t.muted}`}>
                  {signed ? 'Your profile name goes with the note.' : 'Off: the note arrives without your name.'}
                </p>
              </div>
              <Switch dark={dark} label="Sign it with my name" on={signed} onToggle={setSigned} />
            </div>
          )}

          <p id="founder-note-error" role="alert" className={`text-[13px] font-ui font-semibold min-h-[1px] ${error ? 'mt-4' : ''} ${dark ? 'text-rose-400' : 'text-rose-600'}`}>
            {error ?? ''}
          </p>

          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            {!user && <p className={`text-[12px] font-ui ${t.muted} max-w-[18rem]`}>Sign in to send. What you’ve written stays here.</p>}
            <button
              type="submit"
              disabled={user ? empty || status === 'sending' : false}
              className={`${btn} h-12 px-7 ml-auto ${t.primary} !text-[11px]`}
            >
              {!user ? 'Sign in to send' : status === 'sending' ? 'Sending…' : 'Send note'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

/* ── Your notes, and the replies to them ──
   Only for a signed-in student who has sent at least one. A reply is "seen"
   once this list has actually been on screen (IntersectionObserver), not when
   the page opened: arriving at the top of a long page has not read anything.
   A reply that was new keeps its "New" tag until the page is left, so the
   tag does not vanish the instant it is looked at. */

const dateLine = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const YourNotes = ({ dark, notes, fresh, delay, sectionRef }: {
  dark: boolean;
  notes: MyNote[];
  fresh: ReadonlySet<string>;
  delay: number;
  sectionRef: React.RefObject<HTMLElement | null>;
}) => {
  const t = tokens(dark);
  return (
    <section
      id="your-notes"
      ref={sectionRef as React.RefObject<HTMLElement>}
      aria-labelledby="your-notes-h"
      className="mk-rise mt-16 md:mt-20 scroll-mt-24"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={`block h-px w-8 ${dark ? 'bg-white/[0.16]' : 'bg-zinc-300'}`} />
        <Eyebrow dark={dark}><span id="your-notes-h">Your notes</span></Eyebrow>
      </div>

      <ol className="mt-6 grid gap-4 max-w-[46rem]">
        {notes.map(n => {
          const isNew = fresh.has(n.id) || isUnseen(n);
          return (
            <li key={n.id} className={`rounded-2xl border p-5 md:p-6 ${t.card}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={`text-[11px] font-ui ${t.faint}`}>
                  You wrote · {dateLine(n.created_at)}{n.signed ? ' · signed' : ''}
                </p>
                {n.reply && isNew && (
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] font-ui" style={{ color: RED }}>New reply</span>
                )}
              </div>
              <p className={`mt-2 text-[14px] font-ui leading-[1.65] whitespace-pre-wrap break-words ${t.muted}`}>{n.body}</p>

              {n.reply ? (
                <div className={`mt-5 pt-5 border-t ${t.rule}`}>
                  <p className={`text-[15px] md:text-[16px] font-ui leading-[1.7] whitespace-pre-wrap break-words ${t.heading}`}>{n.reply}</p>
                  <div className="mt-4 flex items-baseline justify-between gap-3 flex-wrap">
                    <p className={`font-accent text-[22px] leading-none ${t.heading}`}>{C.signature}</p>
                    {n.replied_at && <p className={`text-[11px] font-ui ${t.faint}`}>Replied {dateLine(n.replied_at)}</p>}
                  </div>
                </div>
              ) : (
                <p className={`mt-4 text-[12px] font-ui ${t.faint}`}>Sent. If there’s a reply, it will appear here.</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/* ── The page ── */

const SupportPage = ({ theme, user, onSignIn, onRepliesSeen, focusNotes, onNotesFocused }: Props) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  /* Decided once: the Play app flag is set before first paint and never changes. */
  const [inPlayApp] = useState(isAndroidApp);

  const uid = user?.id ?? null;
  const [notes, setNotes] = useState<MyNote[]>([]);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const notesRef = useRef<HTMLElement | null>(null);

  const loadNotes = React.useCallback(() => {
    if (!uid) { setNotes([]); return; }
    let alive = true;
    void listMyNotes().then(rows => { if (alive) setNotes(rows); });
    return () => { alive = false; };
  }, [uid]);
  useEffect(() => loadNotes(), [loadNotes]);

  /* Seen = the list scrolled into view. Marked here at once and on the server;
     if that write fails, the next check simply brings the line back. */
  const unseenIds = notes.filter(isUnseen).map(n => n.id).join(',');
  useEffect(() => {
    const el = notesRef.current;
    if (!unseenIds || !el) return;
    const ids = unseenIds.split(',');
    const io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      const now = new Date().toISOString();
      setFresh(prev => new Set([...prev, ...ids]));
      setNotes(prev => prev.map(n => (ids.includes(n.id) ? { ...n, reply_seen_at: now } : n)));
      void ackReplies(ids).then(() => onRepliesSeen?.(), () => { /* shows again next time */ });
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [unseenIds, onRepliesSeen]);

  /* From the line on Today: once the list exists, bring it into view. */
  useEffect(() => {
    if (!focusNotes || notes.length === 0) return;
    notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onNotesFocused?.();
  }, [focusNotes, notes.length, onNotesFocused]);

  return (
    <div className="pb-10">
      <Letter dark={dark} />

      <div className={`mt-16 md:mt-24 grid gap-5 md:gap-6 items-stretch ${inPlayApp ? 'max-w-[40rem]' : 'lg:grid-cols-2'}`}>
        {!inPlayApp && <SupportCard delay={340} />}
        <NoteCard dark={dark} user={user} onSignIn={onSignIn} delay={inPlayApp ? 340 : 400} onSent={loadNotes} />
      </div>

      {user && notes.length > 0 && <YourNotes dark={dark} notes={notes} fresh={fresh} delay={430} sectionRef={notesRef} />}

      <footer className="mk-rise mt-20 md:mt-28 flex flex-col items-center text-center" style={{ animationDelay: '460ms' }}>
        <span aria-hidden="true" className={`block w-px h-12 ${dark ? 'bg-white/[0.1]' : 'bg-zinc-200'}`} />
        <p className={`mt-8 font-accent text-[28px] md:text-[36px] leading-tight ${t.heading}`}>
          {C.closing}<Stop />
        </p>
      </footer>
    </div>
  );
};

export default SupportPage;
