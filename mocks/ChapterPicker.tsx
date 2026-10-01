/* ── Chapters and topics ──
   Two pickers over one vocabulary. The planner takes many chapters, each with
   the topics the paper will test; the error form takes exactly one chapter
   and at most one topic. Both offer the same topic suggestions: the authored
   list for that chapter (content/topics.ts) followed by everything the
   student has typed before, so "Moment of inertia" is offered back the next
   time Rotational Motion is picked. */

import React, { useMemo, useState } from 'react';
import { getChaptersFor } from '../constants';
import { getWeight } from '../content';
import { topicsForChapter } from '../content/topics';
import { ChapterProgress, ExamPreference, MockChapter, Subject } from '../types';
import { chapterKey, cleanTopic } from './model';
import { Chip, subjectDot, tokens } from './ui';

const DONE = new Set(['completed', 'revision_pending']);

export const topicSuggestions = (c: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>, library: Record<string, string[]>): { name: string; custom: boolean }[] => {
  const authored = topicsForChapter(c.classId, c.subject, c.chapter).map(t => t.name);
  const custom = library[chapterKey(c)] ?? [];
  const seen = new Set<string>();
  const out: { name: string; custom: boolean }[] = [];
  custom.forEach(n => { if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ name: n, custom: true }); } });
  authored.forEach(n => { if (!seen.has(n.toLowerCase())) { seen.add(n.toLowerCase()); out.push({ name: n, custom: false }); } });
  return out;
};

/* ── Topic chips with an inline "add your own" ── */

export const TopicChips: React.FC<{
  chapter: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>;
  selected: string[];
  onToggle: (name: string) => void;
  library: Record<string, string[]>;
  onAddTopic: (key: string, name: string) => void;
  onForgetTopic: (key: string, name: string) => void;
  dark: boolean;
  single?: boolean;
}> = ({ chapter, selected, onToggle, library, onAddTopic, onForgetTopic, dark, single }) => {
  const t = tokens(dark);
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const all = topicSuggestions(chapter, library);
  // Selected ones are always visible, even past the fold.
  const visible = showAll ? all : all.filter((x, i) => i < 8 || selected.includes(x.name));
  const add = () => {
    const name = cleanTopic(draft);
    if (!name) return;
    onAddTopic(chapterKey(chapter), name);
    if (!selected.some(s => s.toLowerCase() === name.toLowerCase())) onToggle(name);
    setDraft('');
  };
  const color = subjectDot(chapter.subject);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map(s => {
          const on = selected.includes(s.name);
          return (
            <span key={s.name} className="relative group inline-flex">
              <Chip on={on} onClick={() => onToggle(s.name)} dark={dark} color={color} className="!py-1 !px-2.5 !text-[11px] max-w-[260px]">
                <span className="truncate">{s.name}</span>
                {s.custom && !on && <span className={`text-[9px] uppercase tracking-wider ${t.faint}`}>yours</span>}
              </Chip>
              {s.custom && (
                <button
                  type="button"
                  onClick={() => onForgetTopic(chapterKey(chapter), s.name)}
                  aria-label={`Forget topic ${s.name}`}
                  className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] leading-none hidden group-hover:flex items-center justify-center ${dark ? 'bg-zinc-700 text-white' : 'bg-zinc-800 text-white'}`}
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {all.length > visible.length && (
          <button type="button" onClick={() => setShowAll(true)} className={`px-2 text-[11px] font-ui font-semibold ${t.muted} hover:underline`}>
            +{all.length - visible.length} more
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={single ? 'Or type a topic…' : 'Add a topic, e.g. Moment of inertia'}
          maxLength={60}
          className={`flex-1 min-w-0 px-3 py-1.5 rounded-lg border text-[12px] font-ui outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-transparent border-white/[0.08] text-white placeholder:text-zinc-600' : 'bg-transparent border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
        />
        <button type="button" onClick={add} disabled={!cleanTopic(draft)} className={`px-3 py-1.5 rounded-lg text-[11px] font-ui font-bold transition-all active:scale-95 disabled:opacity-30 ${dark ? 'bg-white/[0.06] text-white' : 'bg-zinc-100 text-zinc-800'}`}>
          Add
        </button>
      </div>
    </div>
  );
};

/* ── Many chapters (the planner) ── */

interface MultiProps {
  subjects: Subject[];
  pref: ExamPreference;
  value: MockChapter[];
  onChange: (next: MockChapter[]) => void;
  progress: ChapterProgress[];
  library: Record<string, string[]>;
  onAddTopic: (key: string, name: string) => void;
  onForgetTopic: (key: string, name: string) => void;
  dark: boolean;
  /** Chapter-test scope: hint that one or two is the norm. */
  compact?: boolean;
}

export const MultiChapterPicker: React.FC<MultiProps> = ({ subjects, pref, value, onChange, progress, library, onAddTopic, onForgetTopic, dark, compact }) => {
  const t = tokens(dark);
  const [subject, setSubject] = useState<Subject>(() => value[0]?.subject ?? subjects[0]);
  const [query, setQuery] = useState('');
  const status = useMemo(() => new Map(progress.map(p => [chapterKey(p), p.status])), [progress]);
  const selectedKeys = new Set(value.map(chapterKey));

  const chaptersOf = (s: Subject) => ([11, 12] as const).flatMap(classId => getChaptersFor(pref, classId, s).map(chapter => ({ classId, subject: s, chapter })));
  const list = chaptersOf(subject);
  const q = query.trim().toLowerCase();
  // A search looks across every subject — typing "capac" should find Capacitance from the Maths tab.
  const shown = q ? subjects.flatMap(chaptersOf).filter(c => c.chapter.toLowerCase().includes(q)) : list;

  const toggle = (c: { classId: 11 | 12; subject: Subject; chapter: string }) => {
    const key = chapterKey(c);
    onChange(selectedKeys.has(key) ? value.filter(v => chapterKey(v) !== key) : [...value, { ...c }]);
  };
  const setTopics = (key: string, topics: string[]) =>
    onChange(value.map(v => (chapterKey(v) === key ? { ...v, topics: topics.length ? topics : undefined } : v)));
  const addMany = (cs: { classId: 11 | 12; subject: Subject; chapter: string }[]) => {
    const add = cs.filter(c => !selectedKeys.has(chapterKey(c)));
    if (add.length) onChange([...value, ...add]);
  };

  const quick: { label: string; run: () => void; n: number }[] = [
    { label: `All Class 11`, run: () => addMany(list.filter(c => c.classId === 11)), n: list.filter(c => c.classId === 11).length },
    { label: `All Class 12`, run: () => addMany(list.filter(c => c.classId === 12)), n: list.filter(c => c.classId === 12).length },
    { label: `Done in Syllabus`, run: () => addMany(list.filter(c => DONE.has(status.get(chapterKey(c)) ?? ''))), n: list.filter(c => DONE.has(status.get(chapterKey(c)) ?? '')).length },
  ];

  const countFor = (s: Subject) => value.filter(v => v.subject === s).length;

  return (
    <div>
      <div className="flex items-center gap-1.5 overflow-x-auto mk-scroll-x -mx-1 px-1 pb-1">
        {subjects.map(s => (
          <Chip key={s} on={subject === s && !q} onClick={() => { setSubject(s); setQuery(''); }} dark={dark} color={subjectDot(s)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(s) }} />
            {s}
            {countFor(s) > 0 && <span className={`ml-0.5 text-[10px] font-black tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>{countFor(s)}</span>}
          </Chip>
        ))}
      </div>

      <div className="relative mt-3">
        <svg className={`absolute left-3 top-1/2 -translate-y-1/2 ${t.faint}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search every chapter…" className={`${t.input} !pl-9`} />
      </div>

      {!q && !compact && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {quick.map(qk => (
            <button key={qk.label} type="button" onClick={qk.run} disabled={!qk.n} className={`px-2.5 py-1 rounded-md text-[11px] font-ui font-semibold transition-colors disabled:opacity-30 ${dark ? 'bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}>
              + {qk.label} <span className={t.faint}>{qk.n}</span>
            </button>
          ))}
          {countFor(subject) > 0 && (
            <button type="button" onClick={() => onChange(value.filter(v => v.subject !== subject))} className={`px-2.5 py-1 rounded-md text-[11px] font-ui font-semibold ${t.muted} hover:text-[#E10600]`}>
              Clear {subject}
            </button>
          )}
        </div>
      )}

      <div className={`mt-3 rounded-xl border divide-y overflow-hidden ${dark ? 'border-white/[0.06] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
        {shown.length === 0 && <p className={`p-4 text-[12px] font-ui ${t.muted}`}>No chapter matches “{query}”.</p>}
        {shown.map((c, idx) => {
          const key = chapterKey(c);
          const on = selectedKeys.has(key);
          const st = status.get(key);
          const tier = getWeight(pref, c.classId, c.subject, c.chapter)?.tier;
          const sel = value.find(v => chapterKey(v) === key);
          const showClass = !q && (idx === 0 || shown[idx - 1].classId !== c.classId);
          return (
            <React.Fragment key={key}>
              {showClass && (
                <div className={`px-4 py-1.5 text-[9px] font-ui font-black uppercase tracking-[0.14em] ${dark ? 'bg-white/[0.02] text-zinc-600' : 'bg-zinc-50 text-zinc-400'}`}>Class {c.classId}</div>
              )}
              <div className={on ? (dark ? 'bg-white/[0.025]' : 'bg-zinc-50/70') : ''}>
                <button type="button" onClick={() => toggle(c)} aria-pressed={on} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${t.hover}`}>
                  <span
                    className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${on ? 'border-transparent' : dark ? 'border-zinc-700' : 'border-zinc-300'}`}
                    style={on ? { background: subjectDot(c.subject) } : undefined}
                  >
                    {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-ui font-semibold truncate ${on ? t.heading : t.body}`}>{c.chapter}</span>
                    {q && <span className={`block text-[10px] font-ui ${t.muted}`}>{c.subject} · Class {c.classId}</span>}
                  </span>
                  {(tier === 'critical' || tier === 'high') && (
                    <span className={`text-[9px] font-ui font-black uppercase tracking-[0.08em] ${tier === 'critical' ? 'text-[#E10600]' : dark ? 'text-orange-400' : 'text-orange-600'}`}>{tier === 'critical' ? 'Heavy' : 'High'}</span>
                  )}
                  <span
                    title={st ? st.replace('_', ' ') : 'Not started'}
                    className={`w-2 h-2 rounded-full shrink-0 ${DONE.has(st ?? '') ? 'bg-emerald-500' : st === 'in_progress' || st === 'practice_pending' ? 'bg-amber-500' : dark ? 'bg-zinc-800' : 'bg-zinc-200'}`}
                  />
                </button>
                {on && sel && (
                  <div className="px-4 pb-4 pl-[46px] mk-fade">
                    <TopicChips
                      chapter={c}
                      selected={sel.topics ?? []}
                      onToggle={name => setTopics(key, (sel.topics ?? []).includes(name) ? (sel.topics ?? []).filter(x => x !== name) : [...(sel.topics ?? []), name])}
                      library={library}
                      onAddTopic={onAddTopic}
                      onForgetTopic={(k, name) => { onForgetTopic(k, name); setTopics(key, (sel.topics ?? []).filter(x => x !== name)); }}
                      dark={dark}
                    />
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <p className={`text-[11px] font-ui mt-2 flex items-center gap-3 ${t.faint}`}>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> done in Syllabus</span>
        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> started</span>
      </p>
    </div>
  );
};

/* ── One chapter (the error form) ── */

export const SingleChapterPicker: React.FC<{
  subjects: Subject[];
  pref: ExamPreference;
  value: Pick<MockChapter, 'classId' | 'subject' | 'chapter'> | null;
  onChange: (c: Pick<MockChapter, 'classId' | 'subject' | 'chapter'> | null) => void;
  /** Chapters to offer first — the mock's syllabus, or recent errors. */
  suggested?: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>[];
  dark: boolean;
}> = ({ subjects, pref, value, onChange, suggested = [], dark }) => {
  const t = tokens(dark);
  const [subject, setSubject] = useState<Subject>(value?.subject ?? suggested[0]?.subject ?? subjects[0]);
  const [query, setQuery] = useState('');

  if (value) {
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${t.inset}`}>
        <span className="w-2 h-2 rounded-full" style={{ background: subjectDot(value.subject) }} />
        <div className="min-w-0 flex-1">
          <p className={`text-[13px] font-ui font-bold truncate ${t.heading}`}>{value.chapter}</p>
          <p className={`text-[11px] font-ui ${t.muted}`}>{value.subject} · Class {value.classId}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className={`text-[11px] font-ui font-bold uppercase tracking-[0.1em] ${t.muted} hover:text-[#E10600]`}>Change</button>
      </div>
    );
  }

  const chaptersOf = (s: Subject) => ([11, 12] as const).flatMap(classId => getChaptersFor(pref, classId, s).map(chapter => ({ classId, subject: s, chapter })));
  const q = query.trim().toLowerCase();
  const shown = q ? subjects.flatMap(chaptersOf).filter(c => c.chapter.toLowerCase().includes(q)) : chaptersOf(subject);

  return (
    <div>
      {suggested.length > 0 && !q && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {suggested.slice(0, 6).map(c => (
            <Chip key={chapterKey(c)} on={false} onClick={() => onChange(c)} dark={dark}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: subjectDot(c.subject) }} />
              {c.chapter}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5 overflow-x-auto mk-scroll-x pb-1">
        {subjects.map(s => (
          <Chip key={s} on={subject === s && !q} onClick={() => { setSubject(s); setQuery(''); }} dark={dark} color={subjectDot(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search chapters…" className={`${t.input} mt-2.5`} />
      <div className={`mt-2 max-h-56 overflow-y-auto rounded-xl border divide-y ${dark ? 'border-white/[0.06] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
        {shown.map(c => (
          <button key={chapterKey(c)} type="button" onClick={() => onChange(c)} className={`w-full text-left px-4 py-2.5 flex items-center gap-2 ${t.hover}`}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subjectDot(c.subject) }} />
            <span className={`text-[13px] font-ui truncate flex-1 ${t.body}`}>{c.chapter}</span>
            <span className={`text-[10px] font-ui ${t.faint}`}>{c.classId}</span>
          </button>
        ))}
        {!shown.length && <p className={`p-4 text-[12px] font-ui ${t.muted}`}>No chapter matches “{query}”.</p>}
      </div>
    </div>
  );
};
