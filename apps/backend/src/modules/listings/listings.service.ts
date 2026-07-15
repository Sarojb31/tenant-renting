import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { FILE_STORAGE_PROVIDER, FileStorageProvider } from '@modules/storage/file-storage.provider';
import { MATCHING_QUEUE, MatchListingJobData } from '@modules/matching/matching.processor';
import { AmenitiesService } from '@modules/amenities/amenities.service';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';

export interface ListingPage {
  data: Listing[];
  nextCursor: string | null;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { c: string; i: string };
    if (!parsed.c || !parsed.i) return null;
    return { createdAt: parsed.c, id: parsed.i };
  } catch {
    return null;
  }
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(Listing)
    private readonly repo: Repository<Listing>,
    @InjectRepository(ListingImage)
    private readonly imageRepo: Repository<ListingImage>,
    private readonly ctx: TenantContextService,
    private readonly amenitiesService: AmenitiesService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(FILE_STORAGE_PROVIDER)
    private readonly storageProvider: FileStorageProvider,
    @InjectQueue(MATCHING_QUEUE)
    private readonly matchingQueue: Queue<MatchListingJobData>,
  ) {}

  // Public search — cursor-paginated, published only (Plan §4.3, §14.1)
  async findAll(filters: ListingFilterDto = {}): Promise<ListingPage> {
    const tenantId = this.ctx.getTenantId();
    if (!tenantId) return { data: [], nextCursor: null };

    const limit = filters.limit ?? 20;

    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .andWhere('l.status = :status', { status: ListingStatus.PUBLISHED })
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .take(limit + 1); // fetch one extra to detect next page

    if (filters.city) qb.andWhere('l.city = :city', { city: filters.city });
    if (filters.roomType) qb.andWhere('l.roomType = :roomType', { roomType: filters.roomType });
    if (filters.bhkType) qb.andWhere('l.bhkType = :bhkType', { bhkType: filters.bhkType });
    if (filters.numberOfRooms !== undefined) {
      qb.andWhere('l.numberOfRooms = :numberOfRooms', { numberOfRooms: parseInt(filters.numberOfRooms, 10) });
    }
    if (filters.minRent !== undefined) {
      qb.andWhere('l.rentAmount >= :minRent', { minRent: parseFloat(filters.minRent) });
    }
    if (filters.maxRent !== undefined) {
      qb.andWhere('l.rentAmount <= :maxRent', { maxRent: parseFloat(filters.maxRent) });
    }
    if (filters.amenityIds) {
      const ids = filters.amenityIds.split(',').map((s) => s.trim()).filter(Boolean);
      if (ids.length) {
        qb.innerJoin('l.amenities', 'a', 'a.id IN (:...amenityIds)', { amenityIds: ids });
      }
    }
    if (filters.cursor) {
      const decoded = decodeCursor(filters.cursor);
      if (decoded) {
        qb.andWhere(
          '(l.createdAt, l.id) < (:cursorCreatedAt, :cursorId)',
          { cursorCreatedAt: decoded.createdAt, cursorId: decoded.id },
        );
      }
    }

    const rows = await qb.getMany();
    const hasNext = rows.length > limit;
    const data = hasNext ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasNext && data.length > 0
        ? encodeCursor(data[data.length - 1].createdAt as unknown as Date, data[data.length - 1].id)
        : null;

    return { data, nextCursor };
  }

  // Admin-only: returns all statuses, offset-paginated, with total count
  async findAllAdmin(params: { page?: number; limit?: number; status?: string; city?: string }): Promise<{ data: Listing[]; total: number }> {
    const tenantId = this.ctx.getRequiredTenantId();
    const limit = Math.min(params.limit ?? 50, 100);
    const offset = ((params.page ?? 1) - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('l')
      .where('l.tenantId = :tenantId', { tenantId })
      .orderBy('l.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (params.status) qb.andWhere('l.status = :status', { status: params.status });
    if (params.city) qb.andWhere('l.city = :city', { city: params.city });

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string): Promise<Listing | null> {
    const tenantId = this.ctx.getTenantId();
    if (!tenantId) return null;
    return this.repo.findOne({ where: { id, tenantId } });
  }

  async create(dto: CreateListingDto, createdBy: string): Promise<Listing> {
    const tenantId = this.ctx.getRequiredTenantId();
    const currentCount = await this.repo.count({ where: { tenantId } });
    await this.subscriptions.assertListingLimit(tenantId, currentCount);

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
