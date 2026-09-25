import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { PaginationDto } from '../common/pagination.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser, query: PaginationDto & { read?: string }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where = {
      userId: user.sub,
      ...(query.read === 'true'
        ? { read: true }
        : query.read === 'false'
          ? { read: false }
          : {}),
    };
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.appNotification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appNotification.count({ where }),
      this.prisma.appNotification.count({
        where: { userId: user.sub, read: false },
      }),
    ]);
    return {
      items: items.map((item) => ({ ...item, timestamp: item.createdAt })),
      page,
      limit,
      total,
      unread,
    };
  }

  async markRead(id: string, user: AuthUser) {
    const result = await this.prisma.appNotification.updateMany({
      where: { id, userId: user.sub },
      data: { read: true },
    });
    if (!result.count) throw new NotFoundException('Notification not found.');
    return { success: true };
  }

  async markAllRead(user: AuthUser) {
    const result = await this.prisma.appNotification.updateMany({
      where: { userId: user.sub, read: false },
      data: { read: true },
    });
    return { success: true, updated: result.count };
  }
}
