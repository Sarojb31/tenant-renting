import { api } from './client';

export interface Booking {
  id: string;
  listingId: string;
  customerId: string;
  tenantId: string;
  status: string;
  moveInDate: string;
  amountDue: string;
  amountPaid: string;
  createdAt: string;
}

export const createBooking = (listingId: string, moveInDate: string) =>
  api.post<Booking>('/bookings', { listingId, moveInDate });

export const fetchBooking = (id: string) =>
  api.get<Booking>(`/bookings/${id}`);
