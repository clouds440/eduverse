import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Role } from '../common/enums';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { FilesService } from './files.service';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { FileUploadDto } from './files.dto';
import type {
  UploadedFileInfo,
  DeleteFileResult,
} from './interfaces/files.interfaces';

@Access(AccessLevel.READ)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @Access(AccessLevel.WRITE)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: FileUploadDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UploadedFileInfo> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const isGlobalAdmin =
      req.user.role === Role.SUPER_ADMIN ||
      req.user.role === Role.PLATFORM_ADMIN;

    if (!isGlobalAdmin && req.user.organizationId !== dto.orgId) {
      throw new ForbiddenException(
        'You cannot upload files to an organization you do not belong to',
      );
    }

    return this.filesService.saveFile(dto, file, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/metadata')
  async getFileMetadata(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<UploadedFileInfo> {
    return this.filesService.getFileMetadata(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async downloadFile(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const payload = await this.filesService.getDownloadPayload(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId ?? null,
    });

    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Length', String(payload.buffer.length));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeHeaderFilename(payload.filename)}"; filename*=UTF-8''${encodeURIComponent(payload.filename)}`,
    );
    res.send(payload.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @Access(AccessLevel.WRITE)
  async deleteFile(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<DeleteFileResult> {
    return this.filesService.deleteFile(id, {
      id: req.user.id,
      role: req.user.role,
      organizationId: req.user.organizationId ?? null,
    });
  }
}

function sanitizeHeaderFilename(filename: string) {
  return (filename || 'download').replace(/["\r\n\\]/g, '_');
}
