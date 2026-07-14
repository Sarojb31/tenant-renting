import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomerPreference } from './customer-preference.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CommonModule } from '@common/common.module';

// Implements: Plan Section 4.4, 14 (/customers endpoints)
@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerPreference]), CommonModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
