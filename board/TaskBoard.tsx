import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { ScheduleBlock, Subject, Task, TaskColumn } from '../types';
import { getISTDateString } from '../utils';
import { COLUMNS, buildBoard, scheduledTaskIds } from './board';
import BoardColumn from './BoardColumn';
import TaskCard from './TaskCard';
import { useCardDrag } from './useCardDrag';

/* The editor is a modal carrying a colour picker, a date input and the subject
   list. Lazy for the same reason share/ShareModal is: it is opened on demand,
   and the Today tab is the landing tab whose bundle everyone pays for. */
const TaskEditor = React.lazy(() => import('./TaskEditor'));

/* ── The edit hint ──
   "Tap to edit" exists only because nothing about a card said it opened, and
   people were treating the board as drag-only. Once somebody has opened one it
   has done its job, and a permanent instruction on every card is the kind of
   thing that looks like scaffolding nobody took down.

   Device-local, like `onboarding_complete` and the sound preference, and
   deliberately not in `AppState`: it is not data, it would fire a Supabase
   upsert on the way out, and "this person has figured out the board" is a fact
   about a device rather than something worth syncing.

   A browser that cannot read the flag also cannot write it, so both paths
   default to showing the hint — a hint that keeps appearing is a smaller
   failure than an affordance nobody ever discovers. */
const HINT_KEY = 'board_edit_hint_done';

const hintDismissed = (): boolean => {
  try {
    return localStorage.getItem(HINT_KEY) === 'true';
  } catch {
    return false;
  }
};

const markHintSeen = (): void => {
  try {
    localStorage.setItem(HINT_KEY, 'true');
  } catch {
    /* Private browsing. The hint stays; nothing else breaks. */
  }
};

interface Props {
  tasks: Task[];
  /** Today's materialized plan, for the "on the timeline" glyph. */
  todayBlocks: ScheduleBlock[];
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  onAddTask: (text: string, subject: Subject, column?: TaskColumn) => void;
  onUpdateTask: (id: string, patch: Partial<Omit<Task, 'id'>>) => void;
  onDeleteTask: (id: string) => void;
  onMoveTask: (id: string, column: TaskColumn, index: number) => void;
}

/**
 * The board.
 *
 * A container in the shape questions/QuestionsTab.tsx established: one narrow
 * slice in, narrow named callbacks out, all mutation in App.tsx and all
 * arithmetic in board.ts. That shape is also what makes the memoised children
 * below actually memoise — a component handed the whole `state` would re-render
 * regardless of how it was wrapped.
 */
const TaskBoard: React.FC<Props> = ({
  tasks, todayBlocks, theme, activeSubjects,
  onAddTask, onUpdateTask, onDeleteTask, onMoveTask,
}) => {
  const dark = theme === 'dark';
  const [editing, setEditing] = useState<Task | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const today = getISTDateString();
  const board = useMemo(() => buildBoard(tasks), [tasks]);
  const scheduledIds = useMemo(() => scheduledTaskIds(todayBlocks), [todayBlocks]);

  const commitMove = useCallback((id: string, column: TaskColumn, index: number) => {
    onMoveTask(id, column, index);
  }, [onMoveTask]);

  const { drag, begin, consumeClick, registerColumn } = useCardDrag({
    onCommit: commitMove,
    scrollerRef,
  });

  /* Read once on mount. Flipping it re-renders every card exactly once, which
     is the render that drops the hint — unavoidable, and it happens once in the
     lifetime of the install. */
  const [showHint, setShowHint] = useState(() => !hintDismissed());

  /* Every route into the editor goes through here, so the hint cannot survive
     because one of them forgot to retire it — the keyboard path opens the same
     sheet a tap does. */
  const openEditor = useCallback((task: Task) => {
    setEditing(task);
    setShowHint(false);
    markHintSeen();
  }, []);

  const openTask = useCallback((task: Task) => {
    /* A pointerup that ended a real drag is still followed by a click, and that
       click would open the editor on the card just dropped. */
    if (consumeClick()) return;
    openEditor(task);
  }, [consumeClick, openEditor]);

  /* The column is passed through rather than added-then-moved: a two-step
     write would fire two syncs and briefly show the card in the wrong place. */
  const addToColumn = useCallback((text: string, column: TaskColumn) => {
    onAddTask(text, 'General', column);
  }, [onAddTask]);

  /* Keyboard equivalent of the drag. Not optional: a board you can only use
     with a pointer is a board half the people cannot use at all, and
     schedule/DayTimeline.tsx already set this precedent for the grid. */
  const onKeyMove = useCallback((e: React.KeyboardEvent, task: Task) => {
    const column: TaskColumn = task.completed ? 'done' : task.column === 'doing' ? 'doing' : 'todo';
    const ci = COLUMNS.indexOf(column);
    const list = buildBoard(tasks)[column];
    const index = list.findIndex(t => t.id === task.id);

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEditor(task);
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (window.confirm('Discard task?')) onDeleteTask(task.id);
      return;
    }
    if (e.key === 'ArrowLeft' && ci > 0) {
      e.preventDefault();
      onMoveTask(task.id, COLUMNS[ci - 1], 0);
      return;
    }
    if (e.key === 'ArrowRight' && ci < COLUMNS.length - 1) {
      e.preventDefault();
      onMoveTask(task.id, COLUMNS[ci + 1], 0);
      return;
    }
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onMoveTask(task.id, column, index - 1);
      return;
    }
    if (e.key === 'ArrowDown' && index < list.length - 1) {
      e.preventDefault();
      onMoveTask(task.id, column, index + 1);
    }
  }, [tasks, onMoveTask, onDeleteTask, openEditor]);

  const dragged = drag ? tasks.find(t => t.id === drag.id) ?? null : null;

  return (
    /* No `relative z-10` on this wrapper, deliberately. It would open a
       stacking context, and the editor and the drag overlay below are `fixed`
       with high z-indexes that would then be trapped inside it — competing as
       z-10 against the voice control at the app root, which sits at z-40 and
       would draw straight over the Save button. */
    <div className="space-y-4">
      <div className="flex justify-between items-end mb-4 pb-2">
        <h3 className={`text-xs font-bold tracking-tight font-ui ${dark ? 'text-zinc-500' : 'text-[#6B675C]'}`}>Focus Tasks</h3>
      </div>

      {/* All three columns are on screen at every width, phones included.
          They started as scroll-snap panes at ~82vw — Trello's own mobile
          answer — and that was wrong for this board: the whole point of Todo /
          Doing / Done is seeing the three of them at once, and a layout that
          hides two thirds of it behind a swipe turns a status board back into
          the single list it replaced. You cannot tell what you are doing today
          without swiping, which is the one question the board exists to answer.

          The cost is narrow columns, paid for by condensing the cards below
          rather than by hiding two of the three. It also removes the need to
          drag a card to the screen edge and wait for a scroll — every
          destination is already visible, so a drop is one short movement.

          `overflow-x-auto` stays as a safety valve for a very narrow phone or a
          large accessibility font size; with `flex-1` there is normally nothing
          to scroll, and the edge autoscroll in useCardDrag simply never fires. */}
      <div
        ref={scrollerRef}
        className="flex gap-1.5 md:gap-4 overflow-x-auto no-scrollbar items-stretch"
      >
        {COLUMNS.map(column => (
          <div key={column} className="flex-1 min-w-0 flex">
            <BoardColumn
              column={column}
              tasks={board[column]}
              theme={theme}
              today={today}
              scheduledIds={scheduledIds}
              activeSubjects={activeSubjects}
              draggingId={drag?.id ?? null}
              dropTarget={drag?.target ?? null}
              showHint={showHint}
              onOpen={openTask}
              onDragStart={begin}
              onKeyMove={onKeyMove}
              onAdd={addToColumn}
              registerColumn={registerColumn}
            />
          </div>
        ))}
      </div>

      {/* The card under the pointer, drawn once, outside the columns.
          `translate3d` only — never top/left, which would force layout on every
          frame. `will-change` lives here rather than on every card, so exactly
          one compositor layer is promoted, and only while a drag is happening. */}
      {drag && dragged && (
        <div
          className="fixed left-0 top-0 z-[60] pointer-events-none"
          style={{
            width: drag.width,
            transform: `translate3d(${drag.left + drag.dx}px, ${drag.top + drag.dy}px, 0)`,
            willChange: 'transform',
          }}
          aria-hidden="true"
        >
          <div style={{ transform: 'rotate(1.5deg)' }}>
            <TaskCard
              task={dragged}
              theme={theme}
              today={today}
              scheduled={scheduledIds.has(dragged.id)}
              showHint={showHint}
              dragging
              onOpen={() => {}}
              onDragStart={() => {}}
              onKeyMove={() => {}}
            />
          </div>
        </div>
      )}

      {editing && (
        <Suspense fallback={null}>
          <TaskEditor
            task={editing}
            theme={theme}
            activeSubjects={activeSubjects}
            today={today}
            onSave={patch => { onUpdateTask(editing.id, patch); setEditing(null); }}
            onDelete={() => { onDeleteTask(editing.id); setEditing(null); }}
            onClose={() => setEditing(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default React.memo(TaskBoard);
