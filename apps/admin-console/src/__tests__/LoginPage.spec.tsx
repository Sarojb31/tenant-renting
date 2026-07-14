import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth');
vi.mock('../store/auth.store', () => ({
  useAuthStore: () => ({ login: vi.fn(), token: null, user: null, logout: vi.fn() }),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders email and password fields', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/admin@example/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/admin@example/i), { target: { value: 'notanemail' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'somepass' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it('shows error on wrong credentials', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('401'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/admin@example/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });

  it('renders brand panel on larger screens', () => {
    renderPage();
    expect(screen.getByText(/manage properties/i)).toBeInTheDocument();
  });
});
