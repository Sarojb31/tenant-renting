import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './customer.entity';
import { CustomerImage } from './customer-image.entity';
import { CustomerPreference } from './customer-preference.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { CommonModule } from '@common/common.module';
import { StorageModule } from '@modules/storage/storage.module';

// Implements: Plan Section 4.4, 14 (/customers endpoints)
@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerPreference, CustomerImage]), CommonModule, StorageModule],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
