import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { logout as logoutApi } from '../api/auth';

interface NavItem { label: string; to: string; icon: string }

const COMPANY_NAV: NavItem[] = [
  { label: 'Dashboard',    to: '/company/dashboard',    icon: '▦' },
  { label: 'Listings',     to: '/company/listings',     icon: '🏠' },
  { label: 'Customers',    to: '/company/customers',    icon: '👥' },
  { label: 'Payments',     to: '/company/payments',     icon: '₿' },
  { label: 'Analytics',    to: '/company/analytics',    icon: '📊' },
  { label: 'Users',        to: '/company/users',         icon: '👤' },
  { label: 'SMS Templates', to: '/company/sms-templates', icon: '💬' },
  { label: 'Subscription', to: '/company/subscription',  icon: '⭐' },
];

const SUPER_NAV: NavItem[] = [
  { label: 'Overview',   to: '/super/dashboard',   icon: '▦' },
  { label: 'Tenants',    to: '/super/tenants',      icon: '🏢' },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const isSuperAdmin = user?.role === 'super_admin';
  const items = isSuperAdmin ? SUPER_NAV : COMPANY_NAV;

  async function handleLogout() {
    try { await logoutApi(); } catch { /* ignore */ }
    logout();
    nav('/login', { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-sidebar-active text-white font-medium'
        : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
    }`;

  return (
    <aside className="w-60 shrink-0 bg-sidebar flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🏠</span>
          <div>
            <p className="text-white font-bold text-sm leading-tight">RoomFinder</p>
            <p className="text-gray-500 text-xs">Admin Console</p>
          </div>
        </div>
      </div>

      {/* Role badge */}
      <div className="px-5 py-3 border-b border-sidebar-border">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          isSuperAdmin ? 'bg-purple-900 text-purple-300' : 'bg-blue-900 text-blue-300'
        }`}>
          {isSuperAdmin ? 'Super Admin' : 'Company Admin'}
        </span>
        {user?.name && <p className="text-gray-400 text-xs mt-1.5 truncate">{user.name}</p>}
        {user?.email && <p className="text-gray-500 text-xs truncate">{user.email}</p>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-gray-600 text-xs font-semibold uppercase tracking-widest px-3 mb-2">
          {isSuperAdmin ? 'Platform' : 'Manage'}
        </p>
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <span className="text-base leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-sidebar-hover hover:text-red-400 transition-colors text-left"
        >
          <span>↩</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
