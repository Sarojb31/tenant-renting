import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsEmail,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { RoomType } from '@common/enums/room-type.enum';

export class OwnerSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  ownerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ownerPhone!: string;

  @IsEmail()
  @IsOptional()
  ownerEmail?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(RoomType)
  roomType!: RoomType;

  @IsNumber()
  @IsPositive()
  rentAmount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(3)
  currency?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;
}
