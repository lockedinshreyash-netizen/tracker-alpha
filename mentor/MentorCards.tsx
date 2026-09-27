/* ── What the Mentor draws in a conversation ──
   Every card here renders from deterministic data. The model's words appear
   only in `MessageText` (its replies) and a proposal's `summary` — both as
   plain text through React, never as HTML, never with links. */

import React from 'react';
import { tokens, btn, Eyebrow } from '../groups/ui';
import { Proposal, fmtMins } from './proposals';
import { Pace, PaceVerdict, VERDICT_LABEL } from './pace';
import { WeekReview } from './review';
import { formatDay } from './dates';

/* ── Model text ──
   Plain text with short "- " lists. Markdown that slipped through the prompt
   is stripped rather than rendered: no headings, no bold, no links. */
export const MessageText: React.FC<{ text: string; dark: boolean }> = ({ text, dark }) => {
  const clean = text.replace(/\*\*|__|^#+\s*/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const blocks = clean.split(/\n{2,}/);
  return (
    <div className={`space-y-3 text-sm leading-relaxed font-ui ${dark ? 'text-zinc-200' : 'text-[#17150F]'}`}>
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter(l => l.trim());
        const bullets = lines.every(l => /^\s*[-•*]\s+/.test(l));
        return bullets ? (
          <ul key={i} className="space-y-1.5">
            {lines.map((l, j) => (
              <li key={j} className="flex gap-2">
                <span className={dark ? 'text-zinc-600' : 'text-zinc-400'} aria-hidden="true">—</span>
                <span>{l.replace(/^\s*[-•*]\s+/, '')}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="whitespace-pre-wrap">{lines.join('\n')}</p>
        );
      })}
    </div>
  );
};

/* ── Review card ── */

interface ProposalProps {
  proposal: Proposal;
  dark: boolean;
  onToggle: (lineId: string) => void;
  onMins: (lineId: string, mins: number) => void;
  onApply: () => void;
  onUndo: () => void;
  onDismiss: () => void;
}

export const ProposalCard: React.FC<ProposalProps> = ({ proposal: p, dark, onToggle, onMins, onApply, onUndo, onDismiss }) => {
  const t = tokens(dark);
  const pending = p.status === 'pending';
  const checked = p.lines.filter(l => l.checked);
  const totalMins = checked.reduce((a, l) => a + (l.mins ?? 0), 0);

  return (
    <section className={`rounded-xl border p-5 md:p-6 ${t.card} ${p.status === 'dismissed' ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow dark={dark}>{p.source === 'model' ? 'Proposed by the Mentor' : 'Built by the planner'} · review before adding</Eyebrow>
          <h4 className={`mt-1 text-base font-black uppercase tracking-wide font-ui ${t.heading}`}>{p.title}</h4>
        </div>
        {p.status === 'applied' && (
          <span className="shrink-0 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-green-600/15 text-green-500">Applied</span>
        )}
        {p.status === 'dismissed' && (
          <span className={`shrink-0 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${t.muted}`}>Dismissed</span>
        )}
      </div>

      {p.summary && <p className={`mt-3 text-sm font-ui leading-relaxed ${t.body}`}>{p.summary}</p>}

      <ul className={`mt-4 divide-y border-y ${t.rule} ${dark ? 'divide-white/[0.06]' : 'divide-[#E3E0D9]'}`}>
        {p.lines.map(l => (
          <li key={l.id} className="py-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={l.checked}
              disabled={!pending}
              onChange={() => onToggle(l.id)}
              className="mt-1 w-4 h-4 accent-[#E10600] shrink-0"
              aria-label={`Include: ${l.label}`}
            />
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-ui ${l.checked ? t.heading : t.muted} ${l.destructive && l.checked ? 'text-[#E10600]' : ''}`}>{l.label}</p>
              {l.meta && <p className={`text-[11px] font-ui mt-0.5 ${t.muted}`}>{l.meta}</p>}
            </div>
            {l.mins !== undefined && (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  type="button" disabled={!pending || !l.checked}
                  onClick={() => onMins(l.id, l.mins! - 15)}
                  className={`w-7 h-7 rounded-md text-sm font-bold disabled:opacity-30 ${t.ghost}`}
                  aria-label="15 minutes less"
                >−</button>
                <span className={`w-14 text-center text-xs font-bold tabular-nums font-ui ${t.heading}`}>{fmtMins(l.mins)}</span>
                <button
                  type="button" disabled={!pending || !l.checked}
                  onClick={() => onMins(l.id, l.mins! + 15)}
                  className={`w-7 h-7 rounded-md text-sm font-bold disabled:opacity-30 ${t.ghost}`}
                  aria-label="15 minutes more"
                >+</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {p.roadmap && (
        <div className={`mt-4 rounded-lg border p-4 ${t.inset}`}>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Stat label="Weeks" value={String(p.roadmap.weeks)} dark={dark} />
            <Stat label="Chapter hours" value={`~${p.roadmap.totalHours}h`} dark={dark} />
            <Stat label="Paced at" value={`${p.roadmap.hoursPerDay}h/day`} dark={dark} />
            {p.roadmap.overflowHours > 0 && <Stat label="Won't fit" value={`${p.roadmap.overflowHours}h`} dark={dark} alarm />}
          </div>
          <div className="mt-4 space-y-3">
            {p.roadmap.firstWeeks.map(w => (
              <div key={w.start}>
                <Eyebrow dark={dark}>Week of {formatDay(w.start)}</Eyebrow>
                <p className={`mt-1 text-xs font-ui leading-relaxed ${t.body}`}>{w.items.join(' · ') || 'Nothing scheduled'}</p>
              </div>
            ))}
          </div>
          {p.roadmap.unscheduled.length > 0 && (
            <p className={`mt-3 text-[11px] font-ui ${t.muted}`}>Not reached by the target: {p.roadmap.unscheduled.join(', ')}{p.roadmap.unscheduled.length >= 8 ? '…' : ''}</p>
          )}
        </div>
      )}

      {p.notes.length > 0 && (
        <ul className="mt-3 space-y-1">
          {p.notes.map((n, i) => <li key={i} className={`text-[11px] font-ui leading-relaxed ${t.muted}`}>{n}</li>)}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className={`text-[11px] font-bold uppercase tracking-wider font-ui ${t.muted}`}>
          {pending
            ? `${checked.length} of ${p.lines.length} selected${totalMins ? ` · ${fmtMins(totalMins)}` : ''}`
            : p.status === 'applied' ? `${p.appliedCount ?? 0} change${p.appliedCount === 1 ? '' : 's'} made` : 'Nothing changed'}
        </span>
        <div className="flex gap-2">
          {pending && (
            <>
              <button type="button" onClick={onDismiss} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Dismiss</button>
              <button
                type="button"
                onClick={onApply}
                disabled={!checked.length}
                className={`${btn} px-5 py-2.5 ${checked.length ? t.primary : t.disabled}`}
              >{p.commitLabel}</button>
            </>
          )}
          {p.status === 'applied' && p.inverse && (
            <button type="button" onClick={onUndo} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Undo</button>
          )}
        </div>
      </div>
    </section>
  );
};

const Stat: React.FC<{ label: string; value: string; dark: boolean; alarm?: boolean }> = ({ label, value, dark, alarm }) => (
  <div>
    <Eyebrow dark={dark}>{label}</Eyebrow>
    <p className={`mt-0.5 text-lg font-display tabular-nums ${alarm ? 'text-[#E10600]' : dark ? 'text-white' : 'text-[#17150F]'}`}>{value}</p>
  </div>
);

/* ── Pace ── */

const VERDICT_TONE: Record<PaceVerdict, string> = {
  ahead: 'bg-green-600/15 text-green-500',
  on_track: 'bg-green-600/15 text-green-500',
  behind: 'bg-amber-500/15 text-amber-500',
  off_track: 'bg-[#E10600]/15 text-[#E10600]',
  no_history: 'bg-zinc-500/15 text-zinc-400',
  past: 'bg-zinc-500/15 text-zinc-400',
};

const Section: React.FC<{ label: string; items: string[]; dark: boolean }> = ({ label, items, dark }) => (
  <div>
    <p className={`text-[9px] font-black uppercase tracking-[0.14em] font-ui ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>{label}</p>
    <ul className="mt-1.5 space-y-1">
      {items.map((s, i) => <li key={i} className={`text-xs font-ui leading-relaxed ${dark ? 'text-zinc-300' : 'text-[#3A372F]'}`}>{s}</li>)}
    </ul>
  </div>
);

export const PaceCard: React.FC<{ pace: Pace; dark: boolean }> = ({ pace: p, dark }) => {
  const t = tokens(dark);
  const req = Number.isFinite(p.required.mid) ? `${p.required.low}–${p.required.high}h` : '—';
  return (
    <section className={`rounded-xl border p-5 md:p-6 ${t.card}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <Eyebrow dark={dark}>Pace check · {p.target.kind === 'exam' ? 'to the exam' : 'to your deadline'} · {formatDay(p.target.date)}</Eyebrow>
        </div>
        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${VERDICT_TONE[p.verdict]}`}>{VERDICT_LABEL[p.verdict]}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Syllabus done" value={`${p.percentDone}%`} dark={dark} />
        <Stat label="Hours left (est.)" value={`${p.remaining.low}–${p.remaining.high}`} dark={dark} />
        <Stat label="Needed / study day" value={req} dark={dark} />
        <Stat label="You're doing" value={`${p.recentPerDay}h`} dark={dark} alarm={p.verdict === 'off_track'} />
      </div>
      <div className="mt-5 grid md:grid-cols-3 gap-5">
        <Section label="Facts" items={p.facts} dark={dark} />
        <Section label="Estimates" items={p.estimates} dark={dark} />
        <Section label="Assumptions" items={p.assumptions} dark={dark} />
      </div>
      {p.options && (p.options.finishAtCurrentPace || p.options.dropCandidates.length > 0) && (
        <div className={`mt-5 rounded-lg border p-4 ${t.inset}`}>
          <Eyebrow dark={dark}>Ways to close the gap</Eyebrow>
          <ul className={`mt-2 space-y-1 text-xs font-ui ${t.body}`}>
            {Number.isFinite(p.options.hoursPerDayNeeded) && <li>Study about {p.options.hoursPerDayNeeded}h per study day{p.options.hoursPerDayNeeded > 10 ? ' — more than is sustainable; pick another option too' : ''}.</li>}
            {p.options.finishAtCurrentPace && <li>Keep your pace and finish around {formatDay(p.options.finishAtCurrentPace)}.</li>}
            {p.options.dropCandidates.length > 0 && (
              <li>Deprioritise low-yield chapters you haven't started: {p.options.dropCandidates.map(d => `${d.chapter} (~${d.hours}h)`).join(', ')}.</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
};

/* ── Week ── */

export const WeekCard: React.FC<{ review: WeekReview; dark: boolean }> = ({ review: r, dark }) => {
  const t = tokens(dark);
  const delta = r.hours - r.prevHours;
  const max = Math.max(1, ...r.bySubject.map(b => Math.max(b.hours, b.prev)));
  return (
    <section className={`rounded-xl border p-5 md:p-6 ${t.card}`}>
      <Eyebrow dark={dark}>Your week · {formatDay(r.from)} – {formatDay(r.to)}</Eyebrow>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Hours" value={`${r.hours}h`} dark={dark} />
        <Stat label="Vs week before" value={`${delta >= 0 ? '+' : ''}${Math.round(delta * 10) / 10}h`} dark={dark} />
        <Stat label="Study days" value={`${r.studyDays}/7`} dark={dark} />
        <Stat label="Mentor cards done" value={r.planned ? `${r.plannedDone}/${r.planned}` : '—'} dark={dark} />
      </div>
      <div className="mt-5 space-y-2.5">
        {r.bySubject.map(b => (
          <div key={b.subject} className="flex items-center gap-3">
            <span className={`w-20 text-[11px] font-bold uppercase tracking-wide font-ui ${t.muted}`}>{b.subject}</span>
            <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-[#EDEAE3]'}`}>
              <div className={dark ? 'h-full bg-zinc-300' : 'h-full bg-[#17150F]'} style={{ width: `${(b.hours / max) * 100}%` }} />
            </div>
            <span className={`w-20 text-right text-xs tabular-nums font-ui ${t.body}`}>{b.hours}h <span className={t.muted}>/ {b.prev}h</span></span>
          </div>
        ))}
      </div>
      {r.untouched.length > 0 && (
        <p className={`mt-4 text-xs font-ui ${t.muted}`}>Untouched this week: {r.untouched.join(', ')}.</p>
      )}
    </section>
  );
};
