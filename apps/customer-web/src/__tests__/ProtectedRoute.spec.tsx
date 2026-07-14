import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { ProtectedRoute } from '../components/ProtectedRoute';

const mockStore = vi.fn();
vi.mock('../store/auth.store', () => ({
  useAuthStore: () => mockStore(),
}));

function renderProtected(token: string | null) {
  mockStore.mockReturnValue({ token, customer: null, login: vi.fn(), logout: vi.fn() });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={<ProtectedRoute><div>secret</div></ProtectedRoute>}
        />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('renders children when authenticated', () => {
    renderProtected('token-abc');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    renderProtected(null);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
