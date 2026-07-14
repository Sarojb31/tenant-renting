import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginPage } from '../pages/LoginPage';
import * as authApi from '../api/auth';

vi.mock('../api/auth');
vi.mock('../store/auth.store', () => ({
  useAuthStore: () => ({ login: vi.fn(), token: null, customer: null, logout: vi.fn() }),
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

  it('shows phone step by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/98xxxxxxxx/i)).toBeInTheDocument();
  });

  it('advances to OTP step after requestOtp succeeds', async () => {
    vi.mocked(authApi.requestOtp).mockResolvedValue({ data: { message: 'sent' } } as any);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/98xxxxxxxx/i), { target: { value: '+9779800000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));
    await waitFor(() => expect(screen.getByText(/enter otp/i)).toBeInTheDocument());
  });

  it('shows error when requestOtp fails', async () => {
    vi.mocked(authApi.requestOtp).mockRejectedValue(new Error('network'));
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/98xxxxxxxx/i), { target: { value: '+9779800000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));
    await waitFor(() => expect(screen.getByText(/failed to send/i)).toBeInTheDocument());
  });

  it('shows error on invalid phone format', async () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/98xxxxxxxx/i), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));
    await waitFor(() => expect(screen.getByText(/valid phone/i)).toBeInTheDocument());
  });
});
