import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationEntity } from '@prisma/client';

export interface NotificationEvent {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  entityType: NotificationEntity | null;
  entityId: string | null;
  createdAt: Date;
}

@Injectable()
export class NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);

  constructor(
    @InjectQueue('notification-dispatch') private readonly queue: Queue,
  ) {}

  async dispatch(events: NotificationEvent[]) {
    if (!events.length) return;
    try {
      await this.queue.addBulk(
        events.map((event) => ({
          name: 'publish-notification',
          data: event,
          opts: {
            jobId: `notification-${event.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
          },
        })),
      );
    } catch {
      this.logger.warn('Could not queue real-time notification delivery.');
    }
  }
}
