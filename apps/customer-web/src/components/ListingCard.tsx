import { Link } from 'react-router-dom';
import type { Listing } from '../api/listings';

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: 'Single Room',
  shared: 'Shared Room',
  pg: 'PG',
  apartment: 'Apartment',
  studio: 'Studio',
};

interface ListingCardProps {
  listing: Listing;
  isFavorited?: boolean;
  onToggleFavorite?: (listingId: string, isFavorited: boolean) => void;
}

export function ListingCard({ listing, isFavorited = false, onToggleFavorite }: ListingCardProps) {
  return (
    <Link
      to={`/listings/${listing.id}`}
      className="block bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="relative bg-gray-100 h-40 flex items-center justify-center text-gray-300 text-4xl">
        🏠
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleFavorite(listing.id, isFavorited);
            }}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center shadow-sm hover:bg-white transition-colors"
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <span className={`text-lg leading-none ${isFavorited ? 'text-red-500' : 'text-gray-300'}`}>
              ♥
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2">
            {listing.title}
          </h3>
          <span className="shrink-0 text-brand-600 font-bold text-sm">
            ₹{Number(listing.rentAmount).toLocaleString()}
            <span className="text-gray-400 font-normal">/mo</span>
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-gray-100 px-2 py-0.5 rounded-full">
            {ROOM_TYPE_LABELS[listing.roomType] ?? listing.roomType}
          </span>
          <span>📍 {listing.city}</span>
        </div>
      </div>
    </Link>
  );
}
