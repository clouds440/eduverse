export type ImportEntity =
  | 'students'
  | 'teachers'
  | 'guardians'
  | 'courses'
  | 'sections'
  | 'departments'
  | 'buildings'
  | 'rooms';

export type AttendanceImportTargetMode =
  | 'FIRST_SCHEDULE_OR_ADHOC'
  | 'ALL_SCHEDULES_OR_ADHOC'
  | 'ADHOC_ONLY';

export interface CsvRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ImportRowError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface ImportPreviewRow<T = Record<string, unknown>> {
  rowNumber: number;
  data: T;
  raw: Record<string, string>;
}

export interface InvalidImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  errors: ImportRowError[];
}

export interface ImportValidationResult<T = Record<string, unknown>> {
  entity: string;
  headers: string[];
  totalRows: number;
  validRows: ImportPreviewRow<T>[];
  invalidRows: InvalidImportRow[];
  summary: {
    valid: number;
    invalid: number;
    duplicate: number;
    skipped: number;
  };
}

export interface ImportConfirmResult {
  entity: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  duplicateCount: number;
  errors: InvalidImportRow[];
}

export interface AttendanceMonthlyValidateOptions {
  sectionId: string;
  year: number;
  month: number;
  targetMode: AttendanceImportTargetMode;
}

export interface AttendanceCellMark {
  day: number;
  value: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
}

export interface AttendanceMonthlyRow {
  studentId: string;
  name: string;
  rollNumber: string;
  marks: AttendanceCellMark[];
  skippedBlankCells: number;
}

export interface AttendanceMonthlyConfirmRow extends AttendanceMonthlyRow {
  rowNumber: number;
  raw: Record<string, string>;
}
