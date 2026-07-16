import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../store/auth.store';

interface Props { children: ReactNode; title: string }

export function Layout({ children, title }: Props) {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Role identity banner — super admin only */}
        {isSuperAdmin && (
          <div className="bg-purple-700 text-white px-8 py-1.5 flex items-center gap-2 text-xs font-medium shrink-0">
            <span>🛡️</span>
            <span>Platform Administration</span>
            <span className="mx-1 text-purple-400">·</span>
            <span className="text-purple-200">Super Admin</span>
            {user?.email && (
              <>
                <span className="mx-1 text-purple-400">·</span>
                <span className="text-purple-300">{user.email}</span>
              </>
            )}
          </div>
        )}

        {/* Company admin context strip */}
        {!isSuperAdmin && user && (
          <div className="bg-brand-600 text-white px-8 py-1.5 flex items-center gap-2 text-xs font-medium shrink-0">
            <span>🏢</span>
            <span>Company Admin</span>
            {user.email && (
              <>
                <span className="mx-1 text-blue-300">·</span>
                <span className="text-blue-200">{user.email}</span>
              </>
            )}
          </div>
        )}

        <header className="bg-white border-b border-gray-100 px-8 py-4 shrink-0 flex items-center gap-3">
          {isSuperAdmin && (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              🛡️ Super
            </span>
          )}
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
        </header>

        <main className="flex-1 px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
