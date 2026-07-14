import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { ProtectedRoute } from '../components/ProtectedRoute';

const mockStore = vi.fn();
vi.mock('../store/auth.store', () => ({
  useAuthStore: () => mockStore(),
}));

function renderProtected(token: string | null, role = 'company_admin', requireRole?: 'super_admin' | 'company_admin') {
  mockStore.mockReturnValue({ token, user: { role }, login: vi.fn(), logout: vi.fn() });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={<ProtectedRoute requireRole={requireRole}><div>secret</div></ProtectedRoute>}
        />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    renderProtected('tok-abc');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderProtected(null);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('redirects to / when role does not match', () => {
    renderProtected('tok-abc', 'company_admin', 'super_admin');
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('allows access when role matches', () => {
    renderProtected('tok-abc', 'super_admin', 'super_admin');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
