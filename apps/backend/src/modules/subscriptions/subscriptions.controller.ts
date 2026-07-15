import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { TenantContextService } from '@common/tenant-context.service';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly service: SubscriptionsService,
    private readonly ctx: TenantContextService,
  ) {}

  @ApiOperation({ summary: 'List all available subscription plans' })
  @Get('plans')
  listPlans() {
    return this.service.listPlans();
  }

  @ApiOperation({ summary: 'Get current subscription for this tenant' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @Get('current')
  async getCurrent() {
    const tenantId = this.ctx.getRequiredTenantId();
    const sub = await this.service.getCurrentSubscription(tenantId);
    if (!sub) throw new NotFoundException('No subscription found for this tenant');
    return sub;
  }

  @ApiOperation({ summary: 'Subscribe or upgrade tenant plan (Company Admin)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @Post('subscribe')
  subscribe(@Body() dto: SubscribeDto) {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.subscribe(tenantId, dto.planId);
  }

  @ApiOperation({ summary: 'Cancel current subscription (Company Admin)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Delete('cancel')
  cancel() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.cancel(tenantId);
  }

  @ApiOperation({ summary: 'Mark subscription past_due — dunning trigger (Super Admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post('mark-past-due')
  markPastDue() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.service.markPastDue(tenantId);
  }
}
