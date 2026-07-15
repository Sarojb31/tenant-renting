import { api } from './client';

export interface Review {
  id: string;
  listingId: string;
  customerId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  averageRating: number;
  total: number;
}

export interface CreateReviewBody {
  listingId: string;
  rating: number;
  comment?: string;
}

export const fetchListingReviews = (listingId: string) =>
  api.get<ReviewsResponse>(`/reviews/listing/${listingId}`);

export const createReview = (body: CreateReviewBody) =>
  api.post<Review>('/reviews', body);
