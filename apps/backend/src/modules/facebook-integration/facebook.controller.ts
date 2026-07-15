import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FacebookService, MessengerPayload } from './facebook.service';
import { TenantContextService } from '@common/tenant-context.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('facebook')
@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly service: FacebookService,
    private readonly ctx: TenantContextService,
  ) {}

  /** GET /facebook/webhook — Meta hub verification */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.service.verifyWebhook(mode, token, challenge);
  }

  /** POST /facebook/webhook — receive Page messages (tenant identified by X-Tenant-Id header) */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: unknown,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') sig: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    this.service.verifySignature(rawBody, sig ?? '');
    if (!tenantId) throw new BadRequestException('x-tenant-id header required');
    await this.service.processEvent(tenantId, body as MessengerPayload);
    return { received: true };
  }

  /** GET /facebook/leads — list leads for this tenant (Company Admin + Staff) */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT)
  @Get('leads')
  getLeads() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.findLeadsForTenant(tenantId);
  }
}
