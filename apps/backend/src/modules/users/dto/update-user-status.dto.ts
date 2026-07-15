import { IsEnum } from 'class-validator';
import { UserStatus } from '@common/enums/user-status.enum';

const ALLOWED = [UserStatus.ACTIVE, UserStatus.DISABLED] as const;

export class UpdateUserStatusDto {
  @IsEnum(ALLOWED)
  status!: (typeof ALLOWED)[number];
}
