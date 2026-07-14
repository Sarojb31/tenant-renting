import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Layout } from '../components/Layout';
import { fetchListing } from '../api/listings';
import { createBooking } from '../api/bookings';

const schema = z.object({
  moveInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date'),
});
type Form = z.infer<typeof schema>;

export function BookingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const nav = useNavigate();

  const { data: listing } = useQuery({
    queryKey: ['listing', listingId],
    queryFn: () => fetchListing(listingId!).then((r) => r.data),
    enabled: !!listingId,
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: ({ moveInDate }: Form) => createBooking(listingId!, moveInDate).then((r) => r.data),
    onSuccess: (booking) => nav(`/pay/${booking.id}`),
  });

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  return (
    <Layout>
      <div className="max-w-sm mx-auto mt-4 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Confirm Booking</h1>
          {listing && (
            <p className="text-gray-500 text-sm mt-1">{listing.title} · ₹{Number(listing.rentAmount).toLocaleString()}/mo</p>
          )}
        </div>

        {mutation.isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            Booking failed. Please try again.
          </div>
        )}

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Move-in date</label>
            <input
              {...register('moveInDate')}
              type="date"
              min={minDate.toISOString().split('T')[0]}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {errors.moveInDate && (
              <p className="text-red-500 text-xs mt-1">{errors.moveInDate.message}</p>
            )}
          </div>

          {listing && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Monthly rent</span>
                <span className="font-medium">₹{Number(listing.rentAmount).toLocaleString()}</span>
              </div>
              {listing.depositAmount && (
                <div className="flex justify-between text-gray-600">
                  <span>Security deposit</span>
                  <span className="font-medium">₹{Number(listing.depositAmount).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {isSubmitting || mutation.isPending ? 'Creating booking...' : 'Continue to Payment'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
