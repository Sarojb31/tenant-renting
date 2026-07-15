import { IsEnum, IsUUID } from 'class-validator';
import { PaymentGateway } from '../../../common/enums/payment-gateway.enum';

export class CreateSubscriptionIntentDto {
  @IsUUID()
  planId!: string;

  @IsEnum(PaymentGateway)
  gateway!: PaymentGateway;
}
