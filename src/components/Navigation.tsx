import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showSwipeFeedback, setShowSwipeFeedback] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/tasks', label: 'Tasks', icon: '📝' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/goals', label: 'Goals', icon: '🎯' }
  ];

  const isActive = (path: string) => location.pathname === path;

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Add touch event listeners to the main content area
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

    // Add listeners to the main content area
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.addEventListener('touchstart', handleTouchStart, { passive: true });
      mainContent.addEventListener('touchmove', handleTouchMove, { passive: true });
      mainContent.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if (mainContent) {
        mainContent.removeEventListener('touchstart', handleTouchStart);
        mainContent.removeEventListener('touchmove', handleTouchMove);
        mainContent.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [touchStart, touchEnd, location.pathname, navigate]);

  return (
    <nav className="bg-slate-800 shadow-lg border-b border-slate-700 w-full">
      <div className="w-full sm:max-w-7xl sm:mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-forest-400">Rudder</h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.path)
                    ? 'text-forest-400 bg-slate-700'
                    : 'text-slate-300 hover:text-forest-400 hover:bg-slate-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-300 hover:text-forest-400 focus:outline-none focus:text-forest-400"
              aria-label="Toggle menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Swipe Feedback Indicator */}
        {showSwipeFeedback && (
          <div className="md:hidden absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-forest-500 text-white px-3 py-1 rounded-md text-sm animate-pulse">
            Swiped!
          </div>
        )}

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-slate-800 border-t border-slate-700">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(item.path)
                      ? 'text-forest-400 bg-slate-700'
                      : 'text-slate-300 hover:text-forest-400 hover:bg-slate-700'
                  }`}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
              {/* Swipe hint */}
              <div className="px-3 py-2 text-xs text-slate-500 text-center border-t border-slate-700 mt-2 pt-2">
                💡 Swipe left/right to navigate between tabs
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 