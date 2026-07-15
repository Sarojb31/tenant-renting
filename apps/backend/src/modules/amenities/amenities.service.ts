import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Amenity } from './amenity.entity';
import { AmenityCategory } from '@common/enums/amenity-category.enum';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectRepository(Amenity)
    private readonly repo: Repository<Amenity>,
  ) {}

  findAll(category?: AmenityCategory): Promise<Amenity[]> {
    return category
      ? this.repo.find({ where: { category }, order: { name: 'ASC' } })
      : this.repo.find({ order: { name: 'ASC' } });
  }

  findByIds(ids: string[]): Promise<Amenity[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.repo
      .createQueryBuilder('a')
      .where('a.id IN (:...ids)', { ids })
      .getMany();
  }

  async upsert(name: string, category: AmenityCategory): Promise<Amenity> {
    const existing = await this.repo.findOne({ where: { name } });
    if (existing) return existing;
    return this.repo.save({ name, category });
  }
}
