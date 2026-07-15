import { AmenitiesService } from './amenities.service';
import { Amenity } from './amenity.entity';
import { AmenityCategory } from '@common/enums/amenity-category.enum';
import { Repository } from 'typeorm';

function makeRepo(overrides: Partial<Repository<Amenity>> = {}): Repository<Amenity> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((e) => Promise.resolve({ id: 'uuid-1', ...e })),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    }),
    ...overrides,
  } as unknown as Repository<Amenity>;
}

describe('AmenitiesService.findAll', () => {
  it('calls find without filter when no category given', async () => {
    const repo = makeRepo();
    const svc = new AmenitiesService(repo);
    await svc.findAll();
    expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('passes category filter when given', async () => {
    const repo = makeRepo();
    const svc = new AmenitiesService(repo);
    await svc.findAll(AmenityCategory.FEASIBILITY);
    expect(repo.find).toHaveBeenCalledWith({
      where: { category: AmenityCategory.FEASIBILITY },
      order: { name: 'ASC' },
    });
  });
});

describe('AmenitiesService.findByIds', () => {
  it('returns empty array immediately when ids is empty', async () => {
    const repo = makeRepo();
    const svc = new AmenitiesService(repo);
    const result = await svc.findByIds([]);
    expect(result).toEqual([]);
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('queries by ids when non-empty', async () => {
    const qb = { where: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([{ id: 'id-1' }]) };
    const repo = makeRepo({ createQueryBuilder: jest.fn().mockReturnValue(qb) });
    const svc = new AmenitiesService(repo);
    const result = await svc.findByIds(['id-1']);
    expect(qb.where).toHaveBeenCalledWith('a.id IN (:...ids)', { ids: ['id-1'] });
    expect(result).toEqual([{ id: 'id-1' }]);
  });
});

describe('AmenitiesService.upsert', () => {
  it('returns existing amenity when name already exists', async () => {
    const existing = { id: 'uuid-x', name: 'WiFi', category: AmenityCategory.GENERAL };
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(existing) });
    const svc = new AmenitiesService(repo);
    const result = await svc.upsert('WiFi', AmenityCategory.GENERAL);
    expect(result).toBe(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('creates new amenity when name not found', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const svc = new AmenitiesService(repo);
    const result = await svc.upsert('Pool', AmenityCategory.FEASIBILITY);
    expect(repo.save).toHaveBeenCalledWith({ name: 'Pool', category: AmenityCategory.FEASIBILITY });
    expect(result.name).toBe('Pool');
  });
});
