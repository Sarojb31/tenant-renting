import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SmsTemplatesService } from './sms-templates.service';
import { CreateSmsTemplateDto } from './dto/create-sms-template.dto';
import { UpdateSmsTemplateDto } from './dto/update-sms-template.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';

const READ_ROLES = [UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT];
const WRITE_ROLES = [UserRole.COMPANY_ADMIN, UserRole.STAFF];

@ApiTags('sms-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sms-templates')
export class SmsTemplatesController {
  constructor(private readonly service: SmsTemplatesService) {}

  @ApiOperation({ summary: 'List SMS templates (tenant + platform defaults)' })
  @Roles(...READ_ROLES)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Get a single SMS template' })
  @Roles(...READ_ROLES)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Create an SMS template (Staff/Admin only)' })
  @Roles(...WRITE_ROLES)
  @Post()
  create(@Body() dto: CreateSmsTemplateDto) {
    return this.service.create(dto);
  }

  @ApiOperation({ summary: 'Update an SMS template (Staff/Admin only — cannot edit platform defaults)' })
  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSmsTemplateDto) {
    return this.service.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete an SMS template (Staff/Admin only — cannot delete platform defaults)' })
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
