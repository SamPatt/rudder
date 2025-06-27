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
        is_recurring: isRecurring,
        recur_type: isRecurring ? recurType : null,
        custom_days: isRecurring && recurType === 'custom' ? customDays : null,
        date: taskDate,
        user_id: user.id,
      };
      console.log('Inserting task with payload:', insertPayload, 'User:', user);
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (taskError) throw taskError;

      // Add goal relationships if any goals were selected
      if (goalIds.length > 0) {
        const taskGoals = goalIds.map(goalId => ({
          task_id: task.id,
          goal_id: goalId,
          user_id: user.id,
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
        .eq('user_id', user.id)
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
      const nowUTC = new Date().toISOString();
      // If marking as completed, set completed_at to now (UTC)
      // If marking as incomplete, set completed_at to null
      const updateData = currentStatus 
        ? { is_done: false, completed_at: null } 
        : { is_done: true, completed_at: nowUTC, date: nowUTC.split('T')[0] };
      
      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, ...updateData } : task
      ));

      // Also update the corresponding time block completion status
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        // Find time blocks with matching title
        const { data: timeBlocks, error: timeBlocksError } = await supabase
          .from('time_blocks')
          .select('*')
          .eq('user_id', user.id);
        
        if (!timeBlocksError && timeBlocks) {
          const matchingTimeBlocks = timeBlocks.filter(tb => 
            tb.title === task.title || 
            tb.title === task.title.replace(/ \(\d{2}:\d{2} - \d{2}:\d{2}\)/, '')
          );

          for (const timeBlock of matchingTimeBlocks) {
            // Check existing completion
            const today = new Date().toISOString().split('T')[0];
            const { data: existingCompletions, error: completionFetchError } = await supabase
              .from('schedule_completions')
              .select('*')
              .eq('time_block_id', timeBlock.id)
              .eq('date', today)
              .eq('user_id', user.id);
            
            if (!completionFetchError) {
              const existingCompletion = existingCompletions?.[0];
              
              if (!currentStatus) {
                // Task is being marked as completed, so mark time block as completed
                if (!existingCompletion || existingCompletion.status !== 'completed') {
                  const { error: completionError } = await supabase
                    .from('schedule_completions')
                    .upsert([{ 
                      time_block_id: timeBlock.id, 
                      date: today, 
                      status: 'completed',
                      user_id: user.id 
                    }]);
                  if (completionError) {
                    console.error('Error updating time block completion:', completionError);
                  }
                }
              } else {
                // Task is being marked as incomplete, so remove time block completion
                if (existingCompletion && existingCompletion.status === 'completed') {
                  const { error: completionError } = await supabase
                    .from('schedule_completions')
                    .delete()
                    .eq('id', existingCompletion.id)
                    .eq('user_id', user.id);
                  if (completionError) {
                    console.error('Error removing time block completion:', completionError);
                  }
                }
              }
            }
          }
        }
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
      // First, delete existing goal relationships
      const { error: deleteError } = await supabase
        .from('task_goals')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Then add new goal relationships if any goals were selected
      if (goalIds.length > 0) {
        const taskGoals = goalIds.map(goalId => ({
          task_id: taskId,
          goal_id: goalId,
          user_id: user.id,
        }));

        const { error: insertError } = await supabase
          .from('task_goals')
          .insert(taskGoals.map(tg => ({ ...tg, user_id: user.id })));

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
        .eq('user_id', user.id)
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

  // Helper function to check if a task is scheduled for today
  const isTaskScheduledForToday = (task: Task): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // For one-time tasks, check if the date is today AND it's a meaningful due date
    if (!task.is_recurring && task.date) {
      const taskDate = new Date(task.date);
      const todayStr = today.toISOString().split('T')[0];
      const taskDateStr = taskDate.toISOString().split('T')[0];
      
      // Only consider it "today" if the date is today AND it's not a default date
      // We'll assume that if the task was created today with today's date, it's a default date
      if (todayStr === taskDateStr) {
        // Check if this is likely a default date by comparing with created_at
        const createdDate = new Date(task.created_at);
        const createdDateStr = createdDate.toISOString().split('T')[0];
        
        // If created today and date is today, it's likely a default date, not a "today" task
        if (createdDateStr === todayStr) {
          return false;
        }
        
        return true;
      }
      
      return false;
    }
    
    // For one-time tasks without a date, they should not be in "Today"
    if (!task.is_recurring && !task.date) {
      return false;
    }
    
    // For recurring tasks, check if today's day of week is in the scheduled days
    if (task.is_recurring && task.recur_type) {
      switch (task.recur_type) {
        case 'daily':
          return true;
        case 'weekdays':
          return dayOfWeek >= 1 && dayOfWeek <= 5;
        case 'weekly':
          return task.custom_days ? task.custom_days.includes(dayOfWeek) : false;
        case 'custom':
          return task.custom_days ? task.custom_days.includes(dayOfWeek) : false;
        default:
          return false;
      }
    }
    
    return false;
  };

  // Helper function to check if a task is due later than today
  const isTaskUpcoming = (task: Task): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For one-time tasks, check if the date is in the future
    if (!task.is_recurring && task.date) {
      const taskDate = new Date(task.date);
      taskDate.setHours(0, 0, 0, 0);
      
      // Only consider it "upcoming" if the date is actually in the future
      // and it's not a default date
      if (taskDate > today) {
        // Check if this is likely a default date by comparing with created_at
        const createdDate = new Date(task.created_at);
        const createdDateStr = createdDate.toISOString().split('T')[0];
        const taskDateStr = taskDate.toISOString().split('T')[0];
        
        // If created today and date is today, it's likely a default date, not an "upcoming" task
        if (createdDateStr === taskDateStr && taskDateStr === today.toISOString().split('T')[0]) {
          return false;
        }
        
        return true;
      }
      
      return false;
    }
    
    // For one-time tasks without a date, they should not be in "Upcoming"
    if (!task.is_recurring && !task.date) {
      return false;
    }
    
    // For recurring tasks, check if it's not scheduled for today
    if (task.is_recurring) {
      return !isTaskScheduledForToday(task);
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
    return filteredTasks
      .filter(task => {
        // To-do tasks are non-recurring tasks that either:
        // 1. Don't have a date field, OR
        // 2. Have a date but it's not a specific due date (e.g., created with today's date as default)
        if (task.is_recurring) return false;
        
        // If the task has a date, check if it's actually a meaningful due date
        if (task.date) {
          // If the date is today and it's not a recurring task, it might be a default date
          // We'll consider it a to-do task if it was created today (indicating it's a default date)
          const taskDate = new Date(task.date);
          const today = new Date();
          const taskDateStr = taskDate.toISOString().split('T')[0];
          const todayStr = today.toISOString().split('T')[0];
          
          // If the date is today, it's likely a default date, so treat as to-do
          if (taskDateStr === todayStr) {
            return true;
          }
          
          // If the date is in the past, it's also a to-do task
          if (taskDate < today) {
            return true;
          }
          
          // If the date is in the future, it's an upcoming task
          return false;
        }
        
        // No date field, definitely a to-do task
        return true;
      })
      .sort((a, b) => {
        // Sort incomplete tasks first, then completed tasks
        if (!a.is_done && b.is_done) return -1;
        if (a.is_done && !b.is_done) return 1;
        // If both have same completion status, sort by creation date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag, idx) => (
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag, idx) => (
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
                          {getTaskGoalNames(task)!.split(', ').map((goalTag, idx) => (
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
                                {getTaskGoalNames(task)!.split(', ').map((goalTag, idx) => (
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