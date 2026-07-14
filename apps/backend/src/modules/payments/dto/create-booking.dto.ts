import { IsDateString, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  listingId!: string;

  @IsDateString()
  moveInDate!: string;
}
