import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { FbPageLead } from './fb-page-lead.entity';

export interface MessengerPayload {
  entry?: Array<{
    id: string;
    messaging?: Array<{
      sender: { id: string };
      message?: { text?: string };
    }>;
  }>;
}

@Injectable()
export class FacebookService {
  constructor(
    @InjectRepository(FbPageLead)
    private readonly leadRepo: Repository<FbPageLead>,
    private readonly configService: ConfigService,
  ) {}

  /** Returns hub.challenge if token matches, throws UnauthorizedException otherwise */
  verifyWebhook(mode: string, token: string, challenge: string): string {
    const expected = this.configService.get<string>('facebook.verifyToken');
    if (mode === 'subscribe' && token === expected) return challenge;
    throw new UnauthorizedException('Invalid verify token');
  }

  /**
   * Verifies HMAC-SHA256 signature (X-Hub-Signature-256: sha256=<hex>).
   * Accepts an explicit appSecret (resolved per-connection) or falls back
   * to the global FB_APP_SECRET env var for backward compatibility.
   */
  verifySignature(rawBody: Buffer, signature: string, appSecret?: string): void {
    const secret = appSecret ?? this.configService.get<string>('facebook.appSecret');
    if (!secret) return; // skip in dev if not configured
    const expected =
      'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  /** Processes incoming Messenger webhook payload, saves leads */
  async processEvent(tenantId: string, payload: MessengerPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      const pageId = entry.id;
      for (const event of entry.messaging ?? []) {
        if (!event.message?.text) continue;
        await this.leadRepo.save(
          this.leadRepo.create({
            tenantId,
            fbPageId: pageId,
            fbSenderPsid: event.sender.id,
            messageText: event.message.text,
            matchedCustomerId: null,
          }),
        );
      }
    }
  }

  findLeadsForTenant(tenantId: string): Promise<FbPageLead[]> {
    return this.leadRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }
}
