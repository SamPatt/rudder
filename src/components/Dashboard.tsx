import { useState, useEffect, useRef } from 'react';
import { Task, Goal, TimeBlock, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';
import { getValueIcon } from '../lib/valueIcons';
import type { Database } from '../types/database';
type TimeBlockRow = Database['public']['Tables']['time_blocks']['Row'];

interface DashboardProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  timeBlocks: TimeBlock[];
  setTasks: (tasks: Task[]) => void;
}

type ScheduleCompletion = {
  id: string;
  time_block_id: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
  created_at: string;
};

export default function Dashboard({ tasks, goals, values, timeBlocks, setTasks }: DashboardProps) {
  const [currentTimeBlock, setCurrentTimeBlock] = useState<TimeBlockRow | null>(null);
  const [previousTimeBlock, setPreviousTimeBlock] = useState<TimeBlockRow | null>(null);
  const [nextTimeBlock, setNextTimeBlock] = useState<TimeBlockRow | null>(null);
  const [completions, setCompletions] = useState<ScheduleCompletion[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hiddenBlockIds, setHiddenBlockIds] = useState<string[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const taskTitleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCompletions();
    updateCurrentTimeBlock();
    const interval = setInterval(() => {
      updateCurrentTimeBlock();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timeBlocks]);

  // Refetch tasks when mounted or when a task is toggled
  useEffect(() => {
    const fetchTasks = async () => {
      setTasksLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select(`*, task_goals (*, goal:goals (*, value:values (*)))`)
        .order('created_at', { ascending: false });
      if (!error && data) setTasks(data);
      setTasksLoading(false);
    };
    fetchTasks();
  }, []);

  const fetchCompletions = async () => {
    setCompletionsLoading(true);
    const { data, error } = await supabase
      .from('schedule_completions')
      .select('*');
    
    if (error) {
      console.error('Error fetching completions:', error);
      setCompletions([]);
    } else {
      setCompletions(data || []);
    }
    setCompletionsLoading(false);
  };

  const updateCurrentTimeBlock = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const todayStr = now.toISOString().split('T')[0];

    console.log('updateCurrentTimeBlock - all time blocks:', timeBlocks.map(tb => ({
      title: tb.title,
      recur: tb.recur,
      start_time: tb.start_time,
      end_time: tb.end_time
    })));

    // Use the isScheduledForToday function to filter blocks
    const todaysBlocks: TimeBlockRow[] = timeBlocks.filter(block => isScheduledForToday(block))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    console.log('updateCurrentTimeBlock - todays blocks:', todaysBlocks.map(tb => ({
      title: tb.title,
      recur: tb.recur,
      start_time: tb.start_time,
      end_time: tb.end_time
    })));

    const currentMinutes = currentHour * 60 + currentMinute;
    let previousBlock: TimeBlockRow | null = null;
    let currentBlock: TimeBlockRow | null = null;
    let nextBlock: TimeBlockRow | null = null;

    for (let i = 0; i < todaysBlocks.length; i++) {
      const block = todaysBlocks[i];
      const [startHour, startMinute] = block.start_time.split(':').map(Number);
      const [endHour, endMinute] = block.end_time.split(':').map(Number);
      const blockStartMinutes = startHour * 60 + startMinute;
      const blockEndMinutes = endHour * 60 + endMinute;

      if (currentMinutes >= blockStartMinutes && currentMinutes < blockEndMinutes) {
        currentBlock = block;
      }
      if (blockEndMinutes <= currentMinutes) {
        // Find the most recent previous block (closest to current time)
        if (!previousBlock || blockEndMinutes > (() => {
          const [prevEndHour, prevEndMinute] = previousBlock.end_time.split(':').map(Number);
          return prevEndHour * 60 + prevEndMinute;
        })()) {
          previousBlock = block;
        }
      }
    }

    // Find the next block (smallest start time after now)
    nextBlock = todaysBlocks.find(block => {
      const [startHour, startMinute] = block.start_time.split(':').map(Number);
      const blockStartMinutes = startHour * 60 + startMinute;
      return blockStartMinutes > currentMinutes;
    }) || null;

    console.log('updateCurrentTimeBlock - selected blocks:', {
      previous: previousBlock?.title,
      current: currentBlock?.title,
      next: nextBlock?.title,
      currentMinutes
    });

    setPreviousTimeBlock(previousBlock);
    setCurrentTimeBlock(currentBlock);
    setNextTimeBlock(nextBlock);
  };

  const getCompletionStatus = (timeBlockId: string): ScheduleCompletion | null => {
    const today = new Date().toISOString().split('T')[0];
    return completions.find(c => c.time_block_id === timeBlockId && c.date === today) || null;
  };

  // Helper function to get the days a time block is scheduled for
  const getDaysForTimeBlock = (timeBlock: TimeBlockRow): number[] => {
    if (timeBlock.custom_days) {
      return timeBlock.custom_days;
    }
    
    switch (timeBlock.recur) {
      case 'daily': return [0, 1, 2, 3, 4, 5, 6];
      case 'weekdays': return [1, 2, 3, 4, 5];
      case 'weekly': return [1]; // Monday
      default: return [];
    }
  };

  // Helper function to check if a time block is scheduled for today
  const isScheduledForToday = (timeBlock: TimeBlockRow): boolean => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    // Debug logging
    console.log('Checking if scheduled for today:', timeBlock.title, {
      recur: timeBlock.recur,
      dayOfWeek,
      custom_days: timeBlock.custom_days,
      event_date: timeBlock.event_date
    });
    
    // Handle one-time events
    if (timeBlock.recur === 'once' && timeBlock.event_date) {
      const eventDate = new Date(timeBlock.event_date);
      const todayStr = today.toISOString().split('T')[0];
      const eventDateStr = eventDate.toISOString().split('T')[0];
      const isScheduled = todayStr === eventDateStr;
      console.log('One-time event check:', timeBlock.title, { todayStr, eventDateStr, isScheduled });
      return isScheduled;
    }
    
    // For recurring events, check if today's day of week is in the scheduled days
    const days = getDaysForTimeBlock(timeBlock);
    const isScheduled = days.includes(dayOfWeek);
    console.log('Recurring event check:', timeBlock.title, { days, dayOfWeek, isScheduled });
    return isScheduled;
  };

  function isPastDueIncomplete(block: TimeBlockRow | null): boolean {
    if (!block) return false;
    
    // Debug logging
    console.log('Checking if past due:', block.title, {
      recur: block.recur,
      start_time: block.start_time,
      end_time: block.end_time,
      isScheduledForToday: isScheduledForToday(block)
    });
    
    // Check if the block is scheduled for today
    if (!isScheduledForToday(block)) {
      console.log('Block not scheduled for today:', block.title);
      return false;
    }
    
    const completion = getCompletionStatus(block.id);
    if (completion && ['completed', 'failed', 'skipped'].includes(completion.status)) {
      console.log('Block has completion status:', block.title, completion.status);
      return false;
    }
    
    const now = new Date();
    const [endHour, endMinute] = block.end_time.split(':').map(Number);
    const endTime = new Date();
    endTime.setHours(endHour, endMinute, 0, 0);
    const isPastDue = now > endTime;
    
    console.log('Past due check result:', block.title, {
      now: now.toLocaleTimeString(),
      endTime: endTime.toLocaleTimeString(),
      isPastDue
    });
    
    return isPastDue;
  }

  const handleCompletion = async (timeBlockId: string, status: 'completed' | 'skipped' | 'failed') => {
    if (previousTimeBlock && previousTimeBlock.id === timeBlockId && isPastDueIncomplete(previousTimeBlock)) {
      setAnimatingOutId(timeBlockId);
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = setTimeout(() => {
        setAnimatingOutId(null);
        setHiddenBlockIds(ids => [...ids, timeBlockId]);
        actuallyHandleCompletion(timeBlockId, status);
      }, 400); // 400ms fade out
      return;
    }
    actuallyHandleCompletion(timeBlockId, status);
  };

  const actuallyHandleCompletion = async (timeBlockId: string, status: 'completed' | 'skipped' | 'failed') => {
    const today = new Date().toISOString().split('T')[0];
    const existingCompletion = getCompletionStatus(timeBlockId);
    
    // If clicking the same status that's already active, reset it (delete the completion)
    if (existingCompletion && existingCompletion.status === status) {
      const { error } = await supabase
        .from('schedule_completions')
        .delete()
        .eq('id', existingCompletion.id);
      if (error) {
        console.error('Error deleting completion:', error);
        return;
      }
    } else if (existingCompletion) {
      // Update existing completion to new status
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
        .insert([{ time_block_id: timeBlockId, date: today, status }]);
      if (error) {
        console.error('Error creating completion:', error);
        return;
      }
    }
    
    if (status === 'completed') {
      const timeBlock = timeBlocks.find(tb => tb.id === timeBlockId);
      if (timeBlock) {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{ 
            title: `${timeBlock.title} (${timeBlock.start_time} - ${timeBlock.end_time})`, 
            is_done: true,
            date: today
          }]);
        if (taskError) {
          console.error('Error creating task:', taskError);
        }
      }
    }
    fetchCompletions();
  };

  const getBlockStatusColor = (timeBlock: TimeBlockRow) => {
    const completion = getCompletionStatus(timeBlock.id);
    if (!completion) {
      // Only show past due if the block is scheduled for today
      if (isScheduledForToday(timeBlock)) {
        const now = new Date();
        const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
        const endTime = new Date();
        endTime.setHours(endHour, endMinute, 0, 0);
        if (now > endTime) {
          return 'animate-yellow-gradient bg-yellow-300 border-yellow-500 text-black opacity-80'; // Brighter yellow, animated, de-emphasized
        }
      }
      return 'bg-slate-700 border-slate-600'; // Future or current
    }
    
    switch (completion.status) {
      case 'completed':
        return 'bg-green-900 border-green-600';
      case 'failed':
        return 'bg-red-900 border-red-600';
      case 'skipped':
        return 'bg-red-900 border-red-600';
      default:
        return 'bg-slate-700 border-slate-600';
    }
  };

  const getBlockStatusText = (timeBlock: TimeBlockRow) => {
    const completion = getCompletionStatus(timeBlock.id);
    if (!completion) {
      // Only show past due if the block is scheduled for today
      if (isScheduledForToday(timeBlock)) {
        const now = new Date();
        const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
        const endTime = new Date();
        endTime.setHours(endHour, endMinute, 0, 0);
        
        if (now > endTime) {
          return 'Past due';
        }
      }
      return '';
    }
    
    switch (completion.status) {
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'skipped':
        return 'Skipped';
      default:
        return '';
    }
  };

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
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: newTaskTitle,
          is_done: false,
          is_recurring: isRecurring,
          recur_type: isRecurring ? recurType : null,
          custom_days: isRecurring && recurType === 'custom' ? customDays : null,
          date: taskDate,
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
      setSelectedGoalId('');
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

  const incompleteTasks = tasks.filter(task => !task.is_done);

  const getSelectedGoalNames = () => {
    if (!selectedGoalId) return '';
    const goal = goals.find(g => g.id === selectedGoalId);
    if (!goal) return '';
    
    // Find the value for this goal
    const value = values.find(v => v.id === goal.value_id);
    const valueIcon = value ? getValueIcon(value.name) : '🎯';
    return `${valueIcon} ${goal.name}`;
  };

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

  // Helper functions to organize tasks
  const getDailyTasks = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    return tasks.filter(task => {
      // Only show recurring tasks that are not done
      if (!task.is_recurring || task.is_done) return false;
      
      // Check if the task is scheduled for today based on its recurrence pattern
      if (task.recur_type === 'daily') return true;
      if (task.recur_type === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) return true;
      if (task.recur_type === 'weekly' && task.custom_days && task.custom_days.includes(dayOfWeek)) return true;
      if (task.recur_type === 'custom' && task.custom_days && task.custom_days.includes(dayOfWeek)) return true;
      
      return false;
    });
  };

  const getTodaysTasks = () => {
    return tasks.filter(task => !task.is_recurring && !task.is_done);
  };

  const getCompletedTasks = () => {
    return tasks.filter(task => task.is_done);
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

  // Add a 12-hour time formatter for the dashboard
  const formatTime = (t: string) => {
    if (!t) return '';
    let [hour, minute] = t.split(':').map(Number);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, '0')} ${ampm}`;
  };

  // When timeBlocks change (e.g., after deletion), remove any hiddenBlockIds that no longer exist
  useEffect(() => {
    setHiddenBlockIds(ids => ids.filter(id => timeBlocks.some(tb => tb.id === id)));
  }, [timeBlocks]);

  // Only show previous/current/next cards if the block exists in timeBlocks and is not hidden
  const blockExists = (block: TimeBlockRow | null) => block && timeBlocks.some(tb => tb.id === block.id);

  // Focus the input when expanding
  useEffect(() => {
    if (showQuickAdd && taskTitleInputRef.current) {
      taskTitleInputRef.current.focus();
    }
  }, [showQuickAdd]);

  // Helper function to get all past due blocks for today
  const getPastDueBlocks = (): TimeBlockRow[] => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    return timeBlocks.filter(block => {
      // Check if scheduled for today
      if (!isScheduledForToday(block)) return false;
      
      // Check if it has a completion status
      const completion = getCompletionStatus(block.id);
      if (completion && ['completed', 'failed', 'skipped'].includes(completion.status)) return false;
      
      // Check if it's past the end time
      const [endHour, endMinute] = block.end_time.split(':').map(Number);
      const blockEndMinutes = endHour * 60 + endMinute;
      return currentMinutes > blockEndMinutes;
    });
  };

  // Update the past due checking to use all past due blocks
  useEffect(() => {
    const pastDueBlocks = getPastDueBlocks();
    console.log('Past due blocks found:', pastDueBlocks.map(b => b.title));
    
    // Check if any of the past due blocks should be shown
    pastDueBlocks.forEach(block => {
      console.log('Checking past due block:', block.title, {
        end_time: block.end_time,
        isPastDue: isPastDueIncomplete(block)
      });
    });
  }, [timeBlocks, completions]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time Blocks Overview - Only show up to three cards, no header */}
      {!completionsLoading && (previousTimeBlock || currentTimeBlock || nextTimeBlock) && (
        <div className="space-y-3">
          {/* Previous Time Block */}
          {isPastDueIncomplete(previousTimeBlock) && previousTimeBlock && previousTimeBlock.id !== animatingOutId && !hiddenBlockIds.includes(previousTimeBlock.id) && blockExists(previousTimeBlock) && (
            <div className={`p-3 sm:p-4 rounded-lg border ${getBlockStatusColor(previousTimeBlock)} transition-opacity duration-400 ${animatingOutId === previousTimeBlock.id ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-base sm:text-lg font-medium truncate
                    ${getBlockStatusColor(previousTimeBlock).includes('yellow') ? 'text-black' : 'text-slate-300'}`}>{previousTimeBlock.title}</h4>
                  <p className={`text-sm ${getBlockStatusColor(previousTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-gray-500'}`}>
                    {formatTime(previousTimeBlock.start_time)} - {formatTime(previousTimeBlock.end_time)}
                  </p>
                  {getBlockStatusText(previousTimeBlock) && (
                    <p className={`text-xs mt-1 ${getBlockStatusColor(previousTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-gray-400'}`}>{getBlockStatusText(previousTimeBlock)}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => handleCompletion(previousTimeBlock.id, 'completed')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(previousTimeBlock.id)?.status === 'completed'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(previousTimeBlock.id)?.status === 'completed' ? 'Click to unmark as completed' : 'Mark as completed'}
                  >
                    {getCompletionStatus(previousTimeBlock.id)?.status === 'completed' && '✓'}
                  </button>
                  <button
                    onClick={() => handleCompletion(previousTimeBlock.id, 'failed')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(previousTimeBlock.id)?.status === 'failed'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(previousTimeBlock.id)?.status === 'failed' ? 'Click to unmark as failed' : 'Mark as failed'}
                  >
                    {getCompletionStatus(previousTimeBlock.id)?.status === 'failed' && '✕'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Time Block - use same color/animation as schedule */}
          {currentTimeBlock && blockExists(currentTimeBlock) && !hiddenBlockIds.includes(currentTimeBlock.id) && (
            <div className="border-orange-400 animate-gradient-slow bg-slate-800 border rounded-lg p-3 sm:p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-lg sm:text-xl font-medium truncate
                    ${getBlockStatusColor(currentTimeBlock).includes('yellow') ? 'text-black' : 'text-orange-100'}`}>{currentTimeBlock.title}</h4>
                  <p className={`text-sm ${getBlockStatusColor(currentTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-orange-200'}`}>
                    {formatTime(currentTimeBlock.start_time)} - {formatTime(currentTimeBlock.end_time)}
                  </p>
                  {getBlockStatusText(currentTimeBlock) && (
                    <p className={`text-xs mt-1 ${getBlockStatusColor(currentTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-orange-200'}`}>{getBlockStatusText(currentTimeBlock)}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => handleCompletion(currentTimeBlock.id, 'completed')}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(currentTimeBlock.id)?.status === 'completed'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(currentTimeBlock.id)?.status === 'completed' ? 'Click to unmark as completed' : 'Mark as completed'}
                  >
                    {getCompletionStatus(currentTimeBlock.id)?.status === 'completed' && '✓'}
                  </button>
                  <button
                    onClick={() => handleCompletion(currentTimeBlock.id, 'failed')}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(currentTimeBlock.id)?.status === 'failed'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(currentTimeBlock.id)?.status === 'failed' ? 'Click to unmark as failed' : 'Mark as failed'}
                  >
                    {getCompletionStatus(currentTimeBlock.id)?.status === 'failed' && '✕'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Next Time Block (if still today) */}
          {nextTimeBlock && blockExists(nextTimeBlock) && !hiddenBlockIds.includes(nextTimeBlock.id) && (
            <div className={`p-3 sm:p-4 rounded-lg border ${getBlockStatusColor(nextTimeBlock)}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className={`text-base sm:text-lg font-medium truncate
                    ${getBlockStatusColor(nextTimeBlock).includes('yellow') ? 'text-black' : 'text-slate-200'}`}>{nextTimeBlock.title}</h4>
                  <p className={`text-sm ${getBlockStatusColor(nextTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-gray-400'}`}>
                    {formatTime(nextTimeBlock.start_time)} - {formatTime(nextTimeBlock.end_time)}
                  </p>
                  {getBlockStatusText(nextTimeBlock) && (
                    <p className={`text-xs mt-1 ${getBlockStatusColor(nextTimeBlock).includes('yellow') ? 'text-gray-800' : 'text-gray-300'}`}>{getBlockStatusText(nextTimeBlock)}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-2 flex-shrink-0">
                  <button
                    onClick={() => handleCompletion(nextTimeBlock.id, 'completed')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(nextTimeBlock.id)?.status === 'completed'
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'border-green-500 text-green-500 hover:bg-green-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(nextTimeBlock.id)?.status === 'completed' ? 'Click to unmark as completed' : 'Mark as completed'}
                  >
                    {getCompletionStatus(nextTimeBlock.id)?.status === 'completed' && '✓'}
                  </button>
                  <button
                    onClick={() => handleCompletion(nextTimeBlock.id, 'failed')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      getCompletionStatus(nextTimeBlock.id)?.status === 'failed'
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
                    }`}
                    title={getCompletionStatus(nextTimeBlock.id)?.status === 'failed' ? 'Click to unmark as failed' : 'Mark as failed'}
                  >
                    {getCompletionStatus(nextTimeBlock.id)?.status === 'failed' && '✕'}
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
              {selectedGoalId && (
                <div className="p-2 bg-forest-900 border border-forest-600 rounded-md">
                  <p className="text-sm text-forest-200">
                    <span className="font-medium">Selected goal:</span> {getSelectedGoalNames()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tasks List */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        
        {/* Frequent Tasks Section */}
        {getDailyTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-forest-300 mb-3 flex items-center">
              <span className="mr-2">🔄</span>
              Frequent
            </h3>
            <div className="space-y-2">
              {getDailyTasks().map(task => (
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
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* To-do list Section */}
        {getTodaysTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-slate-300 mb-3 flex items-center">
              <span className="mr-2">📝</span>
              To-do list
            </h3>
            <div className="space-y-2">
              {getTodaysTasks().map(task => (
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
        {tasks.length > 0 && getDailyTasks().length === 0 && getTodaysTasks().length === 0 && (
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