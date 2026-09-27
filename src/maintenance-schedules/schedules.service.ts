import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role, ServiceKind, TicketType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { CreateScheduleDto } from './schedules.dto';
import { scheduleStatusLabel } from '../common/api-serializers';
import {
  fixedChecklistFor,
  toChecklistItems,
} from '../common/fixed-checklists';

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
    const dueDate = new Date(lastDate);
    dueDate.setMonth(dueDate.getMonth() + 6);
    const schedule = await this.prisma.maintenanceSchedule.create({
      data: {
        scheduleNo: `SCH-${Date.now()}`,
        equipmentId: dto.equipmentId,
        lastDate,
        dueDate,
        status: this.statusFor(dueDate),
      },
    });
    return { ...schedule, status: scheduleStatusLabel[schedule.status] };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
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
      const status = this.statusFor(schedule.dueDate);
      if (schedule.dueDate > now) {
        await this.prisma.maintenanceSchedule.update({
          where: { id: schedule.id },
          data: { status },
        });
        if (status !== 'DUE_SOON') continue;
      } else {
        await this.createDueTicket(
          schedule.id,
          schedule.equipment,
          schedule.dueDate,
        );
      }
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
    const notifications = await this.prisma.$transaction(async (tx) => {
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
          type: 'V-Service due',
          message: `${equipment.assetNo} has a V-Service ticket due.`,
        })),
      });
    });
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

  private statusFor(dueDate: Date) {
    const daysLeft = (dueDate.getTime() - Date.now()) / 86400000;
    if (daysLeft < 0) return 'OVERDUE' as const;
    if (daysLeft <= 15) return 'DUE_SOON' as const;
    return 'SCHEDULED' as const;
  }
}
