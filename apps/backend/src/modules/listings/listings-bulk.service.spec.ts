import { BadRequestException } from '@nestjs/common';
import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Booking } from '@modules/payments/booking.entity';
import { RoomType } from '@common/enums/room-type.enum';
import { Repository, ObjectLiteral } from 'typeorm';
import { Queue } from 'bullmq';

function makeRepo<T extends ObjectLiteral>(): jest.Mocked<Pick<Repository<T>, 'save' | 'count' | 'findOne' | 'find' | 'createQueryBuilder'>> {
  return {
    save: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as unknown as jest.Mocked<Pick<Repository<T>, 'save' | 'count' | 'findOne' | 'find' | 'createQueryBuilder'>>;
}

const ctx = {
  getTenantId: () => 'tenant-1',
  getRequiredTenantId: () => 'tenant-1',
};
const amenitiesService = { findAll: jest.fn(), findByIds: jest.fn(), upsert: jest.fn() };
const subscriptions = {
  assertListingLimit: jest.fn().mockResolvedValue(undefined),
  assertStaffLimit: jest.fn(),
  deductSmsCredit: jest.fn(),
};
const storage = { upload: jest.fn() };
const queue = { add: jest.fn() } as unknown as Queue;

function buildService() {
  const repo = makeRepo<Listing>();
  (repo.save as jest.Mock).mockImplementation((e) => Promise.resolve({ id: 'new-id', ...e }));
  const imageRepo = makeRepo<ListingImage>();
  const bookingRepo = makeRepo<Booking>();

  const svc = new ListingsService(
    repo as unknown as Repository<Listing>,
    imageRepo as unknown as Repository<ListingImage>,
    bookingRepo as unknown as Repository<Booking>,
    ctx as any,
    amenitiesService as any,
    subscriptions as any,
    storage as any,
    queue,
  );

  return { svc, repo };
}

const USER_ID = 'user-abc';

function csvBuf(content: string): Buffer {
  return Buffer.from(content, 'utf8');
}

describe('ListingsService.bulkUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates listings from valid CSV rows', async () => {
    const { svc, repo } = buildService();
    const csv = [
      'title,roomType,rentAmount,city',
      'Nice Room,single,12000,Kathmandu',
      'Studio Apt,studio,18000,Lalitpur',
    ].join('\n');

    const result = await svc.bulkUpload(USER_ID, csvBuf(csv));

    expect(result.created).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(repo.save).toHaveBeenCalledTimes(2);
  });

  it('records an error for each invalid row without stopping', async () => {
    const { svc } = buildService();
    const csv = [
      'title,roomType,rentAmount',
      ',single,10000',          // missing title
      'Good Room,invalid_type,10000', // bad roomType
      'Good Room,single,abc',   // bad rentAmount
      'Valid Room,apartment,25000',   // passes
    ].join('\n');

    const result = await svc.bulkUpload(USER_ID, csvBuf(csv));

    expect(result.created).toBe(1);
    expect(result.failed).toBe(3);
    expect(result.errors).toHaveLength(3);
  });

  it('throws BadRequestException when CSV has no data rows', async () => {
    const { svc } = buildService();
    await expect(svc.bulkUpload(USER_ID, csvBuf('title,roomType,rentAmount\n'))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('handles CRLF line endings', async () => {
    const { svc } = buildService();
    const csv = 'title,roomType,rentAmount\r\nCozy Room,pg,9000\r\n';

    const result = await svc.bulkUpload(USER_ID, csvBuf(csv));
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('handles quoted fields containing commas', async () => {
    const { svc } = buildService();
    const csv = [
      'title,roomType,rentAmount,description',
      '"Room, with comma",single,11000,"A nice, spacious room"',
    ].join('\n');

    const result = await svc.bulkUpload(USER_ID, csvBuf(csv));
    expect(result.created).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('respects tenant isolation — passes tenantId from context to each listing', async () => {
    const { svc, repo } = buildService();
    const csv = ['title,roomType,rentAmount', 'A Room,single,8000'].join('\n');

    await svc.bulkUpload(USER_ID, csvBuf(csv));

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Listing> & { tenantId: string };
    expect(saved.tenantId).toBe('tenant-1');
  });
});
