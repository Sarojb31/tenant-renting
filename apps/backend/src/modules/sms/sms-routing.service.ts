import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms.provider.interface';
import { SparrowSmsAdapter } from './adapters/sparrow-sms.adapter';
import { AakashSmsAdapter } from './adapters/aakash-sms.adapter';
import { TwilioAdapter } from './adapters/twilio.adapter';
import { NullSmsAdapter } from './adapters/null-sms.adapter';

// Routes outgoing SMS to the correct provider based on phone prefix. Plan §4.6.
// +977 (Nepal) → SparrowSmsAdapter (primary); if Sparrow not configured → AakashSmsAdapter.
// All other prefixes → TwilioAdapter; if not configured → NullSmsAdapter.
@Injectable()
export class SmsRoutingService implements SmsProvider {
  private readonly logger = new Logger(SmsRoutingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sparrow: SparrowSmsAdapter,
    private readonly aakash: AakashSmsAdapter,
    private readonly twilio: TwilioAdapter,
    private readonly nullAdapter: NullSmsAdapter,
  ) {}

  async send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }> {
    const adapter = this.resolveAdapter(to);
    this.logger.debug(`Routing SMS to ${to} via ${adapter.constructor.name}`);
    return adapter.send(to, message);
  }

  async getDeliveryStatus?(
    providerMessageId: string,
  ): Promise<'delivered' | 'failed' | 'pending'> {
    // Status lookup is provider-specific; use Twilio as the default capable adapter.
    return this.twilio.getDeliveryStatus(providerMessageId);
  }

  // Exported for unit testing.
  resolveAdapter(phone: string): SmsProvider {
    const normalized = phone.startsWith('+') ? phone : `+${phone}`;

    if (normalized.startsWith('+977')) {
      const sparrowKey = this.config.get<string>('sms.sparrow.apiKey');
      if (sparrowKey) return this.sparrow;

      const aakashKey = this.config.get<string>('sms.aakash.apiKey');
      if (aakashKey) return this.aakash;

      return this.nullAdapter;
    }

    const twilioSid = this.config.get<string>('sms.twilio.accountSid');
    if (twilioSid) return this.twilio;

    return this.nullAdapter;
  }
}
