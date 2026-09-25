import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import Redis from 'ioredis';
import { NotificationEvent } from './notification-publisher.service';

@Injectable()
@Processor('notification-dispatch')
export class NotificationProcessor
  extends WorkerHost
  implements OnModuleInit, OnModuleDestroy
{
  private publisher: Redis;

  constructor(config: ConfigService) {
    super();
    this.publisher = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
  }

  async process(job: Job<NotificationEvent>) {
    await this.publisher.publish(
      'biman:notifications',
      JSON.stringify(job.data),
    );
    return { published: true };
  }

  async onModuleInit() {
    await this.publisher.ping();
  }

  async onModuleDestroy() {
    await this.publisher.quit();
  }
}
