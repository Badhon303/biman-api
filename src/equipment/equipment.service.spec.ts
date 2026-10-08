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

import { Prisma } from '@prisma/client';
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
  let equipmentCreate: jest.Mock;
  let equipmentFindMany: jest.Mock;
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
    equipmentCreate = jest.fn().mockResolvedValue(item);
    equipmentFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      equipment: {
        findMany: equipmentFindMany,
        create: equipmentCreate,
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
        rearTireSize: '12.00-20',
        frontTireSize: '10.00-20',
        lastVServiceDate: '2026-01-01',
      } as CreateEquipmentDto,
      actor,
    );

    expect(equipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assetNo: 'BGM-001',
          rearTireSize: '12.00-20',
          frontTireSize: '10.00-20',
        }),
      }),
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

  it('uses the highest existing BGM asset number instead of the equipment count', async () => {
    equipmentFindMany.mockResolvedValue([
      { assetNo: 'BGM-001' },
      { assetNo: 'BGM-005' },
    ]);

    await equipmentService.create(
      { equipmentTypeId: 'type-1' } as CreateEquipmentDto,
      actor,
    );

    expect(equipmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assetNo: 'BGM-006' }),
      }),
    );
  });

  it('retries with the next number if another create takes the candidate concurrently', async () => {
    const duplicateAssetNo = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on asset_no',
      { code: 'P2002', clientVersion: 'test', meta: { target: ['asset_no'] } },
    );
    equipmentCreate
      .mockRejectedValueOnce(duplicateAssetNo)
      .mockResolvedValueOnce(item);
    equipmentFindMany
      .mockResolvedValueOnce([{ assetNo: 'BGM-001' }])
      .mockResolvedValueOnce([{ assetNo: 'BGM-001' }, { assetNo: 'BGM-002' }]);

    await equipmentService.create(
      { equipmentTypeId: 'type-1' } as CreateEquipmentDto,
      actor,
    );

    expect(
      equipmentCreate.mock.calls.map(([args]) => args.data.assetNo),
    ).toEqual(['BGM-002', 'BGM-003']);
  });
});
