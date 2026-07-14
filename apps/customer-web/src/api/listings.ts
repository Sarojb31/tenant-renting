import { api } from './client';

export interface Listing {
  id: string;
  title: string;
  description?: string;
  roomType: string;
  rentAmount: string;
  depositAmount?: string;
  city: string;
  address?: string;
  amenities?: string[];
  images?: { id: string; url: string }[];
  status: string;
  tenantId: string;
  createdAt: string;
}

export interface ListingFilters {
  city?: string;
  roomType?: string;
  minRent?: string;
  maxRent?: string;
}

export const fetchListings = (filters: ListingFilters = {}) => {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v != null && v !== ''),
  );
  return api.get<Listing[]>('/listings', { params });
};

export const fetchListing = (id: string) =>
  api.get<Listing>(`/listings/${id}`);
