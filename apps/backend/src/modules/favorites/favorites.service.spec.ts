import { ObjectLiteral, Repository } from 'typeorm';
import { FavoritesService } from './favorites.service';
import { CustomerFavorite } from './customer-favorite.entity';
import { Listing } from '../listings/listing.entity';

function makeRepo<T extends ObjectLiteral>(overrides: Partial<Repository<T>> = {}): Repository<T> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    create: jest.fn().mockImplementation((x) => x),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  } as unknown as Repository<T>;
}

function buildSvc(
  favRepo: Partial<Repository<CustomerFavorite>> = {},
  listingRepo: Partial<Repository<Listing>> = {},
): FavoritesService {
  return new FavoritesService(
    makeRepo<CustomerFavorite>(favRepo),
    makeRepo<Listing>(listingRepo),
  );
}

const T = 'tenant-1';
const C = 'customer-1';
const L = 'listing-1';

describe('FavoritesService.add', () => {
  it('saves new favorite when not already saved', async () => {
    const repo = makeRepo<CustomerFavorite>({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new FavoritesService(repo, makeRepo<Listing>());
    await svc.add(T, C, { listingId: L });
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('skips save when favorite already exists (idempotent)', async () => {
    const existing = { id: 'f-1', tenantId: T, customerId: C, listingId: L };
    const repo = makeRepo<CustomerFavorite>({ findOne: jest.fn().mockResolvedValue(existing) });
    const svc = new FavoritesService(repo, makeRepo<Listing>());
    await svc.add(T, C, { listingId: L });
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('FavoritesService.remove', () => {
  it('calls delete with correct fields', async () => {
    const repo = makeRepo<CustomerFavorite>();
    const svc = new FavoritesService(repo, makeRepo<Listing>());
    await svc.remove(T, C, L);
    expect(repo.delete).toHaveBeenCalledWith({ tenantId: T, customerId: C, listingId: L });
  });
});

describe('FavoritesService.listIds', () => {
  it('returns listingIds from favorites', async () => {
    const favs = [
      { listingId: 'l-1' },
      { listingId: 'l-2' },
    ];
    const repo = makeRepo<CustomerFavorite>({ find: jest.fn().mockResolvedValue(favs) });
    const svc = new FavoritesService(repo, makeRepo<Listing>());
    const ids = await svc.listIds(T, C);
    expect(ids).toEqual(['l-1', 'l-2']);
  });

  it('returns empty array when no favorites', async () => {
    const svc = buildSvc();
    const ids = await svc.listIds(T, C);
    expect(ids).toEqual([]);
  });
});

describe('FavoritesService.listWithListings — cross-tenant isolation', () => {
  it('returns empty array when no favorites exist', async () => {
    const svc = buildSvc();
    const result = await svc.listWithListings(T, C);
    expect(result).toEqual([]);
  });

  it('fetches listings with tenant filter', async () => {
    const favs = [{ listingId: 'l-1' }];
    const listing = { id: 'l-1', tenantId: T } as Listing;
    const favRepo = makeRepo<CustomerFavorite>({ find: jest.fn().mockResolvedValue(favs) });
    const listingRepo = makeRepo<Listing>({ find: jest.fn().mockResolvedValue([listing]) });
    const svc = new FavoritesService(favRepo, listingRepo);
    const result = await svc.listWithListings(T, C);
    expect(result).toHaveLength(1);
    expect(listingRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tenantId: T }) }),
    );
  });
});
