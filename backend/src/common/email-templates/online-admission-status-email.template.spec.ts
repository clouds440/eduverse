import { OnlineAdmissionSubmissionStatus } from '@/prisma/prisma-client';
import { renderOnlineAdmissionStatusEmail } from './online-admission-status-email.template';

describe('online admission status email template', () => {
  it('applies organization placeholders and escapes customized body HTML', () => {
    const email = renderOnlineAdmissionStatusEmail({
      appBaseUrl: 'https://school.test',
      name: '<Ada>',
      reference: 'OA-123',
      organizationName: 'Test School',
      programLabel: 'Computer Science',
      status: OnlineAdmissionSubmissionStatus.SUBMITTED,
      templates: {
        submissionSubject: '{organizationName}: {reference}',
        submissionBody: 'Hello {applicantName}, <script>alert(1)</script> {programName}',
      },
    });

    expect(email.subject).toBe('Test School: OA-123');
    expect(email.text).toContain('Hello <Ada>, <script>alert(1)</script> Computer Science');
    expect(email.html).toContain('Hello &lt;Ada&gt;, &lt;script&gt;alert(1)&lt;/script&gt; Computer Science');
    expect(email.html).not.toContain('<script>alert(1)</script>');
  });
});
