import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { TenantContextService } from '@common/tenant-context.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly ctx: TenantContextService,
  ) {}

  @ApiOperation({ summary: 'Tenant dashboard metrics (Company Admin)' })
  @Roles(UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT)
  @Get('overview')
  getOverview() {
    const tenantId = this.ctx.getRequiredTenantId();
    return this.analytics.getTenantAnalytics(tenantId);
  }

  @ApiOperation({ summary: 'Platform-level metrics (Super Admin only)' })
  @Roles(UserRole.SUPER_ADMIN)
  @Get('platform')
  getPlatform() {
    return this.analytics.getPlatformAnalytics();
  }
}
