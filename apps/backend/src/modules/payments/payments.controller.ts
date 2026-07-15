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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { PaymentGateway } from '../../common/enums/payment-gateway.enum';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateSubscriptionIntentDto } from './dto/create-subscription-intent.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  async createIntent(@Body() dto: CreatePaymentIntentDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    return this.paymentsService.createIntent(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Post('subscription-intent')
  async createSubscriptionIntent(@Body() dto: CreateSubscriptionIntentDto, @Req() req: Request) {
    const { tenantId } = req.user as JwtPayload;
    return this.paymentsService.createSubscriptionIntent(tenantId!, dto);
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
