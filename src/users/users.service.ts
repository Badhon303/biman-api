import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { organizationToDb, roleFromDb, roleToDb } from '../common/enum-mappers';
import { PaginationDto } from '../common/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { NotificationPublisher } from '../notifications/notification-publisher.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationPublisher: NotificationPublisher,
  ) {}

  async list(query: PaginationDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: query.order ?? 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serialize(item)),
      page,
      limit,
      total,
    };
  }

  async listEngineers(query: PaginationDto) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      role: Role.ENGINEER,
      status: 'ACTIVE',
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map(({ id, name }) => ({ id, name })),
      page,
      limit,
      total,
    };
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('A user with this email already exists.');
    }
    const organization =
      dto.organization ?? (dto.role === 'Biman Admin' ? 'Biman' : 'NGGL');
    if (dto.role === 'Biman Admin' && organization !== 'Biman') {
      throw new BadRequestException(
        'Biman Admin users must belong to the Biman organization.',
      );
    }
    const temporaryPassword =
      dto.temporaryPassword ?? randomBytes(18).toString('base64url');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await hash(temporaryPassword, 12),
        role: roleToDb[dto.role],
        organization: organizationToDb(organization),
        mustChangePassword: true,
      },
    });
    const notification = await this.prisma.appNotification.create({
      data: {
        userId: user.id,
        type: 'Account created',
        message:
          'Your account is ready. Change your temporary password after signing in.',
      },
    });
    await this.notificationPublisher.dispatch([notification]);
    return { ...this.serialize(user), temporaryPassword };
  }

  async updateStatus(
    id: string,
    status: 'Active' | 'Inactive',
    actor: AuthUser,
  ) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found.');
    if (actor.role === 'Manager' && existing.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException(
        'Managers cannot change a Super Admin status.',
      );
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: status === 'Active' ? 'ACTIVE' : 'INACTIVE',
        ...(status === 'Inactive'
          ? {
              refreshTokens: {
                updateMany: {
                  where: { revokedAt: null },
                  data: { revokedAt: new Date() },
                },
              },
            }
          : {}),
      },
    });
    return this.serialize(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found.');
    const role = dto.role ?? roleFromDb[existing.role];
    const existingOrganization =
      existing.organization === 'BIMAN' ? 'Biman' : 'NGGL';
    const organization =
      dto.organization ??
      (dto.role
        ? dto.role === 'Biman Admin'
          ? 'Biman'
          : 'NGGL'
        : existingOrganization);
    if (role === 'Biman Admin' && organization !== 'Biman') {
      throw new BadRequestException(
        'Biman Admin users must belong to the Biman organization.',
      );
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.role ? { role: roleToDb[dto.role] } : {}),
        ...(dto.organization !== undefined || dto.role
          ? { organization: organizationToDb(organization) }
          : {}),
        ...(dto.status
          ? { status: dto.status === 'Active' ? 'ACTIVE' : 'INACTIVE' }
          : {}),
        ...(dto.status === 'Inactive'
          ? {
              refreshTokens: {
                updateMany: {
                  where: { revokedAt: null },
                  data: { revokedAt: new Date() },
                },
              },
            }
          : {}),
      },
    });
    return this.serialize(user);
  }

  async get(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found.');
    return this.serialize(user);
  }

  async archive() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
    return users.map((user) => ({
      ...this.serialize(user),
      deletedAt: user.deletedAt,
    }));
  }

  async restore(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Archived user not found.');
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: null, status: 'ACTIVE' },
    });
    return { success: true };
  }

  async permanentlyRemove(id: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: { id, deletedAt: { not: null } },
          select: { id: true },
        });
        if (!user) throw new NotFoundException('Archived user not found.');
        await tx.user.delete({ where: { id } });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This user is referenced by historical or operational records and cannot be permanently deleted.',
        );
      }
      throw error;
    }
    return { success: true };
  }

  async remove(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found.');
    const deletedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { deletedAt, status: 'INACTIVE' },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: deletedAt },
      }),
    ]);
    return { success: true };
  }

  async setPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found.');
    const [, , notification] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash: await hash(newPassword, 12),
          mustChangePassword: true,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.appNotification.create({
        data: {
          userId: id,
          type: 'Password reset',
          message:
            'Your password was reset by an administrator. Change it after signing in.',
        },
      }),
    ]);
    await this.notificationPublisher.dispatch([notification]);
    return { success: true };
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found.');
    const temporaryPassword = randomBytes(18).toString('base64url');
    const [, , notification] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash: await hash(temporaryPassword, 12),
          mustChangePassword: true,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.appNotification.create({
        data: {
          userId: id,
          type: 'Password reset',
          message:
            'Your password was reset. Use the temporary password provided by your administrator.',
        },
      }),
    ]);
    await this.notificationPublisher.dispatch([notification]);
    return { success: true, temporaryPassword };
  }

  private serialize(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: roleFromDb[user.role],
      organization: user.organization === 'BIMAN' ? 'Biman' : 'NGGL',
      status: user.status === 'ACTIVE' ? 'Active' : 'Inactive',
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    };
  }
}
