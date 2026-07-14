import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { FILE_STORAGE_PROVIDER, FileStorageProvider } from '@modules/storage/file-storage.provider';
import { MATCHING_QUEUE, MatchListingJobData } from '@modules/matching/matching.processor';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly repo: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly imageRepo: Repository<ListingImage>,
    private readonly ctx: TenantContextService,
    @Inject(FILE_STORAGE_PROVIDER)
    private readonly storageProvider: FileStorageProvider,
    @InjectQueue(MATCHING_QUEUE)
    private readonly matchingQueue: Queue<MatchListingJobData>,
  ) {}

  // Public search — always restricted to published listings (Plan §4.3)
  findAll(filters: ListingFilterDto = {}): Promise<Listing[]> {
    const tenantId = this.ctx.getTenantId();
    if (!tenantId) return Promise.resolve([]);

    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.status = :status', { status: ListingStatus.PUBLISHED })
      .orderBy('l.createdAt', 'DESC');

    if (filters.city) qb.andWhere('l.city = :city', { city: filters.city });
    if (filters.roomType) qb.andWhere('l.roomType = :roomType', { roomType: filters.roomType });
    if (filters.minRent !== undefined) {
      qb.andWhere('l.rentAmount >= :minRent', { minRent: parseFloat(filters.minRent) });
    }
    if (filters.maxRent !== undefined) {
      qb.andWhere('l.rentAmount <= :maxRent', { maxRent: parseFloat(filters.maxRent) });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Listing | null> {
    const tenantId = this.ctx.getTenantId();
    if (!tenantId) return null;
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async create(dto: CreateListingDto, createdBy: string): Promise<Listing> {
    const tenantId = this.ctx.getRequiredTenantId();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listing = await this.repo.save({
      ...dto,
      tenantId,
      createdBy,
      status: dto.status ?? ListingStatus.DRAFT,
    } as any);

    if (listing.status === ListingStatus.PUBLISHED) {
      await this.dispatchMatchJob(listing.id, tenantId);
    }
    return listing;
  }

  async update(id: string, dto: UpdateListingDto): Promise<Listing> {
    const tenantId = this.ctx.getRequiredTenantId();
    const listing = await this.repo.findOne({ where: { id, tenantId } });
    if (!listing) throw new NotFoundException('Listing not found');
    const wasPublished = listing.status === ListingStatus.PUBLISHED;
    Object.assign(listing, dto);
    const saved = await this.repo.save(listing);

    // Trigger match when status transitions to PUBLISHED
    if (!wasPublished && saved.status === ListingStatus.PUBLISHED) {
      await this.dispatchMatchJob(saved.id, tenantId);
    }
    return saved;
  }

  async archive(id: string): Promise<Listing> {
    const tenantId = this.ctx.getRequiredTenantId();
    const listing = await this.repo.findOne({ where: { id, tenantId } });
    if (!listing) throw new NotFoundException('Listing not found');
    listing.status = ListingStatus.ARCHIVED;
    return this.repo.save(listing);
  }

  async addImages(listingId: string, files: Express.Multer.File[]): Promise<ListingImage[]> {
    const tenantId = this.ctx.getRequiredTenantId();
    const listing = await this.repo.findOne({ where: { id: listingId, tenantId } });
    if (!listing) throw new NotFoundException('Listing not found');

    const existing = await this.imageRepo.find({
      where: { listingId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    let nextSort = existing.length > 0 ? existing[0].sortOrder + 1 : 0;

    const saved: ListingImage[] = [];
    for (const file of files) {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
      const key = `listings/${listingId}/${Date.now()}-${safeName}`;
      const url = await this.storageProvider.upload(key, file.buffer, file.mimetype);
      saved.push(await this.imageRepo.save({ listingId, url, sortOrder: nextSort++ }));
    }

    return saved;
  }

  findImages(listingId: string): Promise<ListingImage[]> {
    return this.imageRepo.find({ where: { listingId }, order: { sortOrder: 'ASC' } });
  }

  private async dispatchMatchJob(listingId: string, tenantId: string): Promise<void> {
    try {
      await this.matchingQueue.add('match-listing', { listingId, tenantId });
    } catch (err) {
      // Job dispatch failure must not fail the HTTP request
      this.logger.error(`Failed to dispatch match job for listing ${listingId}: ${String(err)}`);
    }
  }
}
