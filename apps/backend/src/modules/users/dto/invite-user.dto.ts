import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@common/enums/user-role.enum';

const INVITEABLE_ROLES = [UserRole.STAFF, UserRole.AGENT] as const;

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsEnum(INVITEABLE_ROLES)
  role!: (typeof INVITEABLE_ROLES)[number];

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}
