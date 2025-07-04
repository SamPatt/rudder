import { useState } from 'react';
import { Task, Goal, Value, Project } from '../types/database';
import { supabase } from '../lib/supabase';
import { soundManager } from '../lib/sounds';
import GoalSelector from './GoalSelector';
import ProjectSelector from './ProjectSelector';
import { User } from '@supabase/supabase-js';
import ConfirmationModal from './ConfirmationModal';
import { getCurrentLocalDate } from '../lib/timezone';
import PushRegisterButton from './PushRegisterButton';
import PushDebug from './PushDebug';
import EditTaskModal from './EditTaskModal';

interface TaskListProps {
  tasks: Task[];
  goals: Goal[];
  values: Value[];
  projects: Project[];
  setTasks: (tasks: Task[]) => void;
  setProjects: (projects: Project[]) => void;
  user: User;
}

export default function TaskList({ tasks, goals, values, projects, setTasks, setProjects, user }: TaskListProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showGoalSelector, setShowGoalSelector] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurType, setRecurType] = useState<'daily' | 'weekdays' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{templateId: string, taskId: string | null} | null>(null);
  const [showInstanceDeleteConfirm, setShowInstanceDeleteConfirm] = useState(false);
  const [instanceDeleteTarget, setInstanceDeleteTarget] = useState<{taskId: string, templateId: string} | null>(null);
  const [editProjectModal, setEditProjectModal] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [showProjectDeleteConfirm, setShowProjectDeleteConfirm] = useState(false);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<Project | null>(null);
  const [showDevTools, setShowDevTools] = useState(false);
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    setShowGoalSelector(true);
  };

  // Helper function to determine the appropriate date for a task
  const getTaskDate = (isRecurring: boolean, recurType: string, customDays: number[]): string => {
    const today = new Date();
    const todayStr = getCurrentLocalDate();
    
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

  const handleGoalSelectForNewTask = async (goalIds: string[]) => {
    try {
      const taskDate = getTaskDate(isRecurring, recurType, customDays);
        
        if (isRecurring) {
          // Create a task template
          const templatePayload = {
            title: newTaskTitle,
            recur_type: recurType,
            custom_days: recurType === 'custom' ? customDays : null,
            goal_id: goalIds.length > 0 ? goalIds[0] : null,
            project_id: selectedProjectId,
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
            .select('*, goal:goals(*), template:task_templates(*), project:projects(*)')
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
            project_id: selectedProjectId,
            user_id: user.id,
          };
          
          console.log('Inserting task with payload:', insertPayload, 'User:', user);
          const { data: task, error: taskError } = await supabase
            .from('tasks')
            .insert(insertPayload)
            .select('*, goal:goals(*), project:projects(*)')
            .single();

          if (taskError) throw taskError;

          setTasks([task, ...tasks]);
        }

        setNewTaskTitle('');
        setIsRecurring(false);
        setRecurType('daily');
        setCustomDays([]);
        setSelectedProjectId(null);
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
          completed_at: !currentStatus ? new Date().toISOString() : null,
          completion_status: !currentStatus ? 'completed' : null
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;

      setTasks(tasks.map(t => 
        t.id === taskId ? { 
          ...t, 
          is_done: !currentStatus,
          completed_at: !currentStatus ? new Date().toISOString() : null,
          completion_status: !currentStatus ? 'completed' : null
        } : t
      ));

      // Play sound feedback for completed tasks
      if (!currentStatus) {
        soundManager.playSuccessSound();
      }
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };





  // Get to-do list (one-time tasks)
  const getTodoTasks = () => {
    const today = new Date().toLocaleDateString('en-CA'); // local date
    return tasks.filter(task => {
      // Must be a one-time task (no template_id)
      if (task.template_id) return false;
      // Must not have a project_id, or if it does, the project must not exist
      if (task.project_id) {
        const projectExists = projects.some(p => p.id === task.project_id);
        if (projectExists) return false;
      }
      // Show if incomplete, or completed today (local date)
      if (task.is_done) {
        if (!task.completed_at) return false;
        const completedDate = new Date(task.completed_at).toLocaleDateString('en-CA');
        if (completedDate !== today) return false;
      }
      return true;
    }).sort((a, b) => (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0)); // completed at top
  };

  // Get tasks grouped by project (today only, completed at top)
  const getTasksByProject = () => {
    const today = new Date().toISOString().split('T')[0];
    const projectTasks = tasks.filter(task => 
      task.project_id && 
      task.date === today &&
      task.completion_status !== 'failed'
    );
    const grouped: { [projectId: string]: { project: Project; tasks: Task[] } } = {};
    projectTasks.forEach(task => {
      const project = projects.find(p => p.id === task.project_id);
      if (project) {
        if (!grouped[project.id]) grouped[project.id] = { project, tasks: [] };
        grouped[project.id].tasks.push(task);
      }
    });
    // Sort each project's tasks: completed at top
    Object.values(grouped).forEach(group => {
      group.tasks.sort((a, b) => (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0));
    });
    return Object.values(grouped);
  };

  // Helper function to get the actual completion date for a task
  const getTaskCompletionDate = (task: Task): string | null => {
    if (!task.completed_at) return null;
    return new Date(task.completed_at).toLocaleDateString('en-CA');
  };

  // Recurring tasks scheduled for today (completed at top)
  const getFrequentTodayTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(task => {
      if (!task.template_id) return false;
      if (task.date !== today) return false;
      if (task.project_id) {
        const projectExists = projects.some(p => p.id === task.project_id);
        if (projectExists) return false;
      }
      return true;
    }).sort((a, b) => (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0));
  };

  // Recurring tasks scheduled for future dates (incomplete only, completed at top)
  const getFrequentUpcomingTasks = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = getFrequentTodayTasks();
    const allUpcomingTasks = tasks.filter(task => {
      if (!task.template_id) return false;
      if (task.is_done) return false;
      if (task.date <= today) return false;
      if (task.project_id) {
        const projectExists = projects.some(p => p.id === task.project_id);
        if (projectExists) return false;
      }
      return true;
    });
    const templateGroups: { [templateId: string]: Task[] } = {};
    allUpcomingTasks.forEach(task => {
      if (!templateGroups[task.template_id!]) templateGroups[task.template_id!] = [];
      templateGroups[task.template_id!].push(task);
    });
    const firstUpcomingInstances: Task[] = [];
    Object.values(templateGroups).forEach(templateTasks => {
      const sortedTasks = templateTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      firstUpcomingInstances.push(sortedTasks[0]);
    });
    const todayTemplateIds = new Set(todayTasks.map(task => task.template_id));
    return firstUpcomingInstances.filter(task => !todayTemplateIds.has(task.template_id)).sort((a, b) => (b.is_done ? 1 : 0) - (a.is_done ? 1 : 0));
  };

  // Archive: only completed tasks from previous days, sorted by completion date (most recent first)
  const getArchivedTasks = () => {
    const todayLocal = new Date().toLocaleDateString('en-CA');
    const archivedTasks = tasks
      .filter(task => {
        if (!task.is_done || !task.completed_at) return false;
        const completionDate = getTaskCompletionDate(task);
        if (!completionDate) return false;
        return completionDate !== todayLocal;
      })
      .sort((a, b) => {
        const dateA = getTaskCompletionDate(a) || a.created_at.split('T')[0];
        const dateB = getTaskCompletionDate(b) || b.created_at.split('T')[0];
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    // Group by date
    const groupedByDate: { [date: string]: Task[] } = {};
    archivedTasks.forEach(task => {
      const date = getTaskCompletionDate(task) || task.created_at.split('T')[0];
      if (!groupedByDate[date]) groupedByDate[date] = [];
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

  const handleDeleteInstance = async () => {
    if (instanceDeleteTarget) {
      await supabase
        .from('tasks')
        .delete()
        .eq('id', instanceDeleteTarget.taskId)
        .eq('user_id', user.id);
      setTasks(tasks.filter(t => t.id !== instanceDeleteTarget.taskId));
      setShowInstanceDeleteConfirm(false);
      setInstanceDeleteTarget(null);
    }
  };

  const handleDeleteSeries = async () => {
    if (instanceDeleteTarget) {
      await supabase
        .from('tasks')
        .delete()
        .eq('template_id', instanceDeleteTarget.templateId)
        .eq('user_id', user.id);
      await supabase
        .from('task_templates')
        .delete()
        .eq('id', instanceDeleteTarget.templateId)
        .eq('user_id', user.id);
      setTasks(tasks.filter(t => t.template_id !== instanceDeleteTarget.templateId));
      setShowInstanceDeleteConfirm(false);
      setInstanceDeleteTarget(null);
    }
  };

  // Create a new project
  const handleCreateProject = async (projectName: string): Promise<string | null> => {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          user_id: user.id,
          color: `#${Math.floor(Math.random()*16777215).toString(16)}` // Random color
        })
        .select()
        .single();

      if (error) throw error;

      setProjects([...projects, project]);
      return project.id;
    } catch (error) {
      console.error('Error creating project:', error);
      return null;
    }
  };

  const handleEditProject = async (projectId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: newName })
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (error) throw error;

      setProjects(projects.map(p => 
        p.id === projectId ? { ...p, name: newName } : p
      ));
      setEditProjectModal(null);
      setEditProjectName('');
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      // First, remove project_id from all tasks that belong to this project
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ project_id: null })
        .eq('project_id', projectId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Then delete the project
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      // Update local state
      setProjects(projects.filter(p => p.id !== projectId));
      setTasks(tasks.map(task => 
        task.project_id === projectId ? { ...task, project_id: null } : task
      ));
      setEditProjectModal(null);
      setEditProjectName('');
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleEditTaskSave = async (updated: { name: string }) => {
    if (!editingTask) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ title: updated.name })
        .eq('id', editingTask.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, title: updated.name } : t));
      setEditingTask(null);
      setEditTaskModalOpen(false);
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const handleEditTaskDelete = async () => {
    if (!editingTask) return;
    if (editingTask.template_id) {
      // Recurring instance: show confirmation modal
      setInstanceDeleteTarget({ taskId: editingTask.id, templateId: editingTask.template_id });
      setShowInstanceDeleteConfirm(true);
      setEditingTask(null);
      setEditTaskModalOpen(false);
      return;
    }
    // One-time task: delete immediately
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', editingTask.id)
        .eq('user_id', user.id);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== editingTask.id));
      setEditingTask(null);
      setEditTaskModalOpen(false);
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const handleEditTaskCancel = () => {
    setEditingTask(null);
    setEditTaskModalOpen(false);
  };

  const handleEditTaskGoalSelect = () => {
    setIsEditingGoal(true);
    setShowGoalSelector(true);
  };

  const handleGoalSelect = async (goalIds: string[]) => {
    if (isEditingGoal && editingTask) {
      // Handle goal selection for editing
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ goal_id: goalIds.length > 0 ? goalIds[0] : null })
          .eq('id', editingTask.id)
          .eq('user_id', user.id);
        if (error) throw error;
        setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, goal_id: goalIds.length > 0 ? goalIds[0] : null } : t));
        setEditingTask(tasks.find(t => t.id === editingTask.id) ? { ...editingTask, goal_id: goalIds.length > 0 ? goalIds[0] : null } : null);
      } catch (err) {
        console.error('Error updating task goal:', err);
      }
      setIsEditingGoal(false);
      setShowGoalSelector(false);
    } else {
      // Handle goal selection for new task
      handleGoalSelectForNewTask(goalIds);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-slate-200 mb-4">Tasks</h2>

        {/* Add Task Section */}
        <div className="mb-6">
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
          <div className="flex items-center justify-between mt-3">
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
            <button
              onClick={() => setShowProjectSelector(true)}
              className="flex items-center gap-2 px-3 py-1 text-sm border border-slate-600 rounded-md hover:border-slate-500 transition-colors"
            >
              {selectedProjectId ? (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: projects.find(p => p.id === selectedProjectId)?.color || '#6B7280' }}
                  ></div>
                  <span className="text-slate-300">
                    {projects.find(p => p.id === selectedProjectId)?.name}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                  <span className="text-slate-400">No Project</span>
                </>
              )}
            </button>
          </div>

          {isRecurring && (
            <div className="space-y-3 p-3 bg-slate-700 rounded-md mt-3">
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
                            setEditingTask(task);
                            setEditTaskModalOpen(true);
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
                            setEditingTask(task);
                            setEditTaskModalOpen(true);
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

        {/* Projects Section */}
        {getTasksByProject().length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-blue-300 mb-2 flex items-center">
              <span className="mr-2">📁</span>
              Projects
            </h3>
            <div className="space-y-4">
              {getTasksByProject().map(({ project, tasks: projectTasks }) => (
                <div key={project.id} className="border border-slate-600 rounded-lg bg-slate-700 overflow-hidden">
                  <div className="bg-slate-800 px-3 py-2 border-b border-slate-600">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: project.color }}
                        ></div>
                        <h4 className="text-sm font-medium text-slate-300">
                          {project.name}
                        </h4>
                        <span className="ml-2 text-xs text-slate-400">
                          ({projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="text-slate-400 hover:text-blue-400 text-sm px-2 py-1 rounded"
                          title="Edit project"
                          onClick={() => {
                            setEditProjectModal(project);
                            setEditProjectName(project.name);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          className="text-slate-400 hover:text-red-400 text-sm px-2 py-1 rounded"
                          title="Delete project"
                          onClick={() => {
                            setProjectDeleteTarget(project);
                            setShowProjectDeleteConfirm(true);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    {projectTasks.map(task => (
                      <div key={task.id} className={`p-3 border rounded-lg transition-colors flex flex-col ${
                        task.is_done 
                          ? 'border-green-600 bg-green-900/20' 
                          : 'border-slate-600 bg-slate-800'
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
                              setEditingTask(task);
                              setEditTaskModalOpen(true);
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
                        setEditingTask(task);
                        setEditTaskModalOpen(true);
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
                              setEditingTask(task);
                              setEditTaskModalOpen(true);
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

        {/* Dev Tools Section */}
        <div className="mt-8">
          <button
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 rounded-md font-semibold flex items-center justify-center gap-2"
            onClick={() => setShowDevTools(v => !v)}
          >
            🛠️ Dev Tools {showDevTools ? '▲' : '▼'}
          </button>
          {showDevTools && (
            <div className="mt-4 space-y-4">
              <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-slate-200 mb-4">Push Notifications</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Enable push notifications to get reminded about your scheduled tasks.
                </p>
                <PushRegisterButton user={user} />
              </div>
              <div className="bg-slate-800 rounded-lg shadow-lg p-4 sm:p-6 border border-slate-700">
                <h2 className="text-lg font-semibold text-slate-200 mb-4">Push Debug</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Debug information for troubleshooting push notifications on Android PWA.
                </p>
                <PushDebug />
              </div>
            </div>
          )}
        </div>

        {/* Edit Task Modal */}
        <EditTaskModal
          isOpen={editTaskModalOpen}
          task={editingTask}
          goals={goals}
          values={values}
          onSave={handleEditTaskSave}
          onDelete={handleEditTaskDelete}
          onCancel={handleEditTaskCancel}
          onGoalSelect={handleEditTaskGoalSelect}
        />

        <GoalSelector
          goals={goals}
          values={values}
          onGoalSelect={handleGoalSelect}
          onClose={() => {
            setShowGoalSelector(false);
            setIsEditingGoal(false);
          }}
          isOpen={showGoalSelector}
          multiple={true}
          selectedGoalIds={isEditingGoal && editingTask ? (editingTask.goal_id ? [editingTask.goal_id] : []) : []}
        />

        {/* Project Selector Modal */}
        <ProjectSelector
          projects={projects}
          isOpen={showProjectSelector}
          onClose={() => setShowProjectSelector(false)}
          onProjectSelect={(projectId) => setSelectedProjectId(projectId)}
          onCreateProject={handleCreateProject}
          selectedProjectId={selectedProjectId}
        />

        <ConfirmationModal
          isOpen={showInstanceDeleteConfirm}
          onClose={() => setShowInstanceDeleteConfirm(false)}
          onConfirm={undefined}
          title="Delete Task Instance"
          message={
            <div>
              <div>Do you want to delete just this instance, or the entire recurring series?</div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                  onClick={handleDeleteInstance}
                >
                  Delete Instance
                </button>
                <button
                  className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded font-medium"
                  onClick={handleDeleteSeries}
                >
                  Delete Series
                </button>
              </div>
            </div>
          }
          confirmText={undefined}
          cancelText="Cancel"
          confirmButtonVariant="danger"
        />
        <ConfirmationModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            if (deleteTarget) {
              // Delete all tasks with this template_id
              await supabase
                .from('tasks')
                .delete()
                .eq('template_id', deleteTarget.templateId)
                .eq('user_id', user.id);
              // Delete the template itself
              await supabase
                .from('task_templates')
                .delete()
                .eq('id', deleteTarget.templateId)
                .eq('user_id', user.id);
              setTasks(tasks.filter(t => t.template_id !== deleteTarget.templateId));
              setShowDeleteConfirm(false);
              setDeleteTarget(null);
            }
          }}
          title="Delete Recurring Task Series"
          message="This will delete the recurring template and all its scheduled tasks. Are you sure?"
          confirmText="Delete Series"
          cancelText="Cancel"
          confirmButtonVariant="danger"
        />

        <ConfirmationModal
          isOpen={showProjectDeleteConfirm}
          onClose={() => {
            setShowProjectDeleteConfirm(false);
            setProjectDeleteTarget(null);
          }}
          onConfirm={async () => {
            if (projectDeleteTarget) {
              await handleDeleteProject(projectDeleteTarget.id);
              setShowProjectDeleteConfirm(false);
              setProjectDeleteTarget(null);
            }
          }}
          title="Delete Project"
          message={`Are you sure you want to delete the project "${projectDeleteTarget?.name}"? This will remove the project from all associated tasks.`}
          confirmText="Delete Project"
          cancelText="Cancel"
          confirmButtonVariant="danger"
        />

        {/* Edit Project Modal */}
        {editProjectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-lg shadow-lg w-full max-w-md mx-2">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Edit Project</h3>
              <input
                type="text"
                value={editProjectName}
                onChange={e => setEditProjectName(e.target.value)}
                className="w-full px-3 py-2 mb-4 border border-slate-600 rounded-md bg-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-forest-500"
                placeholder="Project name"
              />
              <div className="flex gap-3 justify-end">
                <button
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded"
                  onClick={() => {
                    setEditProjectModal(null);
                    setEditProjectName('');
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                  onClick={() => {
                    if (editProjectModal && editProjectName.trim()) {
                      handleEditProject(editProjectModal.id, editProjectName.trim());
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}