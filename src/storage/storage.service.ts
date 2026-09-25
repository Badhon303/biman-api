import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FilePurpose, FileStatus, PhotoSlot } from '@prisma/client';
import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { AuthUser } from '../common/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import {
  AttachFileDto,
  UploadDocumentDto,
  UploadImageDto,
} from './storage.dto';

const allowedFormats = new Set(['jpeg', 'png', 'webp', 'avif']);
const safeName = (name: string) =>
  basename(name)
    .replace(/[\r\n]/g, '')
    .slice(0, 180);

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const configured = config.get<string>('LOCAL_UPLOAD_ROOT', './var/uploads');
    this.root = isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
    sharp.concurrency(1);
  }

  async uploadImage(
    file: Express.Multer.File | undefined,
    dto: UploadImageDto,
    user: AuthUser,
  ) {
    this.requireFile(file);
    await this.authorizeUpload(dto.purpose, dto.ownerId, user);
    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes)
      throw new BadRequestException('Image uploads are limited to 15 MB.');
    const metadata = await sharp(file.buffer, {
      limitInputPixels: 40_000_000,
    }).metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format)) {
      throw new BadRequestException(
        'Only JPEG, PNG, WebP, and AVIF images are accepted.',
      );
    }

    const id = randomUUID();
    const directory = this.imageDirectory(dto.purpose, dto.ownerId);
    const relativePath = `${directory}/${id}.webp`;
    const thumbnailRelativePath = `${directory}/${id}_thumb.webp`;
    const fullPath = this.absolutePath(relativePath);
    const thumbnailPath = this.absolutePath(thumbnailRelativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    try {
      const full = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78, effort: 4 })
        .toBuffer({ resolveWithObject: true });
      const thumb = await sharp(file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: 320,
          height: 320,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 70, effort: 4 })
        .toBuffer();
      await Promise.all([
        writeFile(fullPath, full.data, { flag: 'wx' }),
        writeFile(thumbnailPath, thumb, { flag: 'wx' }),
      ]);
      const asset = await this.prisma.fileAsset.create({
        data: {
          id,
          relativePath,
          thumbnailRelativePath,
          purpose: dto.purpose as FilePurpose,
          mimeType: 'image/webp',
          sizeBytes: full.data.length,
          thumbnailSizeBytes: thumb.length,
          originalSizeBytes: file.size,
          width: full.info.width,
          height: full.info.height,
          sha256: createHash('sha256').update(full.data).digest('hex'),
          uploadedByUserId: user.sub,
        },
      });
      return this.assetResponse(asset);
    } catch (error) {
      await Promise.all([
        rm(fullPath, { force: true }),
        rm(thumbnailPath, { force: true }),
      ]);
      throw error;
    }
  }

  async uploadDocument(
    file: Express.Multer.File | undefined,
    dto: UploadDocumentDto,
    user: AuthUser,
  ) {
    this.requireFile(file);
    await this.authorizeUpload('EQUIPMENT_DOCUMENT', dto.equipmentId, user);
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('Document uploads are limited to 10 MB.');
    const isPdf = file.buffer.subarray(0, 5).toString() === '%PDF-';
    const isJpeg =
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff;
    const isPng = file.buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (!isPdf && !isJpeg && !isPng)
      throw new BadRequestException('Documents must be PDF or JPEG/PNG scans.');

    const id = randomUUID();
    const directory = `equipment/${dto.equipmentId}/documents`;
    const extension = isPdf ? '.pdf' : '.webp';
    const relativePath = `${directory}/${id}${extension}`;
    const destination = this.absolutePath(relativePath);
    await mkdir(dirname(destination), { recursive: true });
    try {
      let output = file.buffer;
      let width: number | undefined;
      let height: number | undefined;
      let mimeType = 'application/pdf';
      if (!isPdf) {
        const result = await sharp(file.buffer, {
          limitInputPixels: 40_000_000,
        })
          .rotate()
          .resize({
            width: 2400,
            height: 2400,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 78, effort: 4 })
          .toBuffer({ resolveWithObject: true });
        output = result.data;
        width = result.info.width;
        height = result.info.height;
        mimeType = 'image/webp';
      }
      await writeFile(destination, output, { flag: 'wx' });
      const asset = await this.prisma.fileAsset.create({
        data: {
          id,
          relativePath,
          purpose: FilePurpose.EQUIPMENT_DOCUMENT,
          mimeType,
          sizeBytes: output.length,
          originalSizeBytes: file.size,
          width,
          height,
          sha256: createHash('sha256').update(output).digest('hex'),
          uploadedByUserId: user.sub,
        },
      });
      return {
        ...this.assetResponse(asset),
        originalName: safeName(file.originalname),
        documentType: dto.type,
      };
    } catch (error) {
      await rm(destination, { force: true });
      throw error;
    }
  }

  async attach(id: string, dto: AttachFileDto, user: AuthUser) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('File asset not found.');
    if (asset.status !== FileStatus.PENDING)
      throw new BadRequestException('This file has already been attached.');
    if (
      asset.uploadedByUserId !== user.sub &&
      user.role !== 'Super Admin' &&
      user.role !== 'Manager'
    )
      throw new ForbiddenException();

    if (asset.purpose === FilePurpose.EQUIPMENT_PHOTO) {
      const equipmentId = dto.equipmentId;
      if (!equipmentId)
        throw new BadRequestException('equipmentId is required.');
      await this.authorizeUpload('EQUIPMENT_PHOTO', equipmentId, user);
      const slot = (dto.slot ?? 'OTHER') as PhotoSlot;
      if (slot === PhotoSlot.OTHER) {
        const count = await this.prisma.equipmentPhoto.count({
          where: { equipmentId },
        });
        if (count >= 10)
          throw new BadRequestException(
            'An equipment can have up to 10 OTHER photos.',
          );
      } else {
        const old = await this.prisma.equipmentPhoto.findFirst({
          where: { equipmentId, slot },
        });
        if (old) {
          await this.prisma.equipmentPhoto.delete({ where: { id: old.id } });
          await this.removeAsset(old.fileAssetId);
        }
      }
      await this.prisma.$transaction([
        this.prisma.equipmentPhoto.create({
          data: { equipmentId, fileAssetId: id, slot },
        }),
        this.prisma.fileAsset.update({
          where: { id },
          data: { status: FileStatus.ATTACHED, attachedAt: new Date() },
        }),
      ]);
    } else if (asset.purpose === FilePurpose.EQUIPMENT_DOCUMENT) {
      if (!dto.equipmentId || !dto.name || !dto.type)
        throw new BadRequestException(
          'equipmentId, name and type are required.',
        );
      await this.authorizeUpload('EQUIPMENT_DOCUMENT', dto.equipmentId, user);
      await this.prisma.$transaction([
        this.prisma.equipmentDocument.create({
          data: {
            equipmentId: dto.equipmentId,
            fileAssetId: id,
            name: safeName(dto.name),
            type: dto.type,
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          },
        }),
        this.prisma.fileAsset.update({
          where: { id },
          data: { status: FileStatus.ATTACHED, attachedAt: new Date() },
        }),
      ]);
    } else if (asset.purpose === FilePurpose.WORK_IMAGE) {
      if (!dto.ticketId) throw new BadRequestException('ticketId is required.');
      await this.authorizeTicket(dto.ticketId, user);
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: dto.ticketId },
        select: { maintenanceRecord: { select: { id: true } } },
      });
      if (!ticket?.maintenanceRecord)
        throw new NotFoundException('Ticket maintenance record not found.');
      const imageCount = await this.prisma.workImage.count({
        where: { maintenanceRecordId: ticket.maintenanceRecord.id },
      });
      if (imageCount >= 10)
        throw new BadRequestException(
          'A work-image set can contain up to 10 images.',
        );
      await this.prisma.$transaction([
        this.prisma.workImage.create({
          data: {
            maintenanceRecordId: ticket.maintenanceRecord.id,
            fileAssetId: id,
          },
        }),
        this.prisma.fileAsset.update({
          where: { id },
          data: { status: FileStatus.ATTACHED, attachedAt: new Date() },
        }),
      ]);
    } else {
      if (!dto.feedbackId)
        throw new BadRequestException('feedbackId is required.');
      const feedback = await this.prisma.ticketFeedback.findUnique({
        where: { id: dto.feedbackId },
        select: { ticketId: true },
      });
      if (!feedback) throw new NotFoundException('Feedback entry not found.');
      await this.authorizeTicket(feedback.ticketId, user);
      const imageCount = await this.prisma.feedbackImage.count({
        where: { feedbackId: dto.feedbackId },
      });
      if (imageCount >= 10)
        throw new BadRequestException(
          'A feedback entry can contain up to 10 images.',
        );
      await this.prisma.$transaction([
        this.prisma.feedbackImage.create({
          data: { feedbackId: dto.feedbackId, fileAssetId: id },
        }),
        this.prisma.fileAsset.update({
          where: { id },
          data: { status: FileStatus.ATTACHED, attachedAt: new Date() },
        }),
      ]);
    }
    return this.prisma.fileAsset.findUnique({
      where: { id },
      select: {
        id: true,
        purpose: true,
        mimeType: true,
        sizeBytes: true,
        width: true,
        height: true,
        status: true,
        attachedAt: true,
      },
    });
  }

  async deleteEquipmentDocument(id: string, user: AuthUser) {
    if (!['Super Admin', 'Manager'].includes(user.role))
      throw new ForbiddenException();

    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id,
        purpose: FilePurpose.EQUIPMENT_DOCUMENT,
        status: FileStatus.ATTACHED,
        deletedAt: null,
      },
      include: { equipmentDocument: true },
    });
    if (!asset?.equipmentDocument)
      throw new NotFoundException('Equipment document not found.');

    await this.prisma.$transaction(async (tx) => {
      await tx.equipmentDocument.delete({ where: { fileAssetId: id } });
      await tx.fileAsset.delete({ where: { id } });
    });
    await Promise.all([
      rm(this.absolutePath(asset.relativePath), { force: true }),
      ...(asset.thumbnailRelativePath
        ? [rm(this.absolutePath(asset.thumbnailRelativePath), { force: true })]
        : []),
    ]);
    return { success: true };
  }

  async file(id: string, user: AuthUser, thumbnail = false) {
    const asset = await this.prisma.fileAsset.findFirst({
      where: { id, deletedAt: null },
      include: {
        equipmentPhoto: { select: { equipmentId: true } },
        equipmentDocument: { select: { equipmentId: true } },
        workImage: {
          select: { maintenanceRecord: { select: { ticketId: true } } },
        },
        feedbackImage: { select: { feedback: { select: { ticketId: true } } } },
      },
    });
    if (!asset) throw new NotFoundException('File not found.');
    await this.authorizeFileRead(asset, user);
    const relativePath =
      thumbnail && asset.thumbnailRelativePath
        ? asset.thumbnailRelativePath
        : asset.relativePath;
    const path = this.absolutePath(relativePath);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) throw new NotFoundException('Stored file is missing.');
    const stream = createReadStream(path);
    return {
      stream: new StreamableFile(stream, {
        type: asset.mimeType,
        length: info.size,
        disposition:
          asset.mimeType === 'application/pdf' ? 'attachment' : 'inline',
      }),
      etag: `"${asset.sha256}"`,
      size: info.size,
    };
  }

  async usage() {
    const assets = await this.prisma.fileAsset.findMany({
      where: { deletedAt: null },
      select: {
        sizeBytes: true,
        thumbnailSizeBytes: true,
        originalSizeBytes: true,
      },
    });
    const usedBytes = assets.reduce(
      (sum, item) => sum + item.sizeBytes + (item.thumbnailSizeBytes ?? 0),
      0,
    );
    const quotaBytes = Number(
      this.config.get('STORAGE_QUOTA_BYTES', 10 * 1024 ** 3),
    );
    const originalBytes = assets.reduce(
      (sum, item) => sum + item.originalSizeBytes,
      0,
    );
    return {
      usedBytes,
      quotaBytes,
      assetCount: assets.length,
      bytesSaved: Math.max(0, originalBytes - usedBytes),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupPendingAssets() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const assets = await this.prisma.fileAsset.findMany({
      where: { status: FileStatus.PENDING, createdAt: { lt: cutoff } },
    });
    for (const asset of assets) await this.removeAsset(asset.id);
  }

  private async removeAsset(id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) return;
    await this.prisma.fileAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await Promise.all([
      rm(this.absolutePath(asset.relativePath), { force: true }),
      ...(asset.thumbnailRelativePath
        ? [rm(this.absolutePath(asset.thumbnailRelativePath), { force: true })]
        : []),
    ]);
  }

  private async authorizeUpload(
    purpose: string,
    ownerId: string,
    user: AuthUser,
  ) {
    if (purpose === 'EQUIPMENT_PHOTO' || purpose === 'EQUIPMENT_DOCUMENT') {
      if (!['Super Admin', 'Manager'].includes(user.role))
        throw new ForbiddenException();
      const equipment = await this.prisma.equipment.findFirst({
        where: { id: ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!equipment) throw new NotFoundException('Equipment not found.');
      return;
    }
    if (purpose === 'WORK_IMAGE' || purpose === 'FEEDBACK_IMAGE')
      await this.authorizeTicket(ownerId, user);
  }

  private async authorizeTicket(ticketId: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { assignedEngineerId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    if (
      !['Super Admin', 'Manager'].includes(user.role) &&
      ticket.assignedEngineerId !== user.sub
    )
      throw new ForbiddenException();
  }

  private async authorizeFileRead(asset: any, user: AuthUser) {
    if (user.role === 'Super Admin' || user.role === 'Manager') return;
    if (
      asset.status === FileStatus.PENDING &&
      asset.uploadedByUserId === user.sub
    )
      return;
    const equipmentId =
      asset.equipmentPhoto?.equipmentId ?? asset.equipmentDocument?.equipmentId;
    if (equipmentId) {
      if (user.role === 'Biman Admin') return;
      if (user.role === 'Engineer') {
        const assigned = await this.prisma.ticket.count({
          where: { equipmentId, assignedEngineerId: user.sub },
        });
        if (assigned) return;
      }
    }
    const ticketId =
      asset.workImage?.maintenanceRecord.ticketId ??
      asset.feedbackImage?.feedback.ticketId;
    if (ticketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { assignedEngineerId: true },
      });
      if (
        user.role === 'Biman Admin' ||
        ticket?.assignedEngineerId === user.sub
      )
        return;
    }
    throw new ForbiddenException();
  }

  private requireFile(
    file?: Express.Multer.File,
  ): asserts file is Express.Multer.File {
    if (!file?.buffer?.length)
      throw new BadRequestException('A file is required.');
  }

  private imageDirectory(purpose: UploadImageDto['purpose'], ownerId: string) {
    if (purpose === 'EQUIPMENT_PHOTO') return `equipment/${ownerId}/photos`;
    if (purpose === 'WORK_IMAGE') return `tickets/${ownerId}/work-images`;
    return `tickets/${ownerId}/feedback/pending`;
  }

  private absolutePath(relativePath: string) {
    const path = resolve(this.root, relativePath);
    if (!path.startsWith(`${this.root}${sep}`))
      throw new BadRequestException('Invalid file path.');
    return path;
  }

  private assetResponse(asset: any) {
    return {
      id: asset.id,
      url: `/api/files/${asset.id}`,
      thumbnailUrl: asset.thumbnailRelativePath
        ? `/api/files/${asset.id}/thumbnail`
        : undefined,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
    };
  }
}
