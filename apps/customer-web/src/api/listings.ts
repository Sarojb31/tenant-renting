import { api } from './client';

export interface Listing {
  id: string;
  title: string;
  description?: string;
  roomType: string;
  bhkType?: string | null;
  numberOfRooms?: number | null;
  rentAmount: string;
  depositAmount?: string;
  city: string;
  address?: string;
  amenities?: { id: string; name: string; category: string }[];
  images?: { id: string; url: string }[];
  status: string;
  tenantId: string;
  createdAt: string;
}

export interface ListingPage {
  data: Listing[];
  nextCursor: string | null;
}

export interface ListingFilters {
  city?: string;
  roomType?: string;
  bhkType?: string;
  numberOfRooms?: string;
  minRent?: string;
  maxRent?: string;
  amenityIds?: string;
  cursor?: string;
  limit?: number;
}

export const fetchListings = (filters: ListingFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v != null && v !== ''),
  );
  return api.get<ListingPage>('/listings', { params });
};

export const fetchListing = (id: string) =>
  api.get<Listing>(`/listings/${id}`);

export interface Amenity {
  id: string;
  name: string;
  category: string;
}

export const fetchAmenities = (category?: string) => {
  const params = category ? { category } : {};
  return api.get<Amenity[]>('/amenities', { params });
};
