import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Access } from '../common/access-control/access.decorator';
import { AccessLevel } from '../common/access-control/access-level.enum';
import { OrgId } from '../common/decorators/org-id.decorator';
import { Role } from '../common/enums';
import { Roles } from '../auth/roles.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { ImportsService } from './imports.service';
import type {
  AttendanceImportTargetMode,
  ImportConfirmResult,
  ImportEntity,
  ImportPreviewRow,
  ImportProgressEvent,
  InvalidImportRow,
} from './imports.types';

const CSV_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

@Access(AccessLevel.WRITE)
@SkipThrottle()
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
  @Get(':entity/structure')
  async getStructure(
    @OrgId() orgId: string,
    @Param('entity') entity: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const csv = await this.importsService.getStructure(orgId, entity as ImportEntity, req.user);
    this.sendCsv(res, csv, `${entity}-structure.csv`);
  }

  @Roles(Role.ORG_ADMIN, Role.SUB_ADMIN)
  @Post(':entity/validate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_UPLOAD_LIMIT_BYTES } }))
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
  @Post(':entity/confirm/stream')
  async confirmEntityStream(
    @OrgId() orgId: string,
    @Param('entity') entity: string,
    @Body('rows') rows: ImportPreviewRow[],
    @Body('totalRows') totalRows: number,
    @Body('processedOffset') processedOffset: number,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.streamImportResponse(res, (send) =>
      this.importsService.confirmEntityImport(
        orgId,
        entity as ImportEntity,
        rows,
        req.user,
        send,
        {
          totalRows: Number(totalRows),
          processedOffset: Number(processedOffset),
        },
      ),
    );
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CSV_UPLOAD_LIMIT_BYTES } }))
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

  @Roles(Role.ORG_MANAGER, Role.TEACHER)
  @Post('attendance/monthly/confirm/stream')
  async confirmAttendanceStream(
    @OrgId() orgId: string,
    @Body('sectionId') sectionId: string,
    @Body('year') year: number,
    @Body('month') month: number,
    @Body('targetMode') targetMode: string,
    @Body('rows') rows: ImportPreviewRow[],
    @Body('totalRows') totalRows: number,
    @Body('processedOffset') processedOffset: number,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.streamImportResponse(res, (send) =>
      this.importsService.confirmAttendanceMonthlyImport(
        orgId,
        {
          sectionId,
          year: Number(year),
          month: Number(month),
          targetMode: (targetMode || 'FIRST_SCHEDULE') as AttendanceImportTargetMode,
        },
        rows as any,
        req.user,
        send,
        {
          totalRows: Number(totalRows),
          processedOffset: Number(processedOffset),
        },
      ),
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

  private async streamImportResponse(
    res: Response,
    runImport: (send: (event: ImportProgressEvent) => void) => Promise<ImportConfirmResult>,
  ) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const send = (event: ImportProgressEvent) => {
      res.write(`${JSON.stringify(event)}\n`);
    };

    try {
      const result = await runImport(send);
      send({ type: 'complete', result });
    } catch (error) {
      send({
        type: 'error',
        message: this.getImportStreamErrorMessage(error),
      });
    } finally {
      res.end();
    }
  }

  private getImportStreamErrorMessage(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object') {
        const message = (response as { message?: unknown }).message;
        if (Array.isArray(message)) return String(message[0] || 'Import failed');
        if (typeof message === 'string') return message;
      }
    }
    return error instanceof Error ? error.message : 'Import failed';
  }
}
