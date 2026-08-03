import React, { useState, useMemo } from 'react';
import { Subject, Task } from '../types';

interface Props {
  tasks: Task[];
  onAddTask: (text: string, subject: Subject) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  activeSubjectFilter: Subject | null;
  theme: 'dark' | 'light';
  activeSubjects: Subject[];
  minimal?: boolean;
}

const TaskSection: React.FC<Props> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  activeSubjectFilter,
  theme,
  activeSubjects,
  minimal = false
}) => {
  const [newTaskText, setNewTaskText] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject>('General');

  const handleAdd = () => {
    if (newTaskText.trim()) {
      onAddTask(newTaskText, selectedSubject);
      setNewTaskText('');
    }
  };

  const filteredTasks = useMemo(() => {
    if (activeSubjectFilter) return tasks.filter((t) => t.subject === activeSubjectFilter || t.subject === 'General');
    return tasks;
  }, [tasks, activeSubjectFilter]);

  return (
    <div className={`space-y-4 relative z-10 ${minimal ? 'max-w-md w-full mx-auto' : ''}`}>
      {!minimal && (
        <div className="flex justify-between items-end mb-4 pb-2">
          <h3 className={`text-xs font-bold tracking-tight font-ui ${theme === 'dark' ? 'text-zinc-500' : 'text-[#6B675C]'}`}>Focus Tasks</h3>
        </div>
      )}

      {!minimal && (
        <div className="space-y-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {activeSubjects.map((s: Subject) => (
              <button
                key={s}
                onClick={() => setSelectedSubject(s)}
                className={`text-[9px] px-4 py-2 font-bold uppercase tracking-[0.06em] border rounded-md transition-all ${selectedSubject === s ? 'bg-[#E10600] text-white border-[#E10600]' : (theme === 'dark' ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-[#E3E0D9] text-[#8A8577] hover:border-[#D6D1C5]')}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`ADD ${selectedSubject.toUpperCase()} TASK...`}
              className={`flex-1 text-xs p-3 md:p-4 focus:outline-none focus:ring-1 focus:ring-white/20 font-bold uppercase border rounded-md transition-colors ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F]'}`}
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className={`text-[10px] font-black px-4 md:px-8 transition-all rounded-md ${theme === 'dark' ? 'bg-white text-black hover:bg-zinc-300' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
            >
              COMMIT
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
        {filteredTasks.length === 0 ? (
          <div className={`col-span-full py-8 text-center border rounded-md ${theme === 'dark' ? 'border-white/[0.04] text-zinc-700' : 'border-[#E3E0D9] text-[#B5AFA0]'}`}>
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] italic">No Pending Tasks</p>
          </div>
        ) : filteredTasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-start gap-4 p-4 border rounded-md transition-all group card-interactive ${task.completed ? 'opacity-30' : ''} ${theme === 'dark' ? 'border-white/[0.06] bg-[#111114]' : 'border-[#E3E0D9] bg-white'}`}
          >
            <button
              onClick={() => onToggleTask(task.id)}
              className={`mt-1 w-5 h-5 border-2 rounded-md flex items-center justify-center transition-all ${task.completed ? 'bg-[#E10600] border-[#E10600]' : (theme === 'dark' ? 'border-zinc-700' : 'border-[#D6D1C5]')}`}
            >
              {task.completed && <div className="w-2 h-2 bg-white rounded-sm" />}
            </button>
            <div className="flex-1">
              <span className={`text-[8px] font-medium uppercase tracking-[0.06em] block mb-0.5 ${task.subject === 'General' ? (theme === 'dark' ? 'text-zinc-600' : 'text-[#8A8577]') : 'text-[#E10600]'}`}>{task.subject}</span>
              <p className={`text-[11px] font-bold uppercase tracking-tight break-words ${task.completed ? 'line-through' : (theme === 'dark' ? 'text-white' : 'text-[#17150F]')}`}>{task.text}</p>
            </div>
            {!minimal && (
              <button onClick={() => window.confirm('Discard task?') && onDeleteTask(task.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <span className="text-[12px]">🗑️</span>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TaskSection;
