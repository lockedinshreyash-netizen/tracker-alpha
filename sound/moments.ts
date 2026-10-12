/* Which sound a moment makes, worked out from the state just before it
   changes. Kept out of App.tsx and out of the board so the board stays a pure
   view and App only has to call one line. */

import * as sfx from '../audio';
import type { Task, TaskColumn } from '../types';
import { getISTDateString } from '../utils';
import { comboSemitones } from './cues';

/**
 * A card arriving in Done. The pling climbs a step with every task finished
 * today, so a run of them is a little tune. The last open card is a
 * flourish instead. Moving a card that was already done, or out of Done,
 * makes no sound.
 */
export const soundForTaskMove = (tasks: Task[], id: string, to: TaskColumn, today: string = getISTDateString()) => {
  if (to !== 'done') return;
  const task = tasks.find(t => t.id === id);
  if (!task || task.completed) return;
  const stillOpen = tasks.some(t => t.id !== id && !t.completed);
  if (!stillOpen) {
    sfx.play('board-clear');
    return;
  }
  const doneToday = tasks.filter(t => t.completed && t.completedAt === today).length;
  sfx.play('task-done', { semitones: comboSemitones(doneToday) });
};
