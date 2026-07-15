import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly repo: Repository<Review>,
  ) {}

  async create(tenantId: string, customerId: string, dto: CreateReviewDto): Promise<Review> {
    const existing = await this.repo.findOne({
      where: { tenantId, listingId: dto.listingId, customerId },
    });
    if (existing) throw new ConflictException('You have already reviewed this listing');
    return this.repo.save(
      this.repo.create({
        tenantId,
        listingId: dto.listingId,
        customerId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      }),
    );
  }

  async findByListing(
    tenantId: string,
    listingId: string,
  ): Promise<{ reviews: Review[]; averageRating: number; total: number }> {
    const reviews = await this.repo.find({
      where: { tenantId, listingId },
      order: { createdAt: 'DESC' },
    });
    const total = reviews.length;
    const averageRating =
      total > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10
        : 0;
    return { reviews, averageRating, total };
  }
}
