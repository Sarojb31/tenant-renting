import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional() @IsString()
  preferredLanguage?: string;
}
