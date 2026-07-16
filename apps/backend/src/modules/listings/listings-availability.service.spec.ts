import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';
import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Booking } from '@modules/payments/booking.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { RoomType } from '@common/enums/room-type.enum';

const ctx = { getTenantId: () => 'tenant-1', getRequiredTenantId: () => 'tenant-1' };
const amenitiesService = { findAll: jest.fn(), findByIds: jest.fn(), upsert: jest.fn() };
const subscriptions = { assertListingLimit: jest.fn().mockResolvedValue(undefined), assertStaffLimit: jest.fn(), deductSmsCredit: jest.fn() };
const storage = { upload: jest.fn() };
const queue = { add: jest.fn() } as unknown as Queue;

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    tenantId: 'tenant-1',
    title: 'Test Listing',
    roomType: RoomType.SINGLE,
    rentAmount: '10000',
    status: ListingStatus.PUBLISHED,
    availableFrom: '2025-08-01',
    ...overrides,
  } as unknown as Listing;
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    tenantId: 'tenant-1',
    listingId: 'listing-1',
    customerId: 'customer-1',
    status: 'pending',
    moveInDate: '2025-08-15',
    ...overrides,
  } as unknown as Booking;
}

function buildSvc(
  listing: Listing | null,
  bookings: Booking[],
  saveFn?: jest.Mock,
): ListingsService {
  const repo = {
    findOne: jest.fn().mockResolvedValue(listing),
    save: saveFn ?? jest.fn().mockImplementation(async (x) => x),
    createQueryBuilder: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<Listing>;
  const imageRepo = { find: jest.fn() } as unknown as Repository<ListingImage>;
  const bookingRepo = {
    find: jest.fn().mockResolvedValue(bookings),
  } as unknown as Repository<Booking>;
  const nullSms = { send: jest.fn() };
  return new ListingsService(repo, imageRepo, bookingRepo, ctx as never, amenitiesService as never, subscriptions as never, storage as never, queue, nullSms as never);
}

describe('ListingsService.getAvailability', () => {
  it('returns availability with bookings', async () => {
    const listing = makeListing();
    const booking = makeBooking();
    const svc = buildSvc(listing, [booking]);
    const result = await svc.getAvailability('listing-1');
    expect(result.id).toBe('listing-1');
    expect(result.status).toBe(ListingStatus.PUBLISHED);
    expect(result.availableFrom).toBe('2025-08-01');
    expect(result.bookings).toHaveLength(1);
    expect(result.bookings[0]).toMatchObject({ id: 'booking-1', customerId: 'customer-1' });
  });

  it('returns empty bookings array when no bookings', async () => {
    const svc = buildSvc(makeListing(), []);
    const result = await svc.getAvailability('listing-1');
    expect(result.bookings).toHaveLength(0);
  });

  it('throws NotFoundException when listing not in tenant', async () => {
    const svc = buildSvc(null, []);
    await expect(svc.getAvailability('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('ListingsService.updateAvailability', () => {
  it('updates availableFrom and returns new availability', async () => {
    const listing = makeListing({ availableFrom: '2025-07-01' });
    const svc = buildSvc(listing, []);
    const result = await svc.updateAvailability('listing-1', { availableFrom: '2025-09-01' });
    expect(result.availableFrom).toBe('2025-09-01');
  });

  it('marks listing as occupied', async () => {
    const listing = makeListing({ status: ListingStatus.PUBLISHED });
    const svc = buildSvc(listing, []);
    const result = await svc.updateAvailability('listing-1', { status: ListingStatus.OCCUPIED });
    expect(result.status).toBe(ListingStatus.OCCUPIED);
  });

  it('throws NotFoundException for unknown listing', async () => {
    const svc = buildSvc(null, []);
    await expect(svc.updateAvailability('missing', { status: ListingStatus.OCCUPIED })).rejects.toThrow(NotFoundException);
  });
});
