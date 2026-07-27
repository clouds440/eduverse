import { ConfigService } from '@nestjs/config';
import { Role } from '../common/enums';
import { EmailTemplateService } from '../common/email-templates/email-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { EmailVerificationService } from './email-verification.service';
import { SecurityService } from './security.service';

describe('EmailVerificationService contact email change confirmation', () => {
  const session = {
    id: 'session-a',
    userId: 'user-1',
    isActive: true,
    expiresAt: new Date(Date.now() + 60_000),
    contactEmailChangeCodeHash: null as string | null,
    contactEmailChangeCodeExpiresAt: null as Date | null,
    contactEmailChangeCodeAttempts: 0,
    contactEmailChangeCodeSentAt: null as Date | null,
    contactEmailChangeAuthorizedAt: null as Date | null,
  };
  let issuedCode = '';
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        contactEmail: 'old@example.test',
        contactEmailVerifiedAt: new Date(),
        name: 'Test User',
        organization: { name: 'Test Org', logoUrl: null },
      }),
    },
    session: {
      findFirst: jest.fn(
        ({
          where,
        }: {
          where: { id: string; userId: string; isActive: boolean };
        }) =>
          Promise.resolve(
            where.id === session.id &&
              where.userId === session.userId &&
              where.isActive
              ? session
              : null,
          ),
      ),
      update: jest.fn(
        ({
          data,
        }: {
          data: Partial<typeof session>;
        }) => {
          Object.assign(session, data);
          return Promise.resolve(session);
        },
      ),
    },
  };
  const templates = {
    buildContactEmailVerificationEmail: jest.fn(
      (input: { code: string }) => {
        issuedCode = input.code;
        return { subject: 'Confirm', text: 'Confirm', html: '<p>Confirm</p>' };
      },
    ),
    getSafeAssetUrl: jest.fn().mockReturnValue(undefined),
  };
  const email = { send: jest.fn() };
  const security = { recordEvent: jest.fn() };
  const service = new EmailVerificationService(
    prisma as unknown as PrismaService,
    email as unknown as EmailService,
    { getOrThrow: jest.fn().mockReturnValue('https://app.example.test') } as unknown as ConfigService,
    templates as unknown as EmailTemplateService,
    security as unknown as SecurityService,
  );
  const user = {
    id: 'user-1',
    role: Role.STUDENT,
    organizationId: 'org-1',
    sessionId: 'session-a',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    issuedCode = '';
    session.contactEmailChangeCodeHash = null;
    session.contactEmailChangeCodeExpiresAt = null;
    session.contactEmailChangeCodeAttempts = 0;
    session.contactEmailChangeCodeSentAt = null;
    session.contactEmailChangeAuthorizedAt = null;
  });

  it('binds the old-email proof to the active session', async () => {
    await service.requestContactEmailChangeConfirmation(user);
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'old@example.test' }),
    );

    await expect(
      service.confirmContactEmailChange(
        { ...user, sessionId: 'session-b' },
        issuedCode,
      ),
    ).rejects.toThrow('session is no longer active');

    const result = await service.confirmContactEmailChange(user, issuedCode);
    expect(result.authorizedUntil).toBeTruthy();
    await expect(
      service.assertContactEmailChangeAuthorized(user),
    ).resolves.toBeUndefined();
  });

  it('consumes the session authorization after a change', async () => {
    await service.requestContactEmailChangeConfirmation(user);
    await service.confirmContactEmailChange(user, issuedCode);
    await service.consumeContactEmailChangeAuthorization(user);

    await expect(
      service.assertContactEmailChangeAuthorized(user),
    ).rejects.toThrow('Confirm the code');
  });
});
