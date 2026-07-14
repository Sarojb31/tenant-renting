import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';
import { Customer } from './customer.entity';
import { CustomerPreference } from './customer-preference.entity';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@common/enums/user-role.enum';
import { JwtPayload } from '@modules/auth/strategies/jwt.strategy';

const STAFF_ROLES = [UserRole.COMPANY_ADMIN, UserRole.STAFF, UserRole.AGENT];

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @ApiOperation({ summary: 'List all customers for this tenant (Staff only)' })
  @UseGuards(RolesGuard)
  @Roles(...STAFF_ROLES)
  @Get()
  findAll(): Promise<Customer[]> {
    return this.customersService.findAll();
  }

  @ApiOperation({ summary: 'Create customer manually (Staff only)' })
  @UseGuards(RolesGuard)
  @Roles(...STAFF_ROLES)
  @Post()
  create(@Body() dto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(dto);
  }

  @ApiOperation({ summary: 'Get customer by ID (Staff or the customer themselves)' })
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<Customer> {
    this.assertStaffOrSelf(req, id);
    const customer = await this.customersService.findOneScoped(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  @ApiOperation({ summary: 'Update customer profile (Staff or the customer themselves)' })
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: Request,
  ): Promise<Customer> {
    this.assertStaffOrSelf(req, id);
    return this.customersService.update(id, dto);
  }

  @ApiOperation({ summary: 'Upsert saved search preferences (Staff or the customer themselves)' })
  @Patch(':id/preferences')
  upsertPreference(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPreferenceDto,
    @Req() req: Request,
  ): Promise<CustomerPreference> {
    this.assertStaffOrSelf(req, id);
    return this.customersService.upsertPreference(id, dto);
  }

  // Staff (type='user') can access any customer in their tenant.
  // Customers (type='customer') can only access their own record.
  private assertStaffOrSelf(req: Request, customerId: string): void {
    const user = req.user as JwtPayload;
    if (user.type === 'user') return;
    if (user.sub !== customerId) throw new ForbiddenException('Access denied');
  }
}
