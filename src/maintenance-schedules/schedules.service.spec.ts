jest.mock('@nestjs/common', () => ({
  Injectable: () => (target: unknown) => target,
  BadRequestException: class extends Error {},
  ConflictException: class extends Error {},
  NotFoundException: class extends Error {},
}));
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => undefined }));
jest.mock('../notifications/notification-publisher.service', () => ({
  NotificationPublisher: class {},
}));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { NotificationEntity } from '@prisma/client';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulesService } from './schedules.service';

describe('SchedulesService', () => {
  const scheduleId = 'schedule-id';
  let scheduleModel: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let tx: {
    maintenanceSchedule: typeof scheduleModel;
    appNotification: { deleteMany: jest.Mock };
  };
  let prisma: typeof tx & { $transaction: jest.Mock };
  let schedules: SchedulesService;

  beforeEach(() => {
    scheduleModel = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: scheduleId,
        equipment: { deletedAt: null },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({ id: scheduleId }),
      delete: jest.fn().mockResolvedValue({ id: scheduleId }),
    };
    tx = {
      maintenanceSchedule: scheduleModel,
      appNotification: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    prisma = {
      ...tx,
      $transaction: jest.fn(
        (operation: (client: typeof tx) => Promise<unknown>) => operation(tx),
      ),
    };
    schedules = new SchedulesService(
      prisma as unknown as PrismaService,
      {} as NotificationPublisher,
    );
  });

  it('soft-deletes only an active schedule', async () => {
    await expect(schedules.remove(scheduleId)).resolves.toEqual({
      success: true,
    });

    expect(scheduleModel.updateMany).toHaveBeenCalledWith({
      where: { id: scheduleId, deletedAt: null },
      data: { deletedAt: expect.any(Date) },
    });
  });

  it('throws when the schedule is missing or already archived', async () => {
    scheduleModel.updateMany.mockResolvedValue({ count: 0 });

    await expect(schedules.remove(scheduleId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists only archived schedules in the archive view', async () => {
    await schedules.archive();

    expect(scheduleModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
      }),
    );
  });

  it('restores an archived schedule when its equipment is active', async () => {
    await expect(schedules.restore(scheduleId)).resolves.toEqual({
      success: true,
    });

    expect(scheduleModel.update).toHaveBeenCalledWith({
      where: { id: scheduleId },
      data: { deletedAt: null },
    });
  });

  it('requires archived equipment to be restored before its schedule', async () => {
    scheduleModel.findFirst.mockResolvedValue({
      id: scheduleId,
      equipment: { deletedAt: new Date() },
    });

    await expect(schedules.restore(scheduleId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(scheduleModel.update).not.toHaveBeenCalled();
  });

  it('permanently deletes an archived schedule and its notifications', async () => {
    await expect(schedules.permanentlyRemove(scheduleId)).resolves.toEqual({
      success: true,
    });

    expect(tx.appNotification.deleteMany).toHaveBeenCalledWith({
      where: { entityType: NotificationEntity.SCHEDULE, entityId: scheduleId },
    });
    expect(scheduleModel.delete).toHaveBeenCalledWith({
      where: { id: scheduleId },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
