import { useState, useEffect, useRef } from 'react';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ListingCard } from '../components/ListingCard';
import { SearchFilters, type Filters } from '../components/SearchFilters';
import { fetchListings } from '../api/listings';
import { fetchFavoriteIds, addFavorite, removeFavorite } from '../api/favorites';
import { useAuthStore } from '../store/auth.store';

const EMPTY: Filters = { city: '', roomType: '', bhkType: '', numberOfRooms: '', minRent: '', maxRent: '', amenityIds: '' };

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const initial: Filters = {
    ...EMPTY,
    city: searchParams.get('city') ?? '',
    roomType: searchParams.get('roomType') ?? '',
  };
  const [filters, setFilters] = useState<Filters>(initial);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { token } = useAuthStore();
  const qc = useQueryClient();

  const { data: favoriteIds } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => fetchFavoriteIds().then((r) => r.data),
    enabled: !!token,
  });

  const toggleFavorite = useMutation({
    mutationFn: ({ listingId, isFav }: { listingId: string; isFav: boolean }) =>
      isFav ? removeFavorite(listingId) : addFavorite(listingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['listings', filters],
    queryFn: ({ pageParam }) =>
      fetchListings({ ...filters, cursor: pageParam ?? undefined }).then((r) => r.data),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const listings = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Find Your Room</h1>
        <SearchFilters defaultValues={initial} onSearch={setFilters} />

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-44 animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-center text-red-500 py-8">Failed to load listings. Try again.</p>
        )}

        {!isLoading && listings.length === 0 && !isError && (
          <p className="text-center text-gray-400 py-12">No listings found for these filters.</p>
        )}

        {listings.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorited={favoriteIds?.includes(listing.id) ?? false}
                onToggleFavorite={token ? (id, isFav) => toggleFavorite.mutate({ listingId: id, isFav }) : undefined}
              />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />

        {isFetchingNextPage && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-xl h-44 animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
