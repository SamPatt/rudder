import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/tasks', label: 'Tasks', icon: '📝' },
    { path: '/goals', label: 'Goals', icon: '🎯' }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Footer Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
        <div className="flex justify-around items-center h-16 px-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-center w-full h-full transition-colors ${
                isActive(item.path)
                  ? 'text-forest-400 bg-slate-700'
                  : 'text-slate-300 hover:text-forest-400 hover:bg-slate-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Desktop Header Navigation */}
      <nav className="hidden md:block bg-slate-800 shadow-lg border-b border-slate-700 w-full">
        <div className="w-full sm:max-w-7xl sm:mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-forest-400">Rudder</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="flex items-center space-x-4">
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
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation; 