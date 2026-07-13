import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { extname } from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from '../prisma/prisma.service';
import { FileUploadDto } from './files.dto';
import { Role } from '../common/enums';
import {
  UploadedFileInfo,
  DeleteFileResult,
} from './interfaces/files.interfaces';
import {
  classifyAndValidateUpload,
  FilePolicyResult,
} from './file-upload-policy';

type RequestingUser = {
  id: string;
  role: string;
  organizationId: string | null;
};

type StoredFileRecord = {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  path: string;
  publicId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  resourceType?: string;
  deliveryType?: string;
  fileKind?: string;
  extension?: string | null;
  sha256?: string | null;
  scanStatus?: string;
  createdAt: Date;
};

interface DownloadPayload {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size?: number;
}

type CloudinaryUploadResult = {
  public_id: string;
  resource_type?: string;
};

const SIGNED_DOWNLOAD_TTL_SECONDS = 5 * 60;
const AUTHENTICATED_DELIVERY_TYPE = 'authenticated';

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveFile(
    dto: FileUploadDto,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<UploadedFileInfo> {
    if (!file.buffer) {
      throw new BadRequestException('File upload could not be read.');
    }

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const policy = classifyAndValidateUpload(file, dto.entityType, sha256);
    const uploadResult = await this.uploadToCloudinary(dto, file, policy);

    let record = await this.prisma.file.create({
      data: {
        orgId: dto.orgId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        path: '',
        publicId: uploadResult.public_id,
        filename: file.originalname,
        mimeType: file.mimetype || uploadResult.resource_type || 'application/octet-stream',
        size: file.size,
        uploadedBy,
        resourceType: policy.resourceType,
        deliveryType: AUTHENTICATED_DELIVERY_TYPE,
        fileKind: policy.fileKind,
        extension: policy.extension,
        sha256: policy.sha256,
        scanStatus: 'PASSED',
      },
    });

    record = await this.prisma.file.update({
      where: { id: record.id },
      data: { path: this.downloadPath(record.id) },
    });

    return this.toUploadedFileInfo(record);
  }

  async deleteFile(
    fileId: string,
    requestingUser: RequestingUser,
  ): Promise<DeleteFileResult> {
    const record = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!record) {
      throw new NotFoundException(`File with id "${fileId}" not found`);
    }

    await this.assertCanAccessFile(record, requestingUser);

    if (record.publicId) {
      try {
        await cloudinary.uploader.destroy(record.publicId, {
          resource_type: this.resolveResourceType(record),
          type: record.deliveryType || AUTHENTICATED_DELIVERY_TYPE,
          invalidate: true,
        });
      } catch (err) {
        console.error(
          `Failed to delete file from Cloudinary: ${record.publicId}`,
          err,
        );
      }
    }

    await this.prisma.file.delete({ where: { id: fileId } });

    return { message: 'File deleted successfully' };
  }

  async getDownloadPayload(
    fileId: string,
    requestingUser: RequestingUser,
  ): Promise<DownloadPayload> {
    const record = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!record) {
      throw new NotFoundException(`File with id "${fileId}" not found`);
    }

    await this.assertCanAccessFile(record, requestingUser);

    if (!record.publicId) {
      throw new NotFoundException('File storage reference not found');
    }

    const downloadUrl = this.createSignedCloudinaryDownloadUrl(record);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new InternalServerErrorException('Could not retrieve file');
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: record.filename,
      mimeType:
        response.headers.get('content-type') ||
        record.mimeType ||
        'application/octet-stream',
      size: record.size,
    };
  }

  toUploadedFileInfo(record: StoredFileRecord): UploadedFileInfo {
    return {
      id: record.id,
      path: this.downloadPath(record.id),
      filename: record.filename,
      size: record.size,
      mimeType: record.mimeType,
      entityType: record.entityType,
      entityId: record.entityId,
      orgId: record.orgId,
      publicId: record.publicId || undefined,
      resourceType: record.resourceType,
      deliveryType: record.deliveryType,
      fileKind: record.fileKind,
      extension: record.extension,
      sha256: record.sha256,
      scanStatus: record.scanStatus,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
    };
  }

  toPublicFile<T extends { id: string; path: string }>(record: T): T {
    return {
      ...record,
      path: this.downloadPath(record.id),
    };
  }

  toPublicFiles<T extends { id: string; path: string }>(records: T[]): T[] {
    return records.map((record) => this.toPublicFile(record));
  }

  async replaceFile(
    oldUrl: string | null,
    file: Express.Multer.File,
  ): Promise<string> {
    if (oldUrl) {
      if (oldUrl.startsWith('http') && oldUrl.includes('cloudinary.com')) {
        const parts = oldUrl.split('/');
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex !== -1 && parts.length > uploadIndex + 2) {
          const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
          const publicId = publicIdWithExt.split('.')[0];
          try {
            await cloudinary.uploader.destroy(publicId, {
              resource_type: 'image',
              invalidate: true,
            });
          } catch (err) {
            console.error(
              `Failed to delete old file from Cloudinary: ${publicId}`,
              err,
            );
          }
        }
      }
    }

    return file.path;
  }

  private async uploadToCloudinary(
    dto: FileUploadDto,
    file: Express.Multer.File,
    policy: FilePolicyResult,
  ): Promise<CloudinaryUploadResult> {
    const publicId = `${Date.now()}-${this.safeBaseName(file.originalname)}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `eduverse/orgs/${this.safeSegment(dto.orgId)}/${this.safeSegment(dto.entityType)}/${this.safeSegment(dto.entityId)}`,
          resource_type: policy.resourceType,
          type: AUTHENTICATED_DELIVERY_TYPE,
          public_id: publicId,
          overwrite: false,
          filename_override: file.originalname,
          use_filename_as_display_name: true,
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Cloudinary upload failed'));
            return;
          }
          resolve(result);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  private createSignedCloudinaryDownloadUrl(record: StoredFileRecord) {
    const extension = this.resolveExtension(record);
    const expiresAt =
      Math.floor(Date.now() / 1000) + SIGNED_DOWNLOAD_TTL_SECONDS;

    return cloudinary.utils.private_download_url(record.publicId!, extension, {
      resource_type: this.resolveResourceType(record),
      type: record.deliveryType || AUTHENTICATED_DELIVERY_TYPE,
      expires_at: expiresAt,
      attachment: true,
    });
  }

  private async assertCanAccessFile(
    record: StoredFileRecord,
    requestingUser: RequestingUser,
  ) {
    const isGlobalAdmin =
      requestingUser.role === Role.SUPER_ADMIN ||
      requestingUser.role === Role.PLATFORM_ADMIN;
    if (isGlobalAdmin) return;

    if (!requestingUser.organizationId || requestingUser.organizationId !== record.orgId) {
      throw new ForbiddenException('You do not have permission to access this file');
    }

    if (this.isOrgStaffRole(requestingUser.role)) return;

    const entityType = record.entityType.toUpperCase();
    if (entityType.startsWith('FINANCE_')) {
      if (
        requestingUser.role === Role.FINANCE_MANAGER ||
        record.uploadedBy === requestingUser.id
      ) {
        return;
      }
    }

    if (entityType === 'COURSE_MATERIAL') {
      await this.assertCourseMaterialAccess(record.entityId, requestingUser);
      return;
    }

    if (entityType === 'ASSESSMENT') {
      await this.assertAssessmentAccess(record.entityId, requestingUser);
      return;
    }

    if (entityType === 'SUBMISSION') {
      await this.assertSubmissionAccess(record.entityId, requestingUser);
      return;
    }

    if (entityType === 'CHAT' || entityType === 'CHAT_AVATAR') {
      await this.assertChatAccess(record.entityId, requestingUser);
      return;
    }

    if (record.uploadedBy === requestingUser.id) return;

    throw new ForbiddenException('You do not have permission to access this file');
  }

  private async assertCourseMaterialAccess(
    materialId: string,
    requestingUser: RequestingUser,
  ) {
    const material = await this.prisma.courseMaterial.findUnique({
      where: { id: materialId },
      select: {
        section: {
          select: {
            teachers: { select: { userId: true } },
            enrollments: { select: { student: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!material) throw new NotFoundException('Course material not found');

    const canAccess =
      material.section.teachers.some((teacher) => teacher.userId === requestingUser.id) ||
      material.section.enrollments.some(
        (enrollment) => enrollment.student.userId === requestingUser.id,
      );

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }

  private async assertAssessmentAccess(
    assessmentId: string,
    requestingUser: RequestingUser,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        section: {
          select: {
            teachers: { select: { userId: true } },
            enrollments: { select: { student: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    const canAccess =
      assessment.section.teachers.some((teacher) => teacher.userId === requestingUser.id) ||
      assessment.section.enrollments.some(
        (enrollment) => enrollment.student.userId === requestingUser.id,
      );

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }

  private async assertSubmissionAccess(
    submissionId: string,
    requestingUser: RequestingUser,
  ) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        student: { select: { userId: true } },
        assessment: {
          select: {
            section: { select: { teachers: { select: { userId: true } } } },
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const canAccess =
      submission.student.userId === requestingUser.id ||
      submission.assessment.section.teachers.some(
        (teacher) => teacher.userId === requestingUser.id,
      );

    if (!canAccess) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }

  private async assertChatAccess(chatId: string, requestingUser: RequestingUser) {
    const participant = await this.prisma.chatParticipant.findFirst({
      where: { chatId, userId: requestingUser.id },
      select: { id: true },
    });

    if (!participant) {
      throw new ForbiddenException('You do not have permission to access this file');
    }
  }

  private isOrgStaffRole(role: string) {
    return (
      role === Role.ORG_ADMIN ||
      role === Role.SUB_ADMIN ||
      role === Role.ORG_MANAGER
    );
  }

  private downloadPath(fileId: string) {
    return `/files/${fileId}/download`;
  }

  private safeBaseName(filename: string) {
    const extension = extname(filename);
    const baseName = extension ? filename.slice(0, -extension.length) : filename;
    return this.safeSegment(baseName || 'file');
  }

  private safeSegment(value: string) {
    return String(value || 'unknown')
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'unknown';
  }

  private resolveResourceType(record: StoredFileRecord): 'image' | 'raw' {
    return record.resourceType === 'image' ? 'image' : 'raw';
  }

  private resolveExtension(record: StoredFileRecord) {
    const extension = record.extension || extname(record.filename);
    return extension.replace(/^\./, '') || 'txt';
  }
}
