import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { SmsProvider } from '../sms.provider.interface';

interface AakashResponse {
  status: boolean;
  message: string;
  data?: { message_id?: string };
}

// Aakash SMS — alternate Nepal provider (+977). Plan §4.6, §16.
// API: POST https://aakashsms.com/sms/v3/send/ (form-encoded: apikey, to, text)
@Injectable()
export class AakashSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(AakashSmsAdapter.name);
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = config.get<string>('sms.aakash.apiKey') ?? '';
    this.apiUrl =
      config.get<string>('sms.aakash.apiUrl') ??
      'https://aakashsms.com/sms/v3/send/';
  }

  async send(
    to: string,
    message: string,
  ): Promise<{ providerMessageId: string; status: 'sent' | 'failed' }> {
    const { data } = await axios.post<AakashResponse>(
      this.apiUrl,
      new URLSearchParams({ apikey: this.apiKey, to, text: message }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    if (data.status) {
      return {
        providerMessageId: data.data?.message_id ?? `aakash-${Date.now()}`,
        status: 'sent',
      };
    }

    this.logger.warn(`Aakash rejected SMS to ${to}: ${data.message}`);
    return { providerMessageId: `aakash-failed-${Date.now()}`, status: 'failed' };
  }
}
