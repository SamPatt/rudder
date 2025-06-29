import { useState, useEffect, useRef } from 'react';
import { Task, Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';
import { User } from '@supabase/supabase-js';

interface DashboardProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  setTasks: (tasks: Task[]) => void;
  user: User;
}

export default function Dashboard({ tasks, goals, values, setTasks, user }: DashboardProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const taskTitleInputRef = useRef<HTMLInputElement>(null);

  // Get tasks for the event cards (past due, current, upcoming)
  const getEventTasks = () => {
    // Use timezone-safe date calculation (local midnight)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
    
    // Get all tasks scheduled for today that have time data (both recurring and one-time)
    const todaysTasks = tasks.filter(task => 
      task.start_time && 
      task.end_time &&
      task.date === today
    );
    
    if (todaysTasks.length === 0) {
      return { pastDue: null, current: null, upcoming: null };
    }
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;
    
    let pastDue = null;
    let current = null;
    let upcoming = null;
    
    // Sort tasks by start time
    const sortedTasks = todaysTasks.sort((a, b) => {
      const aStart = a.start_time!.split(':').map(Number);
      const bStart = b.start_time!.split(':').map(Number);
      return (aStart[0] * 60 + aStart[1]) - (bStart[0] * 60 + bStart[1]);
    });
    
    // Find current task (task that is happening right now) - always show regardless of completion
    for (const task of sortedTasks) {
      const [startHour, startMinute] = task.start_time!.split(':').map(Number);
      const [endHour, endMinute] = task.end_time!.split(':').map(Number);
      const taskStartMinutes = startHour * 60 + startMinute;
      const taskEndMinutes = endHour * 60 + endMinute;
      
      if (currentMinutes >= taskStartMinutes && currentMinutes < taskEndMinutes) {
        current = task;
        break;
      }
    }
    
    // Find past due task (most recent task that has ended and is not done and not failed)
    for (let i = sortedTasks.length - 1; i >= 0; i--) {
      const task = sortedTasks[i];
      const [endHour, endMinute] = task.end_time!.split(':').map(Number);
      const taskEndMinutes = endHour * 60 + endMinute;
      
      // Only show as past due if not done, not failed, and not the current task
      if (currentMinutes > taskEndMinutes && 
          !task.is_done && 
          task.completion_status !== 'failed' && 
          task !== current) {
        pastDue = task;
        break;
      }
    }
    
    // Find upcoming task (next task that hasn't started yet and is not done)
    for (const task of sortedTasks) {
      const [startHour, startMinute] = task.start_time!.split(':').map(Number);
      const taskStartMinutes = startHour * 60 + startMinute;
      
      if (currentMinutes < taskStartMinutes && !task.is_done && task !== current) {
        upcoming = task;
        break;
      }
    }
    
    return { pastDue, current, upcoming };
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setShowGoalSelector(true);
  };

  // Helper function to determine the appropriate date for a task
  const getTaskDate = (isRecurring: boolean, recurType: string, customDays: number[]): string => {
    // Use timezone-safe date calculation (local midnight)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0];
    
    if (!isRecurring) {
      return todayStr;
    }
    
    // For recurring tasks, find the next occurrence
    switch (recurType) {
      case 'daily':
        return todayStr;
      
      case 'weekdays':
        // Find next weekday (Monday-Friday)
        const dayOfWeek = today.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          return todayStr;
        } else {
          // If it's weekend, find next Monday
          const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
          const nextMonday = new Date(today);
          nextMonday.setDate(today.getDate() + daysUntilMonday);
          return nextMonday.toISOString().split('T')[0];
        }
      
      case 'custom':
        if (customDays.length === 0) {
          return todayStr;
        }
        // Find the next custom day
        const sortedDays = [...customDays].sort();
        const currentDayOfWeek = today.getDay();
        const nextDay = sortedDays.find(day => day > currentDayOfWeek) || sortedDays[0];
        const daysToAdd = nextDay > currentDayOfWeek ? nextDay - currentDayOfWeek : 7 - currentDayOfWeek + nextDay;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + daysToAdd);
        return nextDate.toISOString().split('T')[0];
      
      default:
        return todayStr;
    }
  };

  const handleGoalSelect = async (goalIds: string[]) => {
    try {
      const taskDate = getTaskDate(isRecurring, recurType, customDays);
      
      if (isRecurring) {
        // Create a task template
        const templatePayload = {
          title: newTaskTitle,
          recur_type: recurType,
          custom_days: recurType === 'custom' ? customDays : null,
          goal_id: goalIds.length > 0 ? goalIds[0] : null,
          user_id: user.id,
        };

        const { error: templateError } = await supabase
          .from('task_templates')
          .insert(templatePayload)
          .select('*, goal:goals(*)')
          .single();

        if (templateError) throw templateError;

        // Generate tasks for today and the next few days
        const { error: generateError } = await supabase.rpc('generate_tasks_for_range', {
          start_date: taskDate,
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });

        if (generateError) throw generateError;

        // Refresh tasks to get the newly generated ones
        const { data: newTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('*, goal:goals(*), template:task_templates(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (tasksError) throw tasksError;
        setTasks(newTasks || []);
      } else {
        // Create a one-time task
        const insertPayload = {
          title: newTaskTitle,
          is_done: false,
          recur: 'once',
          date: taskDate,
          goal_id: goalIds.length > 0 ? goalIds[0] : null,
          user_id: user.id,
        };

        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert(insertPayload)
          .select('*, goal:goals(*)')
          .single();

        if (taskError) throw taskError;

        setTasks([task, ...tasks]);
      }

      setNewTaskTitle('');
      setIsRecurring(false);
      setRecurType('daily');
      setCustomDays([]);
      setShowQuickAdd(false);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Update the task directly (whether it's a template instance or one-time task)
      const { error } = await supabase
        .from('tasks')
        .update({ 
          is_done: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : null
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { 
          ...t, 
          is_done: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : null
        } : t
      ));
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const updateTaskStatus = async (taskId: string, status: 'completed' | 'skipped' | 'failed') => {
    try {
      const task = tasks.find(t => t.id === taskId);
      
      if (!task) return;

      // Update the task directly
      const { error } = await supabase
        .from('tasks')
        .update({ 
          completion_status: status,
          is_done: status === 'completed',
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { 
          ...t, 
          completion_status: status,
          is_done: status === 'completed',
          completed_at: status === 'completed' ? new Date().toISOString() : null
        } : t
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
    }
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

  // Get frequent tasks (recurring tasks scheduled for today)
  const getFrequentTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    
    const filteredTasks = tasks.filter(task => {
      // Must be a task with a template (recurring task)
      if (!task.template_id) {
        return false;
      }
      
      // Check if it's scheduled for today
      return task.date === today;
    });

    // Sort completed tasks to the top, but only if completed today
    return filteredTasks.sort((a, b) => {
      const aCompletedToday = a.completed_at && a.completed_at.startsWith(today);
      const bCompletedToday = b.completed_at && b.completed_at.startsWith(today);
      
      if (aCompletedToday && !bCompletedToday) return -1;
      if (!aCompletedToday && bCompletedToday) return 1;
      return 0;
    });
  };

  // Get to-do list (one-time tasks)
  const getTodoListTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    
    const filteredTasks = tasks.filter(task => {
      // Must be a one-time task (no template_id)
      if (task.template_id) {
        return false;
      }
      
      // Show incomplete tasks
      if (!task.is_done) {
        return true;
      }
      
      // Show completed tasks only if they were scheduled for today AND completed today
      if (task.completed_at && task.completed_at.startsWith(today) && task.date === today) {
        return true;
      }
      
      return false;
    });

    // Sort completed tasks to the top
    return filteredTasks.sort((a, b) => {
      if (a.is_done && !b.is_done) return -1;
      if (!a.is_done && b.is_done) return 1;
      return 0;
    });
  };

  // Focus the input when expanding
  useEffect(() => {
    if (showQuickAdd && taskTitleInputRef.current) {
      taskTitleInputRef.current.focus();
    }
  }, [showQuickAdd]);

  const { pastDue, current, upcoming } = getEventTasks();

  // Format time in 12-hour format
  const formatTime = (time: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  // Get status text for current task
  const getCurrentTaskStatus = (task: Task) => {
    if (task.completion_status === 'completed') return 'Completed';
    if (task.completion_status === 'failed') return 'Failed';
    if (task.completion_status === 'skipped') return 'Skipped';
    return '';
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time Blocks Overview - Only show up to three cards, no header */}
      {(pastDue || current || upcoming) && (
        <div className="space-y-3">
          {/* Previous Time Block */}
          {pastDue && (
            <div className="p-3 sm:p-4 rounded-lg border animate-yellow-gradient bg-yellow-300 border-yellow-500 text-black opacity-80">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base sm:text-lg font-medium truncate">{pastDue.title}</h4>
                  {pastDue.start_time && pastDue.end_time && (
                    <span className="text-xs text-gray-700">
                      {formatTime(pastDue.start_time)} - {formatTime(pastDue.end_time)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => updateTaskStatus(pastDue.id, 'completed')}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                    title="Mark as completed"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => updateTaskStatus(pastDue.id, 'failed')}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    title="Mark as failed"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Time Block - use same color/animation as schedule */}
          {current && (
            <div className="border-orange-400 animate-gradient-slow bg-slate-800 border rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg sm:text-xl font-medium truncate">{current.title}</h4>
                  {current.start_time && current.end_time && (
                    <span className="text-xs text-gray-400">
                      {formatTime(current.start_time)} - {formatTime(current.end_time)}
                    </span>
                  )}
                  {getCurrentTaskStatus(current) && (
                    <p className="text-xs mt-1 text-orange-200">
                      {getCurrentTaskStatus(current)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => updateTaskStatus(current.id, 'completed')}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-colors border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                    title="Mark as completed"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => updateTaskStatus(current.id, 'failed')}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-colors border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    title="Mark as failed"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Next Time Block (if still today) */}
          {upcoming && (
            <div className="p-3 sm:p-4 rounded-lg border">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base sm:text-lg font-medium truncate">{upcoming.title}</h4>
                  {upcoming.start_time && upcoming.end_time && (
                    <span className="text-xs text-gray-400">
                      {formatTime(upcoming.start_time)} - {formatTime(upcoming.end_time)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => updateTaskStatus(upcoming.id, 'completed')}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                    title="Mark as completed"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => updateTaskStatus(upcoming.id, 'failed')}
                    className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    title="Mark as failed"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Add Task */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        {!showQuickAdd ? (
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-forest-600 text-white rounded-md hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors w-full justify-center text-lg font-semibold"
          >
            <span className="text-2xl">+</span> Add Task
          </button>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-slate-200 mb-4">Quick Add Task</h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <input
                  ref={taskTitleInputRef}
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
                  <span className="text-slate-300 text-sm">Make frequent</span>
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
        )}
      </div>

      {/* Tasks List */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        
        {/* Frequent Tasks Section */}
        {getFrequentTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-forest-300 mb-3 flex items-center">
              <span className="mr-2">🔄</span>
              Frequent
            </h3>
            <div className="space-y-2">
              {getFrequentTasks().map(task => (
                <div key={task.id} className={`p-3 border rounded-lg transition-colors flex flex-col ${
                  task.is_done 
                    ? 'border-green-600 bg-green-900/20' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.is_done}
                      onChange={() => toggleTask(task.id, task.is_done)}
                      className={`h-4 w-4 focus:ring-forest-500 border-slate-500 rounded flex-shrink-0 ${
                        task.is_done 
                          ? 'text-green-600 bg-green-600' 
                          : 'text-forest-600 bg-slate-600'
                      }`}
                    />
                    <span className={`flex-1 min-w-0 break-words ${
                      task.is_done 
                        ? 'line-through text-slate-400' 
                        : 'text-slate-200'
                    }`}>
                      {task.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* To-do list Section */}
        {getTodoListTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-slate-300 mb-3 flex items-center">
              <span className="mr-2">📝</span>
              To-do list
            </h3>
            <div className="space-y-2">
              {getTodoListTasks().map(task => (
                <div key={task.id} className={`p-3 border rounded-lg transition-colors flex flex-col ${
                  task.is_done 
                    ? 'border-green-600 bg-green-900/20' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.is_done}
                      onChange={() => toggleTask(task.id, task.is_done)}
                      className={`h-4 w-4 focus:ring-forest-500 border-slate-500 rounded flex-shrink-0 ${
                        task.is_done 
                          ? 'text-green-600 bg-green-600' 
                          : 'text-forest-600 bg-slate-600'
                      }`}
                    />
                    <span className={`flex-1 min-w-0 break-words ${
                      task.is_done 
                        ? 'line-through text-slate-400' 
                        : 'text-slate-200'
                    }`}>
                      {task.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* No Tasks Message */}
        {tasks.length === 0 && (
          <p className="text-slate-400">No tasks yet. Add one above!</p>
        )}
        
        {/* Show message if no incomplete tasks */}
        {tasks.length > 0 && getFrequentTasks().length === 0 && getTodoListTasks().length === 0 && (
          <p className="text-slate-400">All tasks completed! 🎉</p>
        )}
      </div>

      {/* Goal Selector Modal */}
      <GoalSelector
        goals={goals}
        values={values}
        isOpen={showGoalSelector}
        onClose={() => setShowGoalSelector(false)}
        onGoalSelect={handleGoalSelect}
        selectedGoalIds={[]}
      />
    </div>
  );
}