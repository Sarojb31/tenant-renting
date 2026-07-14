import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../common/tenant-context.service';
import { Listing } from '../listings/listing.entity';
import { ListingStatus } from '../../common/enums/listing-status.enum';
import { Booking } from './booking.entity';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Listing)
    private readonly listingRepo: Repository<Listing>,
    private readonly tenantCtx: TenantContextService,
  ) {}

  async create(customerId: string, dto: CreateBookingDto): Promise<Booking> {
    const tenantId = this.tenantCtx.getRequiredTenantId();

    const listing = await this.listingRepo.findOne({
      where: { id: dto.listingId, tenantId, status: ListingStatus.PUBLISHED },
    });
    if (!listing) {
      throw new NotFoundException('Listing not found or not available');
    }

    const booking = this.bookingRepo.create({
      tenantId,
      listingId: dto.listingId,
      customerId,
      moveInDate: dto.moveInDate,
      amountDue: listing.rentAmount,
      amountPaid: '0',
      status: BookingStatus.PENDING,
    } as any) as unknown as Booking;

    return this.bookingRepo.save(booking) as Promise<Booking>;
  }

  async findOne(id: string): Promise<Booking> {
    const tenantId = this.tenantCtx.getRequiredTenantId();
    const booking = await this.bookingRepo.findOne({ where: { id, tenantId } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }
}
