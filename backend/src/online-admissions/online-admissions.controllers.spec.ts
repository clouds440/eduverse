import { AdminOnlineAdmissionsController } from './admin-online-admissions.controller';
import { PublicOnlineAdmissionsController } from './public-online-admissions.controller';
import { OnlineAdmissionSubmissionStatus } from '@/prisma/prisma-client';

function requestUser() {
  return { user: { id: 'admin-1', role: 'ORG_ADMIN', organizationId: 'org-1' } } as any;
}

describe('Online admissions controllers', () => {
  it('passes public submission payload, request metadata, and files to the service', async () => {
    const admissions: any = { submitPublicApplication: jest.fn().mockResolvedValue({ reference: 'OA-1' }) };
    const controller = new PublicOnlineAdmissionsController(admissions);
    const file = { originalname: 'transcript.pdf' } as Express.Multer.File;
    const payload = {
      answers: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
      captchaToken: 'captcha-token',
    };

    await controller.submit('offering-1', payload, [file], '127.0.0.1', 'test-agent');

    expect(admissions.submitPublicApplication).toHaveBeenCalledWith(
      'offering-1',
      payload,
      { ip: '127.0.0.1', userAgent: 'test-agent' },
      [file],
    );
  });

  it('maps admin list query parameters into scoped service filters', async () => {
    const admissions: any = { listAdminSubmissions: jest.fn().mockResolvedValue({ data: [] }) };
    const controller = new AdminOnlineAdmissionsController(admissions);

    await controller.list(
      'org-1', requestUser(), '2', '25', 'ada', 'submittedAt', 'desc',
      OnlineAdmissionSubmissionStatus.REJECTED, 'dept-1', 'program-1', 'offering-1',
      'cycle-1', '2026-08-01', '2026-08-31', 'true',
    );

    expect(admissions.listAdminSubmissions).toHaveBeenCalledWith('org-1', requestUser().user, expect.objectContaining({
      page: 2,
      limit: 25,
      status: OnlineAdmissionSubmissionStatus.REJECTED,
      departmentId: 'dept-1',
      missingRequiredDocuments: true,
    }));
  });

  it('streams only the document payload returned by the scoped service method', async () => {
    const admissions: any = {
      getAdminDocumentDownload: jest.fn().mockResolvedValue({
        buffer: Buffer.from('pdf'),
        filename: 'transcript.pdf',
        mimeType: 'application/pdf',
      }),
    };
    const response = { setHeader: jest.fn(), send: jest.fn() } as any;
    const controller = new AdminOnlineAdmissionsController(admissions);

    await controller.downloadDocument('org-1', 'submission-1', 'file-1', requestUser(), response);

    expect(admissions.getAdminDocumentDownload).toHaveBeenCalledWith('org-1', 'submission-1', 'file-1', requestUser().user);
    expect(response.send).toHaveBeenCalledWith(Buffer.from('pdf'));
  });
});
