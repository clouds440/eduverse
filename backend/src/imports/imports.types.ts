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
  | 'FIRST_SCHEDULE'
  | 'ALL_SCHEDULES';

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
  warnings?: ImportRowError[];
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
    partial: number;
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
