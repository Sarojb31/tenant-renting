import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Length,
  IsPositive,
  IsInt,
  IsArray,
  IsUUID,
} from 'class-validator';
import { RoomType } from '@common/enums/room-type.enum';
import { BhkType } from '@common/enums/bhk-type.enum';
import { ListingStatus } from '@common/enums/listing-status.enum';

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RoomType)
  roomType!: RoomType;

  @IsEnum(BhkType)
  @IsOptional()
  bhkType?: BhkType;

  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfRooms?: number;

  // Array of amenity UUIDs to associate with this listing
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  amenityIds?: string[];

  @IsNumber()
  @IsPositive()
  rentAmount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  depositAmount?: number;

  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsDateString()
  @IsOptional()
  availableFrom?: string;

  @IsEnum(ListingStatus)
  @IsOptional()
  status?: ListingStatus;
}
