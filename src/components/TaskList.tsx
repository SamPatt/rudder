import { useState } from 'react';
import { Task, Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';
import { getValueIcon } from '../lib/valueIcons';

interface TaskListProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  setTasks: (tasks: Task[]) => void;
}

export default function TaskList({ tasks, goals, values, setTasks }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [editMode, setEditMode] = useState<{ [taskId: string]: boolean }>({});

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setShowGoalSelector(true);
  };

  const handleGoalSelect = async (goalIds: string[]) => {
    try {
      // Create the task first
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: newTaskTitle,
          is_done: false,
          is_recurring: isRecurring,
          recur_type: isRecurring ? recurType : null,
          custom_days: isRecurring && recurType === 'custom' ? customDays : null,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Add goal relationships if any goals were selected
      if (goalIds.length > 0) {
        const taskGoals = goalIds.map(goalId => ({
          task_id: task.id,
          goal_id: goalId
        }));

        const { error: goalError } = await supabase
          .from('task_goals')
          .insert(taskGoals);

        if (goalError) throw goalError;
      }

      // Fetch the task with its goals
      const { data: taskWithGoals, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_goals (
            *,
            goal:goals (
              *,
              value:values (*)
            )
          )
        `)
        .eq('id', task.id)
        .single();

      if (fetchError) throw fetchError;

      setTasks([taskWithGoals, ...tasks]);
      setNewTaskTitle('');
      setIsRecurring(false);
      setRecurType('daily');
      setCustomDays([]);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_done: !currentStatus })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, is_done: !currentStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const updateTaskGoals = async (taskId: string, goalIds: string[]) => {
    try {
      // First, delete existing goal relationships
      const { error: deleteError } = await supabase
        .from('task_goals')
        .delete()
        .eq('task_id', taskId);

      if (deleteError) throw deleteError;

      // Then add new goal relationships if any goals were selected
      if (goalIds.length > 0) {
        const taskGoals = goalIds.map(goalId => ({
          task_id: taskId,
          goal_id: goalId
        }));

        const { error: insertError } = await supabase
          .from('task_goals')
          .insert(taskGoals);

        if (insertError) throw insertError;
      }

      // Fetch the updated task with its goals
      const { data: taskWithGoals, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          *,
          task_goals (
            *,
            goal:goals (
              *,
              value:values (*)
            )
          )
        `)
        .eq('id', taskId)
        .single();

      if (fetchError) throw fetchError;

      setTasks(tasks.map(task => task.id === taskId ? taskWithGoals : task));
      setEditingTaskId(null);
    } catch (error) {
      console.error('Error updating task goals:', error);
    }
  };

  const handleEditGoal = (taskId: string) => {
    setEditingTaskId(taskId);
    setShowGoalSelector(true);
  };

  const handleEditGoalSelect = (goalIds: string[]) => {
    if (editingTaskId) {
      updateTaskGoals(editingTaskId, goalIds);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'incomplete') return !task.is_done;
    if (filter === 'complete') return task.is_done;
    return true;
  });

  const getTaskGoalNames = (task: Task) => {
    if (!task.task_goals || task.task_goals.length === 0) return null;
    return task.task_goals.map(tg => {
      const goal = tg.goal;
      if (!goal) return null;
      const value = goal.value;
      const valueIcon = value ? getValueIcon(value.name) : '🎯';
      return `${valueIcon} ${goal.name}`;
    }).filter(Boolean).join(', ');
  };

  const getCurrentTaskGoalIds = () => {
    if (!editingTaskId) return [];
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task || !task.task_goals) return [];
    return task.task_goals.map(tg => tg.goal_id);
  };

  // Helper functions to organize tasks
  const getDailyTasks = () => {
    return filteredTasks.filter(task => task.is_recurring);
  };

  const getRegularTasks = () => {
    return filteredTasks.filter(task => !task.is_recurring);
  };

  const handleDayToggle = (dayValue: number) => {
    setCustomDays(prev => 
      prev.includes(dayValue)
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue].sort()
    );
  };

  const DAYS_OF_WEEK = [
    { value: 0, short: 'Sun', long: 'Sunday' },
    { value: 1, short: 'Mon', long: 'Monday' },
    { value: 2, short: 'Tue', long: 'Tuesday' },
    { value: 3, short: 'Wed', long: 'Wednesday' },
    { value: 4, short: 'Thu', long: 'Thursday' },
    { value: 5, short: 'Fri', long: 'Friday' },
    { value: 6, short: 'Sat', long: 'Saturday' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Add New Task */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Add New Task</h2>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Enter task title..."
              className="flex-1 px-3 py-2 border border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-forest-500 bg-slate-700 text-slate-200"
              onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
            />
            <button
              onClick={handleAddTask}
              disabled={!newTaskTitle.trim()}
              className="bg-forest-600 text-white px-4 py-2 rounded-md hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Task
            </button>
          </div>
          
          {/* Recurring Task Options */}
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 text-forest-600 focus:ring-forest-500 border-slate-500 rounded bg-slate-600"
              />
              <span className="text-slate-300 text-sm">Make this a recurring task</span>
            </label>
          </div>
          
          {isRecurring && (
            <div className="space-y-3 p-3 bg-slate-700 rounded-md">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recurrence Type
                </label>
                <select
                  value={recurType}
                  onChange={(e) => setRecurType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-forest-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom Days</option>
                </select>
              </div>
              
              {recurType === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Days
                  </label>
                  <div className="grid grid-cols-7 gap-1 sm:gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`p-1 sm:p-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                          customDays.includes(day.value)
                            ? 'bg-forest-600 text-white'
                            : 'bg-slate-600 text-gray-300 hover:bg-slate-500'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <h2 className="text-lg font-semibold text-slate-200">Tasks</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filter === 'all' 
                  ? 'bg-forest-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('incomplete')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filter === 'incomplete' 
                  ? 'bg-forest-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
              }`}
            >
              Incomplete
            </button>
            <button
              onClick={() => setFilter('complete')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${
                filter === 'complete' 
                  ? 'bg-forest-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 border border-slate-600'
              }`}
            >
              Complete
            </button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <p className="text-slate-400">No tasks found.</p>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Daily Tasks Section */}
            {getDailyTasks().length > 0 && (
              <div>
                <h3 className="text-md font-medium text-forest-300 mb-3 flex items-center">
                  <span className="mr-2">🔄</span>
                  Daily Tasks
                </h3>
                <div className="space-y-2">
                  {getDailyTasks().map(task => (
                    <div key={task.id} className="relative p-3 sm:p-4 border border-slate-600 rounded-lg bg-slate-700 flex flex-col">
                      {/* Edit icon at top right */}
                      {!editMode[task.id] && (
                        <button
                          onClick={() => setEditMode((prev) => ({ ...prev, [task.id]: true }))}
                          className="absolute top-2 right-2 text-slate-400 hover:text-forest-400 p-1 rounded focus:outline-none focus:ring-2 focus:ring-forest-500"
                          title="Edit task"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 1 1 3.182 3.182L7.5 19.213l-4.182.465a.75.75 0 0 1-.82-.82l.465-4.182L16.862 3.487z" />
                          </svg>
                        </button>
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.is_done}
                          onChange={() => toggleTask(task.id, task.is_done)}
                          className="h-4 w-4 text-forest-600 focus:ring-forest-500 border-slate-500 rounded bg-slate-600 flex-shrink-0"
                        />
                        <span className={`flex-1 min-w-0 break-words ${task.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                      </div>
                      {getTaskGoalNames(task) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {getTaskGoalNames(task).split(', ').map((goalTag, idx) => (
                            <span
                              key={idx}
                              className="text-xs sm:text-sm px-2 py-1 rounded flex-shrink-0 text-slate-300 bg-slate-600"
                            >
                              {goalTag}
                            </span>
                          ))}
                        </div>
                      )}
                      {editMode[task.id] && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <button
                            onClick={() => handleEditGoal(task.id)}
                            className="text-forest-400 hover:text-forest-300 text-xs sm:text-sm px-2 py-1 border border-forest-600 rounded hover:bg-forest-900 transition-colors"
                          >
                            {getTaskGoalNames(task) ? 'Change Goals' : 'Add Goals'}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-red-400 hover:text-red-300 text-xs sm:text-sm transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setEditMode((prev) => ({ ...prev, [task.id]: false }))}
                            className="text-slate-400 hover:text-slate-200 text-xs sm:text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Regular Tasks Section */}
            {getRegularTasks().length > 0 && (
              <div>
                <h3 className="text-md font-medium text-slate-300 mb-3 flex items-center">
                  <span className="mr-2">📝</span>
                  Regular Tasks
                </h3>
                <div className="space-y-2">
                  {getRegularTasks().map(task => (
                    <div key={task.id} className="relative p-3 sm:p-4 border border-slate-600 rounded-lg bg-slate-700 flex flex-col">
                      {/* Edit icon at top right */}
                      {!editMode[task.id] && (
                        <button
                          onClick={() => setEditMode((prev) => ({ ...prev, [task.id]: true }))}
                          className="absolute top-2 right-2 text-slate-400 hover:text-forest-400 p-1 rounded focus:outline-none focus:ring-2 focus:ring-forest-500"
                          title="Edit task"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 1 1 3.182 3.182L7.5 19.213l-4.182.465a.75.75 0 0 1-.82-.82l.465-4.182L16.862 3.487z" />
                          </svg>
                        </button>
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={task.is_done}
                          onChange={() => toggleTask(task.id, task.is_done)}
                          className="h-4 w-4 text-forest-600 focus:ring-forest-500 border-slate-500 rounded bg-slate-600 flex-shrink-0"
                        />
                        <span className={`flex-1 min-w-0 break-words ${task.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                      </div>
                      {getTaskGoalNames(task) && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {getTaskGoalNames(task).split(', ').map((goalTag, idx) => (
                            <span
                              key={idx}
                              className="text-xs sm:text-sm px-2 py-1 rounded flex-shrink-0 text-slate-300 bg-slate-600"
                            >
                              {goalTag}
                            </span>
                          ))}
                        </div>
                      )}
                      {editMode[task.id] && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <button
                            onClick={() => handleEditGoal(task.id)}
                            className="text-forest-400 hover:text-forest-300 text-xs sm:text-sm px-2 py-1 border border-forest-600 rounded hover:bg-forest-900 transition-colors"
                          >
                            {getTaskGoalNames(task) ? 'Change Goals' : 'Add Goals'}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-red-400 hover:text-red-300 text-xs sm:text-sm transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setEditMode((prev) => ({ ...prev, [task.id]: false }))}
                            className="text-slate-400 hover:text-slate-200 text-xs sm:text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Goal Selector Modal */}
      <GoalSelector
        goals={goals}
        values={values}
        onGoalSelect={editingTaskId ? handleEditGoalSelect : handleGoalSelect}
        onClose={() => {
          setShowGoalSelector(false);
          setEditingTaskId(null);
        }}
        isOpen={showGoalSelector}
        multiple={true}
        selectedGoalIds={editingTaskId ? getCurrentTaskGoalIds() : []}
      />
    </div>
  );
} 