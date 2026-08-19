import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdmissionApplicationVersionStatus, OnlineAdmissionSubmissionStatus, ProgramOfferingAction, ProgramOfferingStatus, ProgramStatus, OrgStatus, AcademicCycleStatus } from '@/prisma/prisma-client';
import { OnlineAdmissionsService } from './online-admissions.service';

function createService(prismaOverrides: Record<string, unknown> = {}, filesOverrides: Record<string, unknown> = {}) {
  const prisma: any = {
    organization: { findMany: jest.fn(), findFirst: jest.fn() },
    programOffering: { findFirst: jest.fn(), findMany: jest.fn() },
    user: { findFirst: jest.fn() },
    onlineAdmissionDocumentUpload: { create: jest.fn(), findMany: jest.fn() },
    additionalDocumentRequest: { updateMany: jest.fn() },
    onlineAdmissionSubmission: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn(), update: jest.fn(), delete: jest.fn().mockResolvedValue({}) },
    onlineAdmissionStatusEvent: { create: jest.fn() },
    student: { findFirst: jest.fn() },
    studentProgramEnrollment: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn((callback: (tx: any) => unknown) => callback({
      onlineAdmissionSubmission: { create: jest.fn() },
      onlineAdmissionStatusEvent: { create: jest.fn() },
      admissionsDomainEvent: { create: jest.fn() },
    })),
    ...prismaOverrides,
  };
  const files: any = {
    saveFile: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue({}),
    saveProviderFile: jest.fn(),
    deleteProviderManagedFile: jest.fn().mockResolvedValue({}),
    getDownloadPayload: jest.fn(),
    ...filesOverrides,
  };
  const email: any = { send: jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: jest.fn().mockReturnValue('http://localhost:3000') };
  const emailTemplates: any = {
    buildOnlineAdmissionStatusEmail: jest.fn().mockReturnValue({ subject: 'Application update', text: 'Updated', html: '<p>Updated</p>' }),
  };
  const captcha: any = { verifyToken: jest.fn().mockResolvedValue(undefined) };
  const providers: any = { providerIdForOrganization: jest.fn().mockResolvedValue('provider-1') };
  return { service: new OnlineAdmissionsService(prisma, email, config, files, emailTemplates, captcha, providers), prisma, files, email, providers };
}

function adminSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'submission-1',
    publicReference: 'OA-20260817-ABC123',
    organizationId: 'org-1',
    providerId: 'provider-1',
    departmentId: 'dept-1',
    programId: 'program-1',
    programOfferingId: 'offering-1',
    academicCycleId: 'cycle-1',
    applicantEmail: 'ada@example.com',
    applicantName: 'Ada Lovelace',
    applicantPhone: null,
    status: OnlineAdmissionSubmissionStatus.ACCEPTED,
    formData: {},
    formDefinitionSnapshot: { sections: [] },
    documentRequirementsSnapshot: [],
    submittedAt: new Date('2026-08-17T10:00:00Z'),
    updatedAt: new Date('2026-08-17T10:00:00Z'),
    organization: { id: 'org-1', name: 'North Campus', slug: 'north-campus', logoUrl: null },
    department: { id: 'dept-1', name: 'Computer Science' },
    program: { id: 'program-1', name: 'Computer Science', code: 'CS' },
    academicCycle: { id: 'cycle-1', code: '2026', name: '2026' },
    programOffering: {
      id: 'offering-1',
      campusBinding: {
        curriculumVersionId: 'curriculum-1',
        academicCycleId: 'cycle-1',
        academicCycle: { id: 'cycle-1', code: '2026', name: '2026' },
      },
    },
    applicationVersion: { id: 'version-1', documentRequirements: [{
      id: 'requirement-1', key: 'transcript', label: 'Transcript', isRequired: true,
      acceptedMimeTypes: ['application/pdf'], acceptedExtensions: ['.pdf'], maxFileSizeBytes: 1024,
      maxFileCount: 1, requiresExpiryDate: false,
    }] },
    additionalDocumentRequests: [],
    documentUploads: [],
    statusEvents: [],
    reviewedBy: null,
    admittedStudent: null,
    ...overrides,
  };
}

function publicOffering(requirementOverrides: Record<string, unknown> = {}) {
  return {
    id: 'offering-1',
    providerId: 'provider-1',
    programId: 'program-1',
    status: ProgramOfferingStatus.OPEN,
    onlineAdmissionEnabled: true,
    supportedActions: [ProgramOfferingAction.APPLY],
    provider: {
      id: 'provider-1',
      displayName: 'North Campus',
      slug: 'north-campus',
      kind: 'INSTITUTION',
      defaultCurrency: 'USD',
      contactEmail: 'admissions@example.com',
    },
    program: {
      id: 'program-1',
      name: 'Computer Science',
      code: 'CS',
      status: ProgramStatus.ACTIVE,
      campusConfiguration: { departmentId: 'dept-1', department: { id: 'dept-1', isActive: true } },
    },
    campusBinding: {
      organizationId: 'org-1',
      academicCycleId: 'cycle-1',
      curriculumVersionId: 'curriculum-1',
      organization: {
        id: 'org-1',
        name: 'North Campus',
        slug: 'north-campus',
        location: 'City',
        logoUrl: null,
        onlineAdmissionsEnabled: true,
        onlineAdmissionEmailTemplates: null,
        status: OrgStatus.APPROVED,
      },
      academicCycle: { id: 'cycle-1', status: AcademicCycleStatus.ACTIVE },
      curriculumVersion: { id: 'curriculum-1' },
    },
    applicationConfig: {
      allowApplicantUpdates: true,
      applicationVersion: {
        id: 'version-1', version: 1, schemaVersion: 1, status: AdmissionApplicationVersionStatus.PUBLISHED,
        definition: { sections: [{ key: 'applicant', title: 'Applicant', fields: [
          { key: 'fullName', type: 'SHORT_TEXT', label: 'Full name', required: true, canonicalTarget: 'applicant.name' },
          { key: 'email', type: 'EMAIL', label: 'Email', required: true, canonicalTarget: 'applicant.email' },
        ] }] },
        uiSchema: null, consentText: null, consentVersion: null,
        documentRequirements: [{
          id: 'requirement-1', key: 'transcript', label: 'Transcript', description: null, category: null,
          isRequired: true, sortOrder: 0, acceptedMimeTypes: ['application/pdf'], acceptedExtensions: ['.pdf'],
          maxFileSizeBytes: 1024, maxFileCount: 1, requiresExpiryDate: false,
          ...requirementOverrides,
        }],
      },
    },
  };
}

describe('OnlineAdmissionsService public submissions', () => {
  it('keeps the public organization discovery payload stable and applicant-safe', async () => {
    const { service, prisma } = createService();
    prisma.organization.findMany.mockResolvedValue([{
      id: 'org-1',
      name: 'North Campus',
      slug: 'north-campus',
      location: 'City',
      logoUrl: null,
      campusProgramOfferingBindings: [{ programOffering: { program: { id: 'program-1', code: 'CS', name: 'Computer Science' } } }],
    }]);

    const result = await service.listPublicOrganizations();

    expect(result).toEqual([expect.objectContaining({
      id: 'org-1',
      name: 'North Campus',
      slug: 'north-campus',
      location: 'City',
      logoUrl: null,
      programTags: [{ id: 'program-1', code: 'CS', label: 'Computer Science' }],
    })]);
    expect(JSON.stringify(result)).not.toContain('onlineAdmissionEmailTemplates');
  });

  it('redacts organization email configuration from public offering details', async () => {
    const { service, prisma } = createService();
    prisma.programOffering.findFirst.mockResolvedValue({
      ...publicOffering(),
      campusBinding: {
        ...publicOffering().campusBinding,
        organization: {
          ...publicOffering().campusBinding.organization,
          onlineAdmissionEmailTemplates: { submissionBody: 'private template' },
        },
      },
    });

    const result = await service.getPublicOffering('offering-1');

    expect(result).toMatchObject({
      id: 'offering-1',
      organization: {
        id: 'org-1',
        name: 'North Campus',
        slug: 'north-campus',
        location: 'City',
        logoUrl: null,
        onlineAdmissionsEnabled: true,
      },
    });
    expect(result.organization).not.toHaveProperty('onlineAdmissionEmailTemplates');
    expect(JSON.stringify(result)).not.toContain('private template');
  });

  it('returns provider-neutral public offerings without requiring a Campus organization', async () => {
    const { service, prisma } = createService();
    const standalone = {
      ...publicOffering(),
      campusBinding: null,
      organization: undefined,
      program: {
        ...publicOffering().program,
        campusConfiguration: null,
      },
    };
    prisma.programOffering.findMany.mockResolvedValue([standalone]);

    const result = await service.listPublicOfferings({ search: 'computer' });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'offering-1',
      provider: { id: 'provider-1', slug: 'north-campus' },
      organization: null,
      campusBinding: null,
      academicCycle: null,
    });
  });

  it('rejects a duplicate active application for the same email and offering', async () => {
    const { service, prisma } = createService();
    prisma.programOffering.findFirst.mockResolvedValue(publicOffering());
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue({ id: 'existing-submission' });

    await expect(service.submitPublicApplication('offering-1', {
      answers: { fullName: 'Ada Lovelace', email: 'ADA@example.com' },
      captchaToken: 'captcha-token',
    }, {}, [{
      fieldname: 'document:requirement-1',
      originalname: 'transcript.pdf',
      mimetype: 'application/pdf',
      size: 512,
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File])).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects offerings that are closed or unavailable to the public', async () => {
    const { service, prisma } = createService();
    prisma.programOffering.findFirst.mockResolvedValue(null);

    await expect(service.getPublicOffering('closed-offering')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a public submission when a required document is missing', async () => {
    const { service, prisma } = createService();
    prisma.programOffering.findFirst.mockResolvedValue(publicOffering());

    await expect(service.submitPublicApplication('offering-1', {
      answers: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
      captchaToken: 'captcha-token',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists uploaded requirement documents against the created submission', async () => {
    const tx = {
      onlineAdmissionSubmission: {
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
          applicantEmail: 'ada@example.com',
          applicantName: 'Ada Lovelace',
          publicReference: 'OA-20260817-ABC123',
          status: OnlineAdmissionSubmissionStatus.SUBMITTED,
        }),
      },
      onlineAdmissionStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      admissionsDomainEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service, prisma, files } = createService({
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(tx)),
    });
    prisma.programOffering.findFirst.mockResolvedValue(publicOffering());
    prisma.onlineAdmissionDocumentUpload.create.mockResolvedValue({});
    files.saveProviderFile.mockResolvedValue({ id: 'file-1' });

    const result = await service.submitPublicApplication('offering-1', {
      answers: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
      captchaToken: 'captcha-token',
    }, {}, [{
      fieldname: 'document:requirement-1',
      originalname: 'transcript.pdf',
      mimetype: 'application/pdf',
      size: 512,
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File]);

    expect(result).toEqual({ reference: 'OA-20260817-ABC123', status: OnlineAdmissionSubmissionStatus.SUBMITTED });
    expect(tx.onlineAdmissionSubmission.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerId: 'provider-1' }),
    }));
    expect(files.saveProviderFile).toHaveBeenCalledWith({
      providerId: 'provider-1',
      organizationId: 'org-1',
      entityType: 'ONLINE_ADMISSION',
      entityId: 'submission-1',
    }, expect.objectContaining({ originalname: 'transcript.pdf' }), 'public-applicant:submission-1');
    expect(prisma.onlineAdmissionDocumentUpload.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerId: 'provider-1',
        organizationId: 'org-1',
        submissionId: 'submission-1',
        requirementId: 'requirement-1',
        fileId: 'file-1',
        labelSnapshot: 'Transcript',
        policySnapshot: expect.any(Object),
      }),
    });
  });

  it('removes the initial submission and stored file when document persistence fails', async () => {
    const tx = {
      onlineAdmissionSubmission: {
        create: jest.fn().mockResolvedValue({
          id: 'submission-1',
          applicantEmail: 'ada@example.com',
          applicantName: 'Ada Lovelace',
          publicReference: 'OA-20260817-ABC123',
          status: OnlineAdmissionSubmissionStatus.SUBMITTED,
        }),
      },
      onlineAdmissionStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      admissionsDomainEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service, prisma, files } = createService({
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
    });
    prisma.programOffering.findFirst.mockResolvedValue(publicOffering());
    prisma.onlineAdmissionDocumentUpload.create.mockRejectedValue(new BadRequestException('Document storage failed'));
    prisma.onlineAdmissionDocumentUpload.findMany.mockResolvedValue([]);
    files.saveProviderFile.mockResolvedValue({ id: 'file-1' });

    await expect(service.submitPublicApplication('offering-1', {
      answers: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
      captchaToken: 'captcha-token',
    }, {}, [{
      fieldname: 'document:requirement-1',
      originalname: 'transcript.pdf',
      mimetype: 'application/pdf',
      size: 512,
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File])).rejects.toBeInstanceOf(BadRequestException);

    expect(files.deleteProviderManagedFile).toHaveBeenCalledWith('file-1', expect.objectContaining({
      providerId: 'provider-1',
      entityId: 'submission-1',
    }));
    expect(prisma.onlineAdmissionSubmission.delete).toHaveBeenCalledWith({ where: { id: 'submission-1' } });
  });

  it('keeps update submissions blocked until all required documents are present after upload', async () => {
    const { service, prisma, files } = createService();
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(adminSubmission({
      status: OnlineAdmissionSubmissionStatus.NEEDS_UPDATE,
      updateTokenHash: 'hash',
      updateTokenExpiresAt: new Date(Date.now() + 60_000),
    }));
    prisma.onlineAdmissionDocumentUpload.findMany.mockResolvedValue([]);
    files.saveProviderFile.mockResolvedValue({ id: 'file-1' });

    await expect(service.uploadPublicUpdateDocuments('token', [{
      fieldname: 'document:requirement-1',
      originalname: 'transcript.pdf',
      mimetype: 'application/pdf',
      size: 512,
      buffer: Buffer.from('pdf'),
    } as Express.Multer.File])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.onlineAdmissionSubmission.update).not.toHaveBeenCalled();
  });

  it('blocks marking admitted when the created student is not enrolled in the submission offering curriculum', async () => {
    const { service, prisma } = createService();
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(adminSubmission());
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentProgramEnrollment.findFirst.mockResolvedValue(null);

    await expect(service.markAdmitted(
      'org-1',
      'submission-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
      'student-1',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.onlineAdmissionSubmission.update).not.toHaveBeenCalled();
  });

  it('rejects expired applicant update tokens', async () => {
    const { service, prisma } = createService();
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(null);

    await expect(service.getPublicUpdateSubmission('expired-token')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocks status updates that bypass admitted-student linkage', async () => {
    const { service, prisma } = createService();
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(adminSubmission({ status: OnlineAdmissionSubmissionStatus.ACCEPTED }));

    await expect(service.updateStatus(
      'org-1',
      'submission-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
      OnlineAdmissionSubmissionStatus.ADMITTED,
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('downloads a document only after resolving its scoped parent submission', async () => {
    const { service, prisma, files } = createService();
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(adminSubmission({
      documentUploads: [{ id: 'upload-1', fileId: 'file-1' }],
    }));
    files.getDownloadPayload.mockResolvedValue({ buffer: Buffer.from('pdf'), filename: 'transcript.pdf', mimeType: 'application/pdf' });

    await service.getAdminDocumentDownload(
      'org-1',
      'submission-1',
      'file-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
    );

    expect(files.getDownloadPayload).toHaveBeenCalledWith('file-1', expect.objectContaining({ organizationId: 'org-1' }));
  });

  it('enforces selected department scope before listing submissions', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValue({
      departmentScopeType: 'SELECTED',
      subAdminDepartments: [{ departmentId: 'dept-1' }],
    });

    await expect(service.listAdminSubmissions(
      'org-1',
      { id: 'sub-admin-1', role: 'SUB_ADMIN' },
      { page: 1, limit: 10, departmentId: 'dept-2' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applies the missing-required-documents filter to the paginated query', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw.mockResolvedValue([{ id: 'submission-1' }]);
    prisma.onlineAdmissionSubmission.findMany.mockResolvedValue([]);
    prisma.onlineAdmissionSubmission.count.mockResolvedValue(0);
    prisma.onlineAdmissionSubmission.groupBy.mockResolvedValue([]);

    await service.listAdminSubmissions(
      'org-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
      { page: 1, limit: 10, missingRequiredDocuments: true },
    );

    expect(prisma.onlineAdmissionSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['submission-1'] } }),
    }));
  });

  it('rejects an inverted submitted date range', async () => {
    const { service } = createService();

    await expect(service.listAdminSubmissions(
      'org-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
      { page: 1, limit: 10, submittedFrom: '2026-08-18', submittedTo: '2026-08-17' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks a submission admitted when the student enrollment matches the offering curriculum', async () => {
    const updated = adminSubmission({ status: OnlineAdmissionSubmissionStatus.ADMITTED });
    const tx = {
      onlineAdmissionSubmission: { update: jest.fn().mockResolvedValue(updated) },
      onlineAdmissionStatusEvent: { create: jest.fn().mockResolvedValue({}) },
      admissionsDomainEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service, prisma } = createService({
      $transaction: jest.fn((callback: (client: any) => unknown) => callback(tx)),
    });
    prisma.onlineAdmissionSubmission.findFirst.mockResolvedValue(adminSubmission());
    prisma.student.findFirst.mockResolvedValue({ id: 'student-1' });
    prisma.studentProgramEnrollment.findFirst.mockResolvedValue({ id: 'enrollment-1' });

    const result = await service.markAdmitted(
      'org-1',
      'submission-1',
      { id: 'admin-1', role: 'ORG_ADMIN' },
      'student-1',
    );

    expect(result.status).toBe(OnlineAdmissionSubmissionStatus.ADMITTED);
    expect(prisma.studentProgramEnrollment.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        organizationId: 'org-1',
        programId: 'program-1',
        curriculumVersionId: 'curriculum-1',
        status: { in: expect.any(Array) },
      },
      select: { id: true },
    });
    expect(tx.onlineAdmissionSubmission.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ admittedStudentId: 'student-1' }),
    }));
  });
});
