import { Navigate, Routes, Route } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/company/DashboardPage';
import { ListingsPage } from './pages/company/ListingsPage';
import { CustomersPage } from './pages/company/CustomersPage';
import { PaymentsPage } from './pages/company/PaymentsPage';
import { AnalyticsPage } from './pages/company/AnalyticsPage';
import { SubscriptionPage } from './pages/company/SubscriptionPage';
import { SuperDashboardPage } from './pages/super-admin/SuperDashboardPage';
import { TenantsPage } from './pages/super-admin/TenantsPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Company Admin */}
      <Route path="/company/dashboard"    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/company/listings"     element={<ProtectedRoute><ListingsPage /></ProtectedRoute>} />
      <Route path="/company/customers"    element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
      <Route path="/company/payments"     element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
      <Route path="/company/analytics"    element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/company/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/super/dashboard" element={<ProtectedRoute requireRole="super_admin"><SuperDashboardPage /></ProtectedRoute>} />
      <Route path="/super/tenants"   element={<ProtectedRoute requireRole="super_admin"><TenantsPage /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="/" element={<Navigate to="/company/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/company/dashboard" replace />} />
    </Routes>
  );
}

export default App;
