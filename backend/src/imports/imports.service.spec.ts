import { ImportsService } from './imports.service';

function createService(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    student: { findFirst: jest.fn().mockResolvedValue(null) },
    department: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    building: { findFirst: jest.fn().mockResolvedValue(null) },
    room: { findFirst: jest.fn().mockResolvedValue(null) },
    academicCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1' }) },
    cohort: { findFirst: jest.fn().mockResolvedValue(null) },
    sectionSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    attendanceSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    section: { findUnique: jest.fn().mockResolvedValue({ academicCycleId: 'cycle-1' }) },
    ...overrides.prisma,
  };

  const attendance = {
    getSection: jest.fn().mockResolvedValue({
      students: [
        { id: 'student-1', rollNumber: 'R-001', user: { name: 'Ali Raza' } },
        { id: 'student-2', rollNumber: 'R-002', user: { name: 'Sara Khan' } },
      ],
    }),
    markAttendance: jest.fn(),
    ...overrides.attendance,
  };

  const service = new ImportsService(
    prisma as any,
    { createStudent: jest.fn() } as any,
    { createTeacher: jest.fn() } as any,
    { createGuardian: jest.fn() } as any,
    { createCourse: jest.fn(), validateCourseBelongsToOrg: jest.fn().mockResolvedValue({ id: 'course-1' }) } as any,
    { createSection: jest.fn() } as any,
    { createDepartment: jest.fn() } as any,
    { createBuilding: jest.fn() } as any,
    { createRoom: jest.fn() } as any,
    { createCohort: jest.fn() } as any,
    attendance as any,
  );

  return { service, prisma, attendance };
}

const actor = {
  id: 'teacher-user-1',
  role: 'TEACHER',
  name: 'Teacher',
  email: 'teacher@example.test',
};

function monthlyAttendanceCsv(rows: string[][], year = 2026, month = 2) {
  const days = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => String(index + 1));
  return [
    ['name', 'rollNumber', ...days].join(','),
    ...rows.map((row) => [...row, ...Array(Math.max(0, days.length - (row.length - 2))).fill('')].join(',')),
  ].join('\n');
}

describe('ImportsService monthly attendance validation', () => {
  it('validates monthly attendance rows and skips blank cells', async () => {
    const { service } = createService();
    const csv = monthlyAttendanceCsv([
      ['Ali Raza', 'R-001', 'P', '', 'L'],
      ['Sara Khan', 'R-002', 'A', 'E', ''],
    ]);

    const result = await service.validateAttendanceMonthlyCsv('org-1', csv, {
      sectionId: 'section-1',
      year: 2026,
      month: 2,
      targetMode: 'FIRST_SCHEDULE',
    }, actor);

    expect(result.summary.valid).toBe(2);
    expect(result.summary.invalid).toBe(0);
    expect(result.summary.skipped).toBe(52);
    expect(result.validRows[0].data.marks).toEqual([
      { day: 1, value: 'P', status: 'PRESENT' },
      { day: 3, value: 'L', status: 'LATE' },
    ]);
  });

  it('reports unmatched students, duplicate rows, and invalid letters', async () => {
    const { service } = createService();
    const csv = monthlyAttendanceCsv([
      ['Ali Raza', 'R-001', 'P', 'X', 'L'],
      ['Ali Raza', 'R-001', 'A', '', 'E'],
      ['No One', 'R-999', 'P', '', ''],
    ]);

    const result = await service.validateAttendanceMonthlyCsv('org-1', csv, {
      sectionId: 'section-1',
      year: 2026,
      month: 2,
      targetMode: 'FIRST_SCHEDULE',
    }, actor);

    expect(result.summary.valid).toBe(0);
    expect(result.summary.invalid).toBe(3);
    expect(result.summary.duplicate).toBe(1);
    expect(result.invalidRows.flatMap((row) => row.errors.map((error) => error.message))).toEqual(
      expect.arrayContaining([
        'Use P, A, L, E, or leave blank',
        'Duplicate student row in this CSV',
        'No enrolled student matches this name and roll number',
      ]),
    );
  });
});

describe('ImportsService student validation', () => {
  it('validates mixed student rows without importing', async () => {
    const { service } = createService({
      prisma: {
        department: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      },
    });
    const csv = [
      'name,email,password,registrationNumber,rollNumber,major,gender,phone,fatherName,age,address,admissionDate,graduationDate,emergencyContact,bloodGroup,status,primaryDepartmentCode,departmentCodes',
      'Ali Raza,ali@student.test,Student123,REG-1,R-1,Science,Male,,,,,,,,ACTIVE,,',
      'No Email,,Student123,REG-2,R-2,Science,Male,,,,,,,,ACTIVE,,',
      'Bad Date,bad@student.test,Student123,REG-3,R-3,Science,Male,,,,,not-a-date,,,ACTIVE,,',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'students', csv, {
      id: 'admin-1',
      role: 'ORG_ADMIN',
      name: 'Admin',
      email: 'admin@example.test',
    });

    expect(result.summary.valid).toBe(1);
    expect(result.summary.invalid).toBe(2);
    expect(result.invalidRows.map((row) => row.rowNumber)).toEqual([3, 4]);
  });

  it('prefixes student CSV field names on typed validation errors', async () => {
    const { service } = createService();
    const headers = [
      'name', 'email', 'password', 'registrationNumber', 'rollNumber', 'major', 'gender',
      'phone', 'fatherName', 'age', 'address', 'admissionDate', 'graduationDate',
      'emergencyContact', 'bloodGroup', 'status', 'primaryDepartmentCode', 'departmentCodes',
    ];
    const rowWithBadAge = [
      'Bad Age', 'bad-age@student.test', 'Student123', 'REG-10', 'R-10', 'Science', 'Male',
      '', '', 'twelve', '', '', '', '', '', 'ACTIVE', '', '',
    ];
    const rowWithBadAdmissionDate = [
      'Bad Date', 'bad-date@student.test', 'Student123', 'REG-11', 'R-11', 'Science', 'Male',
      '', '', '', '', 'not-a-date', '', '', '', 'ACTIVE', '', '',
    ];
    const csv = [
      headers.join(','),
      rowWithBadAge.join(','),
      rowWithBadAdmissionDate.join(','),
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'students', csv, {
      id: 'admin-1',
      role: 'ORG_ADMIN',
      name: 'Admin',
      email: 'admin@example.test',
    });

    expect(result.summary.valid).toBe(0);
    expect(result.invalidRows.map((row) => row.errors.map((error) => `${error.field}: ${error.message}`))).toEqual([
      ['age: Must be a valid integer'],
      ['admissionDate: Must be a valid ISO 8601 date string'],
    ]);
  });
});

describe('ImportsService teacher validation', () => {
  it('accepts isManager in teacher CSV rows', async () => {
    const { service } = createService();
    const csv = [
      'name,email,password,phone,education,designation,subject,department,joiningDate,emergencyContact,bloodGroup,address,status,isManager,departmentCodes',
      'Manager Teacher,manager@teacher.test,Teacher123,+923001112233,MSc Computer Science,Program Manager,Computing,Computer Science,2026-04-01,,,,ACTIVE,true,',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'teachers', csv, {
      id: 'admin-1',
      role: 'ORG_ADMIN',
      name: 'Admin',
      email: 'admin@example.test',
    });

    expect(result.summary.valid).toBe(1);
    expect(result.summary.invalid).toBe(0);
    expect(result.validRows[0].data.isManager).toBe(true);
  });
});

describe('ImportsService building validation', () => {
  const admin = {
    id: 'admin-1',
    role: 'ORG_ADMIN',
    name: 'Admin',
    email: 'admin@example.test',
  };

  const buildingHeaders = [
    'name', 'code', 'address', 'description', 'landmark', 'directionsNote',
    'sortOrder', 'mapX', 'mapY', 'mapWidth', 'mapHeight', 'isActive', 'departmentCodes',
  ];

  it('imports rows with at least one valid department from a quoted comma-separated list', async () => {
    const departmentFindFirst = jest.fn(async ({ where }) => {
      const code = where.OR?.[0]?.code?.equals;
      if (code === 'CS') return { id: 'dept-cs' };
      if (code === 'IT') return { id: 'dept-it' };
      return null;
    });
    const { service } = createService({
      prisma: {
        department: { count: jest.fn().mockResolvedValue(2), findFirst: departmentFindFirst },
      },
    });
    const csv = [
      buildingHeaders.join(','),
      'Main Campus,MAIN,Block A,"Primary, academic building",Gate 1,Turn left,1,,,,,true,"CS,NOPE,IT"',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'buildings', csv, admin);

    expect(result.summary.valid).toBe(1);
    expect(result.summary.partial).toBe(1);
    expect(result.summary.invalid).toBe(0);
    expect(result.validRows[0].data.departmentIds).toEqual(['dept-cs', 'dept-it']);
    expect(result.validRows[0].data.description).toBe('Primary, academic building');
    expect(result.validRows[0].warnings).toEqual([
      { rowNumber: 2, field: 'departmentCodes', message: 'Ignored unknown department code "NOPE"' },
    ]);
  });

  it('rejects a multi-department row only when every provided department code is unknown', async () => {
    const { service } = createService({
      prisma: {
        department: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      },
    });
    const csv = [
      buildingHeaders.join(','),
      'Main Campus,MAIN,Block A,Primary academic building,Gate 1,Turn left,1,,,,,true,"NOPE,MISSING"',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'buildings', csv, admin);

    expect(result.summary.valid).toBe(0);
    expect(result.summary.invalid).toBe(1);
    expect(result.invalidRows[0].errors).toEqual([
      { rowNumber: 2, field: 'departmentCodes', message: 'None of these department codes were found: NOPE, MISSING' },
    ]);
  });
});

describe('ImportsService cohort validation', () => {
  const admin = {
    id: 'admin-1',
    role: 'ORG_ADMIN',
    name: 'Admin',
    email: 'admin@example.test',
  };

  it('resolves academicCycleCode and prepares plain empty cohorts', async () => {
    const { service } = createService({
      prisma: {
        academicCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-2026' }) },
      },
    });
    const csv = [
      'name,code,academicCycleCode',
      'Grade 9 Batch A,GRADE-9-A,2026-SPRING',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'cohorts', csv, admin);

    expect(result.summary.valid).toBe(1);
    expect(result.summary.invalid).toBe(0);
    expect(result.validRows[0].data).toEqual({
      name: 'Grade 9 Batch A',
      code: 'GRADE-9-A',
      academicCycleId: 'cycle-2026',
    });
    expect(result.validRows[0].raw).toEqual({
      name: 'Grade 9 Batch A',
      code: 'GRADE-9-A',
      academicCycleCode: '2026-SPRING',
    });
  });

  it('rejects unknown academic cycle codes and duplicate cohort codes', async () => {
    const { service } = createService({
      prisma: {
        academicCycle: { findFirst: jest.fn().mockResolvedValue(null) },
        cohort: {
          findFirst: jest.fn(async ({ where }) => (
            where.code?.equals === 'GRADE-10-A' ? { id: 'existing-cohort' } : null
          )),
        },
      },
    });
    const csv = [
      'name,code,academicCycleCode',
      'Grade 10 Batch A,GRADE-10-A,UNKNOWN',
    ].join('\n');

    const result = await service.validateEntityCsv('org-1', 'cohorts', csv, admin);

    expect(result.summary.valid).toBe(0);
    expect(result.summary.invalid).toBe(1);
    expect(result.invalidRows[0].errors.map((error) => `${error.field || 'row'}: ${error.message}`)).toEqual(
      expect.arrayContaining([
        'academicCycleCode: Academic cycle code "UNKNOWN" was not found',
        'row: Cohort code already exists',
      ]),
    );
  });
});
