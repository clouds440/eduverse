import { buildErrorReportCsv, parseCsv, validateStrictHeaders } from './csv.utils';

describe('CSV import utilities', () => {
  it('parses quoted CSV values and row numbers', () => {
    const parsed = parseCsv('name,email\n"Ali, Jr",ali@example.test\nSara,sara@example.test\n');

    expect(parsed.headers).toEqual(['name', 'email']);
    expect(parsed.rows).toEqual([
      { rowNumber: 2, values: { name: 'Ali, Jr', email: 'ali@example.test' } },
      { rowNumber: 3, values: { name: 'Sara', email: 'sara@example.test' } },
    ]);
  });

  it('rejects template header mismatches', () => {
    expect(() => validateStrictHeaders(['name', 'mail'], ['name', 'email']))
      .toThrow(/Missing required header/);
  });

  it('generates error report CSV with row errors', () => {
    const csv = buildErrorReportCsv([
      {
        rowNumber: 2,
        raw: { name: '', email: 'bad' },
        errors: [
          { rowNumber: 2, field: 'name', message: 'Required field is missing' },
          { rowNumber: 2, field: 'email', message: 'Invalid email address' },
        ],
      },
    ], ['name', 'email']);

    expect(csv).toContain('rowNumber,name,email,errors');
    expect(csv).toContain('2,,bad,');
    expect(csv).toContain('name: Required field is missing');
  });
});
