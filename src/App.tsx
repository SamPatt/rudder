import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Task, Goal, Value, Project } from './types/database';
import { User } from '@supabase/supabase-js';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import Schedule from './components/Schedule';
import GoalManager from './components/GoalManager';
import Navigation from './components/Navigation';
import Login from './components/Login';
import SuccessAnimation from './components/SuccessAnimation';

// Inner component that uses router hooks
function AppContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [values, setValues] = useState<Value[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/tasks', label: 'Tasks', icon: '📝' },
    { path: '/goals', label: 'Goals', icon: '🎯' }
  ];

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Global function to trigger success animation
  const triggerSuccessAnimation = () => {
    setShowSuccessAnimation(true);
  };

  // Make the trigger function globally available
  useEffect(() => {
    (window as any).triggerSuccessAnimation = triggerSuccessAnimation;
    return () => {
      delete (window as any).triggerSuccessAnimation;
    };
  }, []);

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
      const [tasksResult, goalsResult, valuesResult, projectsResult] = await Promise.all([
        supabase.from('tasks').select('*, goal:goals(*), template:task_templates(*), project:projects(*)').order('created_at', { ascending: false }),
        supabase.from('goals').select('*, value:values(*)').order('created_at', { ascending: false }),
        supabase.from('values').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false })
      ]);

      if (tasksResult.data) setTasks(tasksResult.data);
      if (goalsResult.data) setGoals(goalsResult.data);
      if (valuesResult.data) setValues(valuesResult.data);
      if (projectsResult.data) setProjects(projectsResult.data);
      
      // Log any errors
      if (tasksResult.error) console.error('Error fetching tasks:', tasksResult.error);
      if (goalsResult.error) console.error('Error fetching goals:', goalsResult.error);
      if (valuesResult.error) console.error('Error fetching values:', valuesResult.error);
      if (projectsResult.error) console.error('Error fetching projects:', projectsResult.error);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Temporarily disabled realtime subscriptions to reduce console noise
    // These can be re-enabled later if needed for real-time updates
    console.log('Realtime subscriptions disabled for debugging');
    
    return () => {
      // No cleanup needed since subscriptions are disabled
    };
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login />;
  }

  // Show loading screen while fetching data
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-wrapper" className="min-h-screen bg-slate-900 text-slate-200">
      {/* Mobile Layout */}
      <div className="md:hidden max-w-md mx-auto bg-slate-900 min-h-screen pb-16">
        <div className="p-4">
          <Routes>
            <Route path="/" element={
              <div>
                <Dashboard tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} setProjects={setProjects} user={user} />
              </div>
            } />
            <Route path="/schedule" element={<Schedule tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} user={user} />} />
            <Route path="/tasks" element={<TaskList tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} setProjects={setProjects} user={user} />} />
            <Route path="/goals" element={<GoalManager goals={goals} values={values} setGoals={setGoals} setValues={setValues} user={user} />} />
          </Routes>
        </div>
        <Navigation />
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block">
        <Navigation />
        <main className="w-full sm:max-w-7xl sm:mx-auto py-4 px-2 sm:py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={
              <div>
                <Dashboard tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} setProjects={setProjects} user={user} />
              </div>
            } />
            <Route path="/schedule" element={<Schedule tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} user={user} />} />
            <Route path="/tasks" element={<TaskList tasks={tasks} goals={goals} values={values} projects={projects} setTasks={setTasks} setProjects={setProjects} user={user} />} />
            <Route path="/goals" element={<GoalManager goals={goals} values={values} setGoals={setGoals} setValues={setValues} user={user} />} />
          </Routes>
        </main>
      </div>
      
      {/* Swipe feedback indicator */}
      {showSwipeFeedback && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-forest-500 text-white px-4 py-2 rounded-lg">
            Swipe to navigate
          </div>
        </div>
      )}

      {/* Success Animation */}
      <SuccessAnimation 
        isActive={showSuccessAnimation} 
        onAnimationComplete={() => setShowSuccessAnimation(false)} 
      />
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