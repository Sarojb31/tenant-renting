import { IsEnum, IsUUID } from 'class-validator';
import { PaymentGateway } from '../../../common/enums/payment-gateway.enum';

export class CreatePaymentIntentDto {
  @IsUUID()
  bookingId!: string;

  @IsEnum(PaymentGateway)
  gateway!: PaymentGateway;
}
