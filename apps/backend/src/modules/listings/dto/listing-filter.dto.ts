import { IsOptional, IsString, IsEnum, IsNumberString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { RoomType } from '@common/enums/room-type.enum';
import { BhkType } from '@common/enums/bhk-type.enum';

export class ListingFilterDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional()
  @IsEnum(BhkType)
  bhkType?: BhkType;

  @IsOptional()
  @IsNumberString({}, { message: 'numberOfRooms must be a number' })
  numberOfRooms?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'minRent must be a number' })
  minRent?: string;

  @IsOptional()
  @IsNumberString({}, { message: 'maxRent must be a number' })
  maxRent?: string;

  // Comma-separated amenity UUIDs
  @IsOptional()
  @IsString()
  amenityIds?: string;

  // Opaque base64 cursor encoding { c: createdAt ISO, i: id }
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
