import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Task, Goal, TimeBlock, Value } from './types/database';
import { User } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Schedule from './components/Schedule';
import GoalManager from './components/GoalManager';
import Navigation from './components/Navigation';
import Login from './components/Login';

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;

// Type for schedule completions
type ScheduleCompletion = {
  id: string;
  time_block_id: string;
  date: string;
  status: 'completed' | 'skipped' | 'failed';
  created_at: string;
  user_id: string;
};

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [completions, setCompletions] = useState<ScheduleCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetchInitialData();
    setupRealtimeSubscriptions();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [tasksResult, goalsResult, valuesResult, timeBlocksResult, completionsResult] = await Promise.all([
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
        supabase.from('time_blocks').select('*, goal:goals(*)').order('start_time', { ascending: true }),
        supabase.from('schedule_completions').select('*').order('created_at', { ascending: false })
      ]);

      if (tasksResult.data) setTasks(tasksResult.data);
      if (goalsResult.data) setGoals(goalsResult.data);
      if (valuesResult.data) setValues(valuesResult.data);
      if (timeBlocksResult.data) {
        setTimeBlocks(timeBlocksResult.data);
      }
      if (completionsResult.data) {
        setCompletions(completionsResult.data);
      }
      
      // Log any errors
      if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
      if (goalsResult.error) console.error('Error fetching goals:', goalsResult.error);
      if (valuesResult.error) console.error('Error fetching values:', valuesResult.error);
      if (timeBlocksResult.error) console.error('Error fetching time blocks:', timeBlocksResult.error);
      if (completionsResult.error) console.error('Error fetching completions:', completionsResult.error);
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

    // Subscribe to time_blocks changes
    const timeBlocksSubscription = supabase
      .channel('time_blocks_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_blocks' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch the time block with its goal
          const { data: timeBlockWithGoal } = await supabase
            .from('time_blocks')
            .select('*, goal:goals(*)')
            .eq('id', payload.new.id)
            .single();
          
          if (timeBlockWithGoal) {
            setTimeBlocks(prev => [...prev, timeBlockWithGoal as TimeBlock]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setTimeBlocks(prev => prev.map(block => block.id === payload.new.id ? payload.new as TimeBlock : block));
        } else if (payload.eventType === 'DELETE') {
          setTimeBlocks(prev => prev.filter(block => block.id !== payload.old.id));
        }
      })
      .subscribe();

    // Subscribe to schedule_completions changes
    const completionsSubscription = supabase
      .channel('completions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_completions' }, (payload) => {
        console.log('Completions subscription received:', payload);
        if (payload.eventType === 'INSERT') {
          setCompletions(prev => [payload.new as ScheduleCompletion, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setCompletions(prev => prev.map(completion => completion.id === payload.new.id ? payload.new as ScheduleCompletion : completion));
        } else if (payload.eventType === 'DELETE') {
          setCompletions(prev => prev.filter(completion => completion.id !== payload.old.id));
        }
      })
      .subscribe();

    // Subscribe to values changes
    const valuesSubscription = supabase
      .channel('values_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'values' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setValues(prev => [payload.new as Value, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setValues(prev => prev.map(value => value.id === payload.new.id ? payload.new as Value : value));
        } else if (payload.eventType === 'DELETE') {
          setValues(prev => prev.filter(value => value.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(taskGoalsSubscription);
      supabase.removeChannel(goalsSubscription);
      supabase.removeChannel(timeBlocksSubscription);
      supabase.removeChannel(completionsSubscription);
      supabase.removeChannel(valuesSubscription);
    };
  };

  if (!user) return <Login />;
  if (user.email !== ALLOWED_EMAIL) {
    supabase.auth.signOut();
    return <div className="text-center mt-20 text-red-500">Not authorized</div>;
  }

  console.log('User authorized, showing Dashboard');
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
        <Navigation />

        <main className="w-full sm:max-w-7xl sm:mx-auto py-4 px-2 sm:py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={
              <Dashboard 
                tasks={tasks} 
                goals={goals} 
                values={values}
                timeBlocks={timeBlocks}
                completions={completions}
                setTasks={setTasks}
                setCompletions={setCompletions}
                user={user}
              />
            } />
            <Route path="/tasks" element={
              <TaskList 
                tasks={tasks} 
                goals={goals}
                values={values}
                setTasks={setTasks}
                user={user}
              />
            } />
            <Route path="/schedule" element={
              <Schedule 
                user={user}
                completions={completions}
              />
            } />
            <Route path="/goals" element={
              <GoalManager 
                goals={goals}
                values={values}
                setGoals={setGoals}
                setValues={setValues}
                user={user}
              />
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 