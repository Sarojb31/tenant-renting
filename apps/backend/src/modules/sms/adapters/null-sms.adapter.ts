import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from '../sms.provider.interface';

// Development/test stub — logs instead of sending real SMS.
// Replace with SparrowSmsAdapter or TwilioAdapter in production (Plan §16).
@Injectable()
export class NullSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(NullSmsAdapter.name);

  async send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }> {
    this.logger.debug(`[NullSmsAdapter] SMS to ${to}: ${message}`);
    return { providerMessageId: `null-${Date.now()}`, status: 'sent' };
  }
}
