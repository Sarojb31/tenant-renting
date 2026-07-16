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
  status: 'draft' | 'published' | 'occupied' | 'archived' | 'pending_review';
  availableFrom?: string | null;
  amenities?: string[];
  createdAt: string;
}

export interface ListingAvailabilityBooking {
  id: string;
  moveInDate: string | null;
  status: string;
  customerId: string;
}

export interface ListingAvailability {
  id: string;
  status: string;
  availableFrom: string | null;
  bookings: ListingAvailabilityBooking[];
}

export interface ListingsRes { data: Listing[]; total: number }

// Admin endpoint — returns all statuses, offset-paginated
export const fetchListings = (params?: Record<string, string | number>) =>
  api.get<ListingsRes>('/listings/admin/all', { params });

export const fetchListing = (id: string) => api.get<Listing>(`/listings/${id}`);

export const updateListing = (id: string, body: Partial<Listing>) =>
  api.patch<Listing>(`/listings/${id}`, body);

export const fetchAvailability = (id: string) =>
  api.get<ListingAvailability>(`/listings/${id}/availability`);

export const updateAvailability = (id: string, body: { availableFrom?: string; status?: string }) =>
  api.patch<ListingAvailability>(`/listings/${id}/availability`, body);

export const deleteListing = (id: string) => api.delete(`/listings/${id}`);

export interface CreateListingDto {
  title: string;
  roomType: string;
  rentAmount: number;
  description?: string;
  bhkType?: string;
  numberOfRooms?: number;
  depositAmount?: number;
  currency?: string;
  address?: string;
  city?: string;
  availableFrom?: string;
}

export const createListing = (body: CreateListingDto) =>
  api.post<Listing>('/listings', body);

export interface BulkUploadResult { created: number; failed: number; errors: string[] }

export const bulkUploadListings = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.post<BulkUploadResult>('/listings/bulk-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
