import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Task, Goal, TimeBlock, Value } from './types/database';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Schedule from './components/Schedule';
import GoalManager from './components/GoalManager';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInitialData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [tasksResult, goalsResult, valuesResult, timeBlocksResult] = await Promise.all([
        supabase.from('tasks').select(`
          *,
          task_goals (
            *,
            goal:goals (
              *,
              value:values (*)
            )
          )
        `).order('created_at', { ascending: false }),
        supabase.from('goals').select('*, value:values(*)').order('created_at', { ascending: false }),
        supabase.from('values').select('*').order('created_at', { ascending: false }),
        supabase.from('time_blocks').select('*, goal:goals(*)').order('start_hour', { ascending: true })
      ]);

      if (tasksResult.data) setTasks(tasksResult.data);
      if (goalsResult.data) setGoals(goalsResult.data);
      if (valuesResult.data) setValues(valuesResult.data);
      if (timeBlocksResult.data) setTimeBlocks(timeBlocksResult.data);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to task changes
    const tasksSubscription = supabase
      .channel('tasks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch the task with its goals
          const { data: taskWithGoals } = await supabase
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
            .eq('id', payload.new.id)
            .single();
          
          if (taskWithGoals) {
            setTasks(prev => [taskWithGoals, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(task => task.id === payload.new.id ? payload.new as Task : task));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(task => task.id !== payload.old.id));
        }
      })
      .subscribe();

    // Subscribe to task_goals changes
    const taskGoalsSubscription = supabase
      .channel('task_goals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_goals' }, async (payload) => {
        // Refresh the affected task
        if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
          const taskId = payload.eventType === 'INSERT' ? payload.new.task_id : payload.old.task_id;
          const { data: taskWithGoals } = await supabase
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
          
          if (taskWithGoals) {
            setTasks(prev => prev.map(task => task.id === taskId ? taskWithGoals : task));
          }
        }
      })
      .subscribe();

    // Subscribe to goal changes
    const goalsSubscription = supabase
      .channel('goals_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setGoals(prev => [payload.new as Goal, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setGoals(prev => prev.map(goal => goal.id === payload.new.id ? payload.new as Goal : goal));
        } else if (payload.eventType === 'DELETE') {
          setGoals(prev => prev.filter(goal => goal.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(taskGoalsSubscription);
      supabase.removeChannel(goalsSubscription);
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forest-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading Rudder...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-900 text-slate-200">
        <nav className="bg-slate-800 shadow-lg border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-forest-400">Rudder</h1>
              </div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-slate-300 hover:text-forest-400 transition-colors">Dashboard</a>
                <a href="/tasks" className="text-slate-300 hover:text-forest-400 transition-colors">Tasks</a>
                <a href="/schedule" className="text-slate-300 hover:text-forest-400 transition-colors">Schedule</a>
                <a href="/goals" className="text-slate-300 hover:text-forest-400 transition-colors">Goals</a>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                tasks={tasks} 
                goals={goals} 
                values={values}
                timeBlocks={timeBlocks}
                setTasks={setTasks}
              />
            } />
            <Route path="/tasks" element={
              <TaskList 
                tasks={tasks} 
                goals={goals}
                values={values}
                setTasks={setTasks}
              />
            } />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/goals" element={
              <GoalManager 
                goals={goals}
                values={values}
                setGoals={setGoals}
                setValues={setValues}
              />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 