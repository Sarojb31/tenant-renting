import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@common/common.module';
import { FbPageLead } from './fb-page-lead.entity';
import { TenantFacebookConnection } from './tenant-facebook-connection.entity';
import { FacebookService } from './facebook.service';
import { FacebookConnectionService } from './facebook-connection.service';
import { FacebookController } from './facebook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([FbPageLead, TenantFacebookConnection]),
    CommonModule,
  ],
  providers: [FacebookService, FacebookConnectionService],
  controllers: [FacebookController],
})
export class FacebookIntegrationModule {}
