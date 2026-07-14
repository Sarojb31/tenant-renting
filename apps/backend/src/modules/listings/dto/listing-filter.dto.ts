import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { RoomType } from '@common/enums/room-type.enum';

export class ListingFilterDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @IsNumberString({}, { message: 'minRent must be a number' })
  minRent?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'maxRent must be a number' })
  maxRent?: string;
}
