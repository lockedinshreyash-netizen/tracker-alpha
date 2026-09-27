/* ── What a group sees of you ──
   The two per-group switches — hours, and today's tasks at one of three
   levels — as one control, used in exactly three places: creating a group,
   joining one, and the Tasks section afterwards. One component so the
   question is worded the same way every time it is asked, and so tasks are
   never again the setting that only exists one screen deeper than hours. */

import React from 'react';
import { TaskShareLevel } from './api';
import { Segmented, Switch, tokens } from './ui';

export const TASK_LEVEL_COPY: Record<TaskShareLevel, string> = {
  private: 'Nothing about your tasks.',
  summary: 'A count, like “8/10 done today”. No task names.',
  tasks: 'Your open tasks and what you finished today, by name.',
};

/** "hours · task list" — the one-line answer the group header shows. */
export const sharingSummary = (shareHours: boolean, shareTasks: TaskShareLevel): string => {
  const parts: string[] = [];
  if (shareHours) parts.push('hours');
  if (shareTasks === 'summary') parts.push('task count');
  if (shareTasks === 'tasks') parts.push('task list');
  return parts.length ? `You share: ${parts.join(' · ')}` : 'You share nothing';
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
          <p className={`text-[13px] font-bold font-ui ${t.heading}`}>Study hours</p>
          <p className={`text-[11px] font-ui mt-1 leading-relaxed ${t.muted}`}>
            {shareHours
              ? 'Your totals for today, this week and this month. Not your subjects or logs.'
              : 'Hidden. You’re on the board without a number.'}
          </p>
        </div>
        <Switch
          on={shareHours}
          onToggle={v => onChange(v, shareTasks)}
          label="Share study hours with this group"
          dark={dark}
          disabled={disabled}
        />
      </div>

      <div className={`mt-5 pt-5 border-t ${t.rule}`}>
        <p className={`text-[13px] font-bold font-ui ${t.heading}`}>Today’s tasks</p>
        <div className="mt-3">
          <Segmented<TaskShareLevel>
            value={shareTasks}
            onChange={v => onChange(shareHours, v)}
            options={[
              { value: 'private', label: 'Private' },
              { value: 'summary', label: 'Count' },
              { value: 'tasks', label: 'Full list' },
            ]}
            dark={dark}
            label="Share today’s tasks with this group"
            disabled={disabled}
          />
        </div>
        <p className={`text-[11px] font-ui mt-2 ${t.muted}`}>{TASK_LEVEL_COPY[shareTasks]}</p>
      </div>
    </div>
  );
};

export default SharingFields;
