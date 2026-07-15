import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './support-ticket.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket]), CommonModule],
  providers: [SupportService],
  controllers: [SupportController],
})
export class SupportModule {}
