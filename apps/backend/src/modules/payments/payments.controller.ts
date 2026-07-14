import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  async createIntent(@Body() dto: CreatePaymentIntentDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    return this.paymentsService.createIntent(user.sub, dto);
  }

  @Post('webhook/:gateway')
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() body: unknown,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') stripeSig?: string,
  ) {
    const gw = gateway as PaymentGateway;
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const signature = stripeSig ?? '';
    await this.paymentsService.handleWebhookEvent(gw, body, rawBody, signature);
    return { received: true };
  }
}
