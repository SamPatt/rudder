import { useState, useEffect } from 'react';
import { Task, Goal, Value } from '../types/database';

interface EditTaskModalProps {
  isOpen: boolean;
  task: Task | null;
  goals: Goal[];
  values: Value[];
  onSave: (updated: { name: string }) => void;
  onDelete: () => void;
  onCancel: () => void;
  onGoalSelect: () => void;
}

export default function EditTaskModal({
  isOpen,
  task,
  goals,
  values,
  onSave,
  onDelete,
  onCancel,
  onGoalSelect,
}: EditTaskModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (task) {
      setName(task.title);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const currentGoal = task.goal_id ? goals.find(g => g.id === task.goal_id) : null;
  const currentValue = currentGoal ? values.find(v => v.id === currentGoal.value_id) : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 sm:p-4">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Edit Task</h2>
        <div className="mb-4">
          <label className="block text-slate-300 mb-1">Task Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-500"
            autoFocus
          />
        </div>
        <div className="mb-4">
          <label className="block text-slate-300 mb-1">Goal</label>
          <button
            onClick={onGoalSelect}
            className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-200 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-forest-500 text-left"
          >
            {currentGoal ? (
              <span>
                {currentGoal.name} ({currentValue?.name || ''})
              </span>
            ) : (
              <span className="text-slate-400">No Goal</span>
            )}
          </button>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button
            className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded font-medium"
            onClick={onDelete}
          >
            Delete
          </button>
          <button
            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded font-medium"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
            onClick={() => onSave({ name })}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
} 