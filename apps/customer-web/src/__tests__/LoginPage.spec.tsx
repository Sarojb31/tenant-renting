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

describe('LoginPage — Phone OTP flow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows phone input by default', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/98xxxxxxxx/i)).toBeInTheDocument();
  });

  it('advances to OTP step after requestOtp succeeds', async () => {
    vi.mocked(authApi.requestOtp).mockResolvedValue({ data: { message: 'sent' } } as any);
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/98xxxxxxxx/i), { target: { value: '+9779800000000' } });
    fireEvent.click(screen.getByRole('button', { name: /send otp/i }));
    await waitFor(() => expect(screen.getByText(/sent a 6-digit code/i)).toBeInTheDocument());
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

describe('LoginPage — Email flow', () => {
  beforeEach(() => vi.clearAllMocks());

  function switchToEmail() {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /email/i }));
  }

  it('shows email and password fields after switching to email tab', () => {
    switchToEmail();
    expect(screen.getByPlaceholderText(/you@example/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('shows validation error for invalid email', async () => {
    switchToEmail();
    fireEvent.change(screen.getByPlaceholderText(/you@example/i), { target: { value: 'notanemail' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText(/valid email/i)).toBeInTheDocument());
  });

  it('shows error on wrong credentials', async () => {
    vi.mocked(authApi.customerEmailLogin).mockRejectedValue(new Error('401'));
    switchToEmail();
    fireEvent.change(screen.getByPlaceholderText(/you@example/i), { target: { value: 'demo@customer.com' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });

  it('switches back to phone tab correctly', () => {
    switchToEmail();
    fireEvent.click(screen.getByRole('button', { name: /phone/i }));
    expect(screen.getByPlaceholderText(/98xxxxxxxx/i)).toBeInTheDocument();
  });
});
