import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '@common/decorators/current-user.decorator';
import { UserRole } from '@common/enums/user-role.enum';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @ApiOperation({ summary: 'Onboard a new tenant (Super Admin only)' })
  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.onboard(dto);
  }

  @ApiOperation({ summary: 'Get tenant by id' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role === UserRole.COMPANY_ADMIN && user.tenantId !== id) {
      throw new ForbiddenException('Access denied');
    }
    const tenant = await this.tenantsService.findById(id);
    if (!tenant) throw new ForbiddenException('Tenant not found');
    return tenant;
  }

  @ApiOperation({ summary: 'Update tenant settings' })
  @Roles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.role === UserRole.COMPANY_ADMIN) {
      if (user.tenantId !== id) throw new ForbiddenException('Access denied');
      // Company admins cannot change status — only super admin
      delete dto.status;
    }
    return this.tenantsService.update(id, dto);
  }
}
