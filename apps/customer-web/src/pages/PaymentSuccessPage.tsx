import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function PaymentSuccessPage() {
  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-12 text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-xl font-bold text-gray-800">Booking Confirmed!</h1>
        <p className="text-gray-500 text-sm">
          Your payment was received and your booking is confirmed. The landlord will contact you shortly.
        </p>
        <Link
          to="/"
          className="inline-block bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 transition-colors"
        >
          Back to Search
        </Link>
      </div>
    </Layout>
  );
}
