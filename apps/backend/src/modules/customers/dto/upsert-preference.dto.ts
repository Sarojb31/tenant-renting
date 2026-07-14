import {
  IsOptional,
  IsArray,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumberString,
  IsDateString,
} from 'class-validator';
import { RoomType } from '@common/enums/room-type.enum';

export class UpsertPreferenceDto {
  @IsOptional() @IsArray() @IsString({ each: true })
  locations?: string[];

  @IsOptional() @IsNumberString({})
  budgetMin?: string;

  @IsOptional() @IsNumberString({})
  budgetMax?: string;

  @IsOptional() @IsEnum(RoomType)
  roomType?: RoomType;

  @IsOptional() @IsDateString()
  moveInDate?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  amenitiesWanted?: string[];

  @IsOptional() @IsBoolean()
  active?: boolean;
}
