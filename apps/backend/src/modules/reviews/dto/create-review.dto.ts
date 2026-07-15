import { IsUUID, IsInt, Min, Max, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  listingId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  comment?: string;
}
