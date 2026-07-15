import { MatchingService } from './matching.service';
import { Listing } from '@modules/listings/listing.entity';
import { Customer } from '@modules/customers/customer.entity';
import { CustomerPreference } from '@modules/customers/customer-preference.entity';
import { SmsLog } from './sms-log.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { BhkType } from '@common/enums/bhk-type.enum';
import { RoomType } from '@common/enums/room-type.enum';
import { ObjectLiteral, Repository } from 'typeorm';

function makeQb(results: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['where'] = jest.fn().mockImplementation(chain);
  qb['andWhere'] = jest.fn().mockImplementation(chain);
  qb['getMany'] = jest.fn().mockResolvedValue(results);
  return qb;
}

function makeRepo<T extends ObjectLiteral>(overrides: Partial<Repository<T>> = {}): Repository<T> {
  return { findOne: jest.fn(), createQueryBuilder: jest.fn(), ...overrides } as unknown as Repository<T>;
}

const nullSms = { send: jest.fn().mockResolvedValue({ providerMessageId: 'p-1' }) };
const nullSubs = { deductSmsCredit: jest.fn().mockResolvedValue(true) };
const nullTemplateRepo = { findOne: jest.fn().mockResolvedValue(null) } as unknown as Repository<ObjectLiteral>;

function buildListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    tenantId: 'tenant-1',
    status: ListingStatus.PUBLISHED,
    roomType: RoomType.SINGLE,
    bhkType: BhkType.BHK_2,
    rentAmount: '15000',
    city: 'Kathmandu',
    title: 'Nice Room',
    ...overrides,
  } as unknown as Listing;
}

function buildSvc(overrides: {
  listingRepo?: Repository<Listing>;
  prefRepo?: Repository<CustomerPreference>;
  customerRepo?: Repository<Customer>;
  smsLogRepo?: Repository<SmsLog>;
}) {
  const { listingRepo, prefRepo, customerRepo, smsLogRepo } = overrides;
  return new MatchingService(
    listingRepo ?? makeRepo<Listing>(),
    customerRepo ?? makeRepo<Customer>({ createQueryBuilder: jest.fn().mockReturnValue(makeQb([])) }),
    prefRepo ?? makeRepo<CustomerPreference>(),
    smsLogRepo ?? makeRepo<SmsLog>({ findOne: jest.fn(), save: jest.fn(), update: jest.fn() }),
    nullTemplateRepo as never,
    nullSubs as never,
    nullSms as never,
  );
}

describe('MatchingService bhkType matching', () => {
  it('includes bhkType IS NULL condition in preference query', async () => {
    const listing = buildListing();
    const qb = makeQb([]);
    const svc = buildSvc({
      listingRepo: makeRepo<Listing>({ findOne: jest.fn().mockResolvedValue(listing) }),
      prefRepo: makeRepo<CustomerPreference>({ createQueryBuilder: jest.fn().mockReturnValue(qb) }),
    });

    await svc.triggerMatchForListing('listing-1', 'tenant-1');

    const bhkCall = (qb['andWhere'] as jest.Mock).mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('bhkType'),
    );
    expect(bhkCall).toBeDefined();
    expect(bhkCall![0]).toContain('p.bhkType IS NULL OR p.bhkType = :bhkType');
    expect(bhkCall![1]).toEqual({ bhkType: BhkType.BHK_2 });
  });

  it('passes null bhkType when listing has no bhkType', async () => {
    const listing = buildListing({ bhkType: null as never });
    const qb = makeQb([]);
    const svc = buildSvc({
      listingRepo: makeRepo<Listing>({ findOne: jest.fn().mockResolvedValue(listing) }),
      prefRepo: makeRepo<CustomerPreference>({ createQueryBuilder: jest.fn().mockReturnValue(qb) }),
    });

    await svc.triggerMatchForListing('listing-1', 'tenant-1');

    const bhkCall = (qb['andWhere'] as jest.Mock).mock.calls.find(
      (args: unknown[]) => typeof args[0] === 'string' && args[0].includes('bhkType'),
    );
    expect(bhkCall![1]).toEqual({ bhkType: null });
  });

  it('skips triggerMatch when listing not found', async () => {
    const prefRepo = makeRepo<CustomerPreference>({ createQueryBuilder: jest.fn() });
    const svc = buildSvc({
      listingRepo: makeRepo<Listing>({ findOne: jest.fn().mockResolvedValue(null) }),
      prefRepo,
    });

    await svc.triggerMatchForListing('missing', 'tenant-1');
    expect(prefRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
