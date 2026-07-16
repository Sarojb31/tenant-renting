import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Redirect,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { FacebookService, MessengerPayload } from './facebook.service';
import { FacebookConnectionService } from './facebook-connection.service';
import { ByoConnectDto } from './dto/byo-connect.dto';
import { TenantContextService } from '@common/tenant-context.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('facebook')
@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly service: FacebookService,
    private readonly connectionService: FacebookConnectionService,
    private readonly ctx: TenantContextService,
  ) {}

  // ─── Webhook (public) ──────────────────────────────────────────────────────

  /** GET /facebook/webhook — Meta hub verification */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    return this.service.verifyWebhook(mode, token, challenge);
  }

  /**
   * POST /facebook/webhook — receive Page messages.
   *
   * Per §26.3: parse entry[0].id → lookup tenant_facebook_connections →
   * resolve App Secret by connection_method → verify HMAC → process.
   * x-tenant-id header no longer required or trusted.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() body: unknown,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-hub-signature-256') sig: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(body));
    const payload = body as MessengerPayload;

    // 1. Read fb_page_id from first entry before verification (safe — see §26.3)
    const fbPageId = payload?.entry?.[0]?.id;

    // 2. Lookup connection → resolves tenant + correct App Secret
    const resolved = fbPageId
      ? await this.connectionService.resolveAppSecret(fbPageId)
      : null;

    // 3. Verify HMAC with resolved secret (or global fallback)
    this.service.verifySignature(rawBody, sig ?? '', resolved?.appSecret);

    if (!resolved) {
      return { received: true }; // Unknown page — ack to Meta, no-op
    }

    await this.service.processEvent(resolved.tenantId, payload);
    return { received: true };
  }

  // ─── OAuth connect ────────────────────────────────────────────────────────

  /**
   * GET /facebook/connect — initiate Facebook Login for Business.
   * Redirects to Meta's OAuth dialog with state = base64(tenantId:userId).
   */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Get('connect')
  initiateOAuth(@CurrentUser() user: CurrentUserPayload): { url: string } {
    const tenantId = this.ctx.getRequiredTenantId();
    const url = this.connectionService.buildOAuthUrl(tenantId, user.sub);
    return { url };
  }

  /**
   * GET /facebook/callback — Meta redirects here after user grants permission.
   * Public endpoint (no JWT — called by browser after Meta redirect).
   * Exchanges code, stores token, calls subscribed_apps, redirects to admin console.
   */
  @Get('callback')
  @Redirect()
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') fbError: string,
  ) {
    const adminBase = this.connectionService.getAdminBaseUrl();

    if (fbError) {
      return {
        url: `${adminBase}/company/fb-leads?error=${encodeURIComponent(fbError)}`,
        statusCode: 302,
      };
    }
    if (!code || !state) throw new BadRequestException('Missing code or state');

    const redirectUrl = await this.connectionService.handleOAuthCallback(code, state);
    return { url: redirectUrl, statusCode: 302 };
  }

  // ─── BYO-app connect ──────────────────────────────────────────────────────

  /** POST /facebook/connect/byo-app — store tenant's own Meta App credentials */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Post('connect/byo-app')
  @HttpCode(HttpStatus.OK)
  connectByo(
    @Body() dto: ByoConnectDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.connectionService.connectByo(tenantId, user.sub, dto);
  }

  // ─── Status + Disconnect ──────────────────────────────────────────────────

  /** GET /facebook/status — current connection state for this tenant */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT)
  @Get('status')
  getStatus() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.connectionService.getStatus(tenantId);
  }

  /** DELETE /facebook/connect — remove the Facebook Page connection */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @Delete('connect')
  @HttpCode(HttpStatus.NO_CONTENT)
  disconnect() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.connectionService.disconnect(tenantId);
  }

  // ─── Leads ────────────────────────────────────────────────────────────────

  /** GET /facebook/leads — list Page inbox leads for this tenant */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT)
  @Get('leads')
  getLeads() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.findLeadsForTenant(tenantId);
  }
}
