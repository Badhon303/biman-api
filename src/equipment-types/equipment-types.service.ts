import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ServiceKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { serviceKindFromName } from '../common/enum-mappers';
import {
  applyChecklistSettings,
  checklistCatalogFor,
  ChecklistTemplate,
} from '../common/fixed-checklists';
import {
  CreateEquipmentTypeDto,
  UpdateEquipmentTypeDto,
} from './equipment-types.dto';
import { validateServiceBands } from './service-band.validation';

@Injectable()
export class EquipmentTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    return this.prisma.equipmentType.findMany({
      where: {
        deletedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { equipment: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const item = await this.prisma.equipmentType.findFirst({
      where: { id, deletedAt: null },
      include: {
        services: {
          orderBy: { sortOrder: 'asc' },
          include: { checklistItems: { orderBy: { sortOrder: 'asc' } } },
        },
        _count: { select: { equipment: true } },
      },
    });
    if (!item) throw new NotFoundException('Equipment type not found.');
    return {
      ...item,
      services: item.services.map((service) => ({
        ...service,
        checklistItems: this.checklistSettingsFor(
          service.kind,
          service.checklistItems,
        ),
      })),
    };
  }

  checklistCatalog() {
    return Object.fromEntries(
      Object.values(ServiceKind).map((kind) => [
        kind,
        this.checklistSettingsFor(kind, []),
      ]),
    );
  }

  private checklistSettingsFor(kind: ServiceKind, saved: ChecklistTemplate[]) {
    return applyChecklistSettings(checklistCatalogFor(kind), saved);
  }

  async create(dto: CreateEquipmentTypeDto) {
    validateServiceBands(dto.services);
    try {
      return await this.prisma.equipmentType.create({
        data: {
          name: dto.name,
          services: {
            create: dto.services.map((service, sortOrder) => {
              const kind = serviceKindFromName(service.name);
              return {
                name: service.name,
                kind,
                checklistItems: service.checklistItems?.length
                  ? {
                      create: service.checklistItems.map((item) => ({
                        ...item,
                        serviceType: kind,
                      })),
                    }
                  : undefined,
                minHours: service.minHours,
                maxHours: service.maxHours,
                months: kind === ServiceKind.V_SERVICE ? 6 : null,
                sortOrder,
              };
            }),
          },
        },
        include: { services: { orderBy: { sortOrder: 'asc' } } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An equipment type with this name already exists.',
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateEquipmentTypeDto) {
    const item = await this.prisma.equipmentType.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!item) throw new NotFoundException('Equipment type not found.');
    if (dto.services) validateServiceBands(dto.services);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.services) {
          const existingServices = await tx.equipmentTypeService.findMany({
            where: { equipmentTypeId: id },
          });
          const retainedIds: string[] = [];
          for (const [sortOrder, service] of dto.services.entries()) {
            const existing = service.id
              ? existingServices.find((item) => item.id === service.id)
              : existingServices.find((item) => item.name === service.name);
            if (service.id && !existing) {
              throw new NotFoundException(
                'Service does not belong to this equipment type.',
              );
            }
            const kind = serviceKindFromName(service.name);
            const data = {
              name: service.name,
              kind,
              minHours: service.minHours,
              maxHours: service.maxHours,
              months: kind === ServiceKind.V_SERVICE ? 6 : null,
              sortOrder,
            };
            const saved = existing
              ? await tx.equipmentTypeService.update({
                  where: { id: existing.id },
                  data,
                })
              : await tx.equipmentTypeService.create({
                  data: { ...data, equipmentTypeId: id },
                });
            if (service.checklistItems) {
              await tx.checklistTemplateItem.deleteMany({
                where: { equipmentTypeServiceId: saved.id },
              });
              if (service.checklistItems.length)
                await tx.checklistTemplateItem.createMany({
                  data: service.checklistItems.map((item) => ({
                    ...item,
                    serviceType: kind,
                    equipmentTypeServiceId: saved.id,
                  })),
                });
            }
            retainedIds.push(saved.id);
          }
          await tx.equipmentTypeService.deleteMany({
            where: { equipmentTypeId: id, id: { notIn: retainedIds } },
          });
        }
        return tx.equipmentType.update({
          where: { id },
          data: dto.name ? { name: dto.name } : {},
          include: { services: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An equipment type with this name already exists.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot replace a service band referenced by an existing ticket.',
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    const equipmentCount = await this.prisma.equipment.count({
      where: { equipmentTypeId: id, deletedAt: null },
    });
    if (equipmentCount)
      throw new ConflictException(
        'Reassign equipment before deleting this type.',
      );
    await this.prisma.equipmentType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  archive() {
    return this.prisma.equipmentType.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      include: {
        services: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { equipment: true } },
      },
    });
  }

  async restore(id: string) {
    const item = await this.prisma.equipmentType.findFirst({
      where: { id, deletedAt: { not: null } },
    });
    if (!item)
      throw new NotFoundException('Archived equipment type not found.');
    await this.prisma.equipmentType.update({
      where: { id },
      data: { deletedAt: null },
    });
    return { success: true };
  }

  async permanentlyRemove(id: string) {
    const item = await this.prisma.equipmentType.findFirst({
      where: { id, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!item)
      throw new NotFoundException('Archived equipment type not found.');
    try {
      await this.prisma.equipmentType.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Remove linked equipment and service records before permanently deleting this type.',
        );
      }
      throw error;
    }
    return { success: true };
  }
}
