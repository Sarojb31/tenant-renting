import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { Booking } from '@modules/payments/booking.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { SubmissionSource } from '@common/enums/submission-source.enum';
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
  (repo.save as jest.Mock).mockImplementation((e) => Promise.resolve({ id: 'listing-id', ...e }));
  const imageRepo = makeRepo<ListingImage>();
  const bookingRepo = makeRepo<Booking>();
  const smsMock = { send: jest.fn().mockResolvedValue({ providerMessageId: 'ok', status: 'sent' }) };

  const svc = new ListingsService(
    repo as unknown as Repository<Listing>,
    imageRepo as unknown as Repository<ListingImage>,
    bookingRepo as unknown as Repository<Booking>,
    ctx as any,
    amenitiesService as any,
    subscriptions as any,
    storage as any,
    queue,
    smsMock as any,
  );

  return { svc, repo, smsMock };
}

const BASE_DTO = {
  ownerName: 'Ram Bahadur',
  ownerPhone: '+9779800000099',
  ownerEmail: 'ram@example.com',
  title: 'Studio Room',
  roomType: RoomType.STUDIO,
  rentAmount: 12000,
  city: 'Kathmandu',
};

describe('ListingsService.ownerSubmit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves listing with status pending_review and source owner_submitted', async () => {
    const { svc, repo } = buildService();

    const result = await svc.ownerSubmit(BASE_DTO);

    expect(result.status).toBe(ListingStatus.PENDING_REVIEW);
    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Listing>;
    expect(saved.submissionSource).toBe(SubmissionSource.OWNER_SUBMITTED);
    expect(saved.createdBy).toBeNull();
  });

  it('stores owner contact fields on the listing', async () => {
    const { svc, repo } = buildService();

    await svc.ownerSubmit(BASE_DTO);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Listing>;
    expect(saved.ownerName).toBe('Ram Bahadur');
    expect(saved.ownerPhone).toBe('+9779800000099');
    expect(saved.ownerEmail).toBe('ram@example.com');
  });

  it('stamps tenantId from context', async () => {
    const { svc, repo } = buildService();

    await svc.ownerSubmit(BASE_DTO);

    const saved = (repo.save as jest.Mock).mock.calls[0][0] as Partial<Listing>;
    expect(saved.tenantId).toBe('tenant-1');
  });

  it('sends acknowledgement SMS to owner phone (best-effort)', async () => {
    const { svc, smsMock } = buildService();

    await svc.ownerSubmit(BASE_DTO);

    expect(smsMock.send).toHaveBeenCalledWith(
      BASE_DTO.ownerPhone,
      expect.stringContaining(BASE_DTO.title),
    );
  });

  it('does not throw if SMS send fails — submission still succeeds', async () => {
    const { svc, smsMock } = buildService();
    smsMock.send.mockRejectedValue(new Error('SMS gateway timeout'));

    await expect(svc.ownerSubmit(BASE_DTO)).resolves.toBeDefined();
  });

  it('does not call assertListingLimit — owner submissions bypass plan quota', async () => {
    const { svc } = buildService();

    await svc.ownerSubmit(BASE_DTO);

    expect(subscriptions.assertListingLimit).not.toHaveBeenCalled();
  });
});
