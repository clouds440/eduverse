import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma, RoomType } from '@/prisma/prisma-client';
import {
  AttendanceStatus,
  DepartmentScopeType,
  Role,
  StudentStatus,
  TeacherStatus,
  UserStatus,
} from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StudentService } from '../students/student.service';
import { TeacherService } from '../teacher/teacher.service';
import { GuardiansService } from '../guardians/guardians.service';
import { CoursesService } from '../courses/courses.service';
import { SectionsService } from '../sections/sections.service';
import { DepartmentsService } from '../departments/departments.service';
import { BuildingsService } from '../buildings/buildings.service';
import { RoomsService } from '../rooms/rooms.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateStudentDto } from '../org/dto/create-student.dto';
import { CreateTeacherDto } from '../org/dto/create-teacher.dto';
import { CreateGuardianDto } from '../guardians/dto/create-guardian.dto';
import { CreateCourseDto } from '../courses/dto/create-course.dto';
import { CreateSectionDto } from '../sections/dto/create-section.dto';
import { CreateDepartmentDto } from '../departments/dto/create-department.dto';
import { CreateBuildingDto } from '../buildings/dto/create-building.dto';
import { CreateRoomDto } from '../rooms/dto/create-room.dto';
import { buildErrorReportCsv, makeTemplateCsv, parseCsv, validateStrictHeaders } from './csv.utils';
import {
  optionalBoolean,
  optionalDate,
  optionalEnum,
  optionalInteger,
  optionalNumber,
  optionalString,
  splitIds,
} from './import-normalizers';
import { normalizeEntityCode } from '../common/entity-code';
import {
  AttendanceCellMark,
  AttendanceImportTargetMode,
  AttendanceMonthlyConfirmRow,
  AttendanceMonthlyValidateOptions,
  CsvRow,
  ImportConfirmResult,
  ImportEntity,
  ImportPreviewRow,
  ImportRowError,
  ImportValidationResult,
  InvalidImportRow,
} from './imports.types';

type AuthUser = {
  id: string;
  role?: string;
  name: string | null | undefined;
  email?: string;
  organizationId?: string | null;
};

type EntityConfig<T extends Record<string, unknown>> = {
  entity: ImportEntity;
  headers: string[];
  required: string[];
  examples: Record<string, unknown>[];
  dto: new () => object;
  normalize: (row: Record<string, string>, actor: AuthUser) => T;
  resolveRelations?: (orgId: string, data: T, actor: AuthUser) => Promise<void>;
  create: (orgId: string, data: T, actor: AuthUser) => Promise<unknown>;
  validateRelations?: (orgId: string, data: T, actor: AuthUser) => Promise<void>;
  duplicateKeys?: Array<{
    label: string;
    value: (data: T) => string | undefined;
    existing?: (orgId: string, value: string, data: T) => Promise<boolean>;
  }>;
  forbiddenForSubAdmin?: boolean;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly students: StudentService,
    private readonly teachers: TeacherService,
    private readonly guardians: GuardiansService,
    private readonly courses: CoursesService,
    private readonly sections: SectionsService,
    private readonly departments: DepartmentsService,
    private readonly buildings: BuildingsService,
    private readonly rooms: RoomsService,
    private readonly attendance: AttendanceService,
  ) {}

  getTemplate(entity: ImportEntity) {
    const config = this.getEntityConfig(entity);
    return makeTemplateCsv(config.headers, config.examples);
  }

  async validateEntityCsv(
    orgId: string,
    entity: ImportEntity,
    csvContent: string,
    actor: AuthUser,
  ) {
    this.assertEntityPermission(entity, actor);
    const config = this.getEntityConfig(entity);
    const parsed = parseCsv(csvContent);
    validateStrictHeaders(parsed.headers, config.headers);
    return this.validateEntityRows(orgId, config, parsed.rows, actor);
  }

  async confirmEntityImport(
    orgId: string,
    entity: ImportEntity,
    rows: ImportPreviewRow[],
    actor: AuthUser,
  ): Promise<ImportConfirmResult> {
    this.assertEntityPermission(entity, actor);
    const config = this.getEntityConfig(entity);
    const rawRows = this.previewRowsToCsvRows(rows);
    const validation = await this.validateEntityRows(orgId, config, rawRows, actor);
    const errors: InvalidImportRow[] = [...validation.invalidRows];
    let importedCount = 0;
    let failedCount = 0;

    for (const row of validation.validRows) {
      try {
        await config.create(orgId, row.data, actor);
        importedCount += 1;
      } catch (error) {
        failedCount += 1;
        errors.push({
          rowNumber: row.rowNumber,
          raw: row.raw,
          errors: [this.exceptionToRowError(error)],
        });
      }
    }

    return {
      entity,
      importedCount,
      skippedCount: validation.invalidRows.length,
      failedCount,
      duplicateCount: validation.summary.duplicate,
      errors,
    };
  }

  buildEntityErrorReport(entity: ImportEntity, rows: InvalidImportRow[]) {
    const config = this.getEntityConfig(entity);
    return buildErrorReportCsv(rows, config.headers);
  }

  async getAttendanceMonthlyTemplate(
    orgId: string,
    options: Pick<AttendanceMonthlyValidateOptions, 'sectionId' | 'year' | 'month'>,
    actor: AuthUser,
  ) {
    this.assertAttendancePermission(actor);
    const days = this.daysInMonth(options.year, options.month);
    const section = await this.attendance.getSection(orgId, options.sectionId, actor);
    const students = section.students || [];
    const headers = ['name', 'rollNumber', ...days.map(String)];
    const examples = students.slice(0, 3).map((student) => ({
      name: student.user?.name || '',
      rollNumber: student.rollNumber || '',
      ...Object.fromEntries(days.map((day) => [String(day), day % 5 === 0 ? 'A' : 'P'])),
    }));

    return makeTemplateCsv(headers, examples.length ? examples : [{
      name: 'Ali Raza',
      rollNumber: 'R-001',
      ...Object.fromEntries(days.map((day) => [String(day), day % 7 === 0 ? '' : 'P'])),
    }]);
  }

  async validateAttendanceMonthlyCsv(
    orgId: string,
    csvContent: string,
    options: AttendanceMonthlyValidateOptions,
    actor: AuthUser,
  ) {
    this.assertAttendancePermission(actor);
    this.normalizeAttendanceOptions(options);
    const days = this.daysInMonth(options.year, options.month);
    const headers = ['name', 'rollNumber', ...days.map(String)];
    const parsed = parseCsv(csvContent);
    validateStrictHeaders(parsed.headers, headers);

    const section = await this.attendance.getSection(orgId, options.sectionId, actor);
    const students = section.students || [];
    const studentMap = new Map<string, { id: string; name: string; rollNumber: string }>();
    const ambiguousKeys = new Set<string>();

    students.forEach((student) => {
      const name = (student.user?.name || '').trim();
      const rollNumber = (student.rollNumber || '').trim();
      const key = this.studentAttendanceKey(name, rollNumber);
      if (studentMap.has(key)) ambiguousKeys.add(key);
      studentMap.set(key, { id: student.id, name, rollNumber });
    });

    const seenKeys = new Set<string>();
    const invalidRows: InvalidImportRow[] = [];
    const validRows: ImportPreviewRow<AttendanceMonthlyConfirmRow>[] = [];
    let duplicateCount = 0;
    let skippedBlankCells = 0;

    for (const csvRow of parsed.rows) {
      const errors: ImportRowError[] = [];
      const name = (csvRow.values.name || '').trim();
      const rollNumber = (csvRow.values.rollNumber || '').trim();
      const key = this.studentAttendanceKey(name, rollNumber);

      if (!name) errors.push({ rowNumber: csvRow.rowNumber, field: 'name', message: 'Student name is required' });
      if (!rollNumber) errors.push({ rowNumber: csvRow.rowNumber, field: 'rollNumber', message: 'Roll number is required' });
      if (seenKeys.has(key)) {
        duplicateCount += 1;
        errors.push({ rowNumber: csvRow.rowNumber, field: 'rollNumber', message: 'Duplicate student row in this CSV' });
      }
      if (ambiguousKeys.has(key)) {
        errors.push({ rowNumber: csvRow.rowNumber, field: 'name', message: 'Student match is ambiguous in this section' });
      }

      const student = studentMap.get(key);
      if (!student) {
        errors.push({ rowNumber: csvRow.rowNumber, field: 'name', message: 'No enrolled student matches this name and roll number' });
      }

      const marks: AttendanceCellMark[] = [];
      days.forEach((day) => {
        const field = String(day);
        const rawValue = (csvRow.values[field] || '').trim();
        if (!rawValue) {
          skippedBlankCells += 1;
          return;
        }
        const status = this.attendanceLetterToStatus(rawValue);
        if (!status) {
          errors.push({
            rowNumber: csvRow.rowNumber,
            field,
            message: 'Use P, A, L, E, or leave blank',
          });
          return;
        }
        marks.push({ day, value: rawValue.toUpperCase(), status });
      });

      seenKeys.add(key);

      if (errors.length || !student) {
        invalidRows.push({ rowNumber: csvRow.rowNumber, raw: csvRow.values, errors });
        continue;
      }

      validRows.push({
        rowNumber: csvRow.rowNumber,
        raw: csvRow.values,
        data: {
          rowNumber: csvRow.rowNumber,
          raw: csvRow.values,
          studentId: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          marks,
          skippedBlankCells: days.length - marks.length,
        },
      });
    }

    return {
      entity: 'attendance-monthly',
      headers,
      totalRows: parsed.rows.length,
      validRows,
      invalidRows,
      summary: {
        valid: validRows.length,
        invalid: invalidRows.length,
        duplicate: duplicateCount,
        skipped: skippedBlankCells,
      },
      options,
    };
  }

  async confirmAttendanceMonthlyImport(
    orgId: string,
    options: AttendanceMonthlyValidateOptions,
    rows: ImportPreviewRow<AttendanceMonthlyConfirmRow>[],
    actor: AuthUser,
  ): Promise<ImportConfirmResult> {
    this.assertAttendancePermission(actor);
    this.normalizeAttendanceOptions(options);
    const rawRows = this.previewRowsToCsvRows(rows);
    const csv = this.rowsToCsv(rawRows, ['name', 'rollNumber', ...this.daysInMonth(options.year, options.month).map(String)]);
    const validation = await this.validateAttendanceMonthlyCsv(orgId, csv, options, actor);
    const errors: InvalidImportRow[] = [...validation.invalidRows];
    let importedCells = 0;
    let failedRows = 0;

    for (const row of validation.validRows) {
      try {
        importedCells += await this.importAttendanceRow(orgId, options, row.data, actor);
      } catch (error) {
        failedRows += 1;
        errors.push({
          rowNumber: row.rowNumber,
          raw: row.raw,
          errors: [this.exceptionToRowError(error)],
        });
      }
    }

    return {
      entity: 'attendance-monthly',
      importedCount: importedCells,
      skippedCount: validation.summary.skipped + validation.invalidRows.length,
      failedCount: failedRows,
      duplicateCount: validation.summary.duplicate,
      errors,
    };
  }

  buildAttendanceErrorReport(rows: InvalidImportRow[], year: number, month: number) {
    const headers = ['name', 'rollNumber', ...this.daysInMonth(year, month).map(String)];
    return buildErrorReportCsv(rows, headers);
  }

  private async validateEntityRows<T extends Record<string, unknown>>(
    orgId: string,
    config: EntityConfig<T>,
    rows: CsvRow[],
    actor: AuthUser,
  ): Promise<ImportValidationResult<T>> {
    const validRows: ImportPreviewRow<T>[] = [];
    const invalidRows: InvalidImportRow[] = [];
    const duplicateTrackers = (config.duplicateKeys || []).map((key) => ({
      ...key,
      seen: new Set<string>(),
    }));
    let duplicateCount = 0;

    for (const row of rows) {
      const errors: ImportRowError[] = [];
      for (const field of config.required) {
        if (!row.values[field]?.trim()) {
          errors.push({ rowNumber: row.rowNumber, field, message: 'Required field is missing' });
        }
      }

      let data: T | null = null;
      if (errors.length === 0) {
        try {
          data = config.normalize(row.values, actor);
        } catch (error) {
          errors.push(this.exceptionToRowError(error, row.rowNumber));
        }
      }

      if (data) {
        if (config.resolveRelations) {
          try {
            await config.resolveRelations(orgId, data, actor);
          } catch (error) {
            errors.push(this.exceptionToRowError(error, row.rowNumber));
          }
        }

        const dtoErrors = this.validateDto(config.dto, data);
        errors.push(...dtoErrors.map((error) => ({ rowNumber: row.rowNumber, ...error })));

        for (const tracker of duplicateTrackers) {
          const value = tracker.value(data)?.trim();
          if (!value) continue;
          const normalizedValue = value.toLowerCase();
          if (tracker.seen.has(normalizedValue)) {
            duplicateCount += 1;
            errors.push({ rowNumber: row.rowNumber, message: `Duplicate ${tracker.label} in this CSV` });
          }
          tracker.seen.add(normalizedValue);
          if (tracker.existing && await tracker.existing(orgId, value, data)) {
            duplicateCount += 1;
            errors.push({ rowNumber: row.rowNumber, message: `${tracker.label} already exists` });
          }
        }

        if (config.validateRelations) {
          try {
            await config.validateRelations(orgId, data, actor);
          } catch (error) {
            errors.push(this.exceptionToRowError(error, row.rowNumber));
          }
        }
      }

      if (errors.length || !data) {
        invalidRows.push({ rowNumber: row.rowNumber, raw: row.values, errors });
      } else {
        validRows.push({ rowNumber: row.rowNumber, data, raw: row.values });
      }
    }

    return {
      entity: config.entity,
      headers: config.headers,
      totalRows: rows.length,
      validRows,
      invalidRows,
      summary: {
        valid: validRows.length,
        invalid: invalidRows.length,
        duplicate: duplicateCount,
        skipped: invalidRows.length,
      },
    };
  }

  private getEntityConfig(entity: ImportEntity): EntityConfig<Record<string, unknown>> {
    const configs: Record<ImportEntity, EntityConfig<Record<string, unknown>>> = {
      students: {
        entity: 'students',
        headers: ['name', 'email', 'password', 'registrationNumber', 'rollNumber', 'major', 'gender', 'phone', 'fatherName', 'age', 'address', 'admissionDate', 'graduationDate', 'emergencyContact', 'bloodGroup', 'status', 'primaryDepartmentCode', 'departmentCodes'],
        required: ['name', 'email', 'password', 'registrationNumber', 'rollNumber', 'major', 'gender'],
        dto: CreateStudentDto,
        examples: [{
          name: 'Ayesha Khan',
          email: 'ayesha.khan@student.example',
          password: 'Student123',
          registrationNumber: 'REG-001',
          rollNumber: 'R-001',
          major: 'Science',
          gender: 'Female',
          phone: '+923001112222',
          fatherName: 'Imran Khan',
          age: 14,
          address: 'Lahore',
          admissionDate: '2026-04-01',
          graduationDate: '',
          emergencyContact: '+923003334444',
          bloodGroup: 'O+',
          status: 'ACTIVE',
          primaryDepartmentCode: '',
          departmentCodes: '',
        }],
        normalize: (row) => ({
          name: optionalString(row.name),
          email: optionalString(row.email),
          password: optionalString(row.password),
          registrationNumber: optionalString(row.registrationNumber),
          rollNumber: optionalString(row.rollNumber),
          major: optionalString(row.major),
          gender: optionalString(row.gender),
          phone: optionalString(row.phone),
          fatherName: optionalString(row.fatherName),
          age: optionalInteger(row.age, 'age'),
          address: optionalString(row.address),
          admissionDate: optionalDate(row.admissionDate, 'admissionDate', 'Must be a valid ISO 8601 date string'),
          graduationDate: optionalDate(row.graduationDate, 'graduationDate', 'Must be a valid ISO 8601 date string'),
          emergencyContact: optionalString(row.emergencyContact),
          bloodGroup: optionalString(row.bloodGroup),
          status: optionalEnum(row.status, Object.values(StudentStatus)) || StudentStatus.ACTIVE,
          primaryDepartmentCode: this.normalizeCode(row.primaryDepartmentCode),
          departmentCodes: splitIds(row.departmentCodes),
        }),
        create: (orgId, data, actor) => this.students.createStudent(orgId, data as unknown as CreateStudentDto, {
          id: actor.id,
          role: actor.role,
          name: actor.name,
          email: actor.email || '',
        }),
        resolveRelations: async (orgId, data) => {
          data.primaryDepartmentId = await this.resolveDepartmentId(orgId, data.primaryDepartmentCode as string | undefined, 'primaryDepartmentCode');
          data.departmentIds = await this.resolveDepartmentIds(orgId, data.departmentCodes as string[] | undefined, 'departmentCodes');
          delete data.primaryDepartmentCode;
          delete data.departmentCodes;
        },
        validateRelations: async (orgId, data) => {
          await this.assertDepartmentsExist(orgId, [
            data.primaryDepartmentId as string | undefined,
            ...((data.departmentIds as string[] | undefined) || []),
          ]);
        },
        duplicateKeys: [
          { label: 'Email', value: (data) => data.email as string, existing: (orgId, value) => this.userExists(value) },
          { label: 'Registration number', value: (data) => data.registrationNumber as string, existing: (orgId, value) => this.studentRegistrationExists(orgId, value) },
          { label: 'Roll number', value: (data) => data.rollNumber as string, existing: (orgId, value) => this.studentRollExists(orgId, value) },
        ],
      },
      teachers: {
        entity: 'teachers',
        headers: ['name', 'email', 'password', 'phone', 'education', 'designation', 'subject', 'department', 'joiningDate', 'emergencyContact', 'bloodGroup', 'address', 'status', 'departmentCodes'],
        required: ['name', 'email', 'password', 'phone', 'education', 'designation', 'subject'],
        dto: CreateTeacherDto,
        examples: [{
          name: 'Sara Ahmed',
          email: 'sara.ahmed@teacher.example',
          password: 'Teacher123',
          phone: '+923005556666',
          education: 'MSc Mathematics',
          designation: 'Lecturer',
          subject: 'Mathematics',
          department: 'Science',
          joiningDate: '2026-04-01',
          emergencyContact: '+923007778888',
          bloodGroup: 'B+',
          address: 'Lahore',
          status: 'ACTIVE',
          departmentCodes: '',
        }],
        normalize: (row) => ({
          name: optionalString(row.name),
          email: optionalString(row.email),
          password: optionalString(row.password),
          phone: optionalString(row.phone),
          education: optionalString(row.education),
          designation: optionalString(row.designation),
          subject: optionalString(row.subject),
          department: optionalString(row.department),
          joiningDate: optionalDate(row.joiningDate),
          emergencyContact: optionalString(row.emergencyContact),
          bloodGroup: optionalString(row.bloodGroup),
          address: optionalString(row.address),
          status: optionalEnum(row.status, Object.values(TeacherStatus)) || TeacherStatus.ACTIVE,
          departmentCodes: splitIds(row.departmentCodes),
          isManager: false,
          departmentScopeType: DepartmentScopeType.ALL,
          scopeDepartmentIds: [],
          sectionIds: [],
        }),
        create: (orgId, data, actor) => this.teachers.createTeacher(orgId, data as unknown as CreateTeacherDto, {
          id: actor.id,
          role: actor.role || '',
        }),
        resolveRelations: async (orgId, data) => {
          data.departmentIds = await this.resolveDepartmentIds(orgId, data.departmentCodes as string[] | undefined, 'departmentCodes');
          delete data.departmentCodes;
        },
        validateRelations: async (orgId, data) => this.assertDepartmentsExist(orgId, data.departmentIds as string[] | undefined),
        duplicateKeys: [
          { label: 'Email', value: (data) => data.email as string, existing: (orgId, value) => this.userExists(value) },
        ],
      },
      guardians: {
        entity: 'guardians',
        headers: ['name', 'email', 'password', 'phone', 'status', 'address'],
        required: ['name', 'email', 'password'],
        dto: CreateGuardianDto,
        examples: [{
          name: 'Bilal Khan',
          email: 'bilal.khan@guardian.example',
          password: 'Guardian123',
          phone: '+923009990000',
          status: 'ACTIVE',
          address: 'Lahore',
        }],
        normalize: (row) => ({
          name: optionalString(row.name),
          email: optionalString(row.email),
          password: optionalString(row.password),
          phone: optionalString(row.phone),
          status: optionalEnum(row.status, Object.values(UserStatus)) || UserStatus.ACTIVE,
          address: optionalString(row.address),
        }),
        create: (orgId, data) => this.guardians.createGuardian(orgId, data as unknown as CreateGuardianDto),
        duplicateKeys: [
          { label: 'Email', value: (data) => data.email as string, existing: (orgId, value) => this.userExists(value) },
        ],
      },
      courses: {
        entity: 'courses',
        headers: ['name', 'code', 'description', 'creditHours', 'departmentCode'],
        required: ['name', 'code'],
        dto: CreateCourseDto,
        examples: [{ name: 'Physics', code: 'PHY-101', description: 'Core physics course', creditHours: 3, departmentCode: 'SCI' }],
        normalize: (row, actor) => ({
          name: optionalString(row.name),
          code: this.normalizeCode(row.code),
          description: optionalString(row.description),
          creditHours: optionalNumber(row.creditHours),
          departmentCode: this.normalizeCode(row.departmentCode),
          updatedBy: actor.name || actor.email || 'CSV Import',
        }),
        resolveRelations: async (orgId, data) => {
          data.departmentId = await this.resolveDepartmentId(orgId, data.departmentCode as string | undefined, 'departmentCode');
          delete data.departmentCode;
        },
        create: (orgId, data, actor) => this.courses.createCourse(orgId, data as unknown as CreateCourseDto, actor),
        validateRelations: async (orgId, data) => this.assertDepartmentsExist(orgId, [data.departmentId as string | undefined]),
        duplicateKeys: [
          { label: 'Course name', value: (data) => data.name as string, existing: (orgId, value) => this.courseNameExists(orgId, value) },
          { label: 'Course code', value: (data) => data.code as string | undefined, existing: (orgId, value) => this.courseCodeExists(orgId, value) },
        ],
      },
      sections: {
        entity: 'sections',
        headers: ['name', 'code', 'courseCode', 'academicCycleCode', 'room', 'defaultRoomCode', 'cohortCode', 'color'],
        required: ['name', 'code', 'courseCode', 'academicCycleCode'],
        dto: CreateSectionDto,
        examples: [{ name: 'Section A', code: 'GRADE-9-A', courseCode: 'PHY-101', academicCycleCode: '2026-SPRING', room: 'Room 101', defaultRoomCode: 'ROOM-101', cohortCode: 'GRADE-9', color: '#3B82F6' }],
        normalize: (row) => ({
          name: optionalString(row.name),
          code: this.normalizeCode(row.code),
          courseCode: this.normalizeCode(row.courseCode),
          academicCycleCode: this.normalizeCode(row.academicCycleCode),
          room: optionalString(row.room),
          defaultRoomCode: this.normalizeCode(row.defaultRoomCode),
          cohortCode: this.normalizeCode(row.cohortCode),
          color: optionalString(row.color),
        }),
        resolveRelations: async (orgId, data) => {
          data.courseId = await this.resolveCourseId(orgId, data.courseCode as string | undefined, 'courseCode');
          data.academicCycleId = await this.resolveAcademicCycleId(orgId, data.academicCycleCode as string | undefined, 'academicCycleCode');
          data.defaultRoomId = await this.resolveRoomId(orgId, data.defaultRoomCode as string | undefined, 'defaultRoomCode');
          data.cohortId = await this.resolveCohortId(orgId, data.cohortCode as string | undefined, 'cohortCode');
          delete data.courseCode;
          delete data.academicCycleCode;
          delete data.defaultRoomCode;
          delete data.cohortCode;
        },
        create: (orgId, data, actor) => this.sections.createSection(orgId, data as unknown as CreateSectionDto, actor),
        validateRelations: async (orgId, data) => this.assertSectionRelations(orgId, data),
        duplicateKeys: [
          { label: 'Section name', value: (data) => data.name as string, existing: (orgId, value) => this.sectionNameExists(orgId, value) },
          { label: 'Section code', value: (data) => data.code as string | undefined, existing: (orgId, value) => this.sectionCodeExists(orgId, value) },
        ],
      },
      departments: {
        entity: 'departments',
        headers: ['name', 'code', 'description', 'color', 'isActive'],
        required: ['name', 'code'],
        dto: CreateDepartmentDto,
        forbiddenForSubAdmin: true,
        examples: [{ name: 'Computer Science', code: 'CS', description: 'Computing department', color: '#3B82F6', isActive: true }],
        normalize: (row) => ({
          name: optionalString(row.name),
          code: this.normalizeCode(row.code),
          description: optionalString(row.description),
          color: optionalString(row.color),
          isActive: optionalBoolean(row.isActive),
        }),
        create: (orgId, data) => this.departments.createDepartment(orgId, data as unknown as CreateDepartmentDto),
        duplicateKeys: [
          { label: 'Department name', value: (data) => data.name as string, existing: (orgId, value) => this.departmentNameExists(orgId, value) },
          { label: 'Department code', value: (data) => data.code as string | undefined, existing: (orgId, value) => this.departmentCodeExists(orgId, value) },
        ],
      },
      buildings: {
        entity: 'buildings',
        headers: ['name', 'code', 'address', 'description', 'landmark', 'directionsNote', 'sortOrder', 'mapX', 'mapY', 'mapWidth', 'mapHeight', 'isActive', 'departmentCodes'],
        required: ['name', 'code'],
        dto: CreateBuildingDto,
        examples: [{ name: 'Main Campus', code: 'MAIN', address: 'Block A', description: 'Primary academic building', landmark: 'Near the front gate', directionsNote: 'Enter from Gate 1 and turn left after reception.', sortOrder: 1, mapX: '', mapY: '', mapWidth: '', mapHeight: '', isActive: true, departmentCodes: '' }],
        normalize: (row) => ({
          name: optionalString(row.name),
          code: this.normalizeCode(row.code),
          address: optionalString(row.address),
          description: optionalString(row.description),
          landmark: optionalString(row.landmark),
          directionsNote: optionalString(row.directionsNote),
          sortOrder: optionalInteger(row.sortOrder, 'sortOrder'),
          mapX: optionalNumber(row.mapX, 'mapX'),
          mapY: optionalNumber(row.mapY, 'mapY'),
          mapWidth: optionalNumber(row.mapWidth, 'mapWidth'),
          mapHeight: optionalNumber(row.mapHeight, 'mapHeight'),
          isActive: optionalBoolean(row.isActive),
          departmentCodes: splitIds(row.departmentCodes),
        }),
        create: (orgId, data) => this.buildings.createBuilding(orgId, data as unknown as CreateBuildingDto),
        resolveRelations: async (orgId, data) => {
          data.departmentIds = await this.resolveDepartmentIds(orgId, data.departmentCodes as string[] | undefined, 'departmentCodes');
          delete data.departmentCodes;
        },
        validateRelations: async (orgId, data) => this.assertDepartmentsExist(orgId, data.departmentIds as string[] | undefined),
        duplicateKeys: [
          { label: 'Building name', value: (data) => data.name as string, existing: (orgId, value) => this.buildingNameExists(orgId, value) },
          { label: 'Building code', value: (data) => data.code as string | undefined, existing: (orgId, value) => this.buildingCodeExists(orgId, value) },
        ],
      },
      rooms: {
        entity: 'rooms',
        headers: ['buildingCode', 'name', 'code', 'floor', 'type', 'capacity', 'description', 'landmark', 'directionsNote', 'sortOrder', 'mapX', 'mapY', 'mapWidth', 'mapHeight', 'isActive'],
        required: ['buildingCode', 'name', 'code', 'floor'],
        dto: CreateRoomDto,
        examples: [{ buildingCode: 'MAIN', name: 'Room 101', code: 'ROOM-101', floor: '1', type: 'CLASSROOM', capacity: 35, description: 'Standard classroom', landmark: 'Beside the notice board', directionsNote: 'Use the east staircase and turn right.', sortOrder: 1, mapX: '', mapY: '', mapWidth: '', mapHeight: '', isActive: true }],
        normalize: (row) => ({
          buildingCode: this.normalizeCode(row.buildingCode),
          name: optionalString(row.name),
          code: this.normalizeCode(row.code),
          floor: optionalString(row.floor),
          type: optionalEnum(row.type, Object.values(RoomType), 'type'),
          capacity: optionalInteger(row.capacity, 'capacity'),
          description: optionalString(row.description),
          landmark: optionalString(row.landmark),
          directionsNote: optionalString(row.directionsNote),
          sortOrder: optionalInteger(row.sortOrder, 'sortOrder'),
          mapX: optionalNumber(row.mapX, 'mapX'),
          mapY: optionalNumber(row.mapY, 'mapY'),
          mapWidth: optionalNumber(row.mapWidth, 'mapWidth'),
          mapHeight: optionalNumber(row.mapHeight, 'mapHeight'),
          isActive: optionalBoolean(row.isActive),
        }),
        resolveRelations: async (orgId, data) => {
          data.buildingId = await this.resolveBuildingId(orgId, data.buildingCode as string | undefined, 'buildingCode');
          delete data.buildingCode;
        },
        create: (orgId, data) => this.rooms.createRoom(orgId, data as unknown as CreateRoomDto),
        validateRelations: async (orgId, data) => this.assertBuildingExists(orgId, data.buildingId as string | undefined),
        duplicateKeys: [
          {
            label: 'Room name in building',
            value: (data) => `${data.buildingId}:${data.name}`,
            existing: (orgId, value) => {
              const [buildingId, ...nameParts] = value.split(':');
              return this.roomExists(orgId, buildingId, nameParts.join(':'));
            },
          },
          { label: 'Room code', value: (data) => data.code as string | undefined, existing: (orgId, value) => this.roomCodeExists(orgId, value) },
        ],
      },
    };

    const config = configs[entity];
    if (!config) throw new BadRequestException(`Unsupported import entity "${entity}"`);
    return config;
  }

  private assertEntityPermission(entity: ImportEntity, actor: AuthUser) {
    if (entity === 'departments') {
      if (actor.role !== Role.ORG_ADMIN) throw new ForbiddenException('Only organization admins can import departments');
      return;
    }
    if (actor.role !== Role.ORG_ADMIN && actor.role !== Role.SUB_ADMIN) {
      throw new ForbiddenException('You do not have permission to import this resource');
    }
  }

  private assertAttendancePermission(actor: AuthUser) {
    if (![Role.ORG_ADMIN, Role.ORG_MANAGER, Role.TEACHER].includes(actor.role as Role)) {
      throw new ForbiddenException('You do not have permission to import attendance');
    }
  }

  private validateDto(dto: new () => object, data: Record<string, unknown>): Array<{ field: string; message: string }> {
    const instance = plainToInstance(dto, data);
    const errors = validateSync(instance, {
      whitelist: true,
      forbidNonWhitelisted: false,
      skipMissingProperties: false,
    });
    return errors.flatMap((error) => Object.values(error.constraints || {}).map((message) => ({
      field: error.property,
      message: this.formatValidationMessage(error.property, message),
    })));
  }

  private formatValidationMessage(field: string, message: string) {
    const trimmed = message.trim();
    const lowerPrefix = `${field.toLowerCase()} `;
    const withoutField = trimmed.toLowerCase().startsWith(lowerPrefix)
      ? trimmed.slice(field.length + 1)
      : trimmed;
    return withoutField.charAt(0).toUpperCase() + withoutField.slice(1);
  }

  private previewRowsToCsvRows(rows: Array<{ rowNumber: number; raw: Record<string, unknown> }> = []): CsvRow[] {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('No validated rows were provided for import');
    }
    return rows.map((row) => ({
      rowNumber: row.rowNumber,
      values: Object.fromEntries(
        Object.entries(row.raw || {}).map(([key, value]) => [key, value === undefined || value === null ? '' : String(value)]),
      ),
    }));
  }

  private rowsToCsv(rows: CsvRow[], headers: string[]) {
    return makeTemplateCsv(headers, rows.map((row) => row.values));
  }

  private exceptionToRowError(error: unknown, rowNumber = 0): ImportRowError {
    if (error instanceof BadRequestException || error instanceof ConflictException || error instanceof ForbiddenException) {
      const response = error.getResponse();
      const field = typeof response === 'object' && response && 'field' in response
        ? String((response as { field?: string }).field || '')
        : undefined;
      const message = typeof response === 'object' && response && 'message' in response
        ? (response as { message: string | string[] }).message
        : error.message;
      return {
        rowNumber,
        field,
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }
    if (error instanceof Error) return { rowNumber, message: error.message };
    return { rowNumber, message: 'Unexpected import error' };
  }

  private async importAttendanceRow(
    orgId: string,
    options: AttendanceMonthlyValidateOptions,
    row: AttendanceMonthlyConfirmRow,
    actor: AuthUser,
  ) {
    let imported = 0;
    for (const mark of row.marks) {
      const sessions = await this.getOrCreateAttendanceSessionsForDay(orgId, options, mark.day);
      for (const session of sessions) {
        await this.attendance.markAttendance(orgId, session.id, actor, [{
          studentId: row.studentId,
          status: mark.status as AttendanceStatus,
        }]);
        imported += 1;
      }
    }
    return imported;
  }

  private async getOrCreateAttendanceSessionsForDay(
    orgId: string,
    options: AttendanceMonthlyValidateOptions,
    day: number,
  ) {
    const date = this.dateString(options.year, options.month, day);
    if (options.targetMode === 'ADHOC_ONLY') {
      return [await this.getOrCreateAdhocSession(options.sectionId, date)];
    }

    const weekday = new Date(options.year, options.month - 1, day).getDay();
    const schedules = await this.prisma.sectionSchedule.findMany({
      where: { sectionId: options.sectionId, day: weekday },
      orderBy: [{ startTime: 'asc' }],
    });

    if (schedules.length === 0) {
      return [await this.getOrCreateAdhocSession(options.sectionId, date)];
    }

    const selectedSchedules = options.targetMode === 'ALL_SCHEDULES_OR_ADHOC'
      ? schedules
      : [schedules[0]];

    const sessions: Array<{ id: string }> = [];
    for (const schedule of selectedSchedules) {
      const existing = await this.prisma.attendanceSession.findFirst({
        where: {
          sectionId: options.sectionId,
          scheduleId: schedule.id,
          date: new Date(date),
        },
      });
      if (existing) {
        sessions.push(existing);
        continue;
      }
      sessions.push(await this.prisma.attendanceSession.create({
        data: {
          sectionId: options.sectionId,
          scheduleId: schedule.id,
          academicCycleId: schedule.academicCycleId,
          date: new Date(date),
          isAdhoc: false,
        },
      }));
    }
    return sessions;
  }

  private async getOrCreateAdhocSession(sectionId: string, date: string) {
    const existing = await this.prisma.attendanceSession.findFirst({
      where: { sectionId, date: new Date(date), isAdhoc: true },
    });
    if (existing) return existing;
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { academicCycleId: true },
    });
    return this.prisma.attendanceSession.create({
      data: {
        sectionId,
        academicCycleId: section?.academicCycleId,
        date: new Date(date),
        isAdhoc: true,
      },
    });
  }

  private attendanceLetterToStatus(value: string): AttendanceCellMark['status'] | null {
    const normalized = value.trim().toUpperCase();
    if (normalized === 'P') return 'PRESENT';
    if (normalized === 'A') return 'ABSENT';
    if (normalized === 'L') return 'LATE';
    if (normalized === 'E') return 'EXCUSED';
    return null;
  }

  private normalizeAttendanceOptions(options: AttendanceMonthlyValidateOptions) {
    if (!options.sectionId) throw new BadRequestException('sectionId is required');
    if (!Number.isInteger(options.year) || options.year < 2000 || options.year > 2100) {
      throw new BadRequestException('year must be valid');
    }
    if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) {
      throw new BadRequestException('month must be between 1 and 12');
    }
    if (!['FIRST_SCHEDULE_OR_ADHOC', 'ALL_SCHEDULES_OR_ADHOC', 'ADHOC_ONLY'].includes(options.targetMode)) {
      throw new BadRequestException('Invalid attendance target mode');
    }
  }

  private daysInMonth(year: number, month: number) {
    const days = new Date(year, month, 0).getDate();
    return Array.from({ length: days }, (_, index) => index + 1);
  }

  private dateString(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private studentAttendanceKey(name: string, rollNumber: string) {
    return `${name.trim().toLowerCase()}::${rollNumber.trim().toLowerCase()}`;
  }

  private normalizeCode(value?: string | null) {
    return normalizeEntityCode(value) || undefined;
  }

  private async resolveDepartmentId(orgId: string, codeOrId?: string, field = 'departmentCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const department = await this.prisma.department.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!department) throw new BadRequestException({ field, message: `Department code "${value}" was not found` });
    return department.id;
  }

  private async resolveDepartmentIds(orgId: string, codes?: string[], field = 'departmentCodes') {
    const values = Array.from(new Set((codes || []).map((code) => this.normalizeCode(code)).filter(Boolean))) as string[];
    const ids: string[] = [];
    for (const value of values) {
      ids.push((await this.resolveDepartmentId(orgId, value, field))!);
    }
    return ids;
  }

  private async resolveBuildingId(orgId: string, codeOrId?: string, field = 'buildingCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const building = await this.prisma.building.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!building) throw new BadRequestException({ field, message: `Building code "${value}" was not found` });
    return building.id;
  }

  private async resolveRoomId(orgId: string, codeOrId?: string, field = 'roomCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const room = await this.prisma.room.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!room) throw new BadRequestException({ field, message: `Room code "${value}" was not found` });
    return room.id;
  }

  private async resolveCourseId(orgId: string, codeOrId?: string, field = 'courseCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const course = await this.prisma.course.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!course) throw new BadRequestException({ field, message: `Course code "${value}" was not found` });
    return course.id;
  }

  private async resolveAcademicCycleId(orgId: string, codeOrId?: string, field = 'academicCycleCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const cycle = await this.prisma.academicCycle.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!cycle) throw new BadRequestException({ field, message: `Academic cycle code "${value}" was not found` });
    return cycle.id;
  }

  private async resolveCohortId(orgId: string, codeOrId?: string, field = 'cohortCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const cohort = await this.prisma.cohort.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!cohort) throw new BadRequestException({ field, message: `Cohort code "${value}" was not found` });
    return cohort.id;
  }

  private async resolveSectionId(orgId: string, codeOrId?: string, field = 'sectionCode') {
    const value = this.normalizeCode(codeOrId);
    if (!value) return undefined;
    const section = await this.prisma.section.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { code: { equals: value, mode: Prisma.QueryMode.insensitive } },
          { id: codeOrId?.trim() },
        ],
      },
      select: { id: true },
    });
    if (!section) throw new BadRequestException({ field, message: `Section code "${value}" was not found` });
    return section.id;
  }

  private async resolveSectionIds(orgId: string, codes?: string[], field = 'sectionCodes') {
    const values = Array.from(new Set((codes || []).map((code) => this.normalizeCode(code)).filter(Boolean))) as string[];
    const ids: string[] = [];
    for (const value of values) {
      ids.push((await this.resolveSectionId(orgId, value, field))!);
    }
    return ids;
  }
  private async userExists(email: string) {
    return Boolean(await this.prisma.user.findUnique({ where: { email }, select: { id: true } }));
  }

  private async studentRegistrationExists(orgId: string, registrationNumber: string) {
    return Boolean(await this.prisma.student.findFirst({ where: { organizationId: orgId, registrationNumber }, select: { id: true } }));
  }

  private async studentRollExists(orgId: string, rollNumber: string) {
    return Boolean(await this.prisma.student.findFirst({ where: { organizationId: orgId, rollNumber }, select: { id: true } }));
  }

  private async departmentNameExists(orgId: string, name: string) {
    return Boolean(await this.prisma.department.findFirst({
      where: { organizationId: orgId, name: { equals: name, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async departmentCodeExists(orgId: string, code: string) {
    return Boolean(await this.prisma.department.findFirst({
      where: { organizationId: orgId, code: { equals: code, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async buildingNameExists(orgId: string, name: string) {
    return Boolean(await this.prisma.building.findFirst({
      where: { organizationId: orgId, name: { equals: name, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async buildingCodeExists(orgId: string, code: string) {
    return Boolean(await this.prisma.building.findFirst({
      where: { organizationId: orgId, code: { equals: code, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async courseNameExists(orgId: string, name: string) {
    return Boolean(await this.prisma.course.findFirst({
      where: { organizationId: orgId, name: { equals: name, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async courseCodeExists(orgId: string, code: string) {
    return Boolean(await this.prisma.course.findFirst({
      where: { organizationId: orgId, code: { equals: code, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async sectionNameExists(orgId: string, name: string) {
    return Boolean(await this.prisma.section.findFirst({
      where: { organizationId: orgId, name: { equals: name, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async sectionCodeExists(orgId: string, code: string) {
    return Boolean(await this.prisma.section.findFirst({
      where: { organizationId: orgId, code: { equals: code, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async roomCodeExists(orgId: string, code: string) {
    return Boolean(await this.prisma.room.findFirst({
      where: { organizationId: orgId, code: { equals: code, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }
  private async roomExists(orgId: string, buildingId: string, name: string) {
    return Boolean(await this.prisma.room.findFirst({
      where: { organizationId: orgId, buildingId, name: { equals: name, mode: Prisma.QueryMode.insensitive } },
      select: { id: true },
    }));
  }

  private async assertDepartmentsExist(orgId: string, departmentIds?: Array<string | undefined>) {
    const ids = Array.from(new Set((departmentIds || []).filter(Boolean))) as string[];
    if (ids.length === 0) return;
    const count = await this.prisma.department.count({ where: { organizationId: orgId, id: { in: ids } } });
    if (count !== ids.length) throw new BadRequestException('One or more departments do not belong to this organization');
  }

  private async assertBuildingExists(orgId: string, buildingId?: string) {
    if (!buildingId) return;
    const exists = await this.prisma.building.findFirst({ where: { id: buildingId, organizationId: orgId }, select: { id: true } });
    if (!exists) throw new BadRequestException('Building does not belong to this organization');
  }

  private async assertSectionRelations(orgId: string, data: Record<string, unknown>) {
    await this.courses.validateCourseBelongsToOrg(data.courseId as string, orgId);
    const cycle = await this.prisma.academicCycle.findFirst({
      where: { id: data.academicCycleId as string, organizationId: orgId },
      select: { id: true },
    });
    if (!cycle) throw new BadRequestException('Academic cycle does not belong to this organization');
    if (data.cohortId) {
      const cohort = await this.prisma.cohort.findFirst({
        where: { id: data.cohortId as string, organizationId: orgId },
        select: { id: true },
      });
      if (!cohort) throw new BadRequestException('Cohort does not belong to this organization');
    }
    if (data.defaultRoomId) {
      const room = await this.prisma.room.findFirst({
        where: { id: data.defaultRoomId as string, organizationId: orgId },
        select: { id: true },
      });
      if (!room) throw new BadRequestException('Room does not belong to this organization');
    }
  }
}








