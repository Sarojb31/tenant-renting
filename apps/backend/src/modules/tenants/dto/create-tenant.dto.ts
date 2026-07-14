import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Rentals' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'acme', description: 'Lowercase alphanumeric + hyphens' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'subdomain must be lowercase alphanumeric and hyphens only' })
  subdomain!: string;

  @ApiProperty({ example: 'NP' })
  @IsString()
  @IsNotEmpty()
  country!: string;

  @ApiProperty({ example: 'NPR', minLength: 3, maxLength: 3 })
  @IsString()
  @Length(3, 3)
  defaultCurrency!: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  adminEmail!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  adminName!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
