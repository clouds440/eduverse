import { BadRequestException } from '@nestjs/common';
import { CsvRow, InvalidImportRow, ImportRowError } from './imports.types';

export function parseCsv(content: string): { headers: string[]; rows: CsvRow[] } {
  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\n' && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    throw new BadRequestException('CSV has an unterminated quoted value');
  }

  row.push(current);
  rows.push(row);

  const nonEmptyRows = rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
  if (nonEmptyRows.length === 0) {
    throw new BadRequestException('CSV file is empty');
  }

  const headers = nonEmptyRows[0].map((header) => header.trim());
  if (headers.some((header) => !header)) {
    throw new BadRequestException('CSV headers cannot be empty');
  }
  if (new Set(headers).size !== headers.length) {
    throw new BadRequestException('CSV headers must be unique');
  }

  const dataRows = nonEmptyRows.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      values[header] = (cells[headerIndex] ?? '').trim();
    });
    return {
      rowNumber: index + 2,
      values,
    };
  });

  return { headers, rows: dataRows };
}

export function validateStrictHeaders(actual: string[], expected: string[]) {
  const errors: string[] = [];
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((header) => !actualSet.has(header));
  const unknown = actual.filter((header) => !expectedSet.has(header));

  if (missing.length) errors.push(`Missing required header(s): ${missing.join(', ')}`);
  if (unknown.length) errors.push(`Unknown header(s): ${unknown.join(', ')}`);
  if (actual.length !== expected.length || missing.length || unknown.length) {
    throw new BadRequestException(errors.join('. ') || 'CSV headers do not match the template');
  }
}

export function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const lines = [headers.map(escapeCsvValue).join(',')];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','));
  });
  return `${lines.join('\n')}\n`;
}

export function buildErrorReportCsv(invalidRows: InvalidImportRow[], headers: string[]) {
  return toCsv(invalidRows.map((row) => row.raw), headers);
}

export function makeTemplateCsv(headers: string[], examples: Record<string, unknown>[]) {
  return toCsv(examples, headers);
}

export function formatRowError(error: ImportRowError) {
  return error.field ? `${error.field}: ${error.message}` : error.message;
}

function escapeCsvValue(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
