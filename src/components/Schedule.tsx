import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { Task, Goal, Value } from '../types/database';
import { User } from '@supabase/supabase-js';
import GoalSelector from './GoalSelector';
import TimeDropdown from './TimeDropdown';

interface ScheduleProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  setTasks: (tasks: Task[]) => void;
  user: User;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'custom', label: 'Custom Days' },
  { value: 'once', label: 'One Time Event' },
];

export default function Schedule({ tasks, goals, values, setTasks, user }: ScheduleProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '09:00',
    end_time: '10:00',
    recur: 'daily' as 'once' | 'daily' | 'weekdays' | 'custom',
    custom_days: [] as number[],
    event_date: new Date().toISOString().split('T')[0],
    goal_id: null as string | null,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const lastStartTimeRef = useRef(formData.start_time);
  const [endTimeManuallyChanged, setEndTimeManuallyChanged] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // Get scheduled tasks (tasks with start_time and end_time)
  const getScheduledTasks = () => {
    const scheduledTasks = tasks.filter(task => task.start_time && task.end_time);
    
    // For each day, prioritize daily instances over recurring tasks
    const today = new Date().toISOString().split('T')[0];
    const result: Task[] = [];
    
    // Group tasks by their key (title + start_time + end_time)
    const taskGroups: { [key: string]: Task[] } = {};
    
    scheduledTasks.forEach(task => {
      const key = `${task.title}-${task.start_time}-${task.end_time}`;
      if (!taskGroups[key]) {
        taskGroups[key] = [];
      }
      taskGroups[key].push(task);
    });
    
    // For each group, prioritize daily instances for the current date
    Object.values(taskGroups).forEach(group => {
      // Find daily instance for the current date (not just today)
      const dailyInstance = group.find(task => 
        task.date === currentDate.toISOString().split('T')[0] && 
        !task.recur // This is a daily instance, not a recurring task
      );
      
      // Find recurring task
      const recurringTask = group.find(task => 
        task.recur && 
        task.recur !== 'once' &&
        isTaskScheduledForDate(task, currentDate)
      );
      
      // If we have a daily instance for the current date, use it
      if (dailyInstance) {
        result.push(dailyInstance);
      } 
      // Otherwise, if we have a recurring task scheduled for this date, use it
      else if (recurringTask) {
        result.push(recurringTask);
      }
      // For one-time tasks, always include them
      else {
        const oneTimeTask = group.find(task => task.recur === 'once');
        if (oneTimeTask && isTaskScheduledForDate(oneTimeTask, currentDate)) {
          result.push(oneTimeTask);
        }
      }
    });
    
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const taskData = {
      title: formData.title,
      description: formData.description,
      start_time: formData.start_time,
      end_time: formData.end_time,
      recur: formData.recur,
      custom_days: formData.recur === 'custom' ? formData.custom_days : null,
      event_date: formData.recur === 'once' ? formData.event_date : null,
      goal_id: formData.goal_id || null,
      is_done: false,
      date: formData.recur === 'once' ? formData.event_date : new Date().toISOString().split('T')[0],
      user_id: user.id,
    };

    if (editingTask) {
      // Update existing task
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', editingTask.id);

      if (error) {
        console.error('Error updating task:', error);
      } else {
        setFormData({
          title: '',
          description: '',
          start_time: '09:00',
          end_time: '10:00',
          recur: 'daily',
          custom_days: [],
          event_date: new Date().toISOString().split('T')[0],
          goal_id: null,
        });
        setEditingTask(null);
        setSelectedGoalId(null);
        setShowForm(false);
      }
    } else {
      // Create new task
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select('*, goal:goals(*)')
        .single();

      if (error) {
        console.error('Error creating task:', error);
      } else {
        setTasks([data, ...tasks]);
        setFormData({
          title: '',
          description: '',
          start_time: '09:00',
          end_time: '10:00',
          recur: 'daily',
          custom_days: [],
          event_date: new Date().toISOString().split('T')[0],
          goal_id: null,
        });
        setSelectedGoalId(null);
        setShowForm(false);
      }
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      start_time: task.start_time || '09:00',
      end_time: task.end_time || '10:00',
      recur: task.recur || 'daily',
      custom_days: task.custom_days || [],
      event_date: task.event_date || new Date().toISOString().split('T')[0],
      goal_id: task.goal_id || null,
    });
    setSelectedGoalId(task.goal_id || null);
    setShowForm(true);
  };

  const handleDelete = async (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!taskToDelete) return;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskToDelete)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting task:', error);
    } else {
      setTasks(tasks.filter(task => task.id !== taskToDelete));
    }
    
    setTaskToDelete(null);
    setShowDeleteModal(false);
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      description: '',
      start_time: '09:00',
      end_time: '10:00',
      recur: 'daily',
      custom_days: [],
      event_date: new Date().toISOString().split('T')[0],
      goal_id: null,
    });
    setEditingTask(null);
    setSelectedGoalId(null);
    setShowForm(false);
  };

  const handleDayToggle = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      custom_days: prev.custom_days.includes(dayValue)
        ? prev.custom_days.filter(d => d !== dayValue)
        : [...prev.custom_days, dayValue].sort()
    }));
  };

  const getDaysForTask = (task: Task): number[] => {
    if (task.custom_days) {
      return task.custom_days;
    }
    
    switch (task.recur) {
      case 'daily': return [0, 1, 2, 3, 4, 5, 6];
      case 'weekdays': return [1, 2, 3, 4, 5];
      default: return [];
    }
  };

  const isTaskScheduledForDate = (task: Task, date: Date): boolean => {
    // Don't show recurring events for dates before they were created
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // Handle daily instances (tasks with recur: null)
    if (!task.recur) {
      const taskDateStr = task.date;
      const currentDateStr = date.toISOString().split('T')[0];
      return taskDateStr === currentDateStr;
    }
    
    // For recurring events, only show if the date is on or after the creation date
    if (task.recur !== 'once' && task.created_at) {
      const createdDate = new Date(task.created_at);
      createdDate.setHours(0, 0, 0, 0);
      
      if (checkDate < createdDate) {
        return false;
      }
    }
    
    // Handle one-time events
    if (task.recur === 'once' && task.event_date) {
      const eventDateStr = new Date(task.event_date).toISOString().split('T')[0];
      const currentDateStr = date.toISOString().split('T')[0];
      const result = eventDateStr === currentDateStr;
      return result;
    }
    
    const dayOfWeek = date.getDay();
    const days = getDaysForTask(task);
    const result = days.includes(dayOfWeek);
    return result;
  };

  const isTaskCurrent = (task: Task, date: Date): boolean => {
    const now = new Date();
    const today = new Date();
    
    // Check if it's the same day
    if (date.toDateString() !== today.toDateString()) {
      return false;
    }
    
    // Parse start and end times
    const [startHour, startMinute] = task.start_time!.split(':').map(Number);
    const [endHour, endMinute] = task.end_time!.split(':').map(Number);
    
    const startTime = new Date(today);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(today);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    return now >= startTime && now < endTime;
  };

  const updateTaskStatus = async (taskId: string, status: 'completed' | 'skipped' | 'failed') => {
    try {
      const targetDate = currentDate.toISOString().split('T')[0];
      const task = tasks.find(t => t.id === taskId);
      
      console.log('=== DEBUG: updateTaskStatus ===');
      console.log('Task ID:', taskId);
      console.log('Task:', task);
      console.log('currentDate object:', currentDate);
      console.log('Target date (currentDate):', targetDate);
      console.log('Actual today:', new Date().toISOString().split('T')[0]);
      
      if (!task) return;

      // For recurring tasks, create a daily instance for the current date being viewed
      if (task.recur && task.recur !== 'once') {
        console.log('Processing recurring task');
        
        // Check if a daily instance already exists for the target date
        const existingDailyTask = tasks.find(t => 
          t.title === task.title && 
          t.date === targetDate && 
          t.start_time === task.start_time && 
          t.end_time === task.end_time &&
          !t.recur // This must be a daily instance, not a recurring task
        );

        console.log('Existing daily task:', existingDailyTask);

        if (existingDailyTask) {
          console.log('Updating existing daily instance');
          // Update the existing daily instance
          const { error } = await supabase
            .from('tasks')
            .update({ 
              completion_status: status,
              is_done: status === 'completed',
              completed_at: status === 'completed' ? new Date().toISOString() : null
            })
            .eq('id', existingDailyTask.id)
            .eq('user_id', user.id);

          if (error) throw error;

          setTasks(tasks.map(t => 
            t.id === existingDailyTask.id ? { 
              ...t, 
              completion_status: status,
              is_done: status === 'completed',
              completed_at: status === 'completed' ? new Date().toISOString() : null
            } : t
          ));
        } else {
          console.log('Creating new daily instance');
          // Create a new daily instance for the target date
          const dailyTaskData = {
            title: task.title,
            description: task.description,
            start_time: task.start_time,
            end_time: task.end_time,
            goal_id: task.goal_id,
            date: targetDate,
            completion_status: status,
            is_done: status === 'completed',
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            user_id: user.id,
            // Don't copy recur fields - this is a one-time instance
          };

          console.log('Daily task data:', dailyTaskData);

          const { data: newTask, error } = await supabase
            .from('tasks')
            .insert([dailyTaskData])
            .select('*, goal:goals(*)')
            .single();

          if (error) throw error;

          console.log('New daily task created:', newTask);
          setTasks([newTask, ...tasks]);
        }
      } else {
        console.log('Processing one-time task');
        // For one-time tasks, update the original task
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
      }
      console.log('=== END DEBUG ===');
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleGoalSelect = (goalIds: string[]) => {
    setFormData(prev => ({
      ...prev,
      goal_id: goalIds.length > 0 ? goalIds[0] : null
    }));
    setSelectedGoalId(goalIds.length > 0 ? goalIds[0] : null);
    setShowGoalSelector(false);
  };

  const getSelectedGoalName = () => {
    if (!selectedGoalId) return 'Select a goal';
    const goal = goals.find(g => g.id === selectedGoalId);
    return goal ? goal.name : 'Select a goal';
  };

  const formatTime = (t: string) => {
    if (!t) return '';
    let [hour, minute] = t.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  function groupAndAssignColumns(scheduledTasks: Task[]): { [key: string]: Task & { _col: number; _colCount: number } } {
    function toMinutes(t: string): number {
      const [hours, minutes] = t.split(':').map(Number);
      return hours * 60 + minutes;
    }

    function overlaps(a: Task, b: Task): boolean {
      const aStart = toMinutes(a.start_time!);
      const aEnd = toMinutes(a.end_time!);
      const bStart = toMinutes(b.start_time!);
      const bEnd = toMinutes(b.end_time!);
      
      return aStart < bEnd && bStart < aEnd;
    }

    const result: { [key: string]: Task & { _col: number; _colCount: number } } = {};
    
    // Group tasks by time slots
    const timeSlots: { [key: string]: Task[] } = {};
    
    scheduledTasks.forEach(task => {
      const timeKey = `${task.start_time}-${task.end_time}`;
      if (!timeSlots[timeKey]) {
        timeSlots[timeKey] = [];
      }
      timeSlots[timeKey].push(task);
    });

    // For each time slot, assign columns to overlapping tasks
    Object.values(timeSlots).forEach(tasksInSlot => {
      const columns: Task[][] = [];
      
      tasksInSlot.forEach(task => {
        let placed = false;
        
        // Try to place in existing column
        for (let i = 0; i < columns.length; i++) {
          const canPlace = columns[i].every(existingTask => !overlaps(task, existingTask));
          if (canPlace) {
            columns[i].push(task);
            placed = true;
            break;
          }
        }
        
        // If couldn't place, create new column
        if (!placed) {
          columns.push([task]);
        }
      });

      // Assign column numbers
      tasksInSlot.forEach(task => {
        const columnIndex = columns.findIndex(col => col.includes(task));
        result[task.id] = {
          ...task,
          _col: columnIndex,
          _colCount: columns.length
        };
      });
    });

    return result;
  }

  function isPastDue(task: Task, currentDate: Date): boolean {
    const now = new Date();
    const today = new Date();
    
    // Only check for today's tasks
    if (currentDate.toDateString() !== today.toDateString()) {
      return false;
    }
    
    // Check if task is done or failed
    if (task.is_done || task.completion_status === 'failed') {
      return false;
    }
    
    // Check if past end time
    const [endHour, endMinute] = task.end_time!.split(':').map(Number);
    const endTime = new Date(today);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    return now > endTime;
  }

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="p-2 sm:p-6 sm:max-w-6xl sm:mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0 w-full">
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-none sm:rounded-lg transition-colors w-full sm:w-auto"
        >
          {showForm ? 'Cancel' : 'Add Time Block'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 9999 }} onClick={handleCancel}>
          <div className="bg-gray-800 p-4 sm:p-6 rounded-lg w-full max-w-md mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                {editingTask ? 'Edit Time Block' : 'Add New Time Block'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                  placeholder="Add a description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Goal (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setShowGoalSelector(true)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-left"
                >
                  {selectedGoalId ? getSelectedGoalName() : 'Select a goal...'}
                </button>
                {selectedGoalId && (
                  <div className="mt-2 p-2 bg-green-900 border border-green-600 rounded-md">
                    <p className="text-sm text-green-200">
                      <span className="font-medium">Selected:</span> {getSelectedGoalName()}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <TimeDropdown
                    value={formData.start_time}
                    onChange={val => {
                      setFormData(prev => {
                        // If end time hasn't been manually changed since last start time change, auto-advance end time
                        let newEnd = prev.end_time;
                        if (!endTimeManuallyChanged) {
                          // Add one hour to start time
                          const [h, m] = val.split(':').map(Number);
                          const endH = (h + 1) % 24;
                          newEnd = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        }
                        lastStartTimeRef.current = val;
                        setEndTimeManuallyChanged(false);
                        return { ...prev, start_time: val, end_time: newEnd };
                      });
                    }}
                    label="Start Time"
                  />
                </div>
                <div>
                  <TimeDropdown
                    value={formData.end_time}
                    onChange={val => {
                      setFormData(prev => ({ ...prev, end_time: val }));
                      setEndTimeManuallyChanged(true);
                    }}
                    label="End Time"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Recurrence
                </label>
                <select
                  value={formData.recur}
                  onChange={(e) => setFormData({ ...formData, recur: e.target.value as 'once' | 'daily' | 'weekdays' | 'custom' })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {RECURRENCE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {formData.recur === 'custom' && (
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
                          formData.custom_days.includes(day.value)
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        }`}
                      >
                        {day.short}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {formData.recur === 'once' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Event Date
                  </label>
                  <input
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md transition-colors"
                >
                  {editingTask ? 'Update Time Block' : 'Add Time Block'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-2 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-none sm:rounded-lg p-2 sm:p-6 w-full">
        <div className="mb-2 w-full flex flex-col items-center">
          <h2 className="text-lg sm:text-xl font-semibold text-white text-center w-full">
            {formatDate(currentDate)}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <button
              onClick={() => navigateDate('prev')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors text-sm"
            >
              &lt;
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className={`px-3 py-1 rounded transition-colors text-sm ${
                isToday(currentDate) 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => navigateDate('next')}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors text-sm"
            >
              &gt;
            </button>
          </div>
        </div>
        {/* Schedule grid: 24 rows (one per hour), hour labels fixed, blocks span rows */}
        <div className="grid grid-cols-[4rem_1fr]" style={{ gridTemplateRows: `repeat(${24}, 60px)`, position: 'relative' }}>
          {/* Hour labels */}
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`label-${h}`}
              className="col-start-1 row-start-[auto] flex items-center justify-end pr-2 select-none"
              style={{ gridRow: h + 1, zIndex: 2 }}
            >
              <span className="text-xs sm:text-sm text-gray-400 font-mono">{`${h.toString().padStart(2, '0')}:00`}</span>
            </div>
          ))}
          {/* Full-width hour lines */}
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={`line-${h}`}
              className="col-span-2 absolute left-0 right-0 border-b border-slate-700 pointer-events-none"
              style={{ top: `${h * 60}px`, height: 0, zIndex: 1 }}
            />
          ))}
          {/* Time blocks with improved overlap grouping and column assignment */}
          {(() => {
            // Get all visible blocks
            const allScheduledTasks = getScheduledTasks();
            console.log('=== DEBUG: Task Rendering ===');
            console.log('All scheduled tasks:', allScheduledTasks.map(t => ({
              id: t.id,
              title: t.title,
              date: t.date,
              recur: t.recur,
              is_done: t.is_done,
              completion_status: t.completion_status
            })));
            
            const visibleBlocks = allScheduledTasks
              .filter(task => {
                const isScheduled = isTaskScheduledForDate(task, currentDate);
                console.log(`Task ${task.title}: isScheduledForDate = ${isScheduled}`);
                return isScheduled;
              })
              .filter(task => {
                const [startHour] = task.start_time!.split(':').map(Number);
                const currentHour = new Date().getHours();
                const isEarlyMorning = startHour >= 0 && startHour < 6;
                const isCurrentTimeInEarlyMorning = currentHour >= 0 && currentHour < 6;
                const shouldShow = !(isEarlyMorning && !isCurrentTimeInEarlyMorning);
                console.log(`Task ${task.title}: early morning filter = ${shouldShow} (startHour: ${startHour}, currentHour: ${currentHour})`);
                return shouldShow;
              });
              
            console.log('Visible blocks after filtering:', visibleBlocks.map(t => ({
              id: t.id,
              title: t.title,
              is_done: t.is_done,
              completion_status: t.completion_status
            })));
            console.log('=== END DEBUG ===');
            
            // Group and assign columns
            const blocksWithCols = groupAndAssignColumns(visibleBlocks);
            return Object.values(blocksWithCols).map((task) => {
              const isCurrentTime = isTaskCurrent(task, currentDate);
              const [startHour, startMinute] = task.start_time!.split(':').map(Number);
              const [endHour, endMinute] = task.end_time!.split(':').map(Number);
              // Only render if block is in hourRange
              if (!Array.from({ length: 24 }, (_, h) => h).some(h => h === startHour || (startHour < h && endHour > h))) return null;
              const top = startHour * 60 + startMinute;
              const height = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
              // Calculate width and left offset for columns
              const colCount = task._colCount || 1;
              const width = colCount === 1 ? '100%' : `calc((100% - 0.5rem * ${colCount - 1}) / ${colCount})`;
              const left = colCount === 1 ? '0' : `calc((${width} + 0.5rem) * ${task._col})`;
              const isActive = activeTaskId === task.id;
              return (
                <div
                  key={task.id}
                  className={`col-start-2 z-30 p-2 sm:p-3 rounded border transition-colors flex flex-col justify-between overflow-visible absolute cursor-pointer
                    ${
                      task.completion_status === 'completed'
                        ? 'bg-green-900 border-green-600'
                        : isCurrentTime
                        ? 'border-orange-400 animate-gradient-slow'
                        : task.completion_status === 'failed'
                        ? 'bg-red-900 border-red-600'
                        : task.completion_status === 'skipped'
                        ? 'bg-red-900 border-red-600'
                        : isPastDue(task, currentDate)
                        ? 'animate-yellow-gradient bg-yellow-300 border-yellow-500 text-black opacity-80'
                        : 'bg-slate-700 border-slate-600'
                    }
                  `}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left,
                    width,
                    right: 'auto'
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    if (isActive) {
                      setActiveTaskId(null);
                      setMenuPosition(null);
                      setActiveMenuTaskId(null);
                    } else {
                      setActiveTaskId(task.id);
                      // Calculate position for the floating menu
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPosition({
                        x: rect.left,
                        y: rect.bottom + 4,
                        width: rect.width
                      });
                      setActiveMenuTaskId(task.id);
                    }
                  }}
                >
                  {/* Show details/buttons only if active or on desktop */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className={`text-xs sm:text-sm font-medium truncate
                      ${isCurrentTime ? 'text-orange-100' :
                        task.completion_status === 'completed' ? 'text-green-200' :
                        isPastDue(task, currentDate) ? 'text-gray-800' : 'text-gray-400'
                      }`}>
                      {task.title} <span className={`text-xs ${isPastDue(task, currentDate) ? 'text-gray-800' : 'text-gray-400'}`}>({formatTime(task.start_time!)} - {formatTime(task.end_time!)})</span>
                    </h4>
                    {isPastDue(task, currentDate) && (
                      <p className="text-xs mt-1 text-gray-800">Past due</p>
                    )}
                  </div>
                </div>
              );
            });
          })()}
          
          {/* Clickable overlay for adding a block to a specific hour */}
          {Array.from({ length: 24 }, (_, h) => {
            // Check if there are any time blocks in this hour
            const hasTimeBlocksInHour = getScheduledTasks()
              .some(task => {
                const [startHour] = task.start_time!.split(':').map(Number);
                const [endHour] = task.end_time!.split(':').map(Number);
                return (startHour <= h && endHour > h) || 
                       (startHour === h) || 
                       (endHour > h && startHour < h);
              });

            return (
              <div
                key={`click-${h}`}
                className={`col-start-2 absolute ${hasTimeBlocksInHour ? 'z-20' : 'z-40'}`}
                style={{ 
                  top: `${h * 60}px`,
                  height: '60px',
                  left: '0',
                  right: '0',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (!hasTimeBlocksInHour) {
                    setFormData(prev => ({
                      ...prev,
                      start_time: `${h.toString().padStart(2, '0')}:00`,
                      end_time: `${((h + 1) % 24).toString().padStart(2, '0')}:00`,
                    }));
                    setEditingTask(null);
                    setShowForm(true);
                  }
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Action Menu Portal */}
      {menuPosition && activeMenuTaskId && (() => {
        const task = getScheduledTasks().find(t => t.id === activeMenuTaskId);
        
        return createPortal(
          <div
            className="fixed bg-slate-800 border border-slate-600 rounded-md shadow-2xl p-2 z-[99999]"
            style={{
              left: menuPosition.x,
              top: menuPosition.y,
              width: menuPosition.width,
              minWidth: '120px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => {
                  if (task) updateTaskStatus(task.id, 'completed');
                  setMenuPosition(null);
                  setActiveMenuTaskId(null);
                  setActiveTaskId(null);
                }}
                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                  task?.completion_status === 'completed'
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                }`}
                title={task?.completion_status === 'completed' ? 'Click to unmark as completed' : 'Mark as completed'}
              >
                ✓
              </button>
              <button
                onClick={() => {
                  if (task) updateTaskStatus(task.id, 'failed');
                  setMenuPosition(null);
                  setActiveMenuTaskId(null);
                  setActiveTaskId(null);
                }}
                className={`w-6 h-6 rounded-full border flex items-center justify-center transition-colors ${
                  task?.completion_status === 'failed'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                }`}
                title={task?.completion_status === 'failed' ? 'Click to unmark as failed' : 'Mark as failed'}
              >
                ✕
              </button>
              <button
                onClick={() => {
                  if (task) handleEdit(task);
                  setMenuPosition(null);
                  setActiveMenuTaskId(null);
                  setActiveTaskId(null);
                }}
                className="w-6 h-6 rounded-full border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-colors"
                title="Edit time block"
              >
                ✎
              </button>
              <button
                onClick={() => {
                  if (task) handleDelete(task.id);
                  setMenuPosition(null);
                  setActiveMenuTaskId(null);
                  setActiveTaskId(null);
                }}
                className="w-6 h-6 rounded-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                title="Delete time block"
              >
                🗑️
              </button>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Goal Selector Modal - Moved outside form modal */}
      <GoalSelector
        goals={goals}
        values={values}
        isOpen={showGoalSelector}
        onClose={() => setShowGoalSelector(false)}
        onGoalSelect={handleGoalSelect}
        selectedGoalIds={selectedGoalId ? [selectedGoalId] : []}
        multiple={false}
      />

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">Delete Time Block</h3>
            <p className="text-slate-300 mb-6">Are you sure you want to delete this time block? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTaskToDelete(null);
                }}
                className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 