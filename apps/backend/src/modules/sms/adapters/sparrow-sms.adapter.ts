import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SmsProvider } from '../sms.provider.interface';

interface SparrowResponse {
  response_code: number;
  message: string;
  messageid?: number;
}

// Sparrow SMS — primary provider for +977 Nepal numbers. Plan §4.6, §16.
// API: POST https://api.sparrowsms.com/v2/sms/ (form-encoded: token, from, to, text)
@Injectable()
export class SparrowSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(SparrowSmsAdapter.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('sms.sparrow.apiKey') ?? '';
    this.apiUrl =
      config.get<string>('sms.sparrow.apiUrl') ??
      'https://api.sparrowsms.com/v2/sms/';
    this.from = config.get<string>('sms.sparrow.from') ?? 'RoomFinder';
  }

  async send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }> {
    const { data } = await axios.post<SparrowResponse>(
      this.apiUrl,
      new URLSearchParams({ token: this.apiKey, from: this.from, to, text: message }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    if (data.response_code === 200) {
      return {
        providerMessageId: String(data.messageid ?? `sparrow-${Date.now()}`),
        status: 'sent',
      };
    }

    this.logger.warn(`Sparrow rejected SMS to ${to}: code=${data.response_code} msg=${data.message}`);
    return { providerMessageId: `sparrow-failed-${Date.now()}`, status: 'failed' };
  }

  // Sparrow has no delivery status lookup API — relies on webhook (Phase 3).
  async getDeliveryStatus(
    _providerMessageId: string,
  ): Promise<'delivered' | 'failed' | 'pending'> {
    return 'pending';
  }
}
