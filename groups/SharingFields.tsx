/* ── What a group sees of you ──
   The two per-group switches — hours, and your Focus Tasks at one of three
   levels — as one control, used in every place the question is asked:
   creating a group, joining one (invite or Explore), and the Tasks section
   afterwards.

   The copy is the whole feature here. An earlier version said "Today's
   tasks: Private / Count / Full list" and users could not tell what a task
   was, whose list it meant, or what "full" included. So every string names
   the thing by what the student already calls it (Focus Tasks, on Today),
   says who sees it (other members of this group), and gives a concrete
   example of what they see. Keep that when editing: no abstract nouns. */

import React from 'react';
import { TaskShareLevel } from './api';
import { Segmented, Switch, tokens } from './ui';

/** Short labels — the three buttons, and the badge on a member's row. */
export const TASK_LEVEL_LABEL: Record<TaskShareLevel, string> = {
  private: 'Hidden',
  summary: 'Just a count',
  tasks: 'Every task',
};

/** What members of the group actually see, with an example. */
export const TASK_LEVEL_COPY: Record<TaskShareLevel, string> = {
  private: 'Members see nothing about your tasks.',
  summary: 'Members see a number like “3 of 5 done today”. Not what the tasks are.',
  tasks: 'Members see each task by name and whether it’s done: everything still open, plus what you finished today.',
};

/** The one-line answer under the group's name. */
export const sharingSummary = (shareHours: boolean, shareTasks: TaskShareLevel): string => {
  const parts: string[] = [];
  if (shareHours) parts.push('your study hours');
  if (shareTasks === 'summary') parts.push('how many tasks you’ve done');
  if (shareTasks === 'tasks') parts.push('every task on your list');
  return parts.length ? `Members can see ${parts.join(' and ')}` : 'Members can see only your name';
};

interface Props {
  shareHours: boolean;
  shareTasks: TaskShareLevel;
  onChange: (shareHours: boolean, shareTasks: TaskShareLevel) => void;
  dark: boolean;
  disabled?: boolean;
}

const SharingFields: React.FC<Props> = ({ shareHours, shareTasks, onChange, dark, disabled }) => {
  const t = tokens(dark);
  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[13px] font-bold font-ui ${t.heading}`}>Show my study hours</p>
          <p className={`text-[11px] font-ui mt-1 leading-relaxed ${t.muted}`}>
            {shareHours
              ? 'On. Your hours for today, this week and this month appear on the group leaderboard. Not your subjects.'
              : 'Off. You’re listed on the leaderboard with your hours hidden.'}
          </p>
        </div>
        <Switch
          on={shareHours}
          onToggle={v => onChange(v, shareTasks)}
          label="Show my study hours to this group"
          dark={dark}
          disabled={disabled}
        />
      </div>

      <div className={`mt-5 pt-5 border-t ${t.rule}`}>
        <p className={`text-[13px] font-bold font-ui ${t.heading}`}>Show my tasks</p>
        <p className={`text-[11px] font-ui mt-1 leading-relaxed ${t.muted}`}>
          The to-dos in Focus Tasks on your Today tab.
        </p>
        <div className="mt-3">
          <Segmented<TaskShareLevel>
            value={shareTasks}
            onChange={v => onChange(shareHours, v)}
            options={(['private', 'summary', 'tasks'] as TaskShareLevel[]).map(v => ({ value: v, label: TASK_LEVEL_LABEL[v] }))}
            dark={dark}
            label="Show my tasks to this group"
            disabled={disabled}
          />
        </div>
        <p className={`text-[11px] font-ui mt-2 leading-relaxed ${t.body}`}>{TASK_LEVEL_COPY[shareTasks]}</p>
      </div>
    </div>
  );
};

export default SharingFields;
