import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { PastRecordFiltersDto } from './dto/past-records.dto';
import { PastRecordsService } from './past-records.service';

type RequestActor = { user: { id: string; role: string } };

@Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER, Role.TEACHER, Role.STUDENT, Role.GUARDIAN)
@Access(AccessLevel.READ)
@Controller('org/past-records')
export class PastRecordsController {
  constructor(private readonly pastRecords: PastRecordsService) {}

  @Get('options')
  options(@OrgId() orgId: string, @Query() filters: PastRecordFiltersDto, @Req() req: RequestActor) {
    return this.pastRecords.options(orgId, filters, req.user);
  }

  @Get('cycles')
  cycles(@OrgId() orgId: string, @Query() filters: PastRecordFiltersDto, @Req() req: RequestActor) {
    return this.pastRecords.cycles(orgId, filters, req.user);
  }

  @Get('students')
  students(@OrgId() orgId: string, @Query() filters: PastRecordFiltersDto, @Req() req: RequestActor) {
    return this.pastRecords.students(orgId, filters, req.user);
  }

  @Get('students/:studentId')
  student(
    @OrgId() orgId: string,
    @Param('studentId') studentId: string,
    @Query() filters: PastRecordFiltersDto,
    @Req() req: RequestActor,
  ) {
    return this.pastRecords.studentHistory(orgId, studentId, filters, req.user);
  }

  @Get('sections')
  sections(@OrgId() orgId: string, @Query() filters: PastRecordFiltersDto, @Req() req: RequestActor) {
    return this.pastRecords.sections(orgId, filters, req.user);
  }

  @Get('sections/:archiveSectionId')
  section(@OrgId() orgId: string, @Param('archiveSectionId') archiveSectionId: string, @Req() req: RequestActor) {
    return this.pastRecords.section(orgId, archiveSectionId, req.user);
  }

  @Get('sections/:archiveSectionId/grades/:gradeId/answerbook-attachments/:attachmentId/download')
  async downloadAnswerbook(
    @OrgId() orgId: string,
    @Param('archiveSectionId') archiveSectionId: string,
    @Param('gradeId') gradeId: string,
    @Param('attachmentId') attachmentId: string,
    @Req() req: RequestActor,
    @Res() res: Response,
  ) {
    const payload = await this.pastRecords.downloadAnswerbook(orgId, archiveSectionId, gradeId, attachmentId, req.user);
    const filename = (payload.filename || 'answerbook').replace(/["\r\n\\]/g, '_');
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Length', String(payload.buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(payload.filename)}`);
    res.send(payload.buffer);
  }
}
