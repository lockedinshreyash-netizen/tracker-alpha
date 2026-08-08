import React, { useEffect } from 'react';
import { Subject } from '../types';
import { ChapterWeight, RevisionNote, TIER_LABELS, TIER_STYLES, canShowPercent } from '../content';

interface Props {
  chapter: string;
  classId: 11 | 12;
  subject: Subject;
  weight?: ChapterWeight;
  note?: RevisionNote;
  theme: 'dark' | 'light';
  onClose: () => void;
}

/**
 * The night-before one-pager. Deliberately dense and print-friendly — this is
 * the screen a student stares at with 20 minutes left, so nothing decorative
 * competes with the content.
 *
 * When no note has been authored for a chapter it says so plainly instead of
 * padding the page. An invented formula on a revision sheet is worse than a
 * blank one.
 */
const RevisionSheet: React.FC<Props> = ({ chapter, classId, subject, weight, note, theme, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // The grid behind this is long; freeze it so closing returns you in place.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const dark = theme === 'dark';
  const panel = dark ? 'bg-[#0B0B0D] border-white/[0.08]' : 'bg-white border-zinc-200';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const body = dark ? 'text-zinc-300' : 'text-zinc-700';
  const rule = dark ? 'border-white/[0.06]' : 'border-zinc-200';

  const Section: React.FC<{ label: string; accent: string; items: string[] }> = ({ label, accent, items }) => (
    <div className="mb-7 break-inside-avoid">
      <h4 className={`text-[10px] font-bold uppercase tracking-[0.14em] mb-3 ${accent}`}>{label}</h4>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className={`text-[12px] leading-relaxed font-ui flex gap-2.5 ${body}`}>
            <span className={`${muted} shrink-0 tabular-nums`}>{String(i + 1).padStart(2, '0')}</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-3xl my-4 border rounded-xl ${panel} print:border-0 print:my-0 print:max-w-none animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className={`flex items-start justify-between gap-4 p-6 md:p-8 border-b ${rule}`}>
          <div className="min-w-0">
            <p className={`text-[9px] font-bold uppercase tracking-[0.16em] mb-2 ${muted}`}>
              Revision Sheet · Class {classId} · {subject}
            </p>
            <h2 className={`text-xl md:text-2xl font-black uppercase leading-none tracking-tight ${dark ? 'text-white' : 'text-black'}`}>
              {chapter}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {weight && (
                <span className={`text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded border ${TIER_STYLES[weight.tier].chip}`}>
                  {TIER_LABELS[weight.tier]}
                  {canShowPercent(weight) && ` · ${weight.percent}%`}
                </span>
              )}
              {weight?.foundational && (
                <span className="text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded border border-blue-500/50 text-blue-400">
                  Core — everything rests on this
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0 print:hidden">
            <button
              onClick={() => window.print()}
              className={`px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded border transition-colors active:scale-97 ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white hover:border-white/25' : 'border-zinc-300 text-zinc-600 hover:border-zinc-400'}`}
            >
              Print
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.08em] rounded border border-[#E10600]/60 text-[#E10600] hover:bg-[#E10600]/10 transition-colors active:scale-97"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8">
          {note ? (
            <div className="md:columns-2 md:gap-10">
              <Section label="Must Know Cold" accent="text-[#E10600]" items={note.mustKnow} />
              <Section label="Where Marks Get Lost" accent="text-orange-400" items={note.traps} />
              <Section label="How They Ask It" accent={dark ? 'text-zinc-300' : 'text-zinc-700'} items={note.archetypes} />
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className={`text-sm font-bold uppercase tracking-[0.08em] mb-2 ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                No sheet written for this chapter yet
              </p>
              <p className={`text-[12px] leading-relaxed max-w-md mx-auto font-ui ${muted}`}>
                Eight chapters are covered so far. The rest are being written — you are
                seeing this instead of a page of invented formulas, which is the point.
              </p>
            </div>
          )}

          {weight?.note && (
            <div className={`mt-2 pt-5 border-t ${rule}`}>
              <p className={`text-[10px] leading-relaxed font-ui ${muted}`}>
                <span className="font-bold uppercase tracking-[0.08em]">On weightage — </span>
                {weight.note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RevisionSheet;
