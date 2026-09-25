import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, RequestStatus, TicketStatus } from '@prisma/client';
import { AuthUser } from '../common/current-user.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { CreateRequestDto } from './requests.dto';
import { requestStatusLabel } from '../common/api-serializers';

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async list(query: PaginationDto & { status?: string }, user: AuthUser) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const status = query.status
      ? (Object.entries(requestStatusLabel).find(
          ([, label]) => label === query.status,
        )?.[0] as RequestStatus | undefined)
      : undefined;
    if (query.status && !status)
      throw new BadRequestException('Unknown request status filter.');
    const where: Prisma.EquipmentRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(user.role === 'Engineer' ? { requestedById: user.sub } : {}),
      ...(query.search
        ? {
            OR: [
              { requestNo: { contains: query.search, mode: 'insensitive' } },
              { item: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.equipmentRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: query.order ?? 'desc' },
        include: this.includeRequest(),
      }),
      this.prisma.equipmentRequest.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        status: requestStatusLabel[item.status],
      })),
      page,
      limit,
      total,
    };
  }

  async create(dto: CreateRequestDto, actor: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: { equipment: { select: { id: true, assetNo: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (actor.role === 'Engineer' && ticket.assignedEngineerId !== actor.sub)
      throw new ForbiddenException(
        'Requests can only be created for assigned tickets.',
      );
    if (['COMPLETED', 'CLOSED'].includes(ticket.status))
      throw new BadRequestException(
        'Cannot request items for a completed ticket.',
      );

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.equipmentRequest.create({
        data: {
          requestNo: `REQ-${Date.now()}-${Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0')}`,
          ticketId: dto.ticketId,
          equipmentId: ticket.equipment.id,
          item: dto.item,
          quantity: dto.quantity,
          reason: dto.reason,
          requestedById: actor.sub,
        },
        include: this.includeRequest(),
      });
      await tx.ticket.update({
        where: { id: dto.ticketId },
        data: {
          status: TicketStatus.AWAITING_PARTS,
          history: {
            create: {
              actorId: actor.sub,
              label: `Parts request created — ${created.requestNo}`,
            },
          },
        },
      });
      const recipients = await tx.user.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          role: { in: [Role.BIMAN_ADMIN, Role.MANAGER, Role.SUPER_ADMIN] },
        },
        select: { id: true },
      });
      const notifications = await tx.appNotification.createManyAndReturn({
        data: recipients.map(({ id: userId }) => ({
          userId,
          type: 'New Request',
          message: `${created.requestNo}: ${created.item} requested for ${ticket.equipment.assetNo}.`,
        })),
      });
      return { request: created, notifications };
    });
    await this.notificationPublisher.dispatch(request.notifications);
    return {
      ...request.request,
      status: requestStatusLabel[request.request.status],
    };
  }

  async approve(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    actor: AuthUser,
    reason?: string,
  ) {
    const request = await this.prisma.equipmentRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { id: true } }, ticket: true },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== RequestStatus.PENDING)
      throw new BadRequestException(
        'Only pending requests can be approved or rejected.',
      );
    const message =
      decision === RequestStatus.APPROVED
        ? `${request.requestNo} was approved.`
        : `${request.requestNo} was rejected${reason ? `: ${reason}` : '.'}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.equipmentRequest.update({
        where: { id },
        data: {
          status: decision,
          approvedById: actor.sub,
          approvedAt: new Date(),
        },
        include: this.includeRequest(),
      });
      const notification = await tx.appNotification.create({
        data: {
          userId: request.requestedBy.id,
          type: `Request ${decision.toLowerCase()}`,
          message,
        },
      });
      await tx.ticket.update({
        where: { id: request.ticketId },
        data: {
          status:
            (await tx.equipmentRequest.count({
              where: {
                ticketId: request.ticketId,
                status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
              },
            })) > 0
              ? TicketStatus.AWAITING_PARTS
              : TicketStatus.IN_PROGRESS,
          history: { create: { actorId: actor.sub, label: message } },
        },
      });
      return { result, notification };
    });
    await this.notificationPublisher.dispatch([updated.notification]);
    return {
      ...updated.result,
      status: requestStatusLabel[updated.result.status],
    };
  }

  async receive(id: string, actor: AuthUser) {
    const request = await this.prisma.equipmentRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { id: true } } },
    });
    if (!request) throw new NotFoundException('Request not found.');
    if (request.status !== RequestStatus.APPROVED)
      throw new BadRequestException(
        'Only approved requests can be marked received.',
      );
    const updated = await this.prisma.$transaction(async (tx) => {
      const received = await tx.equipmentRequest.update({
        where: { id },
        data: { status: RequestStatus.RECEIVED, receivedAt: new Date() },
        include: this.includeRequest(),
      });
      const outstanding = await tx.equipmentRequest.count({
        where: {
          ticketId: request.ticketId,
          status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
        },
      });
      if (!outstanding) {
        await tx.ticket.update({
          where: { id: request.ticketId },
          data: {
            status: TicketStatus.IN_PROGRESS,
            history: {
              create: {
                actorId: actor.sub,
                label: `Request ${request.requestNo} received`,
              },
            },
          },
        });
      }
      const notification = await tx.appNotification.create({
        data: {
          userId: request.requestedBy.id,
          type: 'Request received',
          message: `${request.requestNo} was received.`,
        },
      });
      return { received, notification };
    });
    await this.notificationPublisher.dispatch([updated.notification]);
    return {
      ...updated.received,
      status: requestStatusLabel[updated.received.status],
    };
  }

  private includeRequest() {
    return {
      ticket: {
        select: {
          id: true,
          ticketNo: true,
          equipment: { select: { id: true, assetNo: true } },
        },
      },
      equipment: { select: { id: true, assetNo: true } },
      requestedBy: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    } satisfies Prisma.EquipmentRequestInclude;
  }
}
