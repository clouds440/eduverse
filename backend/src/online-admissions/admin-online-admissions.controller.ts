import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { OnlineAdmissionsService } from './online-admissions.service';
import { CreateAdditionalDocumentRequestDto, MarkOnlineAdmissionAdmittedDto, UpdateOnlineAdmissionSubmissionStatusDto } from './dto/online-admission.dto';

@Access(AccessLevel.READ)
@Controller('org/online-admissions')
export class AdminOnlineAdmissionsController {
  constructor(private readonly admissions: OnlineAdmissionsService) {}

  @Get()
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  list(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('programId') programId?: string,
    @Query('programOfferingId') programOfferingId?: string,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('submittedFrom') submittedFrom?: string,
    @Query('submittedTo') submittedTo?: string,
    @Query('missingRequiredDocuments') missingRequiredDocuments?: string,
  ) {
    return this.admissions.listAdminSubmissions(orgId, req.user, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      sortBy,
      sortOrder,
      status,
      departmentId,
      programId,
      programOfferingId,
      academicCycleId,
      submittedFrom,
      submittedTo,
      missingRequiredDocuments: missingRequiredDocuments === 'true',
    });
  }

  @Get('export.csv')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  async exportCsv(
    @OrgId() orgId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('programId') programId?: string,
    @Query('programOfferingId') programOfferingId?: string,
    @Query('academicCycleId') academicCycleId?: string,
    @Query('submittedFrom') submittedFrom?: string,
    @Query('submittedTo') submittedTo?: string,
    @Query('missingRequiredDocuments') missingRequiredDocuments?: string,
  ) {
    const csv = await this.admissions.exportAdminSubmissions(orgId, req.user, {
      search,
      status,
      departmentId,
      programId,
      programOfferingId,
      academicCycleId,
      submittedFrom,
      submittedTo,
      missingRequiredDocuments: missingRequiredDocuments === 'true',
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="online-admissions.csv"');
    res.send(csv);
  }

  @Get(':id/documents/:fileId/download')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  async downloadDocument(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const payload = await this.admissions.getAdminDocumentDownload(orgId, id, fileId, req.user);
    const safeFilename = (payload.filename || 'download').replace(/["\r\n\\]/g, '_');
    res.setHeader('Content-Type', payload.mimeType);
    res.setHeader('Content-Length', String(payload.buffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(payload.filename)}`);
    res.send(payload.buffer);
  }

  @Get(':id')
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN, Role.ORG_MANAGER)
  get(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.admissions.getAdminSubmission(orgId, id, req.user);
  }

  @Patch(':id/status')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  updateStatus(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOnlineAdmissionSubmissionStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissions.updateStatus(orgId, id, req.user, dto.status, dto.note);
  }

  @Post(':id/document-requests')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  requestDocument(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateAdditionalDocumentRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissions.createAdditionalDocumentRequest(orgId, id, req.user, dto);
  }

  @Patch(':id/admit')
  @Access(AccessLevel.WRITE)
  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  markAdmitted(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: MarkOnlineAdmissionAdmittedDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.admissions.markAdmitted(orgId, id, req.user, dto.studentId, dto.note);
  }
}
