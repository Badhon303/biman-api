import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Subscription } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStream } from './notification-stream.service';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: true } })
export class NotificationsGateway
  implements OnModuleInit, OnModuleDestroy, OnGatewayConnection
{
  @WebSocketServer()
  private server: Server;

  private subscription?: Subscription;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly stream: NotificationStream,
  ) {}

  onModuleInit() {
    this.subscription = this.stream.all$.subscribe((event) => {
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

  onModuleDestroy() {
    this.subscription?.unsubscribe();
  }
}
