import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ListingStatus } from '@common/enums/listing-status.enum';

const ALLOWED = [ListingStatus.PUBLISHED, ListingStatus.OCCUPIED] as const;

export class UpdateAvailabilityDto {
  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @IsEnum(ALLOWED)
  @IsOptional()
  status?: (typeof ALLOWED)[number];
}
