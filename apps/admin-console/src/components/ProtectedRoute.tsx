import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

interface Props {
  children: ReactNode;
  requireRole?: 'super_admin' | 'company_admin';
}

export function ProtectedRoute({ children, requireRole }: Props) {
  const { token, user } = useAuthStore();
  const location = useLocation();

  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requireRole && user?.role !== requireRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}
