import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

export const MATCHING_DISPATCH_QUEUE = 'matching-dispatch';

// BullMQ processor: evaluates saved customer preferences against a newly published listing
// and enqueues individual sms-dispatch jobs for each match.
// Plan Section 13, 18 (background workers scale independently from API)
@Processor(MATCHING_DISPATCH_QUEUE)
export class MatchingDispatchProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    throw new Error('MatchingDispatchProcessor not yet implemented — Phase 1 Step 4');
  }
}
