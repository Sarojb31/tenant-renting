import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { fetchListing } from '../api/listings';
import { fetchListingReviews, createReview } from '../api/reviews';
import { useAuthStore } from '../store/auth.store';

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < rating ? 'text-amber-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  );
}

function ReviewsSection({ listingId, isLoggedIn }: { listingId: string; isLoggedIn: boolean }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['reviews', listingId],
    queryFn: () => fetchListingReviews(listingId).then((r) => r.data),
  });

  const submit = useMutation({
    mutationFn: () => createReview({ listingId, rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reviews', listingId] });
      setShowForm(false);
      setComment('');
      setRating(5);
    },
  });

  const total = data?.total ?? 0;
  const avg = data?.averageRating ?? 0;
  const alreadyReviewed = submit.isSuccess;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-700">
          Reviews {total > 0 && <span className="text-gray-400 font-normal text-sm">({total})</span>}
        </h2>
        {total > 0 && (
          <div className="flex items-center gap-1.5">
            <StarRow rating={Math.round(avg)} />
            <span className="text-sm font-medium text-gray-700">{avg.toFixed(1)}</span>
          </div>
        )}
      </div>

      {isLoading && <p className="text-xs text-gray-400">Loading reviews…</p>}

      {!isLoading && total === 0 && (
        <p className="text-sm text-gray-400 italic">No reviews yet. Be the first to review!</p>
      )}

      {data?.reviews.map((r) => (
        <div key={r.id} className="bg-gray-50 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-2">
            <StarRow rating={r.rating} />
            <span className="text-xs text-gray-400">
              {new Date(r.createdAt).toLocaleDateString()}
            </span>
          </div>
          {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
        </div>
      ))}

      {isLoggedIn && !alreadyReviewed && (
        <>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-brand-600 hover:underline"
            >
              Write a review
            </button>
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Your review</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRating(s)}
                    className={`text-2xl leading-none ${s <= rating ? 'text-amber-400' : 'text-gray-200'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)…"
                rows={3}
                maxLength={1000}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none"
              />
              {submit.isError && (
                <p className="text-xs text-red-500">
                  {(submit.error as Error)?.message === 'Request failed with status code 409'
                    ? 'You have already reviewed this listing.'
                    : 'Failed to submit. Please try again.'}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => submit.mutate()}
                  disabled={submit.isPending}
                  className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {submit.isPending ? 'Submitting…' : 'Submit Review'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {alreadyReviewed && (
        <p className="text-xs text-green-600">Your review has been submitted. Thank you!</p>
      )}
    </div>
  );
}

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

        <ReviewsSection listingId={listing.id} isLoggedIn={!!token} />

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
