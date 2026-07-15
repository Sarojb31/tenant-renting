import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@common/common.module';
import { FbPageLead } from './fb-page-lead.entity';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FbPageLead]), CommonModule],
  providers: [FacebookService],
  controllers: [FacebookController],
})
export class FacebookIntegrationModule {}
