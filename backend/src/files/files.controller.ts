import {
  Controller,
  Post,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Request,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

/** MIME types that are permitted for upload */
const ALLOWED_MIME_TYPES = new Set<string>([
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'text/plain',
]);

const IMAGE_MIME_PREFIX = 'image/';
const IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Access(AccessLevel.WRITE)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * POST /files
   * Generic file upload endpoint.
   * Accepts multipart/form-data with fields: orgId, entityType, entityId, file.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: FileUploadDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UploadedFileInfo> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `File type "${file.mimetype}" is not allowed. Allowed types: images, PDF, DOCX, XLSX, PPTX, ZIP.`,
      );
    }

    // Validate file size per type
    const isImageOrText =
      file.mimetype.startsWith(IMAGE_MIME_PREFIX) ||
      file.mimetype === 'text/plain';
    const sizeLimit = isImageOrText
      ? IMAGE_MAX_SIZE_BYTES
      : DEFAULT_MAX_SIZE_BYTES;

    if (file.size > sizeLimit) {
      const limitMb = sizeLimit / (1024 * 1024);
      throw new BadRequestException(
        `File too large. Maximum allowed size for this file type is ${limitMb} MB.`,
      );
    }

    // Org-ownership enforcement: skip for global admins
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

  /**
   * DELETE /files/:id
   * Removes a file from disk and the database.
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
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
