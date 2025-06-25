import { useState, useEffect } from 'react';
import { Task, Goal, TimeBlock, Value } from '../types/database';
import { supabase } from '../lib/supabase';
import GoalSelector from './GoalSelector';

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
  const [currentTimeBlock, setCurrentTimeBlock] = useState<TimeBlock | null>(null);
  const [previousTimeBlock, setPreviousTimeBlock] = useState<TimeBlock | null>(null);
  const [nextTimeBlock, setNextTimeBlock] = useState<TimeBlock | null>(null);
  const [completions, setCompletions] = useState<ScheduleCompletion[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);

  useEffect(() => {
    fetchCompletions();
    updateCurrentTimeBlock();
    const interval = setInterval(() => {
      updateCurrentTimeBlock();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [timeBlocks]);

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

  const updateCurrentTimeBlock = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const today = new Date().toDateString();

    // Convert time blocks to new format if needed
    const convertedBlocks = timeBlocks.map(block => {
      if (block.start_time && block.end_time) {
        return block;
      }
      // Convert old format to new format
      const [startHour, startMinute] = block.start_time ? block.start_time.split(':').map(Number) : [block.start_hour, 0];
      const endTime = block.end_time || `${((block.start_hour + Math.floor(block.duration_m / 60)) % 24).toString().padStart(2, '0')}:${(block.duration_m % 60).toString().padStart(2, '0')}`;
      
      return {
        ...block,
        start_time: `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`,
        end_time: endTime
      };
    });

    // Get today's scheduled blocks
    const todaysBlocks = convertedBlocks.filter(block => {
      if (block.recur === 'daily') return true;
      if (block.recur === 'weekdays' && dayOfWeek >= 1 && dayOfWeek <= 5) return true;
      if (block.recur === 'weekly' && dayOfWeek === 1) return true;
      if (block.custom_days && block.custom_days.includes(dayOfWeek)) return true;
      return false;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));

    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    let currentBlock = null;
    let previousBlock = null;
    let nextBlock = null;

    // Find current, previous, and next blocks
    for (let i = 0; i < todaysBlocks.length; i++) {
      const block = todaysBlocks[i];
      const [startHour, startMinute] = block.start_time.split(':').map(Number);
      const [endHour, endMinute] = block.end_time.split(':').map(Number);
      
      const blockStartMinutes = startHour * 60 + startMinute;
      const blockEndMinutes = endHour * 60 + endMinute;
      const currentMinutes = currentHour * 60 + currentMinute;
      
      if (currentMinutes >= blockStartMinutes && currentMinutes <= blockEndMinutes) {
        // Current block
        currentBlock = block;
        if (i > 0) previousBlock = todaysBlocks[i - 1];
        if (i < todaysBlocks.length - 1) nextBlock = todaysBlocks[i + 1];
        break;
      } else if (currentMinutes < blockStartMinutes) {
        // Future block - this is the next block
        nextBlock = block;
        if (i > 0) previousBlock = todaysBlocks[i - 1];
        break;
      } else {
        // Past block - keep track of the most recent one
        previousBlock = block;
      }
    }

    // If no current block found, the last block we saw is the previous one
    if (!currentBlock && !nextBlock && previousBlock) {
      // Check if the previous block ended today (not yesterday)
      const [prevEndHour, prevEndMinute] = previousBlock.end_time.split(':').map(Number);
      const prevEndMinutes = prevEndHour * 60 + prevEndMinute;
      const currentMinutes = currentHour * 60 + currentMinute;
      
      // Only show as previous if it ended within the last 24 hours
      if (currentMinutes - prevEndMinutes <= 24 * 60) {
        // Previous block is valid, look for next block
        const nextBlockIndex = todaysBlocks.findIndex(block => 
          block.id === previousBlock.id
        ) + 1;
        if (nextBlockIndex < todaysBlocks.length) {
          nextBlock = todaysBlocks[nextBlockIndex];
        }
      } else {
        // Previous block is too old, don't show it
        previousBlock = null;
      }
    }

    setCurrentTimeBlock(currentBlock);
    setPreviousTimeBlock(previousBlock);
    setNextTimeBlock(nextBlock);
  };

  const getCompletionStatus = (timeBlockId: string): ScheduleCompletion | null => {
    const today = new Date().toISOString().split('T')[0];
    return completions.find(c => c.time_block_id === timeBlockId && c.date === today) || null;
  };

  const handleCompletion = async (timeBlockId: string, status: 'completed' | 'skipped' | 'failed') => {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if completion already exists
    const existingCompletion = getCompletionStatus(timeBlockId);
    
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
          date: today,
          status,
        }]);
      
      if (error) {
        console.error('Error creating completion:', error);
        return;
      }
    }

    // If completed, create a task
    if (status === 'completed') {
      const timeBlock = timeBlocks.find(tb => tb.id === timeBlockId);
      if (timeBlock) {
        const { error: taskError } = await supabase
          .from('tasks')
          .insert([{
            title: `${timeBlock.title} (${timeBlock.start_time} - ${timeBlock.end_time})`,
            is_done: true,
          }]);
        
        if (taskError) {
          console.error('Error creating task:', taskError);
        }
      }
    }

    fetchCompletions();
  };

  const getBlockStatusColor = (timeBlock: TimeBlock) => {
    const completion = getCompletionStatus(timeBlock.id);
    if (!completion) {
      // Check if it's past the end time
      const now = new Date();
      const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
      const endTime = new Date();
      endTime.setHours(endHour, endMinute, 0, 0);
      
      if (now > endTime) {
        return 'bg-yellow-900 border-yellow-600'; // Past due, untouched
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

  const getBlockStatusText = (timeBlock: TimeBlock) => {
    const completion = getCompletionStatus(timeBlock.id);
    if (!completion) {
      const now = new Date();
      const [endHour, endMinute] = timeBlock.end_time.split(':').map(Number);
      const endTime = new Date();
      endTime.setHours(endHour, endMinute, 0, 0);
      
      if (now > endTime) {
        return 'Past due';
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
      setSelectedGoalId('');
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

  const incompleteTasks = tasks.filter(task => !task.is_done);

  const getSelectedGoalNames = () => {
    if (!selectedGoalId) return '';
    const goal = goals.find(g => g.id === selectedGoalId);
    return goal ? goal.name : '';
  };

  const getTaskGoalNames = (task: Task) => {
    if (!task.task_goals || task.task_goals.length === 0) return null;
    return task.task_goals.map(tg => tg.goal?.name).filter(Boolean).join(', ');
  };

  // Helper functions to organize tasks
  const getDailyTasks = () => {
    return tasks.filter(task => task.is_recurring && !task.is_done);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Time Blocks Overview */}
      {(previousTimeBlock || currentTimeBlock || nextTimeBlock) && (
        <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Today's Schedule</h2>
          <div className="space-y-3">
            {/* Previous Time Block */}
            {previousTimeBlock && (
              <div className="p-3 sm:p-4 rounded-lg border border-slate-600 bg-slate-700/50 opacity-60">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-400">Previous</h3>
                    <h4 className="text-base sm:text-lg font-medium text-slate-300 truncate">{previousTimeBlock.title}</h4>
                    <p className="text-sm text-gray-500">
                      {previousTimeBlock.start_time} - {previousTimeBlock.end_time}
                    </p>
                    {getBlockStatusText(previousTimeBlock) && (
                      <p className="text-xs text-gray-400 mt-1">{getBlockStatusText(previousTimeBlock)}</p>
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
                      title="Mark as completed"
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
                      title="Mark as failed"
                    >
                      {getCompletionStatus(previousTimeBlock.id)?.status === 'failed' && '✕'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Current Time Block */}
            {currentTimeBlock && (
              <div className="bg-green-900 border border-green-600 rounded-lg p-3 sm:p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-green-300">Current</h3>
                    <h4 className="text-lg sm:text-xl font-medium text-green-200 truncate">{currentTimeBlock.title}</h4>
                    <p className="text-sm text-green-300">
                      {currentTimeBlock.start_time} - {currentTimeBlock.end_time}
                    </p>
                    {getBlockStatusText(currentTimeBlock) && (
                      <p className="text-xs text-green-300 mt-1">{getBlockStatusText(currentTimeBlock)}</p>
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
                      title="Mark as completed"
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
                      title="Mark as failed"
                    >
                      {getCompletionStatus(currentTimeBlock.id)?.status === 'failed' && '✕'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Next Time Block */}
            {nextTimeBlock && (
              <div className={`p-3 sm:p-4 rounded-lg border ${getBlockStatusColor(nextTimeBlock)}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-300">Next</h3>
                    <h4 className="text-base sm:text-lg font-medium text-slate-200 truncate">{nextTimeBlock.title}</h4>
                    <p className="text-sm text-gray-400">
                      {nextTimeBlock.start_time} - {nextTimeBlock.end_time}
                    </p>
                    {getBlockStatusText(nextTimeBlock) && (
                      <p className="text-xs text-gray-300 mt-1">{getBlockStatusText(nextTimeBlock)}</p>
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
                      title="Mark as completed"
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
                      title="Mark as failed"
                    >
                      {getCompletionStatus(nextTimeBlock.id)?.status === 'failed' && '✕'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Add Task */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Quick Add Task</h2>
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
              <span className="text-slate-300 text-sm">Make this a daily task</span>
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

      {/* Tasks List */}
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Today's Tasks</h2>
        
        {/* Daily Tasks Section */}
        {getDailyTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-forest-300 mb-3 flex items-center">
              <span className="mr-2">🔄</span>
              Daily Tasks
            </h3>
            <div className="space-y-2">
              {getDailyTasks().map(task => (
                <div key={task.id} className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                  task.is_done 
                    ? 'border-green-600 bg-green-900/20' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
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
                  <span className={`flex-1 min-w-0 ${
                    task.is_done 
                      ? 'line-through text-slate-400' 
                      : 'text-slate-200'
                  }`}>
                    {task.title}
                  </span>
                  {getTaskGoalNames(task) && (
                    <span className={`text-xs sm:text-sm px-2 py-1 rounded flex-shrink-0 ${
                      task.is_done 
                        ? 'text-slate-400 bg-slate-600' 
                        : 'text-slate-300 bg-slate-600'
                    }`}>
                      {getTaskGoalNames(task)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Today's Tasks Section */}
        {getTodaysTasks().length > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-medium text-slate-300 mb-3 flex items-center">
              <span className="mr-2">📝</span>
              Today's Tasks
            </h3>
            <div className="space-y-2">
              {getTodaysTasks().map(task => (
                <div key={task.id} className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                  task.is_done 
                    ? 'border-green-600 bg-green-900/20' 
                    : 'border-slate-600 bg-slate-700'
                }`}>
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
                  <span className={`flex-1 min-w-0 ${
                    task.is_done 
                      ? 'line-through text-slate-400' 
                      : 'text-slate-200'
                  }`}>
                    {task.title}
                  </span>
                  {getTaskGoalNames(task) && (
                    <span className={`text-xs sm:text-sm px-2 py-1 rounded flex-shrink-0 ${
                      task.is_done 
                        ? 'text-slate-400 bg-slate-600' 
                        : 'text-slate-300 bg-slate-600'
                    }`}>
                      {getTaskGoalNames(task)}
                    </span>
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