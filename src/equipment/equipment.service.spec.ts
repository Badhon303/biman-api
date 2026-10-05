jest.mock('@nestjs/common', () => ({
  Injectable: () => (target: unknown) => target,
  BadRequestException: class extends Error {},
  ConflictException: class extends Error {},
  ForbiddenException: class extends Error {},
  NotFoundException: class extends Error {},
}));
jest.mock('../notifications/notification-publisher.service', () => ({
  NotificationPublisher: class {},
}));
jest.mock('../storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('../maintenance-schedules/schedules.service', () => ({
  SchedulesService: class {},
}));
jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

import { EquipmentService } from './equipment.service';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SchedulesService } from '../maintenance-schedules/schedules.service';
import { AuthUser } from '../common/current-user.decorator';
import { CreateEquipmentDto } from './equipment.dto';

describe('EquipmentService.create', () => {
  const actor = { sub: 'manager-1', role: 'Manager' } as AuthUser;
  const item = {
    id: 'equipment-1',
    assetNo: 'BGM-001',
    equipmentTypeId: 'type-1',
    equipmentType: { id: 'type-1', name: 'Loader' },
    hourMeter: 0,
    lastVServiceDate: new Date('2026-01-01'),
    status: 'AVAILABLE',
    specifications: [],
    photos: [],
    documents: [],
  };
  let equipmentService: EquipmentService;
  let serviceCheck: jest.SpyInstance;
  let equipmentTypeService: { findMany: jest.Mock };
  let schedules: { ensureInitialSchedule: jest.Mock };

  beforeEach(() => {
    equipmentTypeService = {
      findMany: jest.fn().mockResolvedValue([
        { id: 'hour-band-1', minHours: 0, maxHours: 500 },
        { id: 'hour-band-2', minHours: 500, maxHours: 1000 },
      ]),
    };
    schedules = {
      ensureInitialSchedule: jest
        .fn()
        .mockResolvedValue({ ticketCreated: false, scheduleCreated: true }),
    };
    const prisma = {
      equipment: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(item),
      },
      equipmentTypeService,
    };
    equipmentService = new EquipmentService(
      prisma as unknown as PrismaService,
      {} as NotificationPublisher,
      {} as StorageService,
      schedules as unknown as SchedulesService,
    );
    serviceCheck = jest
      .spyOn(equipmentService, 'serviceCheck')
      .mockResolvedValue({
        created: [{ id: 'ticket-1' }],
        previousValue: 0,
        currentValue: item.hourMeter,
      } as never);
  });

  it('creates the current band ticket at 0 hours and reports ticket and schedule', async () => {
    const result = await equipmentService.create(
      {
        equipmentTypeId: 'type-1',
        lastVServiceDate: '2026-01-01',
      } as CreateEquipmentDto,
      actor,
    );

    expect(serviceCheck).toHaveBeenCalledWith(
      'equipment-1',
      {
        dueDateByServiceId: {
          'hour-band-1': expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      },
      actor,
      0,
    );
    expect(result).toMatchObject({
      id: 'equipment-1',
      serviceTicketsCreated: 1,
      vServiceScheduleCreated: true,
    });
  });
});
