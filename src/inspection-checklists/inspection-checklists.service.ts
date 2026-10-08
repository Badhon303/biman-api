import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoryDto,
  CreateItemDto,
  UpdateItemDto,
} from './inspection-checklists.dto';

const nextOrder = (max: number | null) => (max ?? -1) + 1;

@Injectable()
export class InspectionChecklistsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.inspectionChecklistCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  private async guard<T>(action: Promise<T>, notFound: string): Promise<T> {
    try {
      return await action;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002')
          throw new ConflictException(
            'A category with this name already exists.',
          );
        if (error.code === 'P2025' || error.code === 'P2003')
          throw new NotFoundException(notFound);
      }
      throw error;
    }
  }

  async createCategory(dto: CategoryDto) {
    const { _max } = await this.prisma.inspectionChecklistCategory.aggregate({
      _max: { sortOrder: true },
    });
    return this.guard(
      this.prisma.inspectionChecklistCategory.create({
        data: { name: dto.name.trim(), sortOrder: nextOrder(_max.sortOrder) },
        include: { items: true },
      }),
      'Category not found.',
    );
  }

  updateCategory(id: string, dto: CategoryDto) {
    return this.guard(
      this.prisma.inspectionChecklistCategory.update({
        where: { id },
        data: { name: dto.name.trim() },
        include: { items: true },
      }),
      'Category not found.',
    );
  }

  async removeCategory(id: string) {
    await this.guard(
      this.prisma.inspectionChecklistCategory.delete({ where: { id } }),
      'Category not found.',
    );
    return { success: true };
  }

  async createItem(dto: CreateItemDto) {
    const { _max } = await this.prisma.inspectionChecklistItem.aggregate({
      where: { categoryId: dto.categoryId },
      _max: { sortOrder: true },
    });
    return this.guard(
      this.prisma.inspectionChecklistItem.create({
        data: {
          categoryId: dto.categoryId,
          label: dto.label.trim(),
          sortOrder: nextOrder(_max.sortOrder),
        },
      }),
      'Category not found.',
    );
  }

  updateItem(id: string, dto: UpdateItemDto) {
    return this.guard(
      this.prisma.inspectionChecklistItem.update({
        where: { id },
        data: { label: dto.label.trim() },
      }),
      'Checklist item not found.',
    );
  }

  async removeItem(id: string) {
    await this.guard(
      this.prisma.inspectionChecklistItem.delete({ where: { id } }),
      'Checklist item not found.',
    );
    return { success: true };
  }
}
