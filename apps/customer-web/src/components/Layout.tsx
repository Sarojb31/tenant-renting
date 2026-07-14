import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export function Layout({ children }: { children: React.ReactNode }) {
  const { customer, logout } = useAuthStore();
  const nav = useNavigate();

  function handleLogout() {
    logout();
    nav('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-brand-600 font-bold text-lg tracking-tight">
            RoomFinder
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/" className="text-gray-600 hover:text-brand-600">Search</Link>
            {customer ? (
              <>
                <Link to="/profile" className="text-gray-600 hover:text-brand-600">Profile</Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-red-500"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="bg-brand-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t">
        © {new Date().getFullYear()} RoomFinder
      </footer>
    </div>
  );
}
