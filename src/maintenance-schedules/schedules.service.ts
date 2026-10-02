import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  NotificationEntity,
  Role,
  ServiceKind,
  TicketType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { CreateScheduleDto } from './schedules.dto';
import { scheduleStatusLabel } from '../common/api-serializers';
import {
  fixedChecklistFor,
  toChecklistItems,
} from '../common/fixed-checklists';
import {
  addMonthsClamped,
  isScheduleDue,
  scheduleStatusFor,
} from './schedule-logic';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  list() {
    return this.prisma.maintenanceSchedule
      .findMany({
        include: {
          equipment: {
            select: {
              id: true,
              assetNo: true,
              equipmentType: { select: { name: true } },
            },
          },
          ticket: { select: { id: true, ticketNo: true, status: true } },
        },
        orderBy: { dueDate: 'asc' },
      })
      .then((items) =>
        items.map((item) => ({
          ...item,
          status: scheduleStatusLabel[item.status],
        })),
      );
  }

  async create(dto: CreateScheduleDto) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: dto.equipmentId, deletedAt: null },
      include: { equipmentType: { include: { services: true } } },
    });
    if (!equipment) throw new NotFoundException('Equipment not found.');
    if (
      !equipment.equipmentType.services.some(
        (service) =>
          service.kind === ServiceKind.V_SERVICE && service.months === 6,
      )
    ) {
      throw new BadRequestException(
        'This equipment type has no six-month V-Service.',
      );
    }
    const lastDate = new Date(dto.lastDate);
    const dueDate = addMonthsClamped(lastDate, 6);
    let schedule = await this.prisma.maintenanceSchedule.create({
      data: {
        scheduleNo: `SCH-${Date.now()}`,
        equipmentId: dto.equipmentId,
        lastDate,
        dueDate,
        status: scheduleStatusFor(dueDate),
      },
    });
    if (isScheduleDue(dueDate, new Date())) {
      await this.createDueTicket(schedule.id, equipment, dueDate);
      schedule = await this.prisma.maintenanceSchedule.findUniqueOrThrow({
        where: { id: schedule.id },
      });
    }
    return { ...schedule, status: scheduleStatusLabel[schedule.status] };
  }

  async ensureInitialSchedule(equipmentId: string) {
    const equipment = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, deletedAt: null },
      include: { equipmentType: { include: { services: true } } },
    });
    if (
      !equipment?.lastVServiceDate ||
      !equipment.equipmentType.services.some(
        (service) =>
          service.kind === ServiceKind.V_SERVICE && service.months === 6,
      )
    ) {
      return;
    }
    const lastDate = equipment.lastVServiceDate;
    const existing = await this.prisma.maintenanceSchedule.findFirst({
      where: { equipmentId },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      await this.create({ equipmentId, lastDate: lastDate.toISOString() });
      return;
    }
    if (existing.ticketId || existing.lastDate.getTime() === lastDate.getTime())
      return;
    const dueDate = addMonthsClamped(lastDate, 6);
    await this.prisma.maintenanceSchedule.update({
      where: { id: existing.id },
      data: {
        lastDate,
        dueDate,
        status: scheduleStatusFor(dueDate),
      },
    });
    if (isScheduleDue(dueDate, new Date())) {
      await this.createDueTicket(existing.id, equipment, dueDate);
    }
  }

  @Cron('0 */10 * * * *')
  async processDueSchedules() {
    const now = new Date();
    const schedules = await this.prisma.maintenanceSchedule.findMany({
      where: { ticketId: null },
      include: {
        equipment: {
          include: { equipmentType: { include: { services: true } } },
        },
      },
    });
    for (const schedule of schedules) {
      const status = scheduleStatusFor(schedule.dueDate, now);
      if (!isScheduleDue(schedule.dueDate, now)) {
        await this.prisma.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { status },
        });
        continue;
      }
      await this.createDueTicket(
        schedule.id,
        schedule.equipment,
        schedule.dueDate,
      );
    }
  }

  private async createDueTicket(
    scheduleId: string,
    equipment: any,
    dueDate: Date,
  ) {
    const vService = equipment.equipmentType.services.find(
      (service) => service.kind === ServiceKind.V_SERVICE,
    );
    if (!vService) return;
    const notifications = await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.maintenanceSchedule.findFirst({
          where: { id: scheduleId, ticketId: null },
        });
        if (!current) return [];
        const templates =
          fixedChecklistFor(
            equipment.equipmentType.name,
            ServiceKind.V_SERVICE,
          ) ??
          (await tx.checklistTemplateItem.findMany({
            where: {
              serviceType: ServiceKind.V_SERVICE,
              equipmentTypeServiceId: null,
            },
            orderBy: { sortOrder: 'asc' },
          }));
        const systemActorId = await this.systemActorId(tx);
        const ticket = await tx.ticket.create({
          data: {
            ticketNo: `TKT-${Date.now()}-${Math.floor(Math.random() * 10000)
              .toString()
              .padStart(4, '0')}`,
            serviceType: TicketType.V_SERVICE,
            pmServiceId: vService.id,
            equipmentId: equipment.id,
            dueDate,
            createdByUserId: systemActorId,
            maintenanceRecord: {
              create: {
                checklistItems: { create: toChecklistItems(templates) },
              },
            },
            history: {
              create: {
                actorId: systemActorId,
                label: 'V-Service ticket created by maintenance schedule',
              },
            },
          },
        });
        await tx.maintenanceSchedule.update({
          where: { id: scheduleId },
          data: { ticketId: ticket.id, status: 'OVERDUE' },
        });
        const recipients = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            role: { in: [Role.SUPER_ADMIN, Role.MANAGER] },
          },
          select: { id: true },
        });
        if (!recipients.length) return [];
        return tx.appNotification.createManyAndReturn({
          data: recipients.map(({ id }) => ({
            userId: id,
            type: 'V-Service ticket generated',
            message: `${ticket.ticketNo} was generated for ${equipment.assetNo} because its V-Service is due.`,
            entityType: NotificationEntity.TICKET,
            entityId: ticket.id,
          })),
        });
      },
      { timeout: 20_000 },
    );
    await this.notificationPublisher.dispatch(notifications);
  }

  private async systemActorId(tx: any) {
    const actor = await tx.user.findFirst({
      where: { status: 'ACTIVE', deletedAt: null, role: Role.SUPER_ADMIN },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!actor)
      throw new Error(
        'Create an active Super Admin before enabling maintenance schedule jobs.',
      );
    return actor.id;
  }
}
