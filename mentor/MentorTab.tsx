/* ── The Mentor tab ──
   A container over `useMentor` (mounted at App root) and the deterministic
   engines. It reads AppState to draw the brief strip — the Mentor is by nature
   a reader of everything — but changes nothing itself: every write goes
   through a card the student applies, or through the three narrow callbacks
   below (consent on/off, exam date).

   Two layers, deliberately:
   - the strip and the four quick actions work with the model switched off,
     rate-limited or out of allowance — they are the planner, not the AI;
   - the conversation is what the model adds on top. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from '../types';
import { resolveExamDate } from '../constants';
import { getISTDateString } from '../utils';
import { MENTOR_CONSENT_VERSION, normalizeMentor } from '../state';
import { tokens, btn, Eyebrow } from '../groups/ui';
import { MentorApi, QuickAction } from './useMentor';
import { computePace, VERDICT_LABEL } from './pace';
import { slippedTasks } from './replan';
import { hoursBySubject } from './brief';
import { addDays } from '../utils';
import { MessageText, PaceCard, ProposalCard, WeekCard } from './MentorCards';
import ExamDateField from './ExamDateField';
import MentorInvites from './MentorInvites';
import { Entry } from './threads';

interface Props {
  state: AppState;
  theme: 'dark' | 'light';
  mentor: MentorApi;
  signedIn: boolean;
  /** Whether a model can be reached at all in this deployment for this account. */
  modelReady: boolean;
  onEnable: () => void;
  onDisable: () => void;
  onSetExamDate: (date: string | null) => void;
  onOpenAuth: () => void;
  /** This account may invite others into the beta. */
  canInvite: boolean;
}

const QUICK: { action: QuickAction; label: string; hint: string }[] = [
  { action: 'plan_today', label: 'Plan my day', hint: 'Cards that fit the time you actually have' },
  { action: 'on_track', label: 'Am I on track?', hint: 'Pace against your exam or deadline' },
  { action: 'roadmap', label: 'Build roadmap', hint: 'Every chapter left, week by week' },
  { action: 'review_week', label: 'Review my week', hint: 'Last 7 days against the 7 before' },
];

const SUGGESTIONS = [
  'How much Physics do I have left?',
  'Which subject am I neglecting?',
  'Plan tomorrow around 4 hours.',
  'I want to finish my syllabus by December 15.',
];

const MentorTab: React.FC<Props> = ({ state, theme, mentor, signedIn, modelReady, onEnable, onDisable, onSetExamDate, onOpenAuth, canInvite }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const prefs = normalizeMentor(state.mentor);
  const consented = prefs.enabled && prefs.consentVersion === MENTOR_CONSENT_VERSION;
  const exam = state.examPreference || 'JEE';
  const today = getISTDateString();

  /* The strip: all arithmetic, recomputed only when its inputs move. */
  const strip = useMemo(() => {
    const pace = computePace(state, today);
    const week = hoursBySubject(state, addDays(today, -7), addDays(today, -1));
    const overdue = state.tasks.filter(x => !x.completed && x.dueAt && x.dueAt < today).length;
    return { pace, week, overdue, slipped: slippedTasks(state.tasks, today).length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.logs, state.progress, state.tasks, state.mentor, state.examDates, state.examPreference, state.currentClass, state.schedule, today]);

  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const entries = mentor.thread?.entries ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entries.length, mentor.step]);

  const submit = () => {
    if (!draft.trim() || mentor.busy) return;
    mentor.send(draft.slice(0, 1000));
    setDraft('');
  };

  const lastEntry = entries[entries.length - 1];
  const unanswered = !mentor.busy && lastEntry?.kind === 'user';

  const renderEntry = (e: Entry) => {
    switch (e.kind) {
      case 'user':
        return (
          <div key={e.id} className="flex justify-end">
            <p className={`max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm font-ui whitespace-pre-wrap ${dark ? 'bg-white/[0.07] text-white' : 'bg-[#17150F] text-[#F2F0EC]'}`}>{e.text}</p>
          </div>
        );
      case 'assistant':
        return (
          <div key={e.id} className="max-w-[92%]">
            <MessageText text={e.text} dark={dark} />
          </div>
        );
      case 'proposal':
        return (
          <ProposalCard
            key={e.id}
            proposal={e.proposal}
            dark={dark}
            onToggle={lineId => mentor.toggleLine(e.id, lineId)}
            onMins={(lineId, mins) => mentor.setLineMins(e.id, lineId, mins)}
            onApply={() => mentor.apply(e.id)}
            onUndo={() => mentor.undo(e.id)}
            onDismiss={() => mentor.dismiss(e.id)}
          />
        );
      case 'pace':
        return <PaceCard key={e.id} pace={e.pace} dark={dark} />;
      case 'week':
        return <WeekCard key={e.id} review={e.review} dark={dark} />;
      case 'notice':
        return (
          <div key={e.id} className={`flex flex-wrap items-center gap-3 text-xs font-ui ${e.tone === 'error' ? 'text-[#E10600]' : t.muted}`}>
            <span>{e.text}</span>
            {e.retry && modelReady && consented && (
              <button type="button" onClick={mentor.retry} disabled={mentor.busy} className={`${btn} px-3 py-1.5 ${t.ghost}`}>Retry</button>
            )}
          </div>
        );
    }
  };

  /* ── Consent ── */
  if (!consented) {
    return (
      <div className="space-y-6">
        <Header dark={dark} />
        <section className={`rounded-xl border p-6 md:p-8 ${t.card}`}>
          <Eyebrow dark={dark}>Before you turn it on</Eyebrow>
          <h3 className={`mt-2 text-xl font-black uppercase tracking-wide font-ui ${t.heading}`}>It plans from your real data. So it has to see it.</h3>
          <div className="mt-5 grid md:grid-cols-2 gap-6">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.14em] font-ui ${t.heading}`}>Sent when you ask it something</p>
              <ul className={`mt-2 space-y-1.5 text-sm font-ui ${t.body}`}>
                <li>Your syllabus status and chapter names</li>
                <li>Hours studied per day and subject</li>
                <li>Your task cards: text, due dates, sizes</li>
                <li>Your timetable for the days it looks at</li>
                <li>Your exam date, goals and roadmap</li>
              </ul>
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-[0.14em] font-ui ${t.heading}`}>Never sent</p>
              <ul className={`mt-2 space-y-1.5 text-sm font-ui ${t.body}`}>
                <li>Your name, email or account id</li>
                <li>Chapter notes, sleep, anything about your groups</li>
                <li>Anything at all until you press a button</li>
              </ul>
            </div>
          </div>
          <p className={`mt-5 text-xs font-ui leading-relaxed ${t.muted}`}>
            Requests go through Tracker Alpha to an AI model provider that does not train on what it receives. Your conversations are kept on this device only — never on our servers — and are wiped when you sign out or turn the Mentor off. It suggests; nothing changes until you tap to apply it.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {signedIn ? (
              <button type="button" onClick={onEnable} className={`${btn} px-6 py-3 ${t.primary}`}>Turn on Mentor</button>
            ) : (
              <button type="button" onClick={onOpenAuth} className={`${btn} px-6 py-3 ${t.primary}`}>Sign in to use the Mentor</button>
            )}
            {!modelReady && (
              <span className={`text-[11px] font-ui ${t.muted}`}>The AI half isn't live in this build — the planner and cards still work.</span>
            )}
          </div>
        </section>
        {canInvite && signedIn && <MentorInvites theme={theme} />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Header dark={dark} />
        <div className="flex items-center gap-2">
          {mentor.threads.length > 1 && (
            <select
              value={mentor.thread?.id ?? ''}
              onChange={e => mentor.openThread(e.target.value)}
              disabled={mentor.busy}
              className={`max-w-[180px] px-3 py-2 rounded-lg border text-xs font-ui ${dark ? 'bg-[#111114] border-white/[0.08] text-zinc-300' : 'bg-white border-[#E3E0D9] text-[#17150F]'}`}
              aria-label="Past conversations"
            >
              {mentor.threads.map(th => <option key={th.id} value={th.id}>{th.title}</option>)}
            </select>
          )}
          <button type="button" onClick={mentor.startThread} disabled={mentor.busy} className={`${btn} px-4 py-2.5 ${t.ghost} disabled:opacity-40`}>New chat</button>
        </div>
      </div>

      {/* The brief: arithmetic, no model. */}
      <section className={`rounded-xl border p-5 md:p-6 ${t.card}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StripStat label="Syllabus done" value={`${strip.pace.percentDone}%`} dark={dark} />
          <StripStat label="Last 7 days" value={`${strip.week.hours}h`} sub={`${strip.week.studyDays} study days`} dark={dark} />
          <StripStat label="Pace" value={VERDICT_LABEL[strip.pace.verdict]} sub={Number.isFinite(strip.pace.required.mid) ? `needs ~${strip.pace.required.mid}h/day` : undefined} dark={dark} small />
          <StripStat label="Overdue cards" value={String(strip.overdue)} dark={dark} alarm={strip.overdue > 0} />
        </div>
        <div className={`mt-5 pt-4 border-t ${t.rule}`}>
          <ExamDateField exam={exam} examDates={state.examDates} onSet={onSetExamDate} theme={theme} compact />
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK.map(q => (
          <button
            key={q.action}
            type="button"
            onClick={() => mentor.runAction(q.action)}
            disabled={mentor.busy}
            className={`text-left rounded-xl border p-4 transition-all active:scale-[0.98] disabled:opacity-40 ${t.card} ${t.hover}`}
          >
            <span className={`block text-[11px] font-black uppercase tracking-[0.12em] font-ui ${t.heading}`}>{q.label}</span>
            <span className={`block mt-1 text-[11px] font-ui leading-snug ${t.muted}`}>{q.hint}</span>
          </button>
        ))}
      </div>
      {strip.slipped > 0 && (
        <button
          type="button"
          onClick={() => mentor.runAction('replan')}
          disabled={mentor.busy}
          className={`w-full ${btn} px-4 py-3 ${t.primary} disabled:opacity-40`}
        >
          {strip.slipped} planned card{strip.slipped === 1 ? '' : 's'} slipped — replan
        </button>
      )}

      {/* The conversation. */}
      <section className={`rounded-xl border p-4 md:p-6 ${t.card}`}>
        {entries.length === 0 ? (
          <div className="py-6">
            <p className={`text-sm font-ui ${t.body}`}>Ask about your progress, or start with a button above. Every number it gives you comes from your own record.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => mentor.send(s)}
                  disabled={mentor.busy || !modelReady}
                  className={`px-3 py-2 rounded-full border text-xs font-ui transition-colors disabled:opacity-40 ${t.ghost}`}
                >{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5" aria-live="polite">
            {entries.map(renderEntry)}
          </div>
        )}

        {mentor.busy && (
          <div className="mt-5 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#E10600] animate-pulse" aria-hidden="true" />
            <span className={`text-[10px] font-black uppercase tracking-[0.16em] font-ui ${t.muted}`}>{mentor.step ?? 'THINKING'}…</span>
            <button type="button" onClick={mentor.cancel} className={`ml-auto text-[10px] font-bold uppercase tracking-wider underline underline-offset-2 ${t.muted}`}>Stop</button>
          </div>
        )}
        {unanswered && modelReady && (
          <div className="mt-4 flex items-center gap-3">
            <span className={`text-xs font-ui ${t.muted}`}>No reply to that one.</span>
            <button type="button" onClick={mentor.retry} className={`${btn} px-3 py-1.5 ${t.ghost}`}>Retry</button>
          </div>
        )}
        <div ref={endRef} />
      </section>

      {/* Composer: sticky so the send button is never something you scroll to
          find — and lifted clear of the two floating circles, the feedback
          dock bottom-left and the mic bottom-right, or SEND sits under the mic. */}
      <div className={`sticky bottom-20 z-30 rounded-xl border p-2 flex items-end gap-2 shadow-lg ${t.card}`}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={1}
          maxLength={1000}
          disabled={!modelReady}
          placeholder={modelReady ? 'Ask about your prep…' : 'Chat needs the AI, which is not live in this build. The buttons above still work.'}
          className={`flex-1 resize-none bg-transparent px-3 py-2.5 text-sm font-ui outline-none max-h-40 ${dark ? 'text-white placeholder:text-zinc-600' : 'text-[#17150F] placeholder:text-[#B5AFA0]'}`}
          aria-label="Message the Mentor"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || mentor.busy || !modelReady}
          className={`${btn} px-5 py-3 ${draft.trim() && !mentor.busy && modelReady ? t.primary : t.disabled}`}
        >Send</button>
      </div>

      {canInvite && signedIn && <MentorInvites theme={theme} />}

      <div className={`flex flex-wrap items-center justify-between gap-3 text-[11px] font-ui ${t.muted}`}>
        <span>
          {mentor.remaining !== null ? `${mentor.remaining} Mentor calls left today · ` : ''}
          Conversations stay on this device. Hours are estimates; your record is the source of truth.
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('TURN OFF THE MENTOR? Every conversation on this device is deleted. Cards you already applied stay.')) onDisable();
          }}
          className="underline underline-offset-2 hover:opacity-80"
        >Turn off Mentor</button>
      </div>
    </div>
  );
};

const Header: React.FC<{ dark: boolean }> = ({ dark }) => (
  <div>
    <Eyebrow dark={dark}>Mentor · closed beta</Eyebrow>
    <h2 className={`mt-1 text-3xl md:text-4xl font-display uppercase ${dark ? 'text-white' : 'text-[#17150F]'}`}>Your prep, read from your data.</h2>
  </div>
);

const StripStat: React.FC<{ label: string; value: string; sub?: string; dark: boolean; alarm?: boolean; small?: boolean }> = ({ label, value, sub, dark, alarm, small }) => (
  <div>
    <Eyebrow dark={dark}>{label}</Eyebrow>
    <p className={`mt-1 font-display tabular-nums ${small ? 'text-lg' : 'text-2xl'} ${alarm ? 'text-[#E10600]' : dark ? 'text-white' : 'text-[#17150F]'}`}>{value}</p>
    {sub && <p className={`text-[11px] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{sub}</p>}
  </div>
);

export default MentorTab;
