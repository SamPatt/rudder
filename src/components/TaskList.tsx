import { useState } from 'react';
import { Task, Goal, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';
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
  const [editModalTask, setEditModalTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');

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
        
        console.log('Inserting task with payload:', insertPayload, 'User:', user);
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

  const handleEditGoalSelect = (goalIds: string[]) => {
    if (editingTaskId) {
      updateTaskGoals(editingTaskId, goalIds);
    }
  };

  const getCurrentTaskGoalIds = () => {
    if (!editingTaskId) return [];
    const task = tasks.find(t => t.id === editingTaskId);
    if (!task || !task.goal_id) return [];
    return [task.goal_id];
  };

  const filteredTasks = tasks.filter(task => {
    switch (filter) {
      case 'incomplete':
        return !task.is_done;
      case 'complete':
        return task.is_done;
      default:
        return true;
    }
  });

  // One-time tasks (non-recurring)
  const getTodoTasks = () => {
    return tasks.filter(task => {
      // Must be a one-time task (no template_id)
      if (task.template_id) {
        return false;
      }
      return true;
    });
  };

  // Helper function to get the actual completion date for a task
  const getTaskCompletionDate = (task: Task): string | null => {
    if (!task.completed_at) return null;
    return new Date(task.completed_at).toLocaleDateString('en-CA');
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

  // Recurring tasks scheduled for today
  const getFrequentTodayTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(task => {
      // Must be a task with a template (recurring task)
      if (!task.template_id) {
        return false;
      }
      // Check if it's scheduled for today
      return task.date === today;
    });
  };

  // Recurring tasks scheduled for future dates (incomplete only)
  const getFrequentUpcomingTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = getFrequentTodayTasks();
    
    // Get all upcoming recurring tasks
    const allUpcomingTasks = tasks.filter(task => {
      // Must be a task with a template (recurring task)
      if (!task.template_id) {
        return false;
      }
      if (task.is_done) return false;
      // Must be in the future
      return task.date > today;
    });

    // Group by template_id and only keep the first (earliest) instance of each template
    const templateGroups: { [templateId: string]: Task[] } = {};
    allUpcomingTasks.forEach(task => {
      if (!templateGroups[task.template_id!]) {
        templateGroups[task.template_id!] = [];
      }
      templateGroups[task.template_id!].push(task);
    });

    // For each template, only keep the earliest upcoming instance
    const firstUpcomingInstances: Task[] = [];
    Object.values(templateGroups).forEach(templateTasks => {
      // Sort by date and take the first one
      const sortedTasks = templateTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      firstUpcomingInstances.push(sortedTasks[0]);
    });

    // Filter out any templates that already have a task in "Today"
    const todayTemplateIds = new Set(todayTasks.map(task => task.template_id));
    return firstUpcomingInstances.filter(task => !todayTemplateIds.has(task.template_id));
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
            {/* Frequent Tasks Section */}
            {(getFrequentTodayTasks().length > 0 || getFrequentUpcomingTasks().length > 0) && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-forest-300 mb-2 flex items-center">
                  <span className="mr-2">🔄</span>
                  Frequent
                </h3>
                {/* Today subsection */}
                {getFrequentTodayTasks().length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-md font-medium text-slate-200 mb-2">Today</h4>
                    <div className="space-y-2">
                      {getFrequentTodayTasks().map(task => (
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
                            <button
                              className="ml-2 text-slate-400 hover:text-blue-400 text-lg px-2 py-1 rounded"
                              title="Edit task"
                              onClick={() => {
                                setEditModalTask(task);
                                setEditTitle(task.title);
                              }}
                            >
                              ✎
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Upcoming subsection */}
                {getFrequentUpcomingTasks().length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-blue-300 mb-2">Upcoming</h4>
                    <div className="space-y-2">
                      {getFrequentUpcomingTasks().map(task => (
                        <div key={task.id} className="p-3 border border-slate-600 rounded-lg bg-slate-700 flex flex-col">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex-1 min-w-0 break-words text-slate-200">{task.title}</span>
                            <button
                              className="ml-2 text-slate-400 hover:text-blue-400 text-lg px-2 py-1 rounded"
                              title="Edit task"
                              onClick={() => {
                                setEditModalTask(task);
                                setEditTitle(task.title);
                              }}
                            >
                              ✎
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* To-do list Section */}
            {getTodoTasks().length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-300 mb-2 flex items-center">
                  <span className="mr-2">📝</span>
                  To-do list
                </h3>
                <div className="space-y-2">
                  {getTodoTasks().map(task => (
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
                        <button
                          className="ml-2 text-slate-400 hover:text-blue-400 text-lg px-2 py-1 rounded"
                          title="Edit task"
                          onClick={() => {
                            setEditModalTask(task);
                            setEditTitle(task.title);
                          }}
                        >
                          ✎
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Edit Task Modal */}
            {editModalTask && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md mx-2">
                  <h3 className="text-lg font-semibold text-slate-200 mb-4">Edit Task</h3>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 mb-4 border border-slate-600 rounded-md bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-500"
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded"
                      onClick={() => setEditModalTask(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                      onClick={async () => {
                        if (!editModalTask) return;
                        const { error } = await supabase
                          .from('tasks')
                          .update({ title: editTitle })
                          .eq('id', editModalTask.id)
                          .eq('user_id', user.id);
                        if (!error) {
                          setTasks(tasks.map(t => t.id === editModalTask.id ? { ...t, title: editTitle } : t));
                          setEditModalTask(null);
                        }
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                      onClick={async () => {
                        if (!editModalTask) return;
                        const { error } = await supabase
                          .from('tasks')
                          .delete()
                          .eq('id', editModalTask.id)
                          .eq('user_id', user.id);
                        if (!error) {
                          setTasks(tasks.filter(t => t.id !== editModalTask.id));
                          setEditModalTask(null);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Archive Section */}
            {Object.keys(getArchivedTasks()).length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-amber-300 mb-2 flex items-center">
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
                          <div key={task.id} className="p-3 border border-slate-600 rounded-lg bg-slate-800 flex flex-col">
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={task.is_done}
                                onChange={() => toggleTask(task.id, task.is_done)}
                                className="h-4 w-4 text-forest-600 focus:ring-forest-500 border-slate-500 rounded bg-slate-600 flex-shrink-0"
                              />
                              <span className={`flex-1 min-w-0 break-words ${task.is_done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                              <button
                                className="ml-2 text-slate-400 hover:text-blue-400 text-lg px-2 py-1 rounded"
                                title="Edit task"
                                onClick={() => {
                                  setEditModalTask(task);
                                  setEditTitle(task.title);
                                }}
                              >
                                ✎
                              </button>
                            </div>
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
    </div>
  );
} 