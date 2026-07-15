import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { fetchAmenities } from '../api/listings';

export interface Filters {
  city: string;
  roomType: string;
  bhkType: string;
  numberOfRooms: string;
  minRent: string;
  maxRent: string;
  amenityIds: string;
}

interface Props {
  defaultValues?: Partial<Filters>;
  onSearch: (f: Filters) => void;
}

export function SearchFilters({ defaultValues, onSearch }: Props) {
  const { register, handleSubmit, watch, setValue } = useForm<Filters>({
    defaultValues: { city: '', roomType: '', bhkType: '', numberOfRooms: '', minRent: '', maxRent: '', amenityIds: '', ...defaultValues },
  });

  const { data: amenities } = useQuery({
    queryKey: ['amenities', 'feasibility'],
    queryFn: () => fetchAmenities('feasibility').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const selectedIds = (watch('amenityIds') ?? '').split(',').filter(Boolean);

  function toggleAmenity(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setValue('amenityIds', next.join(','));
  }

  return (
    <form
      onSubmit={handleSubmit(onSearch)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          {...register('city')}
          placeholder="City"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 col-span-2 sm:col-span-1"
        />
        <select
          {...register('roomType')}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-600"
        >
          <option value="">Any type</option>
          <option value="single">Single Room</option>
          <option value="shared">Shared Room</option>
          <option value="pg">PG</option>
          <option value="apartment">Apartment</option>
          <option value="studio">Studio</option>
        </select>
        <select
          {...register('bhkType')}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-600"
        >
          <option value="">Any BHK</option>
          <option value="studio">Studio</option>
          <option value="1bhk">1 BHK</option>
          <option value="2bhk">2 BHK</option>
          <option value="3bhk">3 BHK</option>
          <option value="4bhk_plus">4 BHK+</option>
        </select>
        <input
          {...register('numberOfRooms')}
          placeholder="Rooms"
          type="number"
          min={1}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          {...register('minRent')}
          placeholder="Min rent (₹)"
          type="number"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          {...register('maxRent')}
          placeholder="Max rent (₹)"
          type="number"
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {amenities && amenities.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-1.5">Near</p>
          <div className="flex flex-wrap gap-2">
            {amenities.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleAmenity(a.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedIds.includes(a.id)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-gray-200 text-gray-600 hover:border-brand-400'
                }`}
              >
                {a.name}
              </button>
            ))}
          </div>
          <input type="hidden" {...register('amenityIds')} />
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-brand-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
