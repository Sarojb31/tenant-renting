import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';
import { SmsProvider } from '../sms.provider.interface';

// Twilio — international SMS (non-+977 numbers). Plan §4.6, §16.
@Injectable()
export class TwilioAdapter implements SmsProvider {
  private readonly logger = new Logger(TwilioAdapter.name);
  private readonly client: ReturnType<typeof Twilio>;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const accountSid = config.get<string>('sms.twilio.accountSid') ?? '';
    const authToken = config.get<string>('sms.twilio.authToken') ?? '';
    this.from = config.get<string>('sms.twilio.from') ?? '';
    this.client = Twilio(accountSid, authToken);
  }

  async send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }> {
    const msg = await this.client.messages.create({ from: this.from, to, body: message });
    return { providerMessageId: msg.sid, status: 'sent' };
  }

  async getDeliveryStatus(
    providerMessageId: string,
  ): Promise<'delivered' | 'failed' | 'pending'> {
    const msg = await this.client.messages(providerMessageId).fetch();
    if (msg.status === 'delivered') return 'delivered';
    if (msg.status === 'failed' || msg.status === 'undelivered') return 'failed';
    return 'pending';
  }
}
