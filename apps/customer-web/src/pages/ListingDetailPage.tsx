import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { fetchListing } from '../api/listings';
import { useAuthStore } from '../store/auth.store';

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single Room', shared: 'Shared Room', pg: 'PG',
  apartment: 'Apartment', studio: 'Studio',
};

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { token } = useAuthStore();

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchListing(id!).then((r) => r.data),
    enabled: !!id,
  });

  function handleBook() {
    if (!token) {
      nav('/login', { state: { from: { pathname: `/listings/${id}` } } });
      return;
    }
    nav(`/book/${id}`);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 animate-pulse">
          <div className="bg-gray-100 rounded-xl h-52" />
          <div className="h-6 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
        </div>
      </Layout>
    );
  }

  if (isError || !listing) {
    return <Layout><p className="text-center text-red-500 py-12">Listing not found.</p></Layout>;
  }

  return (
    <Layout>
      <div className="space-y-5">
        <div className="bg-gray-100 rounded-xl h-52 flex items-center justify-center text-gray-300 text-6xl">
          🏠
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-800">{listing.title}</h1>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-brand-600">
                ₹{Number(listing.rentAmount).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">per month</p>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded-full">
              {ROOM_TYPE_LABELS[listing.roomType] ?? listing.roomType}
            </span>
            <span>📍 {listing.city}</span>
            {listing.address && <span>{listing.address}</span>}
          </div>
        </div>

        {listing.description && (
          <div>
            <h2 className="font-semibold text-gray-700 mb-1">About</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{listing.description}</p>
          </div>
        )}

        {listing.amenities && listing.amenities.length > 0 && (
          <div>
            <h2 className="font-semibold text-gray-700 mb-2">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {listing.amenities.map((a) => (
                <span key={a.id} className="bg-brand-50 text-brand-700 text-xs px-2 py-1 rounded-full">
                  {a.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {listing.depositAmount && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <span className="font-medium">Security deposit:</span>{' '}
            ₹{Number(listing.depositAmount).toLocaleString()}
          </div>
        )}

        <div className="sticky bottom-4 pt-2">
          <button
            onClick={handleBook}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-brand-700 transition-colors shadow-lg"
          >
            Book This Room
          </button>
        </div>
      </div>
    </Layout>
  );
}
