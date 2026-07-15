import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { TenantSettingsController } from './tenant-settings.controller';
import { UsersModule } from '@modules/users/users.module';
import { CommonModule } from '@common/common.module';

// Implements: Plan Section 4.1, 14 (/tenants endpoints)
// Build order: Phase 1 Step 1 (Tenants/Auth)
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), UsersModule, CommonModule],
  providers: [TenantsService],
  controllers: [TenantsController, TenantSettingsController],
  exports: [TenantsService, TypeOrmModule],
})
export class TenantsModule {}
