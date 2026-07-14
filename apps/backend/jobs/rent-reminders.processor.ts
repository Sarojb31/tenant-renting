import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

export const RENT_REMINDERS_QUEUE = 'rent-reminders';

// BullMQ processor: sends rent-due SMS/email reminders to customers.
// Plan Section 5 (Automated rent reminders — premium add-on)
// Phase 4 — do not implement until Phase 4.
@Processor(RENT_REMINDERS_QUEUE)
export class RentRemindersProcessor extends WorkerHost {
  async process(_job: Job): Promise<void> {
    throw new Error('RentRemindersProcessor not yet implemented — Phase 4 add-on');
  }
}
