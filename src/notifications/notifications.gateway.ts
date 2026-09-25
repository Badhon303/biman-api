import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationEvent } from './notification-publisher.service';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: true } })
export class NotificationsGateway
  implements OnModuleInit, OnModuleDestroy, OnGatewayConnection
{
  @WebSocketServer()
  private server: Server;

  private subscriber: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.subscriber = new Redis(
      config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
  }

  async onModuleInit() {
    await this.subscriber.subscribe('biman:notifications');
    this.subscriber.on('message', (_channel, message) => {
      const event = JSON.parse(message) as NotificationEvent;
      this.server.to(`user:${event.userId}`).emit('notification', event);
    });
  }

  async handleConnection(client: Socket) {
    const rawToken =
      client.handshake.auth?.token ?? client.handshake.headers.authorization;
    const token =
      typeof rawToken === 'string' ? rawToken.replace(/^Bearer\s+/i, '') : '';
    try {
      const origin = client.handshake.headers.origin;
      const allowedOrigins = this.config
        .get<string>('CORS_ORIGIN', 'http://localhost:3000')
        .split(',')
        .map((value) => value.trim());
      if (origin && !allowedOrigins.includes(origin)) {
        throw new Error('Origin not allowed.');
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
        select: { id: true, mustChangePassword: true },
      });
      if (!user || user.mustChangePassword)
        throw new Error('Account unavailable.');
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  async onModuleDestroy() {
    await this.subscriber.quit();
  }
}
