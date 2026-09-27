import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPublisher } from './notification-publisher.service';
import { NotificationProcessor } from './notification.processor';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationStream } from './notification-stream.service';

@Global()
@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({ name: 'notification-dispatch' }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationPublisher,
    NotificationProcessor,
    NotificationStream,
    NotificationsGateway,
  ],
  exports: [NotificationPublisher],
})
export class NotificationsModule {}
