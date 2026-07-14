import { Routes, Route } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { LoginPage } from './pages/LoginPage';
import { BookingPage } from './pages/BookingPage';
import { PaymentPage } from './pages/PaymentPage';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<SearchPage />} />
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
    </Routes>
  );
}

export default App;
