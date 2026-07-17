import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';

export function PaymentFailedPage() {
  const nav = useNavigate();
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 px-4">
        <div className="text-5xl">❌</div>
        <h1 className="text-xl font-bold text-gray-800">Payment Failed</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Your payment could not be completed. No money has been charged. You can try again or choose a different payment method.
        </p>
        <button
          onClick={() => nav(-1)}
          className="bg-brand-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => nav('/')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Home
        </button>
      </div>
    </Layout>
  );
}
