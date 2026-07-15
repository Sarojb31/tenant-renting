import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { TenantContextService } from '@common/tenant-context.service';

interface AuthReq {
  user: { sub: string; tenantId: string; role: UserRole };
}

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(
    private readonly service: SupportService,
    private readonly ctx: TenantContextService,
  ) {}

  @Roles(UserRole.COMPANY_ADMIN, UserRole.STAFF)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupportTicketDto, @Req() req: AuthReq) {
    return this.service.create(req.user.tenantId, req.user.sub, dto);
  }

  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @Get()
  list(@Req() req: AuthReq) {
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return this.service.findAllPlatform();
    }
    return this.service.findAllForTenant(req.user.tenantId);
  }

  @Roles(UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }
}
