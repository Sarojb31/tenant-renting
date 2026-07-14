import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { requestOtp, verifyOtp, customerEmailLogin } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { Layout } from '../components/Layout';

const phoneSchema = z.object({ phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Enter a valid phone number') });
const otpSchema = z.object({ code: z.string().length(6, 'OTP must be 6 digits') });
const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type EmailForm = z.infer<typeof emailSchema>;

type Tab = 'phone' | 'email';

export function LoginPage() {
  const [tab, setTab] = useState<Tab>('phone');
  const [otpStep, setOtpStep] = useState(false);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const phoneForm = useForm<PhoneForm>({ resolver: zodResolver(phoneSchema) });
  const otpForm = useForm<OtpForm>({ resolver: zodResolver(otpSchema) });
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  async function onPhoneSubmit({ phone: p }: PhoneForm) {
    setError('');
    try {
      await requestOtp(p);
      setPhone(p);
      setOtpStep(true);
    } catch {
      setError('Failed to send OTP. Check the number and try again.');
    }
  }

  async function onOtpSubmit({ code }: OtpForm) {
    setError('');
    try {
      const res = await verifyOtp(phone, code);
      login(res.data.accessToken, res.data.customer);
      nav(from, { replace: true });
    } catch {
      setError('Invalid or expired OTP. Try again.');
    }
  }

  async function onEmailSubmit({ email, password }: EmailForm) {
    setError('');
    try {
      const res = await customerEmailLogin(email, password);
      login(res.data.accessToken, res.data.customer);
      nav(from, { replace: true });
    } catch {
      setError('Invalid email or password.');
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError('');
    setOtpStep(false);
  }

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm mb-5">Sign in to continue browsing rooms.</p>

        {/* Tab switcher */}
        <div className="flex border border-gray-200 rounded-lg p-1 mb-6 bg-gray-50">
          <button
            type="button"
            onClick={() => switchTab('phone')}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              tab === 'phone'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Phone / OTP
          </button>
          <button
            type="button"
            onClick={() => switchTab('email')}
            className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
              tab === 'email'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Email
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Phone OTP flow */}
        {tab === 'phone' && !otpStep && (
          <form onSubmit={phoneForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
              <input
                {...phoneForm.register('phone')}
                placeholder="+977 98XXXXXXXX"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                type="tel"
              />
              {phoneForm.formState.errors.phone && (
                <p className="text-red-500 text-xs mt-1">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={phoneForm.formState.isSubmitting}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {phoneForm.formState.isSubmitting ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {tab === 'phone' && otpStep && (
          <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
            <p className="text-gray-500 text-sm">We sent a 6-digit code to {phone}.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">OTP code</label>
              <input
                {...otpForm.register('code')}
                placeholder="123456"
                maxLength={6}
                className="w-full border rounded-lg px-3 py-2.5 text-sm text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                type="number"
                inputMode="numeric"
              />
              {otpForm.formState.errors.code && (
                <p className="text-red-500 text-xs mt-1">{otpForm.formState.errors.code.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={otpForm.formState.isSubmitting}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {otpForm.formState.isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button
              type="button"
              onClick={() => setOtpStep(false)}
              className="w-full text-sm text-gray-500 hover:text-gray-700"
            >
              ← Use a different number
            </button>
          </form>
        )}

        {/* Email + password flow */}
        {tab === 'email' && (
          <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                {...emailForm.register('email')}
                placeholder="you@example.com"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                type="email"
                autoComplete="email"
              />
              {emailForm.formState.errors.email && (
                <p className="text-red-500 text-xs mt-1">{emailForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                {...emailForm.register('password')}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                type="password"
                autoComplete="current-password"
              />
              {emailForm.formState.errors.password && (
                <p className="text-red-500 text-xs mt-1">{emailForm.formState.errors.password.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={emailForm.formState.isSubmitting}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-60 transition-colors"
            >
              {emailForm.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}
