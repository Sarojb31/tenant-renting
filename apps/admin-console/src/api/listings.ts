import { api } from './client';

export interface Listing {
  id: string;
  tenantId: string;
  title: string;
  rentAmount: string;
  depositAmount?: string;
  roomType: string;
  city: string;
  address?: string;
  status: 'draft' | 'published' | 'archived';
  amenities?: string[];
  createdAt: string;
}

export interface ListingsRes { data: Listing[]; total: number }

// Admin endpoint — returns all statuses, offset-paginated
export const fetchListings = (params?: Record<string, string | number>) =>
  api.get<ListingsRes>('/listings/admin/all', { params });

export const fetchListing = (id: string) => api.get<Listing>(`/listings/${id}`);

export const updateListing = (id: string, body: Partial<Listing>) =>
  api.patch<Listing>(`/listings/${id}`, body);

export const deleteListing = (id: string) => api.delete(`/listings/${id}`);
