import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const { login: storeLogin } = useAuthStore();
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  async function onSubmit({ email, password }: Form) {
    setError('');
    try {
      const res = await login(email, password);
      storeLogin(res.data.accessToken, res.data.user);
      const dest = res.data.user.role === 'super_admin' ? '/super/dashboard' : '/company/dashboard';
      nav(from === '/login' ? dest : from, { replace: true });
    } catch {
      setError('Invalid email or password.');
    }
  }

  return (
    <div className="min-h-screen bg-sidebar flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex flex-col justify-between w-96 p-10 border-r border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">🏠</span>
          <div>
            <p className="text-white font-bold text-base">RoomFinder</p>
            <p className="text-gray-500 text-xs">Admin Console</p>
          </div>
        </div>
        <div>
          <p className="text-gray-300 text-2xl font-bold leading-snug mb-3">
            Manage properties,<br />customers, and payments<br />from one place.
          </p>
          <p className="text-gray-500 text-sm leading-relaxed">
            Multi-tenant SaaS platform for rental property management. Real-time bookings, SMS matching, and payment tracking.
          </p>
        </div>
        <p className="text-gray-600 text-xs">RoomFinder SaaS · {new Date().getFullYear()}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign in</h1>
            <p className="text-gray-500 text-sm mt-1">Admin accounts are provisioned by your platform administrator.</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-brand-700 disabled:opacity-60 transition-colors mt-2"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
