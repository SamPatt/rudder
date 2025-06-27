import { useState } from 'react';
import { Task, Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';
import { getValueIcon } from '../lib/valueIcons';
import ConfirmationModal from './ConfirmationModal';
import { User } from '@supabase/supabase-js';

interface TaskListProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  setTasks: (tasks: Task[]) => void;
  user: User;
}

export default function TaskList({ tasks, goals, values, setTasks, user }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'complete'>('all');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [editMode, setEditMode] = useState<{ [taskId: string]: boolean }>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setShowGoalSelector(true);
  };

  // Helper function to determine the appropriate date for a task
  const getTaskDate = (isRecurring: boolean, recurType: string, customDays: number[]): string => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    if (!isRecurring) {
      // For one-time tasks, use today's date
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
      
      case 'weekly':
        // For weekly (Monday), find next Monday
        const currentDay = today.getDay();
        const daysUntilMonday = currentDay === 1 ? 0 : (8 - currentDay) % 7;
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + daysUntilMonday);
        return nextMonday.toISOString().split('T')[0];
      
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
      
      // Create the task first
      const insertPayload = {
        title: newTaskTitle,
        is_done: false,
        recur: isRecurring ? recurType : null,
        custom_days: isRecurring && recurType === 'custom' ? customDays : null,
        date: taskDate,
        goal_id: goalIds.length > 0 ? goalIds[0] : null,
        user_id: user.id,
      };
      
      console.log('Inserting task with payload:', insertPayload, 'User:', user);
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(insertPayload)
        .select('*, goal:goals(*)')
        .single();

      if (taskError) throw taskError;

      setTasks([task, ...tasks]);
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
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // For recurring tasks, create a daily instance for today
      if (task.recur && task.recur !== 'once') {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if a daily instance already exists for today
        const existingDailyTask = tasks.find(t => 
          t.title === task.title && 
          t.date === today && 
          t.start_time === task.start_time && 
          t.end_time === task.end_time
        );

        if (existingDailyTask) {
          // Update the existing daily instance
          const { error } = await supabase
            .from('tasks')
            .update({ 
              is_done: !currentStatus,
              completed_at: !currentStatus ? new Date().toISOString() : null
            })
            .eq('id', existingDailyTask.id)
            .eq('user_id', user.id);

          if (error) throw error;

          setTasks(tasks.map(t => 
            t.id === existingDailyTask.id ? { 
              ...t, 
              is_done: !currentStatus,
              completed_at: !currentStatus ? new Date().toISOString() : null
            } : t
          ));
        } else {
          // Create a new daily instance for today
          const dailyTaskData = {
            title: task.title,
            description: task.description,
            start_time: task.start_time,
            end_time: task.end_time,
            goal_id: task.goal_id,
            date: today,
            is_done: !currentStatus,
            completed_at: !currentStatus ? new Date().toISOString() : null,
            user_id: user.id,
            // Don't copy recur fields - this is a one-time instance
          };

          const { data: newTask, error } = await supabase
            .from('tasks')
            .insert([dailyTaskData])
            .select('*, goal:goals(*)')
            .single();

          if (error) throw error;

          setTasks([newTask, ...tasks]);
        }
      } else {
        // For one-time tasks, update the original task
        const { error } = await supabase
          .from('tasks')
          .update({ 
            is_done: !currentStatus,
            completed_at: !currentStatus ? new Date().toISOString() : null
          })
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        setTasks(tasks.map(task => 
          task.id === taskId ? { 
            ...task, 
            is_done: !currentStatus,
            completed_at: !currentStatus ? new Date().toISOString() : null
          } : task
        ));
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.filter(task => task.id !== taskId));
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const confirmDelete = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setTaskToDelete(null);
    }
  };

  const updateTaskGoals = async (taskId: string, goalIds: string[]) => {
    try {
      // Update the task's goal_id
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ goal_id: goalIds.length > 0 ? goalIds[0] : null })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Fetch the updated task with its goal
      const { data: taskWithGoal, error: fetchError } = await supabase
        .from('tasks')
        .select('*, goal:goals(*)')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) throw fetchError;

      setTasks(tasks.map(task => task.id === taskId ? taskWithGoal : task));
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
    if (!task.goal) return null;
    const goal = task.goal;
    const value = goal.value;
    const valueIcon = value ? getValueIcon(value.name) : '🎯';
    return `${valueIcon} ${goal.name}`;
  };

  const getCurrentTaskGoalIds = () => {
    if (!editingTaskId) return [];
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task || !task.goal_id) return [];
    return [task.goal_id];
  };

  // Helper function to check if a task is scheduled for today
  const isTaskScheduledForToday = (task: Task): boolean => {
    const today = new Date().toISOString().split('T')[0];
    
    // One-time tasks with a specific date
    if (task.recur === 'once' && task.date) {
      return task.date === today;
    }
    
    // Tasks without recurrence and without a date (to-do items)
    if (!task.recur && !task.date) {
      return false; // To-do items are not scheduled for today
    }
    
    // Recurring tasks
    if (task.recur && task.recur !== 'once') {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const days = getDaysForTask(task);
      return days.includes(dayOfWeek);
    }
    
    // Tasks with a specific date
    if (task.date) {
      return task.date === today;
    }
    
    return false;
  };

  // Helper function to check if a task is due later than today
  const isTaskUpcoming = (task: Task): boolean => {
    const today = new Date().toISOString().split('T')[0];
    
    // One-time tasks with a specific date
    if (task.recur === 'once' && task.date) {
      return task.date > today;
    }
    
    // Tasks without recurrence and without a date (to-do items)
    if (!task.recur && !task.date) {
      return false; // To-do items are not upcoming
    }
    
    // Recurring tasks
    if (task.recur && task.recur !== 'once') {
      // For recurring tasks, we consider them "upcoming" if they're not scheduled for today
      return !isTaskScheduledForToday(task);
    }
    
    // Tasks with a specific date
    if (task.date) {
      return task.date > today;
    }
    
    return false;
  };

  // Get tasks that are due today (recurring tasks scheduled for today)
  const getTodaysTasks = () => {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    return filteredTasks
      .filter(task => {
        if (!isTaskScheduledForToday(task)) return false;
        // For completed tasks, only show if completed_at is today (local)
        if (task.is_done && getTaskCompletionDate(task) !== todayLocal) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.is_done && b.is_done) return -1;
        if (a.is_done && !b.is_done) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  };

  // Get upcoming tasks (recurring tasks not due today, or one-time tasks in the future)
  const getUpcomingTasks = () => {
    return filteredTasks
      .filter(task => {
        if (!isTaskUpcoming(task)) return false;
        if (task.is_done) return false;
        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Get to-do tasks (non-recurring tasks without specific due dates)
  const getTodoTasks = () => {
    return tasks.filter(task => isTaskTodo(task) && !task.is_done);
  };

  // Helper function to get the actual completion date for a task
  const getTaskCompletionDate = (task: Task): string | null => {
    if (!task.is_done || !task.completed_at) return null;
    // Return local date string from UTC timestamp
    return new Date(task.completed_at).toLocaleDateString('en-CA'); // YYYY-MM-DD
  };

  // Get archived tasks (completed tasks from previous days)
  const getArchivedTasks = () => {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    
    // Get all completed tasks that were completed on a date other than today
    const archivedTasks = filteredTasks
      .filter(task => {
        if (!task.is_done || !task.completed_at) return false;
        
        const completionDate = getTaskCompletionDate(task);
        if (!completionDate) return false;
        
        return completionDate !== todayLocal;
      })
      .sort((a, b) => {
        // Sort by completion date (most recent first)
        const dateA = getTaskCompletionDate(a) || a.created_at.split('T')[0];
        const dateB = getTaskCompletionDate(b) || b.created_at.split('T')[0];
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

    // Group by date
    const groupedByDate: { [date: string]: Task[] } = {};
    archivedTasks.forEach(task => {
      const date = getTaskCompletionDate(task) || task.created_at.split('T')[0];
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(task);
    });

    return groupedByDate;
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

  const isTaskTodo = (task: Task): boolean => {
    // To-do items are tasks without recurrence and without a specific date
    return !task.recur && !task.date;
  };

  const getDaysForTask = (task: Task): number[] => {
    if (!task.recur) return [];
    
    switch (task.recur) {
      case 'daily':
        return [0, 1, 2, 3, 4, 5, 6]; // All days
      case 'weekdays':
        return [1, 2, 3, 4, 5]; // Monday to Friday
      case 'custom':
        return task.custom_days || [];
      default:
        return [];
    }
  };

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
            {/* Today Section */}
            {getTodaysTasks().length > 0 && (
              <div>
                <h3 className="text-md font-medium text-forest-300 mb-3 flex items-center">
                  <span className="mr-2">📅</span>
                  Today
                </h3>
                <div className="space-y-2">
                  {getTodaysTasks().map(task => (
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag: string, idx: number) => (
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
                            onClick={() => {
                              setShowDeleteModal(true);
                              setTaskToDelete(task.id);
                            }}
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
            
            {/* Upcoming Section */}
            {getUpcomingTasks().length > 0 && (
              <div>
                <h3 className="text-md font-medium text-blue-300 mb-3 flex items-center">
                  <span className="mr-2">🔮</span>
                  Upcoming
                </h3>
                <div className="space-y-2">
                  {getUpcomingTasks().map(task => (
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag: string, idx: number) => (
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
                            onClick={() => {
                              setShowDeleteModal(true);
                              setTaskToDelete(task.id);
                            }}
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
            
            {/* To-do list Section */}
            {getTodoTasks().length > 0 && (
              <div>
                <h3 className="text-md font-medium text-slate-300 mb-3 flex items-center">
                  <span className="mr-2">📝</span>
                  To-do list
                </h3>
                <div className="space-y-2">
                  {getTodoTasks().map(task => (
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag: string, idx: number) => (
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
                            onClick={() => {
                              setShowDeleteModal(true);
                              setTaskToDelete(task.id);
                            }}
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
            
            {/* Archive Section */}
            {Object.keys(getArchivedTasks()).length > 0 && (
              <div>
                <h3 className="text-md font-medium text-amber-300 mb-3 flex items-center">
                  <span className="mr-2">📚</span>
                  Archive
                </h3>
                <div className="space-y-4">
                  {Object.entries(getArchivedTasks()).map(([date, tasks]) => (
                    <div key={date} className="border border-slate-600 rounded-lg bg-slate-700 overflow-hidden">
                      <div className="bg-slate-800 px-3 py-2 border-b border-slate-600">
                        <h4 className="text-sm font-medium text-slate-300">
                          {new Date(date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </h4>
                      </div>
                      <div className="p-3 space-y-2">
                        {tasks.map(task => (
                          <div key={task.id} className="relative p-3 border border-slate-600 rounded-lg bg-slate-800 flex flex-col">
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
                                {getTaskGoalNames(task)!.split(', ').map((goalTag: string, idx: number) => (
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
                                  onClick={() => {
                                    setShowDeleteModal(true);
                                    setTaskToDelete(task.id);
                                  }}
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

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setTaskToDelete(null);
          }}
          onConfirm={confirmDelete}
          title="Confirm Deletion"
          message="Are you sure you want to delete this task?"
        />
      )}
    </div>
  );
} 