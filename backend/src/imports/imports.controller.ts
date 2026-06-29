import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { ImportsService } from './imports.service';
import type { AttendanceImportTargetMode, ImportEntity, ImportPreviewRow, InvalidImportRow } from './imports.types';

@Access(AccessLevel.WRITE)
@Controller('org/imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Get(':entity/template')
  getTemplate(
    @Param('entity') entity: string,
    @Res() res: Response,
  ) {
    const csv = this.importsService.getTemplate(entity as ImportEntity);
    this.sendCsv(res, csv, `${entity}-template.csv`);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':entity/validate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  validateEntity(
    @OrgId() orgId: string,
    @Param('entity') entity: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.importsService.validateEntityCsv(
      orgId,
      entity as ImportEntity,
      this.fileToText(file),
      req.user,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':entity/confirm')
  confirmEntity(
    @OrgId() orgId: string,
    @Param('entity') entity: string,
    @Body('rows') rows: ImportPreviewRow[],
    @Request() req: AuthenticatedRequest,
  ) {
    return this.importsService.confirmEntityImport(orgId, entity as ImportEntity, rows, req.user);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':entity/error-report')
  errorReport(
    @Param('entity') entity: string,
    @Body('rows') rows: InvalidImportRow[],
    @Res() res: Response,
  ) {
    const csv = this.importsService.buildEntityErrorReport(entity as ImportEntity, rows || []);
    this.sendCsv(res, csv, `${entity}-import-errors.csv`);
  }

  @Roles(Role.ORG_MANAGER, Role.TEACHER)
  @Get('attendance/monthly/template')
  async getAttendanceTemplate(
    @OrgId() orgId: string,
    @Query('sectionId') sectionId: string,
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.importsService.getAttendanceMonthlyTemplate(
      orgId,
      { sectionId, year: Number(year), month: Number(month) },
      req.user,
    );
    this.sendCsv(res, csv, `attendance-${year}-${month}.csv`);
  }

  @Roles(Role.ORG_MANAGER, Role.TEACHER)
  @Post('attendance/monthly/validate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  validateAttendance(
    @OrgId() orgId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('sectionId') sectionId: string,
    @Body('year') year: string,
    @Body('month') month: string,
    @Body('targetMode') targetMode: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.importsService.validateAttendanceMonthlyCsv(
      orgId,
      this.fileToText(file),
      {
        sectionId,
        year: Number(year),
        month: Number(month),
        targetMode: (targetMode || 'FIRST_SCHEDULE') as AttendanceImportTargetMode,
      },
      req.user,
    );
  }

  @Roles(Role.ORG_MANAGER, Role.TEACHER)
  @Post('attendance/monthly/confirm')
  confirmAttendance(
    @OrgId() orgId: string,
    @Body('sectionId') sectionId: string,
    @Body('year') year: number,
    @Body('month') month: number,
    @Body('targetMode') targetMode: string,
    @Body('rows') rows: ImportPreviewRow[],
    @Request() req: AuthenticatedRequest,
  ) {
    return this.importsService.confirmAttendanceMonthlyImport(
      orgId,
      {
        sectionId,
        year: Number(year),
        month: Number(month),
        targetMode: (targetMode || 'FIRST_SCHEDULE') as AttendanceImportTargetMode,
      },
      rows as any,
      req.user,
    );
  }

  @Roles(Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER)
  @Post('attendance/monthly/error-report')
  attendanceErrorReport(
    @Body('rows') rows: InvalidImportRow[],
    @Body('year') year: number,
    @Body('month') month: number,
    @Res() res: Response,
  ) {
    const csv = this.importsService.buildAttendanceErrorReport(rows || [], Number(year), Number(month));
    this.sendCsv(res, csv, `attendance-import-errors-${year}-${month}.csv`);
  }

  private fileToText(file?: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }
    return file.buffer.toString('utf8');
  }

  private sendCsv(res: Response, csv: string, filename: string) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
