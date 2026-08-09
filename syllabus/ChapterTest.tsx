import React, { useEffect, useMemo, useState } from 'react';
import { Subject, TopicMastery, TopicResult } from '../types';
import { testForChapter } from '../content/questions';

interface Props {
  chapter: string;
  classId: 11 | 12;
  subject: Subject;
  theme: 'dark' | 'light';
  onClose: () => void;
  onFinish: (results: Record<string, TopicMastery>, allSolid: boolean) => void;
}

/**
 * Chapter mastery test: one question per topic, so a wrong answer names the
 * exact topic to revisit rather than yielding a score nobody can act on.
 *
 * Confidence is captured per answer because the rule is "confidently get all of
 * these right". A right-but-guessed answer scores `shaky` and still blocks
 * completion — otherwise the test certifies luck.
 */
const ChapterTest: React.FC<Props> = ({ chapter, classId, subject, theme, onClose, onFinish }) => {
  const items = useMemo(() => testForChapter(classId, subject, chapter), [classId, subject, chapter]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Record<string, TopicMastery>>({});
  /* The verdict for the question on screen is held directly rather than read
     back out of `results`. Deriving it from the map meant the reveal block
     depended on `revealed` and `results` landing in the same render — and when
     they did not, it threw and took the whole app down with it. */
  const [verdict, setVerdict] = useState<TopicResult | null>(null);
  const [done, setDone] = useState(false);
  const revealed = verdict !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const dark = theme === 'dark';
  const panel = dark ? 'bg-[#0B0B0D] border-white/[0.08]' : 'bg-white border-zinc-200';
  const rule = dark ? 'border-white/[0.06]' : 'border-zinc-200';
  const muted = 'text-zinc-500';

  if (!items.length) return null;
  const current = items[index];

  const submit = (sure: boolean) => {
    if (picked === null) return;
    const correct = picked === current.question.answer;
    const result: TopicResult = !correct ? 'gap' : sure ? 'solid' : 'shaky';
    setResults((r) => ({ ...r, [current.topic.id]: { result, date: new Date().toISOString().slice(0, 10) } }));
    setVerdict(result);
  };

  const next = () => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setPicked(null);
      setVerdict(null);
    } else {
      setDone(true);
    }
  };

  const allSolid = items.every((it) => results[it.topic.id]?.result === 'solid');

  const VERDICT: Record<TopicResult, { label: string; cls: string }> = {
    solid: { label: 'Solid', cls: 'text-green-500 border-green-600/50' },
    shaky: { label: 'Shaky — you guessed', cls: 'text-yellow-500 border-yellow-600/50' },
    gap: { label: 'Gap — revisit this', cls: 'text-[#E10600] border-[#E10600]/50' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 md:p-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`w-full max-w-2xl my-4 border rounded-xl ${panel} animate-in fade-in zoom-in-95 duration-200`}>
        <div className={`flex items-start justify-between gap-4 p-6 border-b ${rule}`}>
          <div className="min-w-0">
            <p className={`text-[9px] font-bold uppercase tracking-[0.16em] mb-2 ${muted}`}>
              Mastery test · Class {classId} · {subject}
            </p>
            <h2 className={`text-lg md:text-xl font-black uppercase leading-none tracking-tight ${dark ? 'text-white' : 'text-black'}`}>
              {chapter}
            </h2>
          </div>
          <button onClick={onClose} className={`shrink-0 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded border transition-colors ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500'}`}>
            Close
          </button>
        </div>

        {!done ? (
          <div className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`flex-1 h-1 rounded-full overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                <div className="h-full bg-[#E10600] transition-all duration-300" style={{ width: `${((index + (revealed ? 1 : 0)) / items.length) * 100}%` }} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-500 tabular-nums shrink-0">
                {index + 1} / {items.length}
              </span>
            </div>

            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-600 mb-2 font-ui">{current.topic.name}</p>
            <p className={`text-[14px] leading-relaxed font-ui mb-5 ${dark ? 'text-zinc-100' : 'text-black'}`}>
              {current.question.question}
            </p>

            <div className="space-y-2 mb-5">
              {current.question.options.map((opt, i) => {
                const isAnswer = i === current.question.answer;
                const isPicked = i === picked;
                let cls = dark ? 'border-white/[0.08] hover:border-white/25 text-zinc-300' : 'border-zinc-200 hover:border-zinc-400 text-zinc-700';
                if (revealed && isAnswer) cls = 'border-green-600/60 bg-green-600/10 text-green-400';
                else if (revealed && isPicked) cls = 'border-[#E10600]/60 bg-[#E10600]/10 text-[#E10600]';
                else if (isPicked) cls = dark ? 'border-white/40 bg-white/[0.04] text-white' : 'border-zinc-500 bg-zinc-50 text-black';
                return (
                  <button
                    key={i}
                    disabled={revealed}
                    onClick={() => setPicked(i)}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-[12px] font-ui transition-all ${cls} ${revealed ? 'cursor-default' : 'active:scale-[0.99]'}`}
                  >
                    <span className="text-zinc-600 mr-2.5 tabular-nums">{String.fromCharCode(65 + i)}</span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {!revealed ? (
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={picked === null}
                  onClick={() => submit(true)}
                  className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#c40500] transition-colors active:scale-97"
                >
                  Lock it in
                </button>
                <button
                  disabled={picked === null}
                  onClick={() => submit(false)}
                  className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-97 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-zinc-200' : 'border-zinc-300 text-zinc-500'}`}
                >
                  I’m guessing
                </button>
              </div>
            ) : (
              <div>
                <div className={`p-4 rounded-lg border mb-4 ${rule} ${dark ? 'bg-white/[0.02]' : 'bg-zinc-50'}`}>
                  <p className={`text-[9px] font-bold uppercase tracking-[0.1em] mb-1.5 ${VERDICT[verdict!].cls.split(' ')[0]}`}>
                    {VERDICT[verdict!].label}
                  </p>
                  <p className={`text-[12px] leading-relaxed font-ui ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {current.question.explain}
                  </p>
                </div>
                <button onClick={next} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97">
                  {index + 1 < items.length ? 'Next' : 'See result'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <h3 className={`text-base font-black uppercase tracking-tight mb-1 ${allSolid ? 'text-green-500' : 'text-[#E10600]'}`}>
              {allSolid ? 'Chapter cleared' : 'Not done yet'}
            </h3>
            <p className={`text-[12px] leading-relaxed font-ui mb-5 ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {allSolid
                ? 'Every topic solid, and you meant all of them. That is what finished looks like.'
                : 'Anything below that is not solid is unfinished — a guess that landed counts against you. Go back to those topics, then run this again.'}
            </p>

            <div className="space-y-1.5 mb-6">
              {items.map((it) => {
                const r = results[it.topic.id]?.result || 'gap';
                return (
                  <div key={it.topic.id} className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${rule}`}>
                    <span className={`text-[11px] font-ui truncate ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{it.topic.name}</span>
                    <span className={`text-[8px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded border shrink-0 ${VERDICT[r].cls}`}>
                      {VERDICT[r].label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { onFinish(results, allSolid); onClose(); }}
                className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97"
              >
                {allSolid ? 'Mark chapter complete' : 'Save result'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChapterTest;
