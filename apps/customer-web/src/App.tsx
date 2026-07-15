import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { LoginPage } from './pages/LoginPage';
import { BookingPage } from './pages/BookingPage';
import { PaymentPage } from './pages/PaymentPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { ProfilePage } from './pages/ProfilePage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useTenantBranding } from './hooks/useTenantBranding';

function App() {
  useTenantBranding(); // applies --color-brand CSS var from tenant settings

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/listings/:id" element={<ListingDetailPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/book/:listingId"
        element={<ProtectedRoute><BookingPage /></ProtectedRoute>}
      />
      <Route
        path="/pay/:bookingId"
        element={<ProtectedRoute><PaymentPage /></ProtectedRoute>}
      />
      <Route path="/payment/success" element={<PaymentSuccessPage />} />
      <Route
        path="/profile"
        element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
      />
      <Route
        path="/favorites"
        element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>}
      />
    </Routes>
  );
}

export default App;
