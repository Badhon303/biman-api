import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import {
  AttachFileDto,
  UploadDocumentDto,
  UploadImageDto,
} from './storage.dto';
import { StorageService } from './storage.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller('files')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadImageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storage.uploadImage(file, dto, user);
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storage.uploadDocument(file, dto, user);
  }

  @Delete(':id')
  deleteFile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.storage.deleteFile(id, user);
  }

  @Post(':id/attach')
  attach(
    @Param('id') id: string,
    @Body() dto: AttachFileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storage.attach(id, dto, user);
  }

  @Get('usage')
  @Roles('Super Admin')
  usage() {
    return this.storage.usage();
  }

  @Get(':id/thumbnail')
  async thumbnail(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.storage.file(id, user, true);
    response.setHeader('ETag', result.etag);
    response.setHeader('Content-Length', result.size);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return result.stream;
  }

  @Get(':id')
  async file(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.storage.file(id, user);
    response.setHeader('ETag', result.etag);
    response.setHeader('Content-Length', result.size);
    response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    return result.stream;
  }
}
