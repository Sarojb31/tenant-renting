import { useAuthStore } from '../store/auth.store';
import { Layout } from '../components/Layout';

export function ProfilePage() {
  const { customer, logout } = useAuthStore();

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-4 space-y-5">
        <h1 className="text-xl font-bold text-gray-800">Profile</h1>

        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <p className="font-semibold text-gray-800">{customer?.name ?? 'Customer'}</p>
              <p className="text-sm text-gray-500">{customer?.phone}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <div className="px-4 py-3 text-sm text-gray-500">
            Preferences (edit coming soon)
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full border border-red-200 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors"
        >
          Logout
        </button>
      </div>
    </Layout>
  );
}
