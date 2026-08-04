import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AcademicCycleStatus, GradeStatus } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { GradeEvidenceService } from './grade-evidence.service';

function gradeContext(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grade-1',
    studentId: 'student-1',
    status: GradeStatus.DRAFT,
    academicCycleId: 'cycle-1',
    student: { userId: 'student-user', guardianLinks: [{ guardian: { userId: 'guardian-user' } }] },
    assessment: {
      section: {
        course: { departmentId: 'department-1' },
        teachers: [{ userId: 'teacher-user' }],
        enrollments: [{ studentId: 'student-1' }],
      },
    },
    _count: { answerbookAttachments: 0 },
    ...overrides,
  };
}

function basePrisma(context = gradeContext()) {
  return {
    file: { findMany: jest.fn().mockResolvedValue([]) },
    grade: { findFirst: jest.fn().mockResolvedValue(context) },
    gradeAnswerbookAttachment: { findMany: jest.fn().mockResolvedValue([]) },
    academicCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE }) },
  };
}

describe('GradeEvidenceService', () => {
  it('normalizes optional answerbook references', () => {
    const service = new GradeEvidenceService({} as never, {} as never, {} as never);
    expect(service.normalizeReference('  BOOK-100  ')).toBe('BOOK-100');
    expect(service.normalizeReference('   ')).toBeNull();
    expect(service.normalizeReference(undefined)).toBeNull();
  });

  it('allows students to read only their own released evidence', async () => {
    const prisma = basePrisma(gradeContext({ status: GradeStatus.PUBLISHED }));
    const service = new GradeEvidenceService(prisma as never, { deleteManagedFile: jest.fn() } as never, {} as never);

    await expect(service.list('org-1', 'grade-1', { id: 'student-user', role: Role.STUDENT })).resolves.toEqual([]);
    await expect(service.list('org-1', 'grade-1', { id: 'another-student', role: Role.STUDENT })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a linked guardian to read released evidence but not draft evidence', async () => {
    const prisma = basePrisma(gradeContext({ status: GradeStatus.PUBLISHED }));
    const service = new GradeEvidenceService(prisma as never, { deleteManagedFile: jest.fn() } as never, {} as never);
    await expect(service.list('org-1', 'grade-1', { id: 'guardian-user', role: Role.GUARDIAN })).resolves.toEqual([]);

    prisma.grade.findFirst.mockResolvedValue(gradeContext({ status: GradeStatus.DRAFT }));
    await expect(service.list('org-1', 'grade-1', { id: 'guardian-user', role: Role.GUARDIAN })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies evidence management to an unassigned teacher', async () => {
    const prisma = basePrisma();
    const files = { deleteManagedFile: jest.fn(), saveManagedFile: jest.fn() };
    const service = new GradeEvidenceService(prisma as never, files as never, {} as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'other-teacher', role: Role.TEACHER }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(files.saveManagedFile).not.toHaveBeenCalled();
  });

  it('applies selected department scope to sub-admin evidence access', async () => {
    const prisma: any = basePrisma();
    prisma.user = {
      findFirst: jest.fn().mockResolvedValue({
        departmentScopeType: 'SELECTED',
        subAdminDepartments: [{ departmentId: 'another-department' }],
      }),
    };
    const service = new GradeEvidenceService(prisma as never, { deleteManagedFile: jest.fn() } as never, {} as never);

    await expect(service.list('org-1', 'grade-1', { id: 'sub-admin-1', role: Role.SUB_ADMIN }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires managers to be assigned before they manage evidence', async () => {
    const prisma: any = basePrisma();
    prisma.teacher = {
      findFirst: jest.fn().mockResolvedValue({ departmentScopeType: 'ALL', managerDepartments: [] }),
    };
    const files = { deleteManagedFile: jest.fn(), saveManagedFile: jest.fn() };
    const service = new GradeEvidenceService(prisma as never, files as never, {} as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'manager-1', role: Role.ORG_MANAGER }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(files.saveManagedFile).not.toHaveBeenCalled();
  });

  it('enforces the five-file cap before storage upload', async () => {
    const prisma = basePrisma(gradeContext({ _count: { answerbookAttachments: 5 } }));
    const files = { deleteManagedFile: jest.fn(), saveManagedFile: jest.fn() };
    const service = new GradeEvidenceService(prisma as never, files as never, {} as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'teacher-user', role: Role.TEACHER }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(files.saveManagedFile).not.toHaveBeenCalled();
  });

  it('cleans up the uploaded file when a concurrent upload fills the final slot', async () => {
    const first = gradeContext({ _count: { answerbookAttachments: 4 } });
    const second = gradeContext({ _count: { answerbookAttachments: 5 } });
    const prisma: any = basePrisma(first);
    prisma.grade.findFirst.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    prisma.$queryRaw = jest.fn();
    prisma.$transaction = jest.fn(async (operation: (tx: unknown) => unknown) => operation(prisma));
    const files = {
      saveManagedFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
      deleteManagedFile: jest.fn().mockResolvedValue({ message: 'deleted' }),
    };
    const service = new GradeEvidenceService(prisma as never, files as never, {} as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'teacher-user', role: Role.TEACHER }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(files.deleteManagedFile).toHaveBeenCalledWith('file-1', 'org-1', 'GRADE_ANSWERBOOK');
  });

  it('creates a typed attachment after rechecking access and lifecycle in the transaction', async () => {
    const context = gradeContext();
    const prisma: any = basePrisma(context);
    prisma.$queryRaw = jest.fn();
    prisma.$transaction = jest.fn(async (operation: (tx: unknown) => unknown) => operation(prisma));
    prisma.file.findFirst = jest.fn().mockResolvedValue({ id: 'file-1' });
    prisma.gradeAnswerbookAttachment.create = jest.fn().mockResolvedValue({
      id: 'attachment-1', gradeId: 'grade-1', uploadedById: 'teacher-user', createdAt: new Date('2026-08-04'),
      file: { id: 'file-1', filename: 'book.pdf', mimeType: 'application/pdf', size: 100, fileKind: 'document', extension: '.pdf', createdAt: new Date('2026-08-04') },
    });
    const files = {
      saveManagedFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
      deleteManagedFile: jest.fn(),
    };
    const activity = { record: jest.fn().mockResolvedValue({}) };
    const service = new GradeEvidenceService(prisma as never, files as never, activity as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'teacher-user', role: Role.TEACHER }))
      .resolves.toMatchObject({
        id: 'attachment-1',
        file: { path: '/org/grades/grade-1/answerbook-attachments/attachment-1/download' },
      });
    expect(prisma.grade.findFirst).toHaveBeenCalledTimes(2);
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'grade_answerbook_attachment_added' }));
  });

  it('blocks uploads once the cycle starts archiving', async () => {
    const prisma = basePrisma();
    prisma.academicCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ARCHIVING });
    const files = { deleteManagedFile: jest.fn(), saveManagedFile: jest.fn() };
    const service = new GradeEvidenceService(prisma as never, files as never, {} as never);

    await expect(service.upload('org-1', 'grade-1', {} as Express.Multer.File, { id: 'teacher-user', role: Role.TEACHER }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(files.saveManagedFile).not.toHaveBeenCalled();
  });

  it('denies attachment changes after finalization', async () => {
    const prisma: any = basePrisma(gradeContext({ status: GradeStatus.FINALIZED }));
    prisma.$queryRaw = jest.fn();
    prisma.$transaction = jest.fn(async (operation: (tx: unknown) => unknown) => operation(prisma));
    const service = new GradeEvidenceService(prisma as never, { deleteManagedFile: jest.fn() } as never, {} as never);

    await expect(service.remove('org-1', 'grade-1', 'attachment-1', { id: 'admin-1', role: Role.ORG_ADMIN }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('removes the logical attachment and reports deferred storage cleanup', async () => {
    const prisma: any = basePrisma();
    prisma.$queryRaw = jest.fn();
    prisma.$transaction = jest.fn(async (operation: (tx: unknown) => unknown) => operation(prisma));
    prisma.gradeAnswerbookAttachment.findFirst = jest.fn().mockResolvedValue({
      id: 'attachment-1', fileId: 'file-1', file: { lockedByArchiveId: null },
    });
    prisma.gradeAnswerbookAttachment.delete = jest.fn();
    const files = { deleteManagedFile: jest.fn().mockRejectedValue(new Error('storage unavailable')) };
    const activity = { record: jest.fn().mockResolvedValue({}) };
    const service = new GradeEvidenceService(prisma as never, files as never, activity as never);

    await expect(service.remove('org-1', 'grade-1', 'attachment-1', { id: 'teacher-user', role: Role.TEACHER }))
      .resolves.toEqual({ deleted: true, cleanupPending: true });
    expect(prisma.gradeAnswerbookAttachment.delete).toHaveBeenCalledWith({ where: { id: 'attachment-1' } });
  });
});
