import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
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
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @Get()
  findAll(@Req() req: Request, @Query('page') page = '1', @Query('limit') limit = '10') {
    const user = req.user as JwtPayload;
    const tenantId = user.role === UserRole.SUPER_ADMIN ? null : user.tenantId;
    return this.paymentsService.findAll(Number(page), Number(limit), tenantId);
  }

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

  @Post('callback/esewa')
  async handleEsewaCallback(
    @Body() body: { data?: string } & Record<string, unknown>,
    @Req() req: Request & { rawBody?: Buffer },
    @Res() res: Response,
  ) {
    const customerAppUrl =
      this.config.get<string>('app.customerAppBaseUrl') ?? 'http://localhost:5173';
    try {
      let payload: unknown = body;
      // eSewa v3 sends base64-encoded JSON in `data` field
      if (body.data && typeof body.data === 'string') {
        payload = JSON.parse(Buffer.from(body.data, 'base64').toString('utf-8'));
      }
      const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(payload));
      await this.paymentsService.handleWebhookEvent(PaymentGateway.ESEWA, payload, rawBody, '');
      return res.redirect(`${customerAppUrl}/payment/success`);
    } catch {
      return res.redirect(`${customerAppUrl}/payment/failed`);
    }
  }

  @Get('callback/khalti')
  async handleKhaltiCallback(
    @Query() query: Record<string, string>,
    @Res() res: Response,
  ) {
    const customerAppUrl =
      this.config.get<string>('app.customerAppBaseUrl') ?? 'http://localhost:5173';
    try {
      const rawBody = Buffer.from(JSON.stringify(query));
      await this.paymentsService.handleWebhookEvent(PaymentGateway.KHALTI, query, rawBody, '');
      return res.redirect(`${customerAppUrl}/payment/success`);
    } catch {
      return res.redirect(`${customerAppUrl}/payment/failed`);
    }
  }
}
