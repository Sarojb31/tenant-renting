import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSmsTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(320)
  bodyText?: string;
}
