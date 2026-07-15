import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Booking } from '@modules/payments/booking.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { BhkType } from '@common/enums/bhk-type.enum';
import { RoomType } from '@common/enums/room-type.enum';
import { Repository } from 'typeorm';
import { Queue } from 'bullmq';

function makeDate(offsetMs = 0): Date {
  return new Date(Date.now() - offsetMs);
}

function makeListing(id: string, createdAt: Date, overrides: Partial<Listing> = {}): Listing {
  return {
    id,
    tenantId: 'tenant-1',
    status: ListingStatus.PUBLISHED,
    roomType: RoomType.SINGLE,
    bhkType: BhkType.BHK_2,
    rentAmount: '15000',
    createdAt,
    title: `Listing ${id}`,
    ...overrides,
  } as unknown as Listing;
}

function makeQb(results: Listing[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn().mockImplementation(chain);
  qb['andWhere'] = jest.fn().mockImplementation(chain);
  qb['orderBy'] = jest.fn().mockImplementation(chain);
  qb['addOrderBy'] = jest.fn().mockImplementation(chain);
  qb['take'] = jest.fn().mockImplementation(chain);
  qb['innerJoin'] = jest.fn().mockImplementation(chain);
  qb['getMany'] = jest.fn().mockResolvedValue(results);
  return qb;
}

const ctx = { getTenantId: () => 'tenant-1', getRequiredTenantId: () => 'tenant-1' };
const amenitiesService = { findAll: jest.fn(), findByIds: jest.fn(), upsert: jest.fn() };
const subscriptions = { assertListingLimit: jest.fn().mockResolvedValue(undefined), assertStaffLimit: jest.fn(), deductSmsCredit: jest.fn() };
const storage = { upload: jest.fn() };
const queue = { add: jest.fn() } as unknown as Queue;

function buildService(rows: Listing[]): { svc: ListingsService; qb: ReturnType<typeof makeQb> } {
  const qb = makeQb(rows);
  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  } as unknown as Repository<Listing>;
  const imageRepo = { find: jest.fn() } as unknown as Repository<ListingImage>;
  const bookingRepo = { find: jest.fn().mockResolvedValue([]) } as unknown as Repository<Booking>;
  const svc = new ListingsService(repo, imageRepo, bookingRepo, ctx as never, amenitiesService as never, subscriptions as never, storage as never, queue);
  return { svc, qb };
}

describe('ListingsService.findAll cursor pagination', () => {
  it('returns empty page when no tenantId', async () => {
    const ctxNoTenant = { getTenantId: () => null };
    const repo = { createQueryBuilder: jest.fn() } as unknown as Repository<Listing>;
    const imageRepo = { find: jest.fn() } as unknown as Repository<ListingImage>;
    const bookingRepo = { find: jest.fn() } as unknown as Repository<Booking>;
    const svc = new ListingsService(repo, imageRepo, bookingRepo, ctxNoTenant as never, amenitiesService as never, subscriptions as never, storage as never, queue);
    const result = await svc.findAll();
    expect(result).toEqual({ data: [], nextCursor: null });
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('returns all rows with null nextCursor when rows <= limit', async () => {
    const rows = [makeListing('a', makeDate(1000)), makeListing('b', makeDate(2000))];
    const { svc } = buildService(rows);
    const result = await svc.findAll({ limit: 20 });
    expect(result.data).toHaveLength(2);
    expect(result.nextCursor).toBeNull();
  });

  it('returns limit rows and non-null nextCursor when rows > limit', async () => {
    const rows = Array.from({ length: 21 }, (_, i) =>
      makeListing(`id-${i}`, makeDate(i * 1000)),
    );
    const { svc } = buildService(rows);
    const result = await svc.findAll({ limit: 20 });
    expect(result.data).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
  });

  it('encodes cursor from last item in page', async () => {
    const t = makeDate(5000);
    const rows = Array.from({ length: 21 }, (_, i) =>
      makeListing(`id-${i}`, i === 19 ? t : makeDate(i * 1000)),
    );
    const { svc } = buildService(rows);
    const result = await svc.findAll({ limit: 20 });
    const decoded = JSON.parse(Buffer.from(result.nextCursor!, 'base64url').toString('utf8'));
    expect(decoded.i).toBe('id-19');
    expect(decoded.c).toBe(t.toISOString());
  });

  it('applies bhkType filter to query', async () => {
    const { svc, qb } = buildService([]);
    await svc.findAll({ bhkType: BhkType.BHK_1 });
    const bhkCall = (qb['andWhere'] as jest.Mock).mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('bhkType'),
    );
    expect(bhkCall).toBeDefined();
    expect(bhkCall![1]).toEqual({ bhkType: BhkType.BHK_1 });
  });

  it('applies amenityIds inner join when provided', async () => {
    const { svc, qb } = buildService([]);
    await svc.findAll({ amenityIds: 'uuid-1,uuid-2' });
    expect(qb['innerJoin']).toHaveBeenCalledWith(
      'l.amenities',
      'a',
      'a.id IN (:...amenityIds)',
      { amenityIds: ['uuid-1', 'uuid-2'] },
    );
  });

  it('does not innerJoin when amenityIds is empty string', async () => {
    const { svc, qb } = buildService([]);
    await svc.findAll({ amenityIds: '' });
    expect(qb['innerJoin']).not.toHaveBeenCalled();
  });

  it('applies cursor where clause when valid cursor provided', async () => {
    const cursor = Buffer.from(JSON.stringify({ c: '2025-01-01T00:00:00.000Z', i: 'id-5' })).toString('base64url');
    const { svc, qb } = buildService([]);
    await svc.findAll({ cursor });
    const cursorCall = (qb['andWhere'] as jest.Mock).mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('cursorCreatedAt'),
    );
    expect(cursorCall).toBeDefined();
    expect(cursorCall![1]).toEqual({ cursorCreatedAt: '2025-01-01T00:00:00.000Z', cursorId: 'id-5' });
  });

  it('ignores malformed cursor gracefully', async () => {
    const { svc, qb } = buildService([]);
    await svc.findAll({ cursor: 'not-valid-base64!!!' });
    const cursorCall = (qb['andWhere'] as jest.Mock).mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('cursorCreatedAt'),
    );
    expect(cursorCall).toBeUndefined();
  });
});
