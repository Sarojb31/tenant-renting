import { useForm } from 'react-hook-form';

export interface Filters {
  city: string;
  roomType: string;
  minRent: string;
  maxRent: string;
}

interface Props {
  defaultValues?: Partial<Filters>;
  onSearch: (f: Filters) => void;
}

export function SearchFilters({ defaultValues, onSearch }: Props) {
  const { register, handleSubmit } = useForm<Filters>({ defaultValues });

  return (
    <form
      onSubmit={handleSubmit(onSearch)}
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
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
      <input
        {...register('minRent')}
        placeholder="Min rent"
        type="number"
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <input
        {...register('maxRent')}
        placeholder="Max rent"
        type="number"
        className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="submit"
        className="col-span-2 sm:col-span-4 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
