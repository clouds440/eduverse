import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import { AuthService } from './auth.service';

const genericForgotMessage =
  'If an eligible account exists, password reset instructions will be sent.';

type MockPrismaService = {
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
  passwordResetToken: {
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
};

describe('AuthService forgotPassword', () => {
  let service: AuthService;
  let prisma: MockPrismaService;
  let emailService: { send: jest.Mock };

  const verifiedOrgAdmin = {
    id: 'admin-1',
    email: 'admin@school.test',
    role: Role.ORG_ADMIN,
    organizationId: 'org-1',
    organization: {
      id: 'org-1',
      name: 'Test School',
      contactEmail: 'recovery@school.test',
      contactEmailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'org-1' }),
      },
      user: {
        findFirst: jest.fn(),
      },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'reset-token-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    emailService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn((key: string) => (key === 'FRONTEND_URL' ? 'https://app.test' : undefined)),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.test';
        throw new Error(`Missing config ${key}`);
      }),
    };

    service = new AuthService(
      {} as JwtService,
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
      configService as unknown as ConfigService,
    );
  });

  it('sends reset instructions to verified contactEmail when submitted email is the login email', async () => {
    prisma.user.findFirst.mockResolvedValue(verifiedOrgAdmin);

    const response = await service.forgotPassword(
      { email: ' ADMIN@SCHOOL.TEST ' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: Role.ORG_ADMIN,
        }),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
      }),
    );
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'admin-1',
        }),
      }),
    );
  });

  it('sends reset instructions to contactEmail when submitted email is the verified contactEmail', async () => {
    prisma.user.findFirst.mockResolvedValue(verifiedOrgAdmin);

    const response = await service.forgotPassword(
      { email: 'recovery@school.test' },
      { ip: '127.0.0.2', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
      }),
    );
  });

  it('does not send reset instructions when contactEmail is unverified', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...verifiedOrgAdmin,
      organization: {
        ...verifiedOrgAdmin.organization,
        contactEmailVerifiedAt: null,
      },
    });

    const response = await service.forgotPassword(
      { email: 'admin@school.test' },
      { ip: '127.0.0.3', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('does not send reset instructions for non-admin users', async () => {
    prisma.user.findFirst.mockResolvedValue({
      ...verifiedOrgAdmin,
      role: Role.STUDENT,
    });

    const response = await service.forgotPassword(
      { email: 'student@school.test' },
      { ip: '127.0.0.4', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns the generic response when no account matches', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const response = await service.forgotPassword(
      { email: 'missing@school.test' },
      { ip: '127.0.0.5', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('uses a welcome email template for first registration contact verification', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Test School',
      contactEmail: 'recovery@school.test',
      contactEmailVerifiedAt: null,
      lastVerificationSentAt: null,
    });

    await service.issueContactEmailVerification('org-1', {
      targetUserId: 'admin-1',
      organizationId: 'org-1',
      details: { reason: 'first_registration' },
    });

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
        subject: 'Welcome to EduVerse, Test School',
        text: expect.stringContaining('Welcome to EduVerse, Test School!'),
        html: expect.stringContaining('Before approval can continue'),
      }),
    );
  });
});
