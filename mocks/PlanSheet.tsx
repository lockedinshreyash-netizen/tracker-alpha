/* ── Plan a mock ──
   What it is, when, and what's in it — in that order, with sensible answers
   already filled in. The header is the mock as it will appear in the list, so
   the student watches the thing they are making take shape. */

import React, { useState } from 'react';
import { ChapterProgress, ExamPreference, MockChapter, MockExam, MockScope, MockTest, Subject } from '../types';
import { addDays } from '../utils';
import { MultiChapterPicker } from './ChapterPicker';
import { EXAMS, SCOPES, SCOPE_ORDER, examColor, examsFor, suggestName } from './model';
import { formatDate, nextSunday, relativeDay } from './insights';
import { ExamBadge, Field, ScopeBadge, ScopeGlyph, Segmented, Sheet, btn, subjectDot, tokens } from './ui';

export interface PlanDraft {
  id?: string;
  name: string;
  date: string;
  exam: MockExam;
  scope: MockScope;
  series: string;
  chapters: MockChapter[];
}

interface Props {
  initial: MockTest | null;
  tests: MockTest[];
  pref: ExamPreference;
  subjects: Subject[];
  progress: ChapterProgress[];
  library: Record<string, string[]>;
  today: string;
  dark: boolean;
  onSave: (draft: PlanDraft) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  onAddTopic: (key: string, name: string) => void;
  onForgetTopic: (key: string, name: string) => void;
}

const PlanSheet: React.FC<Props> = ({ initial, tests, pref, subjects, progress, library, today, dark, onSave, onDelete, onClose, onAddTopic, onForgetTopic }) => {
  const t = tokens(dark);
  const exams = examsFor(pref);
  // The student's habit is the best default: the exam and scope of their last mock.
  const last = tests[tests.length - 1];
  const [d, setD] = useState<PlanDraft>(() => initial
    ? { id: initial.id, name: initial.name, date: initial.date, exam: initial.exam, scope: initial.scope, series: initial.series ?? '', chapters: initial.chapters }
    : {
        name: '',
        date: nextSunday(today),
        exam: last && exams.includes(last.exam) ? last.exam : exams[0],
        scope: last?.scope ?? 'full',
        series: last?.series ?? '',
        chapters: [],
      });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<PlanDraft>) => setD(prev => ({ ...prev, ...patch }));

  const autoName = suggestName(tests, d.exam, d.scope, d.id);
  const name = d.name.trim() || autoName;
  const seriesList = Array.from(new Set(tests.map(x => x.series).filter((x): x is string => !!x))).slice(-8);
  const needsChapters = d.scope !== 'full' && d.chapters.length === 0;
  const topicCount = d.chapters.reduce((a, c) => a + (c.topics?.length ?? 0), 0);

  const dateChips = [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'This Sunday', date: nextSunday(today) },
    { label: 'Next Sunday', date: addDays(nextSunday(today), 7) },
  ].filter((c, i, all) => all.findIndex(o => o.date === c.date) === i);

  const header = (
    <div className="px-5 md:px-7 pt-6 pb-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: examColor(d.exam, dark) }} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-[10px] font-ui font-bold uppercase tracking-[0.08em] ${t.muted}`}>{initial ? 'Edit mock' : 'Plan a mock'}</p>
          <p className={`font-display text-[22px] md:text-[26px] leading-tight mt-1.5 truncate ${t.heading}`}>{name}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <ExamBadge exam={d.exam} dark={dark} size="md" />
            <ScopeBadge scope={d.scope} dark={dark} size="md" />
            <span className={`text-[12px] font-ui font-semibold ${t.body}`}>{relativeDay(d.date, today)}{relativeDay(d.date, today) !== formatDate(d.date, today) ? ` · ${formatDate(d.date, today)}` : ''}</span>
            {d.scope !== 'full' && d.chapters.length > 0 && (
              <span className={`text-[12px] font-ui ${t.muted}`}>· {d.chapters.length} {d.chapters.length === 1 ? 'chapter' : 'chapters'}{topicCount ? `, ${topicCount} topics` : ''}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${t.hover} ${t.muted}`}>✕</button>
      </div>
    </div>
  );

  const footer = (
    <div className="flex items-center gap-3">
      {initial && onDelete && (
        confirmDelete ? (
          <button onClick={() => onDelete(initial.id)} className={`${btn} px-4 py-3 text-[#E10600]`}>Delete for good</button>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className={`${btn} px-3 py-3 ${t.muted} hover:text-[#E10600]`}>Delete</button>
        )
      )}
      <span className={`flex-1 text-[11px] font-ui ${t.muted} hidden sm:block`}>
        {needsChapters ? 'Pick at least one chapter.' : d.scope === 'full' ? SCOPES.full.hint : ''}
      </span>
      <button
        onClick={() => onSave({ ...d, name })}
        disabled={needsChapters || !d.date}
        className={`${btn} px-6 py-3.5 ml-auto ${t.primary}`}
      >
        {initial ? 'Save' : 'Plan it'}
      </button>
    </div>
  );

  return (
    <Sheet dark={dark} onClose={onClose} label={initial ? 'Edit mock' : 'Plan a mock'} header={header} footer={footer}>
      <div className="px-5 md:px-7 py-6 space-y-7">
        <Field label="Paper" dark={dark}>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${exams.length}, minmax(0, 1fr))` }}>
            {exams.map(e => {
              const on = d.exam === e;
              const c = examColor(e, dark);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => set({ exam: e })}
                  aria-pressed={on}
                  className={`text-left px-3.5 py-3 rounded-xl border transition-all active:scale-[0.98] ${on ? '' : dark ? 'border-white/[0.08] hover:border-white/[0.16]' : 'border-zinc-200 hover:border-zinc-300'}`}
                  style={on ? { borderColor: c, background: `${c}14`, boxShadow: `0 0 0 1px ${c}` } : undefined}
                >
                  <span className="block w-2 h-2 rounded-full mb-2" style={{ background: c }} />
                  <span className={`block text-[13px] font-ui font-bold ${t.heading}`}>{EXAMS[e].label}</span>
                  <span className={`block text-[10px] font-ui mt-0.5 ${t.muted}`}>{subjects.reduce((a, s) => a + EXAMS[e].max(s), 0)} marks</span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Syllabus" dark={dark} hint={SCOPES[d.scope].hint}>
          <Segmented
            full
            value={d.scope}
            onChange={scope => set({ scope })}
            dark={dark}
            label="Syllabus"
            options={SCOPE_ORDER.map(s => ({
              value: s,
              label: <><ScopeGlyph scope={s} color={dark ? '#d4d4d8' : '#52525b'} size={9} surface={dark ? '#1c1c21' : '#fff'} />{SCOPES[s].label}</>,
            }))}
          />
        </Field>

        <Field label="When" dark={dark}>
          <div className="flex flex-wrap items-center gap-2">
            {dateChips.map(c => (
              <button
                key={c.label}
                type="button"
                onClick={() => set({ date: c.date })}
                className={`px-3 py-1.5 rounded-full border text-[12px] font-ui font-semibold transition-all ${d.date === c.date ? (dark ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-900') : dark ? 'border-white/[0.08] text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}
              >
                {c.label}
              </button>
            ))}
            <input type="date" value={d.date} onChange={e => e.target.value && set({ date: e.target.value })} className={`${t.input} !w-auto !py-1.5 text-[12px]`} aria-label="Date" />
          </div>
        </Field>

        <div className="grid md:grid-cols-2 gap-5">
          <Field label="Name" dark={dark} hint="Optional">
            <input value={d.name} onChange={e => set({ name: e.target.value })} placeholder={autoName} maxLength={60} className={t.input} />
          </Field>
          <Field label="Test series" dark={dark} hint="Optional">
            <input value={d.series} onChange={e => set({ series: e.target.value })} placeholder="e.g. Allen AITS" maxLength={40} list="mk-series" className={t.input} />
            <datalist id="mk-series">{seriesList.map(s => <option key={s} value={s} />)}</datalist>
          </Field>
        </div>

        {d.scope !== 'full' ? (
          <Field label="What’s in it" dark={dark} hint={d.chapters.length ? `${d.chapters.length} picked` : 'Tap chapters to add them'}>
            <MultiChapterPicker
              subjects={subjects}
              pref={pref}
              value={d.chapters}
              onChange={chapters => set({ chapters })}
              progress={progress}
              library={library}
              onAddTopic={onAddTopic}
              onForgetTopic={onForgetTopic}
              dark={dark}
              compact={d.scope === 'chapter'}
            />
          </Field>
        ) : (
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${t.inset}`}>
            <div className="flex -space-x-1">
              {subjects.map(s => <span key={s} className={`w-3 h-3 rounded-full ring-2 ${dark ? 'ring-[#111114]' : 'ring-white'}`} style={{ background: subjectDot(s) }} />)}
            </div>
            <p className={`text-[12px] font-ui ${t.body}`}>Full syllabus — every chapter of {subjects.join(', ')}. After the mock, you’ll mark the chapters where marks went missing.</p>
          </div>
        )}
      </div>
    </Sheet>
  );
};

export default PlanSheet;
