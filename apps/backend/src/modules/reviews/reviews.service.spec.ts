import { ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ReviewsService } from './reviews.service';
import { Review } from './review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

function makeRepo(overrides: Partial<Record<string, jest.Mock>> = {}): Repository<Review> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    create: jest.fn().mockImplementation((x) => x),
    ...overrides,
  } as unknown as Repository<Review>;
}

function buildSvc(repo: Repository<Review>): ReviewsService {
  return new ReviewsService(repo);
}

const TENANT = 'tenant-1';
const CUSTOMER = 'customer-1';
const LISTING = 'listing-1';

function makeDto(overrides: Partial<CreateReviewDto> = {}): CreateReviewDto {
  return { listingId: LISTING, rating: 4, ...overrides };
}

describe('ReviewsService.create', () => {
  it('saves review with correct fields when no duplicate exists', async () => {
    const repo = makeRepo();
    const svc = buildSvc(repo);
    const dto = makeDto({ rating: 5, comment: 'Great place!' });

    const result = await svc.create(TENANT, CUSTOMER, dto);

    expect(repo.create).toHaveBeenCalledWith({
      tenantId: TENANT,
      listingId: LISTING,
      customerId: CUSTOMER,
      rating: 5,
      comment: 'Great place!',
    });
    expect(repo.save).toHaveBeenCalled();
    expect(result.id).toBe('uuid-1');
  });

  it('throws ConflictException when a duplicate review exists', async () => {
    const existing: Partial<Review> = {
      id: 'uuid-x',
      tenantId: TENANT,
      listingId: LISTING,
      customerId: CUSTOMER,
      rating: 3,
    };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const svc = buildSvc(repo);

    await expect(svc.create(TENANT, CUSTOMER, makeDto())).rejects.toThrow(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('ReviewsService.findByListing', () => {
  it('returns reviews with correct averageRating for ratings [4, 5]', async () => {
    const fakeReviews = [
      { id: 'r1', rating: 4 } as Review,
      { id: 'r2', rating: 5 } as Review,
    ];
    const repo = makeRepo({ find: jest.fn().mockResolvedValue(fakeReviews) });
    const svc = buildSvc(repo);

    const result = await svc.findByListing(TENANT, LISTING);

    expect(result.total).toBe(2);
    expect(result.averageRating).toBe(4.5);
    expect(result.reviews).toBe(fakeReviews);
  });

  it('returns averageRating 0 and total 0 when no reviews exist', async () => {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const svc = buildSvc(repo);

    const result = await svc.findByListing(TENANT, LISTING);

    expect(result.total).toBe(0);
    expect(result.averageRating).toBe(0);
    expect(result.reviews).toEqual([]);
  });

  it('returns total 0 when repo returns empty for a wrong tenantId (cross-tenant isolation)', async () => {
    const repo = makeRepo({ find: jest.fn().mockResolvedValue([]) });
    const svc = buildSvc(repo);

    const result = await svc.findByListing('wrong-tenant', LISTING);

    expect(result.total).toBe(0);
    expect(repo.find).toHaveBeenCalledWith({
      where: { tenantId: 'wrong-tenant', listingId: LISTING },
      order: { createdAt: 'DESC' },
    });
  });
});
