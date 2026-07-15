import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { JwtPayload } from '@modules/auth/strategies/jwt.strategy';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.COMPANY_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'List all staff/agent users for this tenant' })
  @Get()
  findAll(@Req() req: Request) {
    const { tenantId } = req.user as JwtPayload;
    return this.usersService.findAllForTenant(tenantId!);
  }

  @ApiOperation({ summary: 'Invite a new staff or agent user' })
  @Post('invite')
  invite(@Req() req: Request, @Body() dto: InviteUserDto) {
    const { tenantId } = req.user as JwtPayload;
    return this.usersService.invite(tenantId!, dto);
  }

  @ApiOperation({ summary: 'Enable or disable a user' })
  @Patch(':id/status')
  setStatus(
    @Req() req: Request,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const { tenantId } = req.user as JwtPayload;
    return this.usersService.setStatus(tenantId!, id, dto);
  }
}
