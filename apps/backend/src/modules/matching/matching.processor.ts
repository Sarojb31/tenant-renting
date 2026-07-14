import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MatchingService } from './matching.service';

export interface MatchListingJobData {
  listingId: string;
  tenantId: string;
}

export const MATCHING_QUEUE = 'matching';

// Thin BullMQ consumer — delegates all logic to MatchingService.
@Processor(MATCHING_QUEUE)
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private readonly matchingService: MatchingService) {
    super();
  }

  async process(job: Job<MatchListingJobData>): Promise<void> {
    this.logger.debug(`Processing match job for listing ${job.data.listingId}`);
    await this.matchingService.triggerMatchForListing(job.data.listingId, job.data.tenantId);
  }
}
