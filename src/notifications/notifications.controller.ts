import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable, interval, map, merge } from 'rxjs';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { NotificationsService } from './notifications.service';
import { NotificationStream } from './notification-stream.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly stream: NotificationStream,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationDto & { read?: string },
  ) {
    return this.notifications.list(user, query);
  }

  @Sse('stream')
  events(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return merge(
      this.stream.forUser(user.sub).pipe(
        map((event) => ({
          type: 'notification',
          id: event.id,
          data: { ...event, timestamp: event.createdAt },
        })),
      ),
      interval(25_000).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user);
  }
}
