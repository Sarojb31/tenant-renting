import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

export const SMS_DISPATCH_QUEUE = 'sms-dispatch';

// BullMQ processor: sends a single SMS via the appropriate provider adapter,
// logs result to sms_logs, retries on failure.
// Plan Section 13, 18, 24.3 (idempotent — dedupes on listing_id+customer_id+event_type)
@Processor(SMS_DISPATCH_QUEUE)
export class SmsDispatchProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    throw new Error('SmsDispatchProcessor not yet implemented — Phase 1 Step 5');
  }
}
