import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../components/Layout';
import { ListingCard } from '../components/ListingCard';
import { SearchFilters, type Filters } from '../components/SearchFilters';
import { fetchListings } from '../api/listings';

export function SearchPage() {
  const [filters, setFilters] = useState<Filters>({ city: '', roomType: '', minRent: '', maxRent: '' });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listings', filters],
    queryFn: () => fetchListings(filters).then((r) => r.data),
  });

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Find Your Room</h1>
        <SearchFilters onSearch={setFilters} />

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

        {data && data.length === 0 && (
          <p className="text-center text-gray-400 py-12">No listings found for these filters.</p>
        )}

        {data && data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {data.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
