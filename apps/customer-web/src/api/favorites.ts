import { api } from './client';
import type { Listing } from './listings';

export const fetchFavoriteIds = () => api.get<string[]>('/favorites');

export const fetchFavoriteListings = () => api.get<Listing[]>('/favorites/listings');

export const addFavorite = (listingId: string) =>
  api.post<void>('/favorites', { listingId });

export const removeFavorite = (listingId: string) =>
  api.delete<void>(`/favorites/${listingId}`);
