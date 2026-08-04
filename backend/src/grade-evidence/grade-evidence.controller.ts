import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { DEFAULT_MAX_SIZE_BYTES } from '../files/file-upload-policy';
import { GradeEvidenceService } from './grade-evidence.service';

type RequestActor = { user: { id: string; role: string } };

@Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
@Access(AccessLevel.READ)
@Controller('org/grades')
export class GradeEvidenceController {
  constructor(private readonly evidence: GradeEvidenceService) {}

  @Get(':gradeId/answerbook-attachments')
  list(@OrgId() orgId: string, @Param('gradeId') gradeId: string, @Req() req: RequestActor) {
    return this.evidence.list(orgId, gradeId, req.user);
  }

  @Get(':gradeId/answerbook-attachments/:attachmentId/download')
  async download(
    @OrgId() orgId: string,
    @Param('gradeId') gradeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: RequestActor,
    @Res() res: Response,
  ) {
    const payload = await this.evidence.download(orgId, gradeId, attachmentId, req.user);
    const filename = (payload.filename || 'answerbook').replace(/["\r\n\\]/g, '_');
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Length', String(payload.buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(payload.filename)}`);
    res.send(payload.buffer);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Post(':gradeId/answerbook-attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: DEFAULT_MAX_SIZE_BYTES, files: 1 } }))
  upload(
    @OrgId() orgId: string,
    @Param('gradeId') gradeId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestActor,
  ) {
    if (!file) throw new BadRequestException('No answerbook file provided');
    return this.evidence.upload(orgId, gradeId, file, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Access(AccessLevel.WRITE)
  @Delete(':gradeId/answerbook-attachments/:attachmentId')
  remove(
    @OrgId() orgId: string,
    @Param('gradeId') gradeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: RequestActor,
  ) {
    return this.evidence.remove(orgId, gradeId, attachmentId, req.user);
  }
}
