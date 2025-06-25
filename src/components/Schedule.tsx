import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Database } from '../types/database';
import GoalSelector from './GoalSelector';
import TimeDropdown from './TimeDropdown';

type TimeBlock = Database['public']['Tables']['time_blocks']['Row'];
type ScheduleCompletion = Database['public']['Tables']['schedule_completions']['Row'];
type Goal = Database['public']['Tables']['goals']['Row'];
type Value = Database['public']['Tables']['values']['Row'];

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
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom Days' },
  { value: 'once', label: 'One Time Event' },
];

export default function Schedule() {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [completions, setCompletions] = useState<ScheduleCompletion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    start_time: '09:00',
    end_time: '10:00',
    recur: 'daily',
    custom_days: [],
    event_date: new Date().toISOString().split('T')[0],
    goal_id: null as string | null,
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [goals, setGoals] = useState<Database['public']['Tables']['goals']['Row'][]>([]);
  const [values, setValues] = useState<Database['public']['Tables']['values']['Row'][]>([]);
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const lastStartTimeRef = useRef(formData.start_time);
  const [endTimeManuallyChanged, setEndTimeManuallyChanged] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeBlocks();
    fetchCompletions();
    fetchGoals();
    fetchValues();
  }, []);

  // Debug effect to track form state changes
  useEffect(() => {
    console.log('Form state changed - showForm:', showForm, 'editingBlock:', editingBlock);
  }, [showForm, editingBlock]);

  const fetchTimeBlocks = async () => {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*, task:tasks(*)')
      .order('start_time', { ascending: true });
    
    if (error) {
      // Fallback to old schema if new columns don't exist
      const { data: oldData, error: oldError } = await supabase
        .from('time_blocks')
        .select('*')
        .order('start_hour', { ascending: true });
      
      if (oldError) {
        console.error('Error fetching time blocks:', oldError);
      } else {
        // Convert old schema to new format
        const convertedData = (oldData || []).map(block => {
          // Calculate end time from old format
          const startHour = block.start_hour || 9;
          const durationM = block.duration_m || 60;
          const endHour = (startHour + Math.floor(durationM / 60)) % 24;
          const endMinute = durationM % 60;
          const calculatedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

          return {
            ...block,
            start_time: block.start_time || `${startHour.toString().padStart(2, '0')}:00`,
            end_time: block.end_time || calculatedEndTime,
            recur: block.recur || 'daily',
            custom_days: block.custom_days || null,
            event_date: block.event_date || null,
          };
        });
        setTimeBlocks(convertedData);
      }
    } else {
      // Convert any remaining old format blocks
      const convertedData = (data || []).map(block => {
        // Calculate end time from old format if needed
        let calculatedEndTime = block.end_time;
        if (!calculatedEndTime && block.start_hour !== undefined && block.duration_m !== undefined) {
          const startHour = block.start_hour || 9;
          const durationM = block.duration_m || 60;
          const endHour = (startHour + Math.floor(durationM / 60)) % 24;
          const endMinute = durationM % 60;
          calculatedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
        }

        return {
          ...block,
          start_time: block.start_time || `${(block.start_hour || 9).toString().padStart(2, '0')}:00`,
          end_time: calculatedEndTime || '10:00',
          recur: block.recur || 'daily',
          custom_days: block.custom_days || null,
          event_date: block.event_date || null,
        };
      });
      setTimeBlocks(convertedData);
    }
  };

  const fetchCompletions = async () => {
    const { data, error } = await supabase
      .from('schedule_completions')
      .select('*');
    
    if (error) {
      console.error('Error fetching completions:', error);
    } else {
      setCompletions(data || []);
    }
  };

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*');
    
    if (error) {
      console.error('Error fetching goals:', error);
    } else {
      setGoals(data || []);
    }
  };

  const fetchValues = async () => {
    const { data, error } = await supabase
      .from('values')
      .select('*');
    
    if (error) {
      console.error('Error fetching values:', error);
    } else {
      setValues(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const timeBlockData = {
      ...formData,
      custom_days: formData.recur === 'custom' ? formData.custom_days : null,
      event_date: formData.recur === 'once' ? formData.event_date : null,
      goal_id: formData.goal_id || null,
    };

    if (editingBlock) {
      // Update existing time block
      const { error } = await supabase
        .from('time_blocks')
        .update(timeBlockData)
        .eq('id', editingBlock.id);

      if (error) {
        console.error('Error updating time block:', error);
      } else {
        setFormData({
          title: '',
          start_time: '09:00',
          end_time: '10:00',
          recur: 'daily',
          custom_days: [],
          event_date: new Date().toISOString().split('T')[0],
          goal_id: null,
        });
        setEditingBlock(null);
        setSelectedGoalId(null);
        setShowForm(false);
        fetchTimeBlocks();
      }
    } else {
      // Create new task first
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([{ title: formData.title, is_done: false }])
        .select('id')
        .single();

      if (taskError || !taskData) {
        console.error('Error creating task:', taskError);
        return;
      }

      // Create new time block with task_id
      const { error } = await supabase
        .from('time_blocks')
        .insert([{ ...timeBlockData, task_id: taskData.id }]);

      if (error) {
        console.error('Error creating time block:', error);
      } else {
        setFormData({
          title: '',
          start_time: '09:00',
          end_time: '10:00',
          recur: 'daily',
          custom_days: [],
          event_date: new Date().toISOString().split('T')[0],
          goal_id: null,
        });
        setSelectedGoalId(null);
        setShowForm(false);
        fetchTimeBlocks();
      }
    }
  };

  const handleEdit = (timeBlock: TimeBlock) => {
    console.log('Edit clicked for time block:', timeBlock);
    console.log('Current showForm state:', showForm);
    console.log('Current editingBlock state:', editingBlock);
    
    // Calculate end time from old format if needed
    let calculatedEndTime = timeBlock.end_time;
    if (!calculatedEndTime && timeBlock.start_hour !== undefined && timeBlock.duration_m !== undefined) {
      const startHour = timeBlock.start_hour || 9;
      const durationM = timeBlock.duration_m || 60;
      const endHour = (startHour + Math.floor(durationM / 60)) % 24;
      const endMinute = durationM % 60;
      calculatedEndTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
    }
    
    setEditingBlock(timeBlock);
    setFormData({
      title: timeBlock.title,
      start_time: timeBlock.start_time || `${(timeBlock.start_hour || 9).toString().padStart(2, '0')}:00`,
      end_time: calculatedEndTime || '10:00',
      recur: timeBlock.recur || 'daily',
      custom_days: timeBlock.custom_days || [],
      event_date: timeBlock.event_date || new Date().toISOString().split('T')[0],
      goal_id: timeBlock.goal_id || null,
    });
    setSelectedGoalId(timeBlock.goal_id || null);
    setShowForm(true);
    
    console.log('After setting state - showForm should be true');
    console.log('Form data set to:', {
      title: timeBlock.title,
      start_time: timeBlock.start_time || `${(timeBlock.start_hour || 9).toString().padStart(2, '0')}:00`,
      end_time: calculatedEndTime || '10:00',
      recur: timeBlock.recur || 'daily',
    });
  };

  const handleDelete = async (timeBlockId: string) => {
    if (window.confirm('Are you sure you want to delete this time block?')) {
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', timeBlockId);

      if (error) {
        console.error('Error deleting time block:', error);
      } else {
        fetchTimeBlocks();
      }
    }
  };

  const handleCancel = () => {
    setFormData({
      title: '',
      start_time: '09:00',
      end_time: '10:00',
      recur: 'daily',
      custom_days: [],
      event_date: new Date().toISOString().split('T')[0],
      goal_id: null,
    });
    setEditingBlock(null);
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

  const getDaysForTimeBlock = (timeBlock: TimeBlock): number[] => {
    if (timeBlock.custom_days) {
      return timeBlock.custom_days;
    }
    
    switch (timeBlock.recur) {
      case 'daily': return [0, 1, 2, 3, 4, 5, 6];
      case 'weekdays': return [1, 2, 3, 4, 5];
      case 'weekly': return [1];
      default: return [];
    }
  };

  const getDayLabel = (days: number[]): string => {
    if (days.length === 0) return 'No days';
    if (days.length === 7) return 'Daily';
    if (days.length === 5 && days.every(d => d >= 1 && d <= 5)) return 'Weekdays';
    
    return days.map(day => DAYS_OF_WEEK.find(d => d.value === day)?.short).join(', ');
  };

  const isTimeBlockScheduledForDate = (timeBlock: TimeBlock, date: Date): boolean => {
    // Handle one-time events
    if (timeBlock.recur === 'once' && timeBlock.event_date) {
      // Compare only the date part (YYYY-MM-DD) for both
      const eventDateStr = new Date(timeBlock.event_date).toISOString().split('T')[0];
      const currentDateStr = date.toISOString().split('T')[0];
      return eventDateStr === currentDateStr;
    }
    const dayOfWeek = date.getDay();
    const days = getDaysForTimeBlock(timeBlock);
    return days.includes(dayOfWeek);
  };

  const isTimeBlockCurrent = (timeBlock: TimeBlock, date: Date): boolean => {
    const now = new Date();
    const today = new Date();
    
    // Check if it's the same day
    if (date.toDateString() !== today.toDateString()) {
      return false;
    }
    
    // Parse start and end times
    const [startHour, startMinute] = timeBlock.start_time.split(':').map(Number);
    const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
    
    const startTime = new Date(today);
    startTime.setHours(startHour, startMinute, 0, 0);
    
    const endTime = new Date(today);
    endTime.setHours(endHour, endMinute, 0, 0);
    
    // Handle overnight blocks (end time before start time)
    if (endTime < startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }
    
    return now >= startTime && now <= endTime;
  };

  const getCompletionStatus = (timeBlockId: string, date: Date): ScheduleCompletion | null => {
    const dateStr = date.toISOString().split('T')[0];
    return completions.find(c => c.time_block_id === timeBlockId && c.date === dateStr) || null;
  };

  const handleCompletion = async (timeBlockId: string, date: Date, status: 'completed' | 'skipped' | 'failed') => {
    const dateStr = date.toISOString().split('T')[0];
    
    // Check if completion already exists
    const existingCompletion = getCompletionStatus(timeBlockId, date);
    
    if (existingCompletion) {
      // Update existing completion
      const { error } = await supabase
        .from('schedule_completions')
        .update({ status })
        .eq('id', existingCompletion.id);
      
      if (error) {
        console.error('Error updating completion:', error);
        return;
      }
    } else {
      // Create new completion
      const { error } = await supabase
        .from('schedule_completions')
        .insert([{
          time_block_id: timeBlockId,
          date: dateStr,
          status,
        }]);
      
      if (error) {
        console.error('Error creating completion:', error);
        return;
      }
    }

    // If completed, also mark the associated task as done
    if (status === 'completed') {
      const timeBlock = timeBlocks.find(tb => tb.id === timeBlockId);
      if (timeBlock && timeBlock.task_id) {
        const { error: taskError } = await supabase
          .from('tasks')
          .update({ is_done: true })
          .eq('id', timeBlock.task_id);
        if (taskError) {
          console.error('Error updating task as done:', taskError);
        }
      }
    }

    fetchCompletions();
    fetchTimeBlocks();
  };

  const getWeekDates = (date: Date): Date[] => {
    // Return only the current day
    return [date];
  };

  const weekDates = getWeekDates(currentDate);

  const handleGoalSelect = (goalIds: string[]) => {
    const goalId = goalIds.length > 0 ? goalIds[0] : null;
    setSelectedGoalId(goalId);
    setFormData(prev => ({ ...prev, goal_id: goalId }));
    setShowGoalSelector(false);
  };

  const getSelectedGoalName = () => {
    if (!selectedGoalId) return '';
    const goal = goals.find(g => g.id === selectedGoalId);
    return goal ? goal.name : '';
  };

  // Format time as HH:mm
  const formatTime = (t: string) => t.slice(0, 5);

  // Helper to group overlapping events and assign columns
  function groupAndAssignColumns(blocks) {
    // Convert time to minutes for easier comparison
    function toMinutes(t) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    }
    // Sort by start time
    const sorted = [...blocks].sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    const groups = [];
    let currentGroup = [];
    let lastEnd = -1;
    for (const block of sorted) {
      const start = toMinutes(block.start_time);
      const end = toMinutes(block.end_time);
      if (currentGroup.length === 0 || start < lastEnd) {
        currentGroup.push(block);
        lastEnd = Math.max(lastEnd, end);
      } else {
        groups.push(currentGroup);
        currentGroup = [block];
        lastEnd = end;
      }
    }
    if (currentGroup.length) groups.push(currentGroup);
    // Assign columns within each group
    const result = [];
    for (const group of groups) {
      if (group.length === 1) {
        result.push({ ...group[0], _col: 0, _colCount: 1 });
      } else {
        // For each event, assign a column so that no two overlapping events share a column
        const cols = [];
        for (let i = 0; i < group.length; i++) {
          let col = 0;
          while (cols.some((c, idx) => idx !== i && c === col &&
            !(toMinutes(group[i].end_time) <= toMinutes(group[idx].start_time) ||
              toMinutes(group[i].start_time) >= toMinutes(group[idx].end_time)))) {
            col++;
          }
          cols[i] = col;
        }
        for (let i = 0; i < group.length; i++) {
          result.push({ ...group[i], _col: cols[i], _colCount: group.length });
        }
      }
    }
    return result;
  }

  // Determine which hours to display
  const earlyEventExists = timeBlocks.some(tb => {
    const [startHour] = tb.start_time.split(':').map(Number);
    const [endHour] = tb.end_time.split(':').map(Number);
    return (
      (startHour < 6 && isTimeBlockScheduledForDate(tb, currentDate)) ||
      (endHour > 0 && endHour <= 6 && isTimeBlockScheduledForDate(tb, currentDate))
    );
  });
  const currentHour = new Date().getHours();
  const showEarly = earlyEventExists || currentHour < 6;
  const hourRange = showEarly ? Array.from({ length: 24 }, (_, h) => h) : Array.from({ length: 18 }, (_, h) => h + 6);

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
                {editingBlock ? 'Edit Time Block' : 'Add New Time Block'}
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-gray-400 hover:text-white text-2xl font-bold"
              >
                ×
              </button>
            </div>
            {console.log('Rendering form with showForm:', showForm, 'editingBlock:', editingBlock)}
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
                  onChange={(e) => setFormData({ ...formData, recur: e.target.value })}
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
                  {editingBlock ? 'Update Time Block' : 'Add Time Block'}
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
            {currentDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h2>
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            <button
              onClick={() => {
                const prev = new Date(currentDate);
                prev.setDate(prev.getDate() - 1);
                setCurrentDate(prev);
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors text-sm"
            >
              &lt;
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded transition-colors text-sm"
            >
              Today
            </button>
            <button
              onClick={() => {
                const next = new Date(currentDate);
                next.setDate(next.getDate() + 1);
                setCurrentDate(next);
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors text-sm"
            >
              &gt;
            </button>
          </div>
        </div>
        {/* Schedule grid: 24 rows (one per hour), hour labels fixed, blocks span rows */}
        <div className="grid grid-cols-[4rem_1fr]" style={{ gridTemplateRows: `repeat(${hourRange.length}, 60px)`, position: 'relative' }}>
          {/* Hour labels */}
          {hourRange.map(hour => (
            <div
              key={`label-${hour}`}
              className="col-start-1 row-start-[auto] flex items-center justify-end pr-2 select-none"
              style={{ gridRow: hour - (showEarly ? 0 : 6) + 1, zIndex: 2 }}
            >
              <span className="text-xs sm:text-sm text-gray-400 font-mono">{`${hour.toString().padStart(2, '0')}:00`}</span>
            </div>
          ))}
          {/* Full-width hour lines */}
          {hourRange.map(hour => (
            <div
              key={`line-${hour}`}
              className="col-span-2 absolute left-0 right-0 border-b border-slate-700 pointer-events-none"
              style={{ top: `${(hour - (showEarly ? 0 : 6)) * 60}px`, height: 0, zIndex: 1 }}
            />
          ))}
          {/* Time blocks with improved overlap grouping and column assignment */}
          {(() => {
            // Get all visible blocks
            const visibleBlocks = timeBlocks
              .filter(timeBlock => isTimeBlockScheduledForDate(timeBlock, currentDate))
              .filter(timeBlock => {
                const [startHour] = timeBlock.start_time.split(':').map(Number);
                const currentHour = new Date().getHours();
                const isEarlyMorning = startHour >= 0 && startHour < 6;
                const isCurrentTimeInEarlyMorning = currentHour >= 0 && currentHour < 6;
                if (isEarlyMorning && !isCurrentTimeInEarlyMorning) {
                  return false;
                }
                return true;
              });
            // Group and assign columns
            const blocksWithCols = groupAndAssignColumns(visibleBlocks);
            return blocksWithCols.map((timeBlock, i) => {
              const completion = getCompletionStatus(timeBlock.id, currentDate);
              const isCurrentTime = isTimeBlockCurrent(timeBlock, currentDate);
              const [startHour, startMinute] = timeBlock.start_time.split(':').map(Number);
              const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
              // Only render if block is in hourRange
              if (!hourRange.some(h => h === startHour || (startHour < h && endHour > h))) return null;
              const top = ((startHour - (showEarly ? 0 : 6)) * 60) + startMinute;
              const height = ((endHour * 60 + endMinute) - (startHour * 60 + startMinute));
              // Calculate width and left offset for columns
              const colCount = timeBlock._colCount || 1;
              const width = colCount === 1 ? '100%' : `calc((100% - 0.5rem * ${colCount - 1}) / ${colCount})`;
              const left = colCount === 1 ? '0' : `calc((${width} + 0.5rem) * ${timeBlock._col})`;
              const isActive = activeBlockId === timeBlock.id;
              return (
                <div
                  key={timeBlock.id}
                  className={`col-start-2 z-10 p-2 sm:p-3 rounded border transition-colors flex flex-col justify-between overflow-visible absolute cursor-pointer
                    ${
                      (completion?.status === 'completed' || timeBlock.task?.is_done)
                        ? 'bg-green-900 border-green-600'
                        : isCurrentTime
                        ? 'border-orange-400 animate-gradient-slow'
                        : completion?.status === 'failed'
                        ? 'bg-red-900 border-red-600'
                        : completion?.status === 'skipped'
                        ? 'bg-red-900 border-red-600'
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
                    setActiveBlockId(isActive ? null : timeBlock.id);
                  }}
                >
                  {/* Show details/buttons only if active or on desktop */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className={`text-xs sm:text-sm font-medium truncate ${
                      isCurrentTime ? 'text-orange-100' :
                      completion?.status === 'completed' || timeBlock.task?.is_done ? 'text-green-200' :
                      'text-gray-300'
                    }`}>
                      {timeBlock.task?.title || timeBlock.title} <span className="text-xs text-gray-400">({formatTime(timeBlock.start_time)} - {formatTime(timeBlock.end_time)})</span>
                    </h4>
                    {(completion?.status === 'completed' || timeBlock.task?.is_done) && (
                      <p className="text-xs mt-1 text-green-400">✓ Completed</p>
                    )}
                  </div>
                  {/* Action buttons: show if active or on desktop */}
                  {(isActive || window.innerWidth >= 640) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        onClick={e => { e.stopPropagation(); handleCompletion(timeBlock.id, currentDate, 'completed'); }}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          completion?.status === 'completed'
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                        }`}
                        title="Mark as completed"
                      >
                        ✓
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleCompletion(timeBlock.id, currentDate, 'failed'); }}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          completion?.status === 'failed'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                        }`}
                        title="Mark as failed"
                      >
                        ✕
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleEdit(timeBlock); }}
                        className="w-5 h-5 rounded-full border border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-colors"
                        title="Edit time block"
                      >
                        ✎
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(timeBlock.id); }}
                        className="w-5 h-5 rounded-full border border-red-500 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                        title="Delete time block"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            });
          })()}
          {/* Clickable overlay for adding a block to a specific hour */}
          {hourRange.map(hour => (
            <div
              key={`click-${hour}`}
              className="col-start-2 z-0"
              style={{ gridRow: hour - (showEarly ? 0 : 6) + 1, height: '60px', position: 'relative', cursor: 'pointer' }}
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  start_time: `${hour.toString().padStart(2, '0')}:00`,
                  end_time: `${((hour + 1) % 24).toString().padStart(2, '0')}:00`,
                }));
                setEditingBlock(null);
                setShowForm(true);
              }}
            />
          ))}
        </div>
      </div>

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
    </div>
  );
} 