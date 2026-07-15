import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant-context.service';
import { FILE_STORAGE_PROVIDER, FileStorageProvider } from '@modules/storage/file-storage.provider';
import { MATCHING_QUEUE, MatchListingJobData } from '@modules/matching/matching.processor';
import { AmenitiesService } from '@modules/amenities/amenities.service';
import { SubscriptionsService } from '@modules/subscriptions/subscriptions.service';
import { Booking } from '@modules/payments/booking.entity';
import { Listing } from './listing.entity';
import { ListingImage } from './listing-image.entity';
import { ListingStatus } from '@common/enums/listing-status.enum';
import { RoomType } from '@common/enums/room-type.enum';
import { BhkType } from '@common/enums/bhk-type.enum';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { ListingFilterDto } from './dto/listing-filter.dto';

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { fields.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  fields.push(cur);
  return fields;
}

export interface BulkUploadResult {
  created: number;
  failed: number;
  errors: string[];
}

export interface ListingAvailability {
  id: string;
  status: ListingStatus;
  availableFrom: string | null;
  bookings: { id: string; moveInDate: string | null; status: string; customerId: string }[];
}

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
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
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

  async getAvailability(id: string): Promise<ListingAvailability> {
    const tenantId = this.ctx.getRequiredTenantId();
    const listing = await this.repo.findOne({ where: { id, tenantId } });
    if (!listing) throw new NotFoundException('Listing not found');

    const bookings = await this.bookingRepo.find({
      where: { listingId: id, tenantId },
      order: { moveInDate: 'ASC' },
      select: ['id', 'moveInDate', 'status', 'customerId'],
    });

    return {
      id: listing.id,
      status: listing.status,
      availableFrom: listing.availableFrom,
      bookings: bookings.map((b) => ({
        id: b.id,
        moveInDate: b.moveInDate,
        status: b.status,
        customerId: b.customerId,
      })),
    };
  }

  async updateAvailability(id: string, dto: UpdateAvailabilityDto): Promise<ListingAvailability> {
    const tenantId = this.ctx.getRequiredTenantId();
    const listing = await this.repo.findOne({ where: { id, tenantId } });
    if (!listing) throw new NotFoundException('Listing not found');

    if (dto.availableFrom !== undefined) listing.availableFrom = dto.availableFrom;
    if (dto.status !== undefined) listing.status = dto.status;
    await this.repo.save(listing);

    return this.getAvailability(id);
  }

  async bulkUpload(userId: string, csvBuffer: Buffer): Promise<BulkUploadResult> {
    const text = csvBuffer.toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) throw new BadRequestException('CSV must have a header row and at least one data row');

    const headers = parseCsvLine(lines[0]);
    const result: BulkUploadResult = { created: 0, failed: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? '').trim(); });

      try {
        const dto: CreateListingDto = {
          title: row['title'] || '',
          roomType: row['roomType'] as RoomType,
          rentAmount: parseFloat(row['rentAmount']),
          ...(row['description'] && { description: row['description'] }),
          ...(row['bhkType'] && { bhkType: row['bhkType'] as BhkType }),
          ...(row['numberOfRooms'] && { numberOfRooms: parseInt(row['numberOfRooms'], 10) }),
          ...(row['depositAmount'] && { depositAmount: parseFloat(row['depositAmount']) }),
          ...(row['currency'] && { currency: row['currency'] }),
          ...(row['address'] && { address: row['address'] }),
          ...(row['city'] && { city: row['city'] }),
          ...(row['availableFrom'] && { availableFrom: row['availableFrom'] }),
          ...(row['status'] && { status: row['status'] as ListingStatus }),
        };
        if (!dto.title) throw new Error('title is required');
        if (!dto.roomType || !Object.values(RoomType).includes(dto.roomType)) {
          throw new Error(`invalid roomType "${row['roomType']}"`);
        }
        if (!dto.rentAmount || isNaN(dto.rentAmount) || dto.rentAmount <= 0) {
          throw new Error('rentAmount must be a positive number');
        }
        await this.create(dto, userId);
        result.created++;
      } catch (err) {
        result.failed++;
        result.errors.push(`Row ${i + 1}: ${(err as Error).message}`);
      }
    }

    return result;
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
