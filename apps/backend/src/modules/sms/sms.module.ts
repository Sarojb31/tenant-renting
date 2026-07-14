import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsRoutingService } from './sms-routing.service';
import { SparrowSmsAdapter } from './adapters/sparrow-sms.adapter';
import { AakashSmsAdapter } from './adapters/aakash-sms.adapter';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { NullSmsAdapter } from './adapters/null-sms.adapter';
import { SMS_PROVIDER } from './sms.provider.interface';

// Implements: Plan Section 4.6, 16 (SMS adapter pattern + phone-prefix routing)
// SMS_PROVIDER = SmsRoutingService → routes +977 to Sparrow/Aakash, others to Twilio.
// Falls back to NullSmsAdapter when credentials are absent (dev/test without env vars).
@Module({
  imports: [ConfigModule],
  providers: [
    NullSmsAdapter,
    SparrowSmsAdapter,
    AakashSmsAdapter,
    TwilioAdapter,
    SmsRoutingService,
    { provide: SMS_PROVIDER, useClass: SmsRoutingService },
  ],
  exports: [SMS_PROVIDER],
})
export class SmsModule {}
