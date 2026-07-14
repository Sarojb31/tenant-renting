import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CustomerEmailLoginDto {
  @ApiProperty({ example: 'demo@customer.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 1 })
  @IsString()
  @MinLength(1)
  password!: string;
}
