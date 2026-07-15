import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description!: string;
}
