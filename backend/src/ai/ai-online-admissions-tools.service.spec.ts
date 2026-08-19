import { OnlineAdmissionSubmissionStatus, Role } from '@/prisma/prisma-client';
import { AIOnlineAdmissionsToolsService } from './ai-online-admissions-tools.service';

function setup() {
  const tools = new Map<string, (input: unknown, context: any) => Promise<any>>();
  const registry = {
    register: jest.fn((tool: { name: string; run: (input: unknown, context: any) => Promise<any> }) => tools.set(tool.name, tool.run)),
  };
  const admissions = {
    listPublicOfferings: jest.fn().mockResolvedValue([{
      id: 'offering-1',
      provider: { displayName: 'Open Provider', slug: 'open-provider' },
      program: { code: 'CERT-AI', name: 'AI Certificate', programType: 'CERTIFICATE', subjectArea: 'AI' },
      deliveryMode: 'ONLINE',
      attendanceMode: 'SELF_PACED',
      intakeName: 'September 2026',
      applicationClosesAt: new Date('2026-09-01T00:00:00Z'),
      locations: [],
      organization: null,
      fees: [{ label: 'Tuition', amount: '100', currencyCode: 'USD', frequency: null }],
      admissionRequirements: [{ label: 'Open admission', isRequired: true }],
      fundingOptions: [{ title: 'Installments', amountSummary: 'Monthly' }],
      applicationForm: { documentRequirements: [{ label: 'ID', isRequired: true }] },
    }]),
    listAdminSubmissions: jest.fn().mockResolvedValue({
      data: [{
        id: 'submission-1',
        publicReference: 'OA-20260819-TEST',
        applicantName: 'Ada Applicant',
        applicantEmail: 'ada@example.test',
        status: OnlineAdmissionSubmissionStatus.SUBMITTED,
        submittedAt: new Date('2026-08-19T08:00:00Z'),
        department: { name: 'Computing' },
        program: { code: 'BSCS', name: 'Computer Science' },
        academicCycle: { code: 'F26', name: 'Fall 2026' },
        requiredDocumentCount: 2,
        uploadedRequiredDocumentCount: 1,
      }],
      totalRecords: 1,
      totalPages: 1,
      currentPage: 1,
      statusCounts: { SUBMITTED: 1 },
    }),
  };
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ departmentScopeType: 'ALL', subAdminDepartments: [] }) },
    teacher: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn().mockResolvedValue({ onlineAdmissionsEnabled: true, status: 'APPROVED', slug: 'test-school' }) },
    programOffering: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new AIOnlineAdmissionsToolsService(prisma as any, admissions as any, registry as any);
  service.onModuleInit();
  return { tools, admissions, prisma };
}

describe('AIOnlineAdmissionsToolsService', () => {
  it('registers online admission context tools', () => {
    const { tools } = setup();
    expect(Array.from(tools.keys())).toEqual([
      'getOnlineAdmissionsContext',
      'getOnlineAdmissionOfferingReadiness',
      'getPublicAdmissionsCatalogContext',
    ]);
  });

  it('returns department-scoped application context for a sub admin', async () => {
    const { tools, admissions } = setup();
    const result = await tools.get('getOnlineAdmissionsContext')!(
      { status: 'submitted', missingRequiredDocuments: true },
      { userId: 'sub-1', orgId: 'org-1', role: Role.SUB_ADMIN },
    );

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        scope: 'department-scoped',
        totalRecords: 1,
        submissions: [expect.objectContaining({
          reference: 'OA-20260819-TEST',
          missingRequiredDocuments: true,
          href: '/online-admissions/submission-1',
        })],
      }),
    }));
    expect(admissions.listAdminSubmissions).toHaveBeenCalledWith(
      'org-1',
      { id: 'sub-1', role: Role.SUB_ADMIN },
      expect.objectContaining({ status: OnlineAdmissionSubmissionStatus.SUBMITTED, missingRequiredDocuments: true }),
    );
  });

  it('denies admissions context to roles without admissions access', async () => {
    const { tools, admissions } = setup();
    const result = await tools.get('getOnlineAdmissionsContext')!(
      {},
      { userId: 'student-1', orgId: 'org-1', role: Role.STUDENT },
    );

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'PERMISSION_DENIED' }));
    expect(admissions.listAdminSubmissions).not.toHaveBeenCalled();
  });

  it('returns offering readiness and public admissions state', async () => {
    const { tools, prisma } = setup();
    prisma.programOffering.findMany.mockResolvedValue([{
      id: 'offering-1',
      status: 'OPEN',
      onlineAdmissionEnabled: true,
      opensAt: null,
      closesAt: null,
      capacity: 40,
      program: { id: 'program-1', code: 'BSCS', name: 'Computer Science', status: 'ACTIVE', campusConfiguration: { department: { id: 'dept-1', name: 'Computing' } } },
      campusBinding: {
        curriculumVersion: { id: 'curriculum-1', code: '2026', name: '2026 Curriculum', status: 'ACTIVE', isDefaultForAdmissions: true },
        academicCycle: { id: 'cycle-1', code: 'F26', name: 'Fall 2026', status: 'ACTIVE', startDate: new Date(), endDate: new Date() },
      },
      applicationConfig: { applicationVersion: {
        id: 'version-1', version: 1, status: 'PUBLISHED',
        documentRequirements: [{ label: 'Transcript', isRequired: true, acceptedMimeTypes: ['application/pdf'], maxFileSizeBytes: 1024 }],
      } },
      _count: { onlineAdmissionSubmissions: 3 },
      fees: [{ label: 'No fee' }],
      fundingOptions: [],
      admissionRequirements: [{ label: 'Open admission' }],
    }]);

    const result = await tools.get('getOnlineAdmissionOfferingReadiness')!(
      {},
      { userId: 'admin-1', orgId: 'org-1', role: Role.ORG_ADMIN },
    );

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        organization: expect.objectContaining({ publicAdmissionsEnabled: true, publicAdmissionsHref: '/admissions/providers/test-school' }),
        offerings: [expect.objectContaining({
          submissions: 3,
          applicationWindowOpen: true,
          applicationForm: expect.objectContaining({ version: 1, status: 'PUBLISHED' }),
          documentRequirements: [expect.objectContaining({ label: 'Transcript', required: true })],
        })],
      }),
    }));
  });

  it('returns provider-neutral public catalog context', async () => {
    const { tools, admissions } = setup();
    const result = await tools.get('getPublicAdmissionsCatalogContext')!(
      { search: 'ai', onlineOnly: true, maxFee: 200 },
      { userId: 'guest', role: null },
    );

    expect(result).toEqual(expect.objectContaining({
      ok: true,
      data: expect.objectContaining({
        totalRecords: 1,
        offerings: [expect.objectContaining({
          provider: 'Open Provider',
          href: '/admissions/apply/offering-1',
          fees: [expect.objectContaining({ label: 'Tuition' })],
        })],
      }),
    }));
    expect(admissions.listPublicOfferings).toHaveBeenCalledWith(expect.objectContaining({ search: 'ai', onlineOnly: true, maxFee: 200 }));
  });
});
