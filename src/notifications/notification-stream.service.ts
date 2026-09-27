import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject, filter } from 'rxjs';
import { NotificationEvent } from './notification-publisher.service';

@Injectable()
export class NotificationStream implements OnModuleInit, OnModuleDestroy {
  private readonly subscriber: Redis;
  private readonly events = new Subject<NotificationEvent>();

  constructor(config: ConfigService) {
    this.subscriber = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
  }

  async onModuleInit() {
    await this.subscriber.subscribe('biman:notifications');
    this.subscriber.on('message', (_channel, message) => {
      try {
        this.events.next(JSON.parse(message) as NotificationEvent);
      } catch {}
    });
  }

  get all$(): Observable<NotificationEvent> {
    return this.events.asObservable();
  }

  forUser(userId: string): Observable<NotificationEvent> {
    return this.events.pipe(filter((event) => event.userId === userId));
  }

  async onModuleDestroy() {
    this.events.complete();
    await this.subscriber.quit();
  }
}
