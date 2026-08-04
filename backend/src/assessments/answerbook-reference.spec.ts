import { AcademicCycleStatus, GradeStatus } from '@/prisma/prisma-client';
import { Role } from '../common/enums';
import { AssessmentsService } from './assessments.service';

describe('AssessmentsService answerbook reference', () => {
  it('normalizes and persists the optional reference through ordinary grade saving', async () => {
    const prisma = {
      assessment: { findUnique: jest.fn().mockResolvedValue({ id: 'assessment-1', organizationId: 'org-1', sectionId: 'section-1', academicCycleId: 'cycle-1', totalMarks: 100 }) },
      academicCycle: { findFirst: jest.fn().mockResolvedValue({ id: 'cycle-1', status: AcademicCycleStatus.ACTIVE }) },
      grade: {
        findUnique: jest.fn().mockResolvedValue({ id: 'grade-1', status: GradeStatus.DRAFT, answerbookReferenceNumber: null }),
        upsert: jest.fn().mockResolvedValue({
          id: 'grade-1', status: GradeStatus.DRAFT, answerbookReferenceNumber: 'BOOK-22', answerbookAttachments: [],
        }),
      },
    };
    const evidence = {
      normalizeReference: jest.fn().mockReturnValue('BOOK-22'),
      recordReferenceChange: jest.fn(),
      publicAttachment: jest.fn(),
    };
    const service = new AssessmentsService(
      prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never, evidence as never,
    );

    await service.updateGrade(
      'org-1', 'assessment-1', 'student-1',
      { marksObtained: 88, status: GradeStatus.DRAFT, answerbookReferenceNumber: '  BOOK-22  ' },
      'admin-1', Role.ORG_ADMIN,
    );

    expect(prisma.grade.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ answerbookReferenceNumber: 'BOOK-22' }),
    }));
    expect(evidence.recordReferenceChange).toHaveBeenCalledWith('org-1', 'grade-1', 'admin-1', null, 'BOOK-22');
  });
});
