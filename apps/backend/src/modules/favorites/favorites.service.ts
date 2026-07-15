import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomerFavorite } from './customer-favorite.entity';
import { Listing } from '../listings/listing.entity';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(CustomerFavorite)
    private readonly favoriteRepo: Repository<CustomerFavorite>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
  ) {}

  async add(tenantId: string, customerId: string, dto: CreateFavoriteDto): Promise<void> {
    const existing = await this.favoriteRepo.findOne({
      where: { tenantId, customerId, listingId: dto.listingId },
    });
    if (!existing) {
      await this.favoriteRepo.save(
        this.favoriteRepo.create({ tenantId, customerId, listingId: dto.listingId }),
      );
    }
  }

  async remove(tenantId: string, customerId: string, listingId: string): Promise<void> {
    await this.favoriteRepo.delete({ tenantId, customerId, listingId });
  }

  async listIds(tenantId: string, customerId: string): Promise<string[]> {
    const favs = await this.favoriteRepo.find({ where: { tenantId, customerId } });
    return favs.map((f) => f.listingId);
  }

  async listWithListings(tenantId: string, customerId: string): Promise<Listing[]> {
    const ids = await this.listIds(tenantId, customerId);
    if (!ids.length) return [];
    return this.listingRepo.find({ where: { tenantId, id: In(ids) } });
  }
}
