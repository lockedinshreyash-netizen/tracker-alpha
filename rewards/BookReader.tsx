import React, { useEffect, useRef, useState } from 'react';
import { BOOK } from '../content/book';

interface Props {
  theme: 'dark' | 'light';
  /** Chapter to open at, remembered across devices. */
  chapter: number;
  onChapterChange: (index: number) => void;
  onClose: () => void;
}

/**
 * The in-app book. Full screen, no chrome, no app UI — reading is the one
 * thing in here that is not supposed to feel like a scoreboard.
 */
const BookReader: React.FC<Props> = ({ theme, chapter, onChapterChange, onClose }) => {
  const dark = theme === 'dark';
  const safeIndex = Math.min(Math.max(0, chapter), Math.max(0, BOOK.chapters.length - 1));
  const [contentsOpen, setContentsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const current = BOOK.chapters[safeIndex];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && safeIndex < BOOK.chapters.length - 1) onChapterChange(safeIndex + 1);
      if (e.key === 'ArrowLeft' && safeIndex > 0) onChapterChange(safeIndex - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [safeIndex, onChapterChange, onClose]);

  // A new chapter starts at its own beginning, not wherever the last one ended.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [safeIndex]);

  if (!current) return null;

  return (
    <div className={`fixed inset-0 z-[80] ${dark ? 'bg-[#0B0B0D]' : 'bg-[#F6F4F0]'}`}>
      {/* Top bar */}
      <div className={`h-14 flex items-center justify-between px-4 md:px-6 border-b ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
        <button
          onClick={() => setContentsOpen(v => !v)}
          className={`text-[9px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded border transition-colors active:scale-97 font-ui ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-zinc-300 text-zinc-500 hover:text-black'}`}
        >
          Contents
        </button>
        <span className={`text-[9px] font-bold uppercase tracking-[0.14em] font-ui ${dark ? 'text-zinc-600' : 'text-[#8A8577]'}`}>
          {BOOK.title}
        </span>
        <button
          onClick={onClose}
          className={`text-[9px] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded border transition-colors active:scale-97 font-ui ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-zinc-300 text-zinc-500 hover:text-black'}`}
        >
          Close
        </button>
      </div>

      {/* Contents drawer */}
      {contentsOpen && (
        <div className={`absolute top-14 left-0 right-0 z-10 border-b max-h-[60vh] overflow-y-auto ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}>
          {BOOK.chapters.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { onChapterChange(i); setContentsOpen(false); }}
              className={`w-full text-left px-6 py-4 border-b last:border-b-0 transition-colors ${dark ? 'border-white/[0.04] hover:bg-white/[0.03]' : 'border-[#EFEBE4] hover:bg-[#F7F5F1]'}`}
            >
              <span className={`block text-[9px] font-bold uppercase tracking-[0.14em] mb-1 font-ui ${i === safeIndex ? 'text-[#E10600]' : 'text-zinc-500'}`}>
                {c.number}
              </span>
              <span className={`text-[13px] font-ui ${dark ? 'text-zinc-300' : 'text-[#17150F]'}`}>{c.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Page */}
      <div ref={scrollRef} className="h-[calc(100%-3.5rem)] overflow-y-auto">
        <article className="max-w-[38rem] mx-auto px-6 py-16 md:py-24">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E10600] mb-4 font-ui">
            {current.number}
          </p>
          <h1
            className={`text-3xl md:text-4xl leading-[1.15] mb-10 font-accent ${dark ? 'text-white' : 'text-[#17150F]'}`}
          >
            {current.title}
          </h1>

          {!BOOK.complete && safeIndex === 0 && (
            <div className={`mb-10 px-4 py-3 rounded-lg border text-[11px] leading-relaxed font-ui ${dark ? 'border-white/[0.08] text-zinc-500' : 'border-[#E3E0D9] text-[#6B675C]'}`}>
              The rest of the book is still being written. It unlocks here
              automatically — you keep this whether or not your streak holds.
            </div>
          )}

          <div className={`space-y-6 ${dark ? 'text-zinc-300' : 'text-[#2A2720]'}`}>
            {current.body.map((para, i) => (
              <p key={i} className="text-[15px] md:text-[16px] leading-[1.75] font-ui">
                {para}
              </p>
            ))}
          </div>

          {/* Pagination */}
          <div className={`mt-16 pt-8 border-t flex items-center justify-between gap-4 ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
            <button
              disabled={safeIndex === 0}
              onClick={() => onChapterChange(safeIndex - 1)}
              className={`text-[9px] font-bold uppercase tracking-[0.14em] px-4 py-2.5 rounded border transition-colors active:scale-97 font-ui disabled:opacity-30 disabled:pointer-events-none ${dark ? 'border-white/[0.12] text-zinc-400 hover:text-white' : 'border-zinc-300 text-zinc-500 hover:text-black'}`}
            >
              Previous
            </button>
            <span className={`text-[9px] font-bold uppercase tracking-[0.14em] tabular-nums font-ui ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>
              {safeIndex + 1} / {BOOK.chapters.length}
            </span>
            <button
              disabled={safeIndex >= BOOK.chapters.length - 1}
              onClick={() => onChapterChange(safeIndex + 1)}
              className="text-[9px] font-bold uppercase tracking-[0.14em] px-4 py-2.5 rounded bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97 font-ui disabled:opacity-30 disabled:pointer-events-none"
            >
              Next
            </button>
          </div>
        </article>
      </div>
    </div>
  );
};

export default BookReader;
