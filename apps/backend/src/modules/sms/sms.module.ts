import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsRoutingService } from './sms-routing.service';
import { SparrowSmsAdapter } from './adapters/sparrow-sms.adapter';
import { AakashSmsAdapter } from './adapters/aakash-sms.adapter';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { NullSmsAdapter } from './adapters/null-sms.adapter';
import { SMS_PROVIDER } from './sms.provider.interface';
import { SmsTemplate } from './sms-template.entity';
import { SmsTemplatesService } from './sms-templates.service';
import { SmsTemplatesController } from './sms-templates.controller';
import { CommonModule } from '@common/common.module';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([SmsTemplate]), CommonModule],
  providers: [
    NullSmsAdapter,
    SparrowSmsAdapter,
    AakashSmsAdapter,
    TwilioAdapter,
    SmsRoutingService,
    SmsTemplatesService,
    { provide: SMS_PROVIDER, useClass: SmsRoutingService },
  ],
  controllers: [SmsTemplatesController],
  exports: [SMS_PROVIDER, SmsTemplatesService, TypeOrmModule],
})
export class SmsModule {}
