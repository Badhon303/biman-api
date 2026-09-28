import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EquipmentStatus,
  NotificationEntity,
  Prisma,
  Role,
  ServiceKind,
  TicketType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { NotificationPublisher } from '../notifications/notification-publisher.service';
import { crossedHourBands } from './service-check.logic';
import {
  ChecklistTemplate,
  fixedChecklistFor,
  toChecklistItems,
} from '../common/fixed-checklists';
import { PaginationDto } from '../common/pagination.dto';
import {
  equipmentStatusLabel,
  serializeTicket,
} from '../common/api-serializers';
import {
  CreateEquipmentDto,
  ServiceCheckDto,
  UpdateEquipmentDto,
} from './equipment.dto';

const equipmentStatus: Record<string, EquipmentStatus> = {
  Available: EquipmentStatus.AVAILABLE,
  'Under Maintenance': EquipmentStatus.UNDER_MAINTENANCE,
  'Out of Service': EquipmentStatus.OUT_OF_SERVICE,
  Inactive: EquipmentStatus.INACTIVE,
};

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async list(
    query: PaginationDto & { status?: string; equipmentTypeId?: string },
    user: AuthUser,
  ) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: Prisma.EquipmentWhereInput = {
      deletedAt: null,
      ...(user.role === 'Engineer'
        ? { tickets: { some: { assignedEngineerId: user.sub } } }
        : {}),
      ...(query.status && equipmentStatus[query.status]
        ? { status: equipmentStatus[query.status] }
        : {}),
      ...(query.equipmentTypeId
        ? { equipmentTypeId: query.equipmentTypeId }
        : {}),
      ...(query.search
        ? {
            OR: [
              { assetNo: { contains: query.search, mode: 'insensitive' } },
              { manufacturer: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { assetNo: query.order ?? 'asc' },
        include: this.includeEquipment(),
      }),
      this.prisma.equipment.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      page,
      limit,
      total,
    };
  }

  async get(id: string, user?: AuthUser) {
    const item = await this.prisma.equipment.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(user?.role === 'Engineer'
          ? { tickets: { some: { assignedEngineerId: user.sub } } }
          : {}),
      },
      include: {
        ...this.includeEquipment(),
        hourMeterReadings: {
          orderBy: { recordedAt: 'desc' },
          take: 50,
          include: { recordedBy: { select: { id: true, name: true } } },
        },
      },
    });
    if (!item) throw new NotFoundException('Equipment not found.');
    return this.serialize(item);
  }

  async create(dto: CreateEquipmentDto, actor: AuthUser) {
    const count = await this.prisma.equipment.count();
    const item = await this.prisma.equipment.create({
      data: {
        assetNo: `BGM-${String(count + 1).padStart(3, '0')}`,
        equipmentTypeId: dto.equipmentTypeId,
        manufacturer: dto.manufacturer,
        model: dto.model,
        location: dto.location,
        engineModel: dto.engineModel,
        engineSerialNo: dto.engineSerialNo,
        bimanSerialNo: dto.bimanSerialNo,
        tldSerialNo: dto.tldSerialNo,
        status: equipmentStatus[dto.status ?? 'Available'],
        hourMeter: dto.hourMeter ?? 0,
        actualGtDate: dto.actualGtDate ? new Date(dto.actualGtDate) : undefined,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : undefined,
        shippingStatus: dto.shippingStatus,
        emissionRating: dto.emissionRating,
        specifications: dto.specifications
          ? { create: dto.specifications }
          : undefined,
        hourMeterReadings:
          dto.hourMeter && dto.hourMeter > 0
            ? {
                create: {
                  value: dto.hourMeter,
                  recordedByUserId: actor.sub,
                },
              }
            : undefined,
      },
      include: this.includeEquipment(),
    });
    return this.serialize(item);
  }

  async update(id: string, dto: UpdateEquipmentDto) {
    await this.getRaw(id);
    const { specifications, actualGtDate, shipDate, status, ...fields } = dto;
    const item = await this.prisma.$transaction(async (tx) => {
      if (specifications)
        await tx.equipmentSpecification.deleteMany({
          where: { equipmentId: id },
        });
      return tx.equipment.update({
        where: { id },
        data: {
          ...fields,
          ...(status ? { status: equipmentStatus[status] } : {}),
          ...(actualGtDate !== undefined
            ? { actualGtDate: actualGtDate ? new Date(actualGtDate) : null }
            : {}),
          ...(shipDate !== undefined
            ? { shipDate: shipDate ? new Date(shipDate) : null }
            : {}),
          ...(specifications
            ? { specifications: { create: specifications } }
            : {}),
        },
        include: this.includeEquipment(),
      });
    });
    return this.serialize(item);
  }

  async remove(id: string) {
    await this.getRaw(id);
    await this.prisma.equipment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async updateHourMeter(id: string, value: number, actor: AuthUser) {
    const equipment = await this.getRaw(id);
    await this.assertEngineerEquipmentAccess(id, actor);
    if (value < equipment.hourMeter)
      throw new BadRequestException('Hour meter values must not decrease.');
    if (value === equipment.hourMeter)
      throw new BadRequestException(
        'Enter a value greater than the current meter reading.',
      );
    try {
      await this.prisma.$transaction(async (tx) => {
        const changed = await tx.equipment.updateMany({
          where: { id, hourMeter: equipment.hourMeter, deletedAt: null },
          data: { hourMeter: value },
        });
        if (changed.count !== 1)
          throw new ConflictException(
            'Equipment meter was updated by another request. Retry.',
          );
        await tx.hourMeterReading.create({
          data: { equipmentId: id, value, recordedByUserId: actor.sub },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Equipment not found.');
      }
      throw error;
    }
    const reading = await this.prisma.hourMeterReading.findFirst({
      where: { equipmentId: id },
      orderBy: { recordedAt: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
    return {
      id,
      hourMeter: value,
      reading: reading
        ? {
            id: reading.id,
            value: reading.value,
            recordedAt: reading.recordedAt,
            recordedBy: reading.recordedBy.name,
          }
        : null,
    };
  }

  async serviceCheck(id: string, dto: ServiceCheckDto, actor: AuthUser) {
    const equipment = await this.getRaw(id);
    await this.assertEngineerEquipmentAccess(id, actor);
    const { name: equipmentTypeName } =
      await this.prisma.equipmentType.findUniqueOrThrow({
        where: { id: equipment.equipmentTypeId },
        select: { name: true },
      });
    const services = await this.prisma.equipmentTypeService.findMany({
      where: {
        equipmentTypeId: equipment.equipmentTypeId,
        kind: { not: ServiceKind.V_SERVICE },
      },
      orderBy: { minHours: 'asc' },
    });
    const readings = await this.prisma.hourMeterReading.findMany({
      where: { equipmentId: id },
      orderBy: { recordedAt: 'desc' },
      take: 2,
    });
    const previousValue = readings[1]?.value ?? 0;
    const checked = await this.prisma.serviceCheck.findMany({
      where: { equipmentId: id },
    });
    const checkedKeys = new Set(
      checked.map(
        (item) => `${item.equipmentTypeServiceId}:${item.thresholdHours}`,
      ),
    );
    const crossed = crossedHourBands(
      services,
      previousValue,
      equipment.hourMeter,
      checkedKeys,
    );
    if (!crossed.length)
      return {
        created: [],
        message: 'No new service bands have been crossed.',
      };
    for (const service of crossed) {
      const dueDate = dto.dueDateByServiceId?.[service.id];
      if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
        throw new BadRequestException(
          `A valid due date is required for ${service.name} (${service.id}).`,
        );
      }
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const created = [];
        for (const service of crossed) {
          const ticketNo = `TKT-${Date.now()}-${Math.floor(
            Math.random() * 10000,
          )
            .toString()
            .padStart(4, '0')}`;
          let templates: ChecklistTemplate[] =
            service.kind === ServiceKind.OTHERS
              ? await tx.checklistTemplateItem.findMany({
                  where: {
                    serviceType: service.kind,
                    equipmentTypeServiceId: service.id,
                  },
                  orderBy: { sortOrder: 'asc' },
                })
              : [];
          if (!templates.length)
            templates =
              fixedChecklistFor(equipmentTypeName, service.kind) ?? [];
          if (!templates.length)
            templates = await tx.checklistTemplateItem.findMany({
              where: {
                serviceType: service.kind,
                equipmentTypeServiceId: null,
              },
              orderBy: { sortOrder: 'asc' },
            });
          const ticket = await tx.ticket.create({
            data: {
              ticketNo,
              serviceType: service.kind as TicketType,
              pmServiceId: service.id,
              equipmentId: id,
              priority: 'MEDIUM',
              status: 'OPEN',
              dueDate: new Date(dto.dueDateByServiceId[service.id]),
              createdByUserId: actor.sub,
              maintenanceRecord: {
                create: {
                  checklistItems: { create: toChecklistItems(templates) },
                },
              },
              history: {
                create: {
                  actorId: actor.sub,
                  label: 'Ticket created — manual hour-meter service check',
                },
              },
              serviceCheck: {
                create: {
                  equipmentId: id,
                  equipmentTypeServiceId: service.id,
                  thresholdHours: service.maxHours ?? service.minHours,
                  triggeredByUserId: actor.sub,
                  previousValue,
                  currentValue: equipment.hourMeter,
                },
              },
            },
            include: { pmService: true, maintenanceRecord: true },
          });
          created.push(ticket);
        }
        const recipients = await tx.user.findMany({
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            role: { in: [Role.SUPER_ADMIN, Role.MANAGER, Role.BIMAN_ADMIN] },
          },
          select: { id: true },
        });
        const notifications = await tx.appNotification.createManyAndReturn({
          data: recipients.map(({ id: userId }) => ({
            userId,
            type: 'Service threshold crossed',
            message: `${equipment.assetNo} crossed ${created.length} maintenance service band(s).`,
            entityType: NotificationEntity.EQUIPMENT,
            entityId: id,
          })),
        });
        await tx.equipment.update({
          where: { id },
          data: { lastServiceCheckAt: new Date() },
        });
        return {
          created,
          previousValue,
          currentValue: equipment.hourMeter,
          notifications,
        };
      });
      await this.notificationPublisher.dispatch(result.notifications);
      return {
        created: result.created.map(serializeTicket),
        previousValue: result.previousValue,
        currentValue: result.currentValue,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A service ticket was created concurrently. Refresh and retry.',
        );
      }
      throw error;
    }
  }

  private async assertEngineerEquipmentAccess(id: string, user: AuthUser) {
    if (
      user.role === 'Engineer' &&
      !(await this.prisma.ticket.count({
        where: { equipmentId: id, assignedEngineerId: user.sub },
      }))
    ) {
      throw new ForbiddenException(
        'Engineers can only update equipment assigned to their tickets.',
      );
    }
  }

  private async getRaw(id: string) {
    const item = await this.prisma.equipment.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Equipment not found.');
    return item;
  }

  private includeEquipment() {
    return {
      equipmentType: { select: { id: true, name: true } },
      specifications: true,
      photos: {
        include: {
          fileAsset: {
            select: { id: true, mimeType: true, width: true, height: true },
          },
        },
      },
      documents: {
        include: { fileAsset: { select: { id: true, mimeType: true } } },
      },
    };
  }

  private serialize(item: any) {
    const {
      equipmentType,
      actualGtDate,
      emissionRating,
      tldSerialNo,
      hourMeterReadings,
      photos,
      documents,
      ...rest
    } = item;
    const photosView =
      photos?.map(({ slot, fileAsset }) => ({
        slot,
        id: fileAsset.id,
        url: `/api/files/${fileAsset.id}`,
        thumbnailUrl: `/api/files/${fileAsset.id}/thumbnail`,
      })) ?? [];
    return {
      ...rest,
      status: equipmentStatusLabel[rest.status],
      equipmentType: equipmentType.name,
      equipmentTypeDetails: equipmentType,
      actualGTDate: actualGtDate,
      emissionRating,
      tldSerialNo,
      equipmentPhotos: photosView.map(({ url }) => url),
      photos: photosView,
      documents:
        documents?.map(
          ({ id, name, type, expiryDate, createdAt, fileAsset }) => ({
            id,
            name,
            type,
            expiryDate,
            uploadedAt: createdAt,
            uploadedDate: createdAt,
            fileId: fileAsset.id,
            url: `/api/files/${fileAsset.id}`,
          }),
        ) ?? [],
      hourMeterReadings: hourMeterReadings?.map(
        ({ id, value, recordedAt, recordedBy }) => ({
          id,
          value,
          recordedAt,
          recordedBy: recordedBy.name,
        }),
      ),
    };
  }
}
