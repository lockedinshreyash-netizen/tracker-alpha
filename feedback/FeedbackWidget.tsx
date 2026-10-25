import React, { useEffect, useRef, useState } from 'react';
import LiquidGlass from '../ui/LiquidGlass';
import type { User } from '@supabase/supabase-js';
import {
  CATEGORIES, Category, CategoryDef, Draft, MESSAGE_MAX, STATUS_LABEL,
  SUBJECT_MAX, Ticket, ackReplies, categoryLabel, humanError, listMine, listUnseenReplies, submit, validate,
} from './api';

interface Props {
  user: User | null;
  theme: 'dark' | 'light';
  /** Recorded on the ticket. The one piece of context nobody should type. */
  route: string;
  /** Tracks the sidebar so the dock clears the rail. See index.css. */
  railPx: number;
  onOpenAuth: () => void;
  /** Opens the Support Alpha page. A quiet row at the foot of the menu, nothing more:
   *  this widget files tickets, and a note to the founder is not a ticket. */
  onOpenSupport?: () => void;
}

type View = 'menu' | 'form' | 'sent' | 'mine';

/**
 * "Need help? Tell us." — a speech bubble in the corner, and a structured
 * ticket behind it.
 *
 * It is written to FEEL like a chat widget and to BE a form, and the difference
 * is deliberate at every step: there is no typing indicator, no agent avatar,
 * no reply that arrives in ninety seconds, and above all no model answering on
 * behalf of a person. What the user sends goes into a table a human reads. The
 * conversational shape is there because "choose a category, fill two fields"
 * reads as work and "what's up?" does not — not because there is anybody on the
 * other end right now.
 *
 * Three views and a success state. A ticket list is the fourth, and it exists
 * only because admins can reply: a reply nobody can read is not a reply.
 *
 * And a reply nobody knows about is not read either: while one is waiting the
 * launcher wears a red dot, and tapping it opens straight onto Your messages.
 * The dot goes once the list with that reply in it has been on screen
 * (`ack_feedback_replies`, supabase/admin.sql §6b), on every device, because
 * "seen" is kept on the ticket. Checked on arrival and when the app comes back
 * to the foreground, at most every two minutes; a reply is not urgent enough to
 * poll for.
 */
const FeedbackWidget: React.FC<Props> = ({ user, theme, route, railPx, onOpenAuth, onOpenSupport }) => {
  const dark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const [category, setCategory] = useState<CategoryDef>(CATEGORIES[0]);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [who, setWho] = useState('');
  const [error, setError] = useState<string | null>(null);

  /* A ref, not state. The guard has to hold between the click and the first
     render of the disabled button, which is a gap `setState` does not close —
     a double-tap on a slow phone would otherwise file the ticket twice. */
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);

  const [mine, setMine] = useState<Ticket[] | null>(null);
  const [mineError, setMineError] = useState<string | null>(null);

  /* Tickets with a reply the student has not seen: the red dot. */
  const [unseen, setUnseen] = useState<string[]>([]);
  /* Replies that were new when the list opened, tagged "New" until it closes. */
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  /* Bumped on every acknowledgement, so a check that was already in flight
     cannot put back a dot the student has just cleared. */
  const ackGenRef = useRef(0);
  const lastCheckRef = useRef(0);
  const uid = user?.id ?? null;

  useEffect(() => {
    setUnseen([]);
    if (!uid) return;
    let alive = true;
    const check = (force: boolean) => {
      const now = Date.now();
      if (!force && now - lastCheckRef.current < 120_000) return;
      lastCheckRef.current = now;
      const gen = ackGenRef.current;
      void listUnseenReplies(uid).then(ids => {
        if (alive && gen === ackGenRef.current) setUnseen(ids);
      });
    };
    check(true);
    const onBack = () => { if (document.visibilityState === 'visible') check(false); };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [uid]);

  /* Seen = the list holding the reply is on screen. Cleared here at once and
     acknowledged on the server; if that write fails, the next check simply
     brings the dot back. */
  useEffect(() => {
    if (!open || view !== 'mine' || !mine || unseen.length === 0) return;
    const shown = new Set(mine.map(t => t.id));
    const ids = unseen.filter(id => shown.has(id));
    if (ids.length === 0) return;
    ackGenRef.current += 1;
    setFresh(prev => new Set([...prev, ...ids]));
    setUnseen(prev => prev.filter(id => !shown.has(id)));
    void ackReplies(ids).catch(() => { /* shows again on the next check */ });
  }, [open, view, mine, unseen]);

  const hasUnseen = !!user && unseen.length > 0;

  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape closes, from anywhere in the panel. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  /* Focus lands in the panel when it opens, so a keyboard user is not left
     tabbing from the top of the document to reach it. */
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, view]);

  const close = () => {
    setOpen(false);
    setError(null);
    setFresh(new Set());
  };

  /* Reopening after a send lands back on the menu rather than on the receipt
     for a ticket they already read. */
  const toggle = () => {
    if (open) { close(); return; }
    setOpen(true);
    /* A reply is waiting: that is what the dot promised, so go straight to it. */
    if (hasUnseen) { void openMine(); return; }
    if (view === 'sent') setView('menu');
  };

  const reset = () => {
    setView('menu');
    setSubject('');
    setMessage('');
    setWho('');
    setError(null);
  };

  const choose = (c: CategoryDef) => {
    setCategory(c);
    setSubject('');
    setMessage('');
    setWho('');
    setError(null);
    setView('form');
  };

  const send = async () => {
    if (sendingRef.current || !user) return;

    const draft: Draft = {
      category: category.id,
      subject,
      message,
      reportedName: who,
      route,
    };

    const problem = validate(draft);
    if (problem) { setError(problem); return; }

    sendingRef.current = true;
    setSending(true);
    setError(null);

    try {
      await submit(user.id, draft);
      setView('sent');
      /* The list is stale the moment a ticket is filed; drop it rather than
         refetching, so it is only paid for if they go and look. */
      setMine(null);
    } catch (e) {
      setError(humanError(e));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const openMine = async () => {
    setView('mine');
    setMineError(null);
    if (!user) return;
    /* A cached list predates the reply the dot is about. */
    if (mine && !hasUnseen) return;
    if (hasUnseen) setMine(null);
    try {
      setMine(await listMine(user.id));
    } catch (e) {
      setMineError(humanError(e));
    }
  };

  /* ── Shared skin ──
     Lifted from the app's existing panels rather than invented: same surface,
     same hairline, same muted zinc as every card in `mocks/`. */
  const panel = dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-200';
  const ink = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const field = `w-full rounded-lg border px-3 py-2.5 text-[13px] font-ui outline-none transition-colors ${dark
    ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-600 focus:border-white/20'
    : 'bg-[#F7F6F3] border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300'}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${muted}`;

  /* The way to Support Alpha, under everything else on the first screen and
     set apart by a hairline: seen by anyone who opens the bubble, asking
     nothing of them. Guests see it too — the page needs no account. */
  const supportRow = onOpenSupport ? (
    <button
      type="button"
      onClick={() => { close(); onOpenSupport(); }}
      className={`group mt-3 pt-3 border-t w-full flex items-center justify-between gap-3 px-1 text-left ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}
    >
      <span className="min-w-0">
        <span className={`block text-[12px] font-bold font-ui ${ink}`}>Support Alpha</span>
        <span className={`block text-[11px] font-ui mt-0.5 leading-snug ${muted}`}>A note from the founder. Entirely optional.</span>
      </span>
      <span aria-hidden="true" className={`shrink-0 text-[13px] font-ui transition-transform group-hover:translate-x-0.5 ${muted}`}>→</span>
    </button>
  ) : null;

  return (
    /* One wrapper so `--rail` reaches both fixed children; it lays out nothing
       itself. */
    <div style={{ ['--rail' as any]: `${railPx}px` }}>
      <div className="fb-dock">
        {/* Liquid glass, the gear's twin in the other corner (settings/
            QuickSettings). Geometry is .fb-button in index.css. */}
        <LiquidGlass
          as="button"
          dark={dark}
          radius={24}
          variant="bar"
          bezel={12}
          strength={12}
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? 'Close feedback' : hasUnseen ? 'Send feedback. You have a new reply.' : 'Send feedback'}
          className={`fb-button flex items-center justify-center transition-transform active:scale-95 ${dark ? 'text-white' : 'text-zinc-900'}`}
        >
          {open ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.3 9.3 0 0 1-3.3-.6L3 21l1.8-4.5A8.1 8.1 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
            </svg>
          )}
        </LiquidGlass>
        {hasUnseen && !open && <span className={`fb-dot ${dark ? '' : 'light'}`} aria-hidden="true" />}
      </div>

      {open && (
        <>
          <div className="fb-scrim" onClick={close} aria-hidden="true" />

          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Feedback and support"
            className={`fb-panel fb-pop rounded-2xl border shadow-2xl overflow-hidden outline-none ${panel}`}
          >
            {/* ── Header ── */}
            <div className={`flex items-center gap-3 px-5 py-4 border-b flex-shrink-0 ${dark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
              {view !== 'menu' && (
                <button
                  onClick={() => (view === 'sent' ? reset() : setView('menu'))}
                  aria-label="Back"
                  className={`-ml-1 p-1 rounded-md transition-colors ${dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-bold font-ui leading-tight ${ink}`}>
                  {view === 'menu' && 'Hey — what’s up?'}
                  {view === 'form' && category.label}
                  {view === 'sent' && 'Sent'}
                  {view === 'mine' && 'Your messages'}
                </p>
                <p className={`text-[11px] font-ui mt-0.5 ${muted}`}>
                  {view === 'menu' && 'Anything we can help with?'}
                  {view === 'form' && category.blurb}
                  {view === 'sent' && 'A person reads every one of these.'}
                  {view === 'mine' && 'Everything you have sent us.'}
                </p>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!user ? (
                <div className="py-4 text-center">
                  <p className={`text-[13px] font-ui leading-relaxed ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Sign in and we can answer you. Without an account there is nowhere
                    to send the reply.
                  </p>
                  <button
                    onClick={() => { close(); onOpenAuth(); }}
                    className="mt-5 w-full px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui"
                  >
                    Sign in
                  </button>
                  {supportRow}
                </div>
              ) : view === 'menu' ? (
                <div className="flex flex-col gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.id}
                      onClick={() => choose(c)}
                      className={`text-left px-4 py-3 rounded-xl border transition-all active:scale-97 ${dark
                        ? 'bg-[#0D0D10] border-white/[0.06] hover:border-white/[0.14]'
                        : 'bg-[#F7F6F3] border-zinc-200 hover:border-zinc-300'}`}
                    >
                      <span className={`block text-[13px] font-bold font-ui ${ink}`}>{c.label}</span>
                      <span className={`block text-[11px] font-ui mt-0.5 leading-snug ${muted}`}>{c.blurb}</span>
                    </button>
                  ))}

                  <button
                    onClick={openMine}
                    className={`mt-1 flex items-center gap-2 text-left px-4 py-2 text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${hasUnseen ? ink : muted} hover:text-[#E10600]`}
                  >
                    {hasUnseen && <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] shrink-0" aria-hidden="true" />}
                    {hasUnseen ? `Your messages · ${unseen.length === 1 ? 'new reply' : `${unseen.length} new replies`} →` : 'Your messages →'}
                  </button>
                  {supportRow}
                </div>
              ) : view === 'form' ? (
                <div className="flex flex-col gap-3">
                  {category.asksWho && (
                    <label className="block">
                      <span className={eyebrow}>Who — optional</span>
                      <input
                        value={who}
                        onChange={e => setWho(e.target.value)}
                        maxLength={60}
                        placeholder="Leaderboard name, if you know it"
                        className={`${field} mt-1.5`}
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className={eyebrow}>Subject</span>
                    <input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      maxLength={SUBJECT_MAX}
                      placeholder="One line"
                      className={`${field} mt-1.5`}
                    />
                  </label>

                  <label className="block">
                    <span className={eyebrow}>Message</span>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      maxLength={MESSAGE_MAX}
                      rows={5}
                      placeholder={category.hint}
                      className={`${field} mt-1.5 resize-none leading-relaxed`}
                    />
                  </label>

                  {category.id === 'abuse' && (
                    <p className={`text-[10.5px] font-ui leading-snug ${muted}`}>
                      Reports are private. Nobody but the LOCK IN team can see this,
                      and the person you name is never told who filed it.
                    </p>
                  )}

                  {error && (
                    <p className="text-[11px] font-bold font-ui text-[#E10600]">{error}</p>
                  )}
                </div>
              ) : view === 'sent' ? (
                <div className="py-6 text-center">
                  <div className="w-11 h-11 rounded-full bg-[#E10600]/10 text-[#E10600] flex items-center justify-center mx-auto">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p className={`mt-4 text-[13px] font-bold font-ui ${ink}`}>Got it.</p>
                  <p className={`mt-1 text-[12px] font-ui leading-relaxed ${muted}`}>
                    It is in the queue. If it needs an answer you will find it under
                    Your messages.
                  </p>
                  <button
                    onClick={openMine}
                    className={`mt-5 text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
                  >
                    Your messages →
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {mineError && (
                    <p className="text-[11px] font-bold font-ui text-[#E10600]">{mineError}</p>
                  )}
                  {!mineError && mine === null && (
                    <p className={`text-[11px] font-ui py-4 text-center ${muted}`}>Loading…</p>
                  )}
                  {mine?.length === 0 && (
                    <p className={`text-[12px] font-ui py-4 text-center leading-relaxed ${muted}`}>
                      Nothing yet. Anything you send shows up here with its status.
                    </p>
                  )}
                  {mine?.map(t => (
                    <div
                      key={t.id}
                      className={`px-4 py-3 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-zinc-200'}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.status === 'resolved' ? muted : 'text-[#E10600]'}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                        <span className={`text-[9px] font-ui uppercase tracking-[0.06em] ${muted}`}>
                          {categoryLabel(t.category)}
                        </span>
                      </div>
                      <p className={`mt-1 text-[12.5px] font-bold font-ui leading-snug ${ink}`}>{t.subject}</p>
                      {t.admin_response && (
                        <p className={`mt-2 pt-2 border-t text-[11.5px] font-ui leading-relaxed ${dark ? 'border-white/[0.06] text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
                          <span className="font-bold text-[#E10600]">{fresh.has(t.id) ? 'New reply · ' : 'Reply · '}</span>
                          {t.admin_response}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Footer ── Only the form has anything to commit. */}
            {user && view === 'form' && (
              <div className={`px-5 py-4 border-t flex-shrink-0 ${dark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
                <button
                  onClick={send}
                  disabled={sending}
                  className="w-full px-5 py-3 text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-50"
                >
                  {sending ? 'Sending…' : category.id === 'abuse' ? 'Send report' : 'Send feedback'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default FeedbackWidget;
