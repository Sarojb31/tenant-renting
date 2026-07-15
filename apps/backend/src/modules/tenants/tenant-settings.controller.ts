import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { TenantContextService } from '@common/tenant-context.service';

@ApiTags('tenant-settings')
@Controller('tenant-settings')
export class TenantSettingsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly ctx: TenantContextService,
  ) {}

  @ApiOperation({ summary: 'Get public branding fields for the current tenant (no auth required)' })
  @Get('branding')
  async getBranding() {
    const tenantId = this.ctx.getRequiredTenantId();
    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    return {
      name: tenant.name,
      logoUrl: tenant.logoUrl,
      themeColor: tenant.themeColor,
      defaultCurrency: tenant.defaultCurrency,
    };
  }
}
