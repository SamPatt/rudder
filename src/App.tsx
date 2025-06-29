import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Task, Goal, Value } from './types/database';
import { User } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Schedule from './components/Schedule';
import GoalManager from './components/GoalManager';
import Navigation from './components/Navigation';
import Login from './components/Login';
import PushRegisterButton from './components/PushRegisterButton';
import PushDebug from './components/PushDebug';

const ALLOWED_EMAIL = import.meta.env.VITE_ALLOWED_EMAIL;

// Inner component that uses router hooks
function AppContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '��' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/tasks', label: 'Tasks', icon: '📝' },
    { path: '/goals', label: 'Goals', icon: '🎯' }
  ];

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Swipe navigation effect
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      setTouchEnd(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe || isRightSwipe) {
        const currentIndex = navItems.findIndex(item => item.path === location.pathname);
        let nextIndex: number;

        if (isLeftSwipe) {
          // Swipe left - go to next tab
          nextIndex = currentIndex === navItems.length - 1 ? 0 : currentIndex + 1;
        } else {
          // Swipe right - go to previous tab
          nextIndex = currentIndex === 0 ? navItems.length - 1 : currentIndex - 1;
        }

        // Show feedback
        setShowSwipeFeedback(true);
        setTimeout(() => setShowSwipeFeedback(false), 300);

        navigate(navItems[nextIndex].path);
      }
    };

    // Add listeners to the entire app wrapper
    const appWrapper = document.getElementById('app-wrapper');
    if (appWrapper) {
      appWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
      appWrapper.addEventListener('touchmove', handleTouchMove, { passive: true });
      appWrapper.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (appWrapper) {
        appWrapper.removeEventListener('touchstart', handleTouchStart);
        appWrapper.removeEventListener('touchmove', handleTouchMove);
        appWrapper.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [touchStart, touchEnd, location.pathname, navigate]);

  useEffect(() => {
    if (user) {
      fetchInitialData();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  const fetchInitialData = async () => {
    try {
      const [tasksResult, goalsResult, valuesResult] = await Promise.all([
        supabase.from('tasks').select('*, goal:goals(*), template:task_templates(*)').order('created_at', { ascending: false }),
        supabase.from('goals').select('*, value:values(*)').order('created_at', { ascending: false }),
        supabase.from('values').select('*').order('created_at', { ascending: false })
      ]);

      if (tasksResult.data) setTasks(tasksResult.data);
      if (goalsResult.data) setGoals(goalsResult.data);
      if (valuesResult.data) setValues(valuesResult.data);
      
      // Log any errors
      if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
      if (goalsResult.error) console.error('Error fetching goals:', goalsResult.error);
      if (valuesResult.error) console.error('Error fetching values:', valuesResult.error);
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
          // Fetch the task with its goal and template
          const { data: taskWithGoal } = await supabase
            .from('tasks')
            .select('*, goal:goals(*), template:task_templates(*)')
            .eq('id', payload.new.id)
            .single();
          
          if (taskWithGoal) {
            setTasks(prev => [taskWithGoal, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(task => task.id === payload.new.id ? payload.new as Task : task));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(task => task.id !== payload.old.id));
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
      supabase.removeChannel(goalsSubscription);
      supabase.removeChannel(valuesSubscription);
    };
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-forest-500 mx-auto"></div>
          <p className="mt-4 text-slate-400">Loading Rudder...</p>
        </div>
      </div>
    );
  }

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
    <div id="app-wrapper" className="min-h-screen bg-slate-900 text-slate-200">
      <Navigation />

      <main className="w-full sm:max-w-7xl sm:mx-auto py-4 px-2 sm:py-6 sm:px-6 lg:px-8">
        {/* Swipe Feedback Indicator */}
        {showSwipeFeedback && (
          <div className="md:hidden fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-forest-500 text-white px-3 py-1 rounded-md text-sm animate-pulse">
            Swiped!
          </div>
        )}

        <Routes>
          <Route path="/" element={
            <Dashboard 
              tasks={tasks} 
              goals={goals} 
              values={values}
              setTasks={setTasks}
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
              tasks={tasks} 
              goals={goals} 
              values={values}
              setTasks={setTasks}
              user={user}
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

      <PushRegisterButton user={user} />
      
      {/* Temporary debug component - remove after troubleshooting */}
      <div className="fixed bottom-20 left-4 right-4 z-40">
        <PushDebug />
      </div>
    </div>
  );
}

// Main App component that provides the Router context
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App; 