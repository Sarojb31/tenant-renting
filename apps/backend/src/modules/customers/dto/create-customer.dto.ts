import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateCustomerDto {
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'phone must be a valid E.164 number' })
  phone!: string;

  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional() @IsString()
  preferredLanguage?: string;
}
