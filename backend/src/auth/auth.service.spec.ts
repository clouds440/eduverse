import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrgStatus, OrganizationType, Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../security/email.service';
import type { NotificationCreator } from '../notifications/notifications.tokens';
import { AuthService } from './auth.service';

const genericForgotMessage =
  'If an eligible account exists, password reset instructions will be sent.';

describe('AuthService register', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          organization: {
            create: jest.fn().mockResolvedValue({
              id: 'org-1',
              name: 'Test School',
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'admin-1',
              email: 'admin@school.test',
            }),
          },
        }),
      ),
    };

    service = new AuthService(
      {} as JwtService,
      prisma as unknown as PrismaService,
      { send: jest.fn() } as unknown as EmailService,
      {} as ConfigService,
      { createNotification: jest.fn() } as NotificationCreator,
    );
    jest
      .spyOn(service, 'issueContactEmailVerification')
      .mockResolvedValue(undefined);
  });

  it('does not force password change for a self-registered organization admin', async () => {
    const tx = {
      organization: {
        create: jest.fn().mockResolvedValue({
          id: 'org-1',
          name: 'Test School',
        }),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'admin-1',
          email: 'admin@school.test',
        }),
      },
    };
    prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(tx),
    );

    await service.register({
      name: 'Test School',
      adminName: 'Admin User',
      location: 'Lahore',
      type: OrganizationType.HIGH_SCHOOL,
      email: 'admin@school.test',
      contactEmail: 'contact@school.test',
      phone: '123456789',
      password: 'StrongPass1',
    });

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: Role.ORG_ADMIN,
          isFirstLogin: false,
        }),
      }),
    );
  });
});

type MockPrismaService = {
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  passwordResetToken: {
    updateMany: jest.Mock;
    create: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
    findMany: jest.Mock;
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
      logoUrl: null,
    },
  };

  const secondVerifiedOrgAdmin = {
    id: 'admin-2',
    email: 'owner@academy.test',
    role: Role.ORG_ADMIN,
    organizationId: 'org-2',
    organization: {
      id: 'org-2',
      name: 'North Academy',
      contactEmail: 'recovery@school.test',
      contactEmailVerifiedAt: new Date('2026-01-02T00:00:00.000Z'),
      logoUrl: '/uploads/org-2/logo.png',
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
        findMany: jest.fn(),
      },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'reset-token-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findMany: jest.fn().mockResolvedValue([]),
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
      { createNotification: jest.fn() } as NotificationCreator,
    );
  });

  it('sends reset instructions to verified contactEmail when submitted email is the login email', async () => {
    prisma.user.findMany.mockResolvedValue([verifiedOrgAdmin]);

    const response = await service.forgotPassword(
      { email: ' ADMIN@SCHOOL.TEST ' },
      { ip: '127.0.0.1', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: Role.ORG_ADMIN,
        }),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
        subject: 'Reset your EduVerse password',
        html: expect.stringContaining('Test School'),
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
    prisma.user.findMany.mockResolvedValue([verifiedOrgAdmin]);

    const response = await service.forgotPassword(
      { email: 'recovery@school.test' },
      { ip: '127.0.0.2', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
        html: expect.stringContaining('Reset this account'),
      }),
    );
  });

  it('sends one recovery email with all eligible accounts when a contactEmail is shared', async () => {
    prisma.user.findMany.mockResolvedValue([
      verifiedOrgAdmin,
      secondVerifiedOrgAdmin,
    ]);

    const response = await service.forgotPassword(
      { email: 'recovery@school.test' },
      { ip: '127.0.0.6', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'recovery@school.test',
        subject: 'Choose an EduVerse account to recover',
        html: expect.stringContaining('Test School'),
        text: expect.stringContaining('North Academy'),
      }),
    );
    const sentEmail = emailService.send.mock.calls[0][0];
    expect(sentEmail.html).toContain('North Academy');
    expect(sentEmail.html).toContain('owner@academy.test');
    expect(sentEmail.html).toContain('https://app.test/uploads/org-2/logo.png');
    expect(prisma.passwordResetToken.create).toHaveBeenCalledTimes(2);
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin-1' }),
      }),
    );
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'admin-2' }),
      }),
    );
  });

  it('does not send reset instructions when contactEmail is unverified', async () => {
    prisma.user.findMany.mockResolvedValue([{
      ...verifiedOrgAdmin,
      organization: {
        ...verifiedOrgAdmin.organization,
        contactEmailVerifiedAt: null,
      },
    }]);

    const response = await service.forgotPassword(
      { email: 'admin@school.test' },
      { ip: '127.0.0.3', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('does not send reset instructions for non-admin users', async () => {
    prisma.user.findMany.mockResolvedValue([{
      ...verifiedOrgAdmin,
      role: Role.STUDENT,
    }]);

    const response = await service.forgotPassword(
      { email: 'student@school.test' },
      { ip: '127.0.0.4', userAgent: 'jest' },
    );

    expect(response).toEqual({ message: genericForgotMessage });
    expect(emailService.send).not.toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('returns the generic response when no account matches', async () => {
    prisma.user.findMany.mockResolvedValue([]);

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
      logoUrl: '/uploads/org-1/logo.png',
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
        text: expect.stringContaining('Welcome to EduVerse, Test School.'),
        html: expect.stringContaining('Before approval can continue'),
      }),
    );
    const sentEmail = emailService.send.mock.calls[0][0];
    expect(sentEmail.html).toContain('Verification code');
    expect(sentEmail.html).toContain('Shared mailbox?');
    expect(sentEmail.html).toContain('https://app.test/uploads/org-1/logo.png');
    expect(sentEmail.text).toContain(
      'If this mailbox is used for multiple EduVerse organizations',
    );
  });

  it('emails platform admins when a pending registration contact email is verified', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Test School',
      status: OrgStatus.PENDING,
      contactEmail: 'recovery@school.test',
      contactEmailVerifiedAt: null,
      contactEmailVerificationCodeHash: (service as unknown as { hashSecret: (value: string) => string }).hashSecret('123456'),
      contactEmailVerificationExpiresAt: new Date(Date.now() + 60_000),
      contactEmailVerificationAttempts: 0,
    });
    prisma.auditLog.findMany.mockResolvedValue([
      { details: { reason: 'first_registration' } },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { email: 'super@eduverse.test' },
      { email: 'platform@eduverse.test' },
    ]);

    await service.verifyContactEmail(
      { id: 'admin-1', role: Role.ORG_ADMIN, organizationId: 'org-1' },
      '123456',
      { ip: '127.0.0.8', userAgent: 'jest' },
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: { in: [Role.SUPER_ADMIN, Role.PLATFORM_ADMIN] },
          status: 'ACTIVE',
        }),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'super@eduverse.test',
        subject: 'Pending organization verified: Test School',
        text: expect.stringContaining('https://app.test/admin/organizations'),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'platform@eduverse.test',
        html: expect.stringContaining('Review organizations'),
      }),
    );
  });

  it('does not email platform admins for contact email change reverification', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Test School',
      status: OrgStatus.PENDING,
      contactEmail: 'new-recovery@school.test',
      contactEmailVerifiedAt: null,
      contactEmailVerificationCodeHash: (service as unknown as { hashSecret: (value: string) => string }).hashSecret('123456'),
      contactEmailVerificationExpiresAt: new Date(Date.now() + 60_000),
      contactEmailVerificationAttempts: 0,
    });
    prisma.auditLog.findMany.mockResolvedValue([
      { details: { reason: 'contact_email_changed' } },
    ]);

    await service.verifyContactEmail(
      { id: 'admin-1', role: Role.ORG_ADMIN, organizationId: 'org-1' },
      '123456',
      { ip: '127.0.0.9', userAgent: 'jest' },
    );

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(emailService.send).not.toHaveBeenCalled();
  });

  it('generates a reset link for a managed user and emails it', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-user-1',
      email: 'teacher@school.test',
      name: 'Teacher User',
      role: Role.TEACHER,
      organizationId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'Test School',
        logoUrl: '/uploads/org-1/logo.png',
      },
    });

    const response = await service.generateManagedUserPasswordResetLink(
      { id: 'admin-1', role: Role.ORG_ADMIN, organizationId: 'org-1' },
      'teacher-user-1',
      { ip: '127.0.0.7', userAgent: 'jest' },
    );

    expect(response.emailSent).toBe(true);
    expect(response.resetUrl).toContain('https://app.test/reset-password?token=');
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'teacher-user-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'teacher-user-1',
        }),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'teacher@school.test',
        subject: 'Your EduVerse password reset link',
        html: expect.stringContaining('https://app.test/uploads/org-1/logo.png'),
      }),
    );
  });

  it('returns the reset link with a warning when managed user email delivery fails', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'student-user-1',
      email: 'missing-mailbox@school.test',
      name: 'Student User',
      role: Role.STUDENT,
      organizationId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'Test School',
        logoUrl: null,
      },
    });
    emailService.send.mockRejectedValueOnce(new Error('Mailbox unavailable'));

    const response = await service.generateManagedUserPasswordResetLink(
      { id: 'admin-1', role: Role.ORG_ADMIN, organizationId: 'org-1' },
      'student-user-1',
      { ip: '127.0.0.8', userAgent: 'jest' },
    );

    expect(response.emailSent).toBe(false);
    expect(response.resetUrl).toContain('https://app.test/reset-password?token=');
    expect(response.warning).toContain('Share the copied link with the user directly');
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'student-user-1',
        }),
      }),
    );
  });

  it('does not allow a sub-admin to generate a sub-admin reset link', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'sub-admin-2',
      email: 'sub-admin@school.test',
      name: 'Sub Admin',
      role: Role.SUB_ADMIN,
      organizationId: 'org-1',
      organization: {
        id: 'org-1',
        name: 'Test School',
        logoUrl: null,
      },
    });

    await expect(
      service.generateManagedUserPasswordResetLink(
        { id: 'sub-admin-1', role: Role.SUB_ADMIN, organizationId: 'org-1' },
        'sub-admin-2',
        { ip: '127.0.0.9', userAgent: 'jest' },
      ),
    ).rejects.toThrow('Only the main organization admin can reset sub-admin passwords.');
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });
});

describe('AuthService Google linked accounts', () => {
  let service: AuthService;
  let prisma: {
    linkedAccount: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
    session: {
      deleteMany: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const linkedUser = {
    id: 'user-1',
    email: 'admin@school.test',
    name: 'Admin User',
    role: Role.ORG_ADMIN,
    status: 'ACTIVE',
    organizationId: 'org-1',
    isFirstLogin: false,
    avatarUrl: null,
    avatarUpdatedAt: null,
    themeMode: 'SYSTEM',
    organization: {
      id: 'org-1',
      name: 'Test School',
      status: 'APPROVED',
      logoUrl: null,
      contactEmailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    teacherProfile: null,
  };

  beforeEach(() => {
    prisma = {
      linkedAccount: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'session-1' }),
        update: jest.fn(),
      },
    };

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('eduverse-jwt'),
      verifyAsync: jest.fn(),
    };

    const configService = {
      get: jest.fn((key: string) => (key === 'JWT_SECRET' ? 'secret' : undefined)),
      getOrThrow: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.test';
        throw new Error(`Missing config ${key}`);
      }),
    };

    service = new AuthService(
      jwtService as unknown as JwtService,
      prisma as unknown as PrismaService,
      { send: jest.fn() } as unknown as EmailService,
      configService as unknown as ConfigService,
      { createNotification: jest.fn() } as NotificationCreator,
    );
  });

  it('logs in with Google by resolving an existing linked account and using the EduVerse user', async () => {
    prisma.linkedAccount.findUnique.mockResolvedValue({
      id: 'linked-1',
      userId: linkedUser.id,
      provider: 'GOOGLE',
      providerAccountId: 'google-sub-1',
      user: linkedUser,
    });

    const result = await (service as unknown as {
      loginWithGoogle: (
        providerAccountId: string,
        device: {
          rememberMe: boolean;
          deviceId: string;
          deviceName: string;
          deviceType: string;
          browser: string;
          os: string;
        },
      ) => Promise<{ access_token: string; role: string }>;
    }).loginWithGoogle('google-sub-1', {
      rememberMe: true,
      deviceId: 'device-1',
      deviceName: 'Chrome on Windows',
      deviceType: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
    });

    expect(result).toEqual(expect.objectContaining({
      access_token: 'eduverse-jwt',
      role: Role.ORG_ADMIN,
    }));
    expect(prisma.linkedAccount.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId: 'google-sub-1',
          },
        },
      }),
    );
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: linkedUser.id,
          token: 'eduverse-jwt',
        }),
      }),
    );
  });

  it('rejects Google login when no linked EduVerse account exists', async () => {
    prisma.linkedAccount.findUnique.mockResolvedValue(null);

    await expect(
      (service as unknown as {
        loginWithGoogle: (providerAccountId: string) => Promise<unknown>;
      }).loginWithGoogle('missing-google-sub'),
    ).rejects.toThrow(
      'No EduVerse account is linked to this Google account. Log in with your EduVerse password first, then link Google from settings.',
    );
  });

  it('treats linking the same Google account to the same user as safe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    prisma.linkedAccount.findUnique.mockResolvedValue({
      id: 'linked-1',
      userId: 'user-1',
      provider: 'GOOGLE',
      providerAccountId: 'google-sub-1',
    });

    const result = await (service as unknown as {
      linkGoogleAccount: (
        userId: string,
        googleIdentity: { providerAccountId: string; email?: string },
      ) => Promise<unknown>;
    }).linkGoogleAccount('user-1', {
      providerAccountId: 'google-sub-1',
      email: 'admin@gmail.test',
    });

    expect(result).toEqual(expect.objectContaining({ id: 'linked-1' }));
    expect(prisma.linkedAccount.upsert).not.toHaveBeenCalled();
  });

  it('rejects linking a Google account already linked to another EduVerse user', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    prisma.linkedAccount.findUnique.mockResolvedValue({
      id: 'linked-1',
      userId: 'user-2',
      provider: 'GOOGLE',
      providerAccountId: 'google-sub-1',
    });

    await expect(
      (service as unknown as {
        linkGoogleAccount: (
          userId: string,
          googleIdentity: { providerAccountId: string; email?: string },
        ) => Promise<unknown>;
      }).linkGoogleAccount('user-1', {
        providerAccountId: 'google-sub-1',
        email: 'admin@gmail.test',
      }),
    ).rejects.toThrow(
      'This Google account is already linked to another EduVerse account.',
    );
  });
});
