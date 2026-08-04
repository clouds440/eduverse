import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
export class Phase11FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async saveManagedFile(
    dto: { orgId: string; entityType: string; entityId: string },
    file: Express.Multer.File,
    uploadedBy: string,
  ) {
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const record = await this.prisma.file.create({
      data: {
        orgId: dto.orgId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        path: '',
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        uploadedBy,
        extension: extname(file.originalname).toLowerCase(),
        fileKind: file.mimetype.startsWith('image/') ? 'image' : 'document',
        sha256,
      },
    });
    return this.prisma.file.update({
      where: { id: record.id },
      data: { path: `/phase11/files/${record.id}` },
    });
  }

  async deleteManagedFile(fileId: string, orgId: string, entityType: string) {
    const deleted = await this.prisma.file.deleteMany({
      where: { id: fileId, orgId, entityType, lockedByArchiveId: null },
    });
    return {
      message: deleted.count
        ? 'File deleted successfully'
        : 'File already deleted',
    };
  }

  async getManagedDownloadPayload(
    fileId: string,
    orgId: string,
    entityType: string,
    entityId: string,
  ) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, orgId, entityType, entityId },
    });
    if (!file) throw new NotFoundException('File not found');
    const buffer = Buffer.from(`phase11-answerbook:${file.sha256}`);
    return {
      buffer,
      filename: file.filename,
      mimeType: file.mimeType,
      size: buffer.length,
    };
  }
}
