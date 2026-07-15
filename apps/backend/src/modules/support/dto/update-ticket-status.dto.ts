import { IsEnum } from 'class-validator';
import { SupportTicketStatus } from '@common/enums/support-ticket-status.enum';

const ALLOWED = [
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.RESOLVED,
  SupportTicketStatus.CLOSED,
] as const;

export class UpdateTicketStatusDto {
  @IsEnum(ALLOWED)
  status!: (typeof ALLOWED)[number];
}
