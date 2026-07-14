// Listing DTOs — mirrors Plan Section 12 (listings table)
// Extend as listings module is implemented (Phase 1 Step 2)

export type RoomType = 'single' | 'shared' | 'pg' | 'apartment' | 'studio';
export type ListingStatus = 'draft' | 'pending_review' | 'published' | 'occupied' | 'archived';

export interface ListingResponse {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  roomType: RoomType;
  rentAmount: number;
  depositAmount: number;
  currency: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  availableFrom: string;
  createdBy: string;
}

export interface CreateListingDto {
  title: string;
  description: string;
  roomType: RoomType;
  rentAmount: number;
  depositAmount: number;
  currency: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  availableFrom: string;
}

export interface ListingFilterQuery {
  city?: string;
  roomType?: RoomType;
  minRent?: number;
  maxRent?: number;
  amenities?: string[];
  page?: number;
  limit?: number;
}
