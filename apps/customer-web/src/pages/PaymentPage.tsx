import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { fetchBooking } from '../api/bookings';
import { createPaymentIntent, type PaymentGateway } from '../api/payments';

const GATEWAYS: { id: PaymentGateway; label: string; desc: string; flag: string }[] = [
  { id: 'esewa', label: 'eSewa', desc: 'Pay via eSewa (Nepal)', flag: '🇳🇵' },
  { id: 'khalti', label: 'Khalti', desc: 'Pay via Khalti (Nepal)', flag: '🇳🇵' },
  { id: 'stripe', label: 'Card / International', desc: 'Credit or debit card', flag: '💳' },
];

export function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const nav = useNavigate();
  const [selected, setSelected] = useState<PaymentGateway>('esewa');

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => fetchBooking(bookingId!).then((r) => r.data),
    enabled: !!bookingId,
  });

  const mutation = useMutation({
    mutationFn: () => createPaymentIntent(bookingId!, selected).then((r) => r.data),
    onSuccess: (res) => {
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
      } else if (res.clientSecret) {
        nav(`/payment/stripe?secret=${encodeURIComponent(res.clientSecret)}&paymentId=${res.paymentId}`);
      }
    },
  });

  if (isLoading) {
    return <Layout><div className="animate-pulse h-48 bg-gray-100 rounded-xl mt-4" /></Layout>;
  }

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-4 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Pay Now</h1>
          {booking && (
            <p className="text-gray-500 text-sm mt-1">
              Booking amount: <span className="font-semibold text-gray-700">₹{Number(booking.amountDue).toLocaleString()}</span>
            </p>
          )}
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            Payment initiation failed. Try again.
          </div>
        )}

        <div className="space-y-2">
          {GATEWAYS.map((gw) => (
            <button
              key={gw.id}
              type="button"
              onClick={() => setSelected(gw.id)}
              className={`w-full flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-colors ${
                selected === gw.id
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <span className="text-2xl">{gw.flag}</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">{gw.label}</p>
                <p className="text-xs text-gray-500">{gw.desc}</p>
              </div>
              <div className="ml-auto">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selected === gw.id ? 'border-brand-500 bg-brand-500' : 'border-gray-300'
                }`}>
                  {selected === gw.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {mutation.isPending ? 'Redirecting...' : `Pay with ${GATEWAYS.find((g) => g.id === selected)?.label}`}
        </button>

        <p className="text-xs text-gray-400 text-center">
          You'll be redirected to the payment gateway. Do not close this tab.
        </p>
      </div>
    </Layout>
  );
}
