import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import sanitizeHtml from 'sanitize-html';
import { AuthUser } from '../common/current-user.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { serializeTicket, ticketStatusLabel } from '../common/api-serializers';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import {
  CreateTicketDto,
  FeedbackDto,
  MaintenanceUpdateDto,
  UpdateTicketDto,
  VerifyTicketDto,
} from './tickets.dto';

const dbTicketType: Record<CreateTicketDto['serviceType'], TicketType> = {
  Breakdown: TicketType.BREAKDOWN,
  General: TicketType.GENERAL,
  Washing: TicketType.WASHING,
};
const dbPriority: Record<
  NonNullable<CreateTicketDto['priority']>,
  TicketPriority
> = {
  Low: TicketPriority.LOW,
  Medium: TicketPriority.MEDIUM,
  High: TicketPriority.HIGH,
  Critical: TicketPriority.CRITICAL,
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async list(
    query: PaginationDto & { status?: string; assignedToMe?: string },
    user: AuthUser,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const status = query.status
      ? (Object.entries(ticketStatusLabel).find(
          ([, label]) => label === query.status,
        )?.[0] as TicketStatus | undefined)
      : undefined;
    if (query.status && !status)
      throw new BadRequestException('Unknown ticket status filter.');
    const where: Prisma.TicketWhereInput = {
      ...(status ? { status } : {}),
      ...(user.role === 'Engineer' ? { assignedEngineerId: user.sub } : {}),
      ...(query.assignedToMe === 'true'
        ? { assignedEngineerId: user.sub }
        : {}),
      ...(query.search
        ? {
            OR: [
              { ticketNo: { contains: query.search, mode: 'insensitive' } },
              {
                equipment: {
                  assetNo: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: query.order ?? 'desc' },
        include: this.ticketInclude(),
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return {
      items: items.map((ticket) => serializeTicket(ticket)),
      page,
      limit,
      total,
    };
  }

  async get(id: string, user: AuthUser) {
    return serializeTicket(await this.getForUser(id, user));
  }

  async create(dto: CreateTicketDto, actor: AuthUser) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, deletedAt: null },
    });
    if (!equipment) throw new NotFoundException('Equipment not found.');
    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNo: `TKT-${Date.now()}-${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0')}`,
        serviceType: dbTicketType[dto.serviceType],
        equipmentId: dto.equipmentId,
        faultDescription: dto.faultDescription,
        priority: dto.priority
          ? dbPriority[dto.priority]
          : TicketPriority.MEDIUM,
        dueDate: new Date(dto.dueDate),
        requestingParty: dto.requestingParty,
        createdByUserId: actor.sub,
        maintenanceRecord: {
          create: { problemDescription: dto.faultDescription },
        },
        history: {
          create: {
            actorId: actor.sub,
            label: `Ticket created — ${dto.serviceType}`,
          },
        },
      },
      include: this.ticketInclude(),
    });
    await this.notifyTicketRoles(
      ticket,
      actor.sub,
      'Ticket created',
      `${ticket.ticketNo} was created.`,
    );
    return serializeTicket(ticket);
  }

  async assign(id: string, assignedEngineerId: string, actor: AuthUser) {
    const ticket = await this.getForEdit(id);
    if (ticket.status === 'CLOSED')
      throw new BadRequestException('Closed tickets cannot be assigned.');
    const engineer = await this.prisma.user.findFirst({
      where: {
        id: assignedEngineerId,
        role: Role.ENGINEER,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
    if (!engineer) throw new BadRequestException('Select an active engineer.');
    const status =
      ticket.status === 'OPEN' ? TicketStatus.ASSIGNED : ticket.status;
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        assignedEngineerId,
        status,
        history: {
          create: { actorId: actor.sub, label: `Assigned to ${engineer.name}` },
        },
      },
      include: this.ticketInclude(),
    });
    const notification = await this.prisma.appNotification.create({
      data: {
        userId: engineer.id,
        type: 'Ticket assigned',
        message: `${updated.ticketNo} was assigned to you.`,
      },
    });
    await this.notificationPublisher.dispatch([notification]);
    return serializeTicket(updated);
  }

  async update(id: string, dto: UpdateTicketDto, actor: AuthUser) {
    const ticket = await this.getForEdit(id);
    if (['COMPLETED', 'CLOSED'].includes(ticket.status))
      throw new BadRequestException('Completed tickets cannot be edited.');
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        ...(dto.priority ? { priority: dbPriority[dto.priority] } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        ...(dto.requestingParty !== undefined
          ? { requestingParty: dto.requestingParty }
          : {}),
        history: {
          create: { actorId: actor.sub, label: 'Ticket details updated' },
        },
      },
      include: this.ticketInclude(),
    });
    await this.notifyTicketParties(
      updated,
      actor.sub,
      'Ticket updated',
      `${updated.ticketNo} was updated.`,
    );
    return serializeTicket(updated);
  }

  async startWork(id: string, actor: AuthUser) {
    const ticket = await this.getForUser(id, actor);
    if (!['OPEN', 'ASSIGNED'].includes(ticket.status))
      throw new BadRequestException('Work cannot be started in this status.');
    if (ticket.assignedEngineerId && ticket.assignedEngineerId !== actor.sub)
      throw new ForbiddenException();
    return this.setStatus(id, TicketStatus.IN_PROGRESS, actor, 'Work started');
  }

  async updateMaintenance(
    id: string,
    dto: MaintenanceUpdateDto,
    actor: AuthUser,
  ) {
    const ticket = await this.getForUser(id, actor);
    if (ticket.status !== 'IN_PROGRESS')
      throw new BadRequestException(
        'Maintenance details can only be edited while work is in progress.',
      );
    const [record] = await this.prisma.$transaction([
      this.prisma.maintenanceRecord.update({
        where: { ticketId: id },
        data: {
          ...(dto.problemDescription !== undefined
            ? { problemDescription: dto.problemDescription }
            : {}),
          ...(dto.partsUsed !== undefined ? { partsUsed: dto.partsUsed } : {}),
          ...(dto.labourHours !== undefined
            ? { labourHours: dto.labourHours }
            : {}),
          ...(dto.functionalTestPassed !== undefined
            ? { functionalTestPassed: dto.functionalTestPassed }
            : {}),
          ...(dto.safetyCheckPassed !== undefined
            ? { safetyCheckPassed: dto.safetyCheckPassed }
            : {}),
        },
      }),
      this.prisma.ticketHistory.create({
        data: {
          ticketId: id,
          actorId: actor.sub,
          label: 'Maintenance record updated',
        },
      }),
    ]);
    return record;
  }

  async updateChecklist(
    id: string,
    itemId: string,
    checked: boolean,
    actor: AuthUser,
  ) {
    const ticket = await this.getForUser(id, actor);
    if (ticket.status !== 'IN_PROGRESS')
      throw new BadRequestException(
        'Checklist can only be updated while work is in progress.',
      );
    const item = await this.prisma.checklistItem.findFirst({
      where: { id: itemId, maintenanceRecord: { ticketId: id } },
    });
    if (!item)
      throw new NotFoundException('Checklist item not found for this ticket.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.checklistItem.update({
        where: { id: itemId },
        data: { checked },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          actorId: actor.sub,
          label: `Checklist item ${checked ? 'checked' : 'unchecked'}`,
        },
      });
      return updated;
    });
  }

  async addFeedback(id: string, dto: FeedbackDto, actor: AuthUser) {
    const ticket = await this.getForUser(id, actor);
    if (!['IN_PROGRESS', 'AWAITING_VERIFICATION'].includes(ticket.status))
      throw new BadRequestException(
        'Feedback can only be added while work is active or awaiting verification.',
      );
    const bodyHtml = sanitizeHtml(dto.bodyHtml, {
      allowedTags: sanitizeHtml.defaults.allowedTags,
      allowedAttributes: sanitizeHtml.defaults.allowedAttributes,
      allowedSchemes: ['http', 'https'],
    });
    if (
      !sanitizeHtml(bodyHtml, { allowedTags: [], allowedAttributes: {} }).trim()
    ) {
      throw new BadRequestException('Feedback must contain readable text.');
    }
    return this.prisma.ticketFeedback.create({
      data: { ticketId: id, authorUserId: actor.sub, bodyHtml },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async submitForVerification(id: string, actor: AuthUser) {
    const ticket = await this.getForUser(id, actor);
    const record = await this.prisma.maintenanceRecord.findUnique({
      where: { ticketId: id },
      include: { checklistItems: true },
    });
    if (
      !record ||
      !ticket.feedback?.length ||
      record.functionalTestPassed === null ||
      record.safetyCheckPassed === null
    ) {
      throw new BadRequestException(
        'Complete the maintenance record, tests, and feedback before submitting.',
      );
    }
    if (record.checklistItems.some((item) => !item.checked)) {
      throw new BadRequestException(
        'Complete every checklist item before submitting.',
      );
    }
    return this.setStatus(
      id,
      TicketStatus.AWAITING_VERIFICATION,
      actor,
      'Submitted for verification',
    );
  }

  async verifyAndClose(id: string, dto: VerifyTicketDto, actor: AuthUser) {
    const ticket = await this.getForEdit(id);
    if (ticket.status !== 'AWAITING_VERIFICATION')
      throw new BadRequestException(
        'Only tickets awaiting verification can be closed.',
      );
    const closedAt = new Date();
    const computedDowntime = Math.max(
      0,
      (closedAt.getTime() - ticket.createdAt.getTime()) / 3600000,
    );
    const updated = await this.prisma.ticket.update({
      where: { id },
      data: {
        status: TicketStatus.CLOSED,
        closedDate: closedAt,
        downtimeHours: dto.downtimeHours ?? computedDowntime,
        history: {
          create: { actorId: actor.sub, label: 'Ticket verified and closed' },
        },
      },
      include: this.ticketInclude(),
    });
    await this.notifyTicketParties(
      updated,
      actor.sub,
      'Ticket closed',
      `${updated.ticketNo} was verified and closed.`,
    );
    if (ticket.serviceType === 'V_SERVICE')
      await this.createNextVServiceSchedule(ticket.equipmentId, closedAt);
    return serializeTicket(updated);
  }

  private async setStatus(
    id: string,
    status: TicketStatus,
    actor: AuthUser,
    label: string,
  ) {
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status, history: { create: { actorId: actor.sub, label } } },
      include: this.ticketInclude(),
    });
    await this.notifyTicketParties(
      ticket,
      actor.sub,
      'Ticket status changed',
      `${ticket.ticketNo}: ${label}.`,
    );
    return serializeTicket(ticket);
  }

  private async getForEdit(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: this.ticketInclude(),
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  private async getForUser(id: string, user: AuthUser) {
    const ticket = await this.getForEdit(id);
    if (user.role === 'Engineer' && ticket.assignedEngineerId !== user.sub) {
      throw new ForbiddenException(
        'Engineers can only view tickets assigned to them.',
      );
    }
    return ticket;
  }

  private ticketInclude(): Prisma.TicketInclude {
    return {
      equipment: {
        select: {
          id: true,
          assetNo: true,
          model: true,
          equipmentType: { select: { name: true } },
        },
      },
      pmService: true,
      createdBy: { select: { id: true, name: true, email: true } },
      assignedEngineer: { select: { id: true, name: true } },
      maintenanceRecord: {
        include: {
          checklistItems: { orderBy: { sortOrder: 'asc' } },
          workImages: { include: { fileAsset: { select: { id: true } } } },
        },
      },
      history: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
      feedback: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true } },
          images: { include: { fileAsset: { select: { id: true } } } },
        },
      },
      requests: true,
    };
  }

  private async notifyTicketRoles(
    ticket: {
      id: string;
      ticketNo: string;
      createdByUserId: string;
      assignedEngineerId: string | null;
    },
    actorId: string,
    type: string,
    message: string,
  ) {
    const recipients = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: [Role.SUPER_ADMIN, Role.MANAGER, Role.BIMAN_ADMIN] },
        id: { not: actorId },
      },
      select: { id: true },
    });
    if (recipients.length) {
      const notifications =
        await this.prisma.appNotification.createManyAndReturn({
          data: recipients.map(({ id: userId }) => ({ userId, type, message })),
        });
      await this.notificationPublisher.dispatch(notifications);
    }
  }

  private async notifyTicketParties(
    ticket: {
      id: string;
      ticketNo: string;
      createdByUserId: string;
      assignedEngineerId: string | null;
    },
    actorId: string,
    type: string,
    message: string,
  ) {
    const ids = [
      ...new Set(
        [ticket.createdByUserId, ticket.assignedEngineerId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ].filter((id) => id !== actorId);
    if (ids.length) {
      const notifications =
        await this.prisma.appNotification.createManyAndReturn({
          data: ids.map((userId) => ({ userId, type, message })),
        });
      await this.notificationPublisher.dispatch(notifications);
    }
  }

  private async createNextVServiceSchedule(
    equipmentId: string,
    lastDate: Date,
  ) {
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + 6);
    const nextNo = `SCH-${Date.now()}`;
    await this.prisma.maintenanceSchedule.create({
      data: {
        scheduleNo: nextNo,
        equipmentId,
        lastDate,
        dueDate,
        status: 'SCHEDULED',
      },
    });
  }
}
