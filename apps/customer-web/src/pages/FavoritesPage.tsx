import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { ListingCard } from '../components/ListingCard';
import { fetchFavoriteListings, fetchFavoriteIds, removeFavorite } from '../api/favorites';

export function FavoritesPage() {
  const qc = useQueryClient();

  const { data: listings, isLoading } = useQuery({
    queryKey: ['favorites', 'listings'],
    queryFn: () => fetchFavoriteListings().then((r) => r.data),
  });

  const { data: favoriteIds } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => fetchFavoriteIds().then((r) => r.data),
  });

  const toggle = useMutation({
    mutationFn: (listingId: string) => removeFavorite(listingId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['favorites'] });
      void qc.invalidateQueries({ queryKey: ['favorites', 'listings'] });
    },
  });

  const items = listings ?? [];

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Saved Listings</h1>
          {items.length > 0 && (
            <span className="text-sm text-gray-400">{items.length} saved</span>
          )}
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-44 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">♥</p>
            <p className="text-gray-500 font-medium">No saved listings yet</p>
            <p className="text-gray-400 text-sm">
              Tap the heart icon on any listing to save it here.
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorited={favoriteIds?.includes(listing.id) ?? true}
                onToggleFavorite={(id) => toggle.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
