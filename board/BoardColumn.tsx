import React, { useState } from 'react';
import { Subject, Task, TaskColumn } from '../types';
import { COLUMN_LABEL, DONE_VISIBLE } from './board';
import TaskCard from './TaskCard';
import { DropTarget } from './useCardDrag';

interface Props {
  column: TaskColumn;
  tasks: Task[];
  theme: 'dark' | 'light';
  today: string;
  scheduledIds: Set<string>;
  activeSubjects: Subject[];
  draggingId: string | null;
  /** False once the user has opened a card and learned the affordance. */
  showHint: boolean;
  dropTarget: DropTarget | null;
  onOpen: (task: Task) => void;
  onDragStart: (e: React.PointerEvent, id: string, column: TaskColumn) => void;
  onKeyMove: (e: React.KeyboardEvent, task: Task) => void;
  onAdd: (text: string, column: TaskColumn) => void;
  registerColumn: (column: TaskColumn, el: HTMLElement | null) => void;
}

const BoardColumn: React.FC<Props> = ({
  column, tasks, theme, today, scheduledIds, draggingId, dropTarget, showHint,
  onOpen, onDragStart, onKeyMove, onAdd, registerColumn,
}) => {
  const dark = theme === 'dark';
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState('');
  /* Done is capped: see DONE_VISIBLE. The rest are one tap away, and the count
     in the header always tells the truth about how many there are. */
  const [showAllDone, setShowAllDone] = useState(false);

  const isDone = column === 'done';
  const visible = isDone && !showAllDone ? tasks.slice(0, DONE_VISIBLE) : tasks;
  const hidden = tasks.length - visible.length;

  const commit = () => {
    const value = text.trim();
    if (value) onAdd(value, column);
    setText('');
    setComposing(false);
  };

  const active = dropTarget?.column === column;

  return (
    <section
      className="flex flex-col min-w-0 snap-start"
      style={{ flex: '1 1 0', minWidth: 0 }}
      aria-label={COLUMN_LABEL[column]}
    >
      <header className="flex items-center justify-between gap-1 mb-2 md:mb-3 px-0.5 md:px-1">
        {/* `truncate` so a column header can never be the thing that widens a
            column past its share. */}
        <h4 className={`text-[9px] md:text-[10px] font-bold uppercase tracking-[0.06em] font-ui truncate ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
          {COLUMN_LABEL[column]}
        </h4>
        <span className={`text-[9px] md:text-[10px] font-bold font-ui tabular-nums flex-shrink-0 ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>
          {tasks.length}
        </span>
      </header>

      <div
        ref={el => registerColumn(column, el)}
        className={`flex-1 rounded-xl border border-dashed p-1 md:p-2 flex flex-col gap-1.5 md:gap-2 transition-colors min-h-[100px] md:min-h-[120px]`}
        style={{
          borderColor: active
            ? '#E1060055'
            : dark ? 'rgba(255,255,255,0.06)' : '#E3E0D9',
          background: active ? (dark ? 'rgba(225,6,0,0.04)' : 'rgba(225,6,0,0.02)') : 'transparent',
        }}
      >
        {visible.map((task, i) => (
          <React.Fragment key={task.id}>
            {/* Where the card would land. A gap rather than a moving ghost:
                the dragged card is already following the pointer, and two
                things moving at once is harder to read than one. */}
            {active && dropTarget?.index === i && draggingId !== task.id && (
              <div className="h-1 rounded-full" style={{ background: '#E10600' }} aria-hidden="true" />
            )}
            <TaskCard
              task={task}
              theme={theme}
              today={today}
              scheduled={scheduledIds.has(task.id)}
              dragging={draggingId === task.id}
              showHint={showHint}
              onOpen={onOpen}
              onDragStart={onDragStart}
              onKeyMove={onKeyMove}
            />
          </React.Fragment>
        ))}

        {active && (dropTarget?.index ?? 0) >= visible.length && (
          <div className="h-1 rounded-full" style={{ background: '#E10600' }} aria-hidden="true" />
        )}

        {!visible.length && !active && (
          <p className={`text-[9px] md:text-[10px] font-medium uppercase tracking-[0.06em] italic text-center py-4 md:py-6 px-1 font-ui ${dark ? 'text-zinc-700' : 'text-[#B5AFA0]'}`}>
            {/* Shorter on a phone, where the column is about ninety pixels wide
                and "Nothing in progress" would set as four ragged lines. */}
            <span className="md:hidden">{column === 'todo' ? 'Empty' : column === 'doing' ? 'Nothing on' : 'Nothing done'}</span>
            <span className="hidden md:inline">{column === 'todo' ? 'Nothing queued' : column === 'doing' ? 'Nothing in progress' : 'Nothing finished yet'}</span>
          </p>
        )}

        {isDone && hidden > 0 && (
          <button
            onClick={() => setShowAllDone(true)}
            className={`text-[8px] md:text-[9px] font-bold uppercase tracking-[0.06em] py-1.5 md:py-2 font-ui ${dark ? 'text-zinc-600 hover:text-zinc-400' : 'text-[#8A8577] hover:text-[#17150F]'}`}
          >
            + {hidden} earlier
          </button>
        )}

        {/* Done is not a place you type into. */}
        {!isDone && (composing ? (
          <input
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setText(''); setComposing(false); }
            }}
            placeholder="WHAT NEEDS DOING?"
            className={`text-[10px] md:text-[11px] font-bold uppercase tracking-tight p-2 md:p-3 rounded-lg border focus:outline-none focus:ring-1 focus:ring-white/20 font-ui min-w-0 ${dark ? 'bg-[#111114] border-white/[0.06] text-white' : 'bg-white border-[#E3E0D9] text-[#17150F]'}`}
          />
        ) : (
          <button
            onClick={() => setComposing(true)}
            className={`text-[9px] md:text-[10px] font-bold uppercase tracking-[0.06em] py-2 md:py-2.5 rounded-lg border border-dashed transition-colors font-ui ${dark ? 'border-white/[0.06] text-zinc-600 hover:text-zinc-400 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:text-[#17150F] hover:border-[#D6D1C5]'}`}
          >
            + Add
          </button>
        ))}
      </div>
    </section>
  );
};

export default React.memo(BoardColumn);
