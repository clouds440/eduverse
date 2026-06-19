import { Role } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../security/email.service';
import { FilesService } from '../files/files.service';
import { UserService } from '../users/user.service';
import { OrgService } from './org.service';
import { ConfigService } from '@nestjs/config';

type MockPrismaService = {
  organization: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
  };
};

describe('OrgService updateSettings', () => {
  let service: OrgService;
  let prisma: MockPrismaService;
  let authService: { issueContactEmailVerification: jest.Mock };
  let emailService: { send: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
    };

    authService = {
      issueContactEmailVerification: jest.fn().mockResolvedValue(undefined),
    };

    emailService = {
      send: jest.fn().mockResolvedValue(undefined),
    };

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://app.test';
        throw new Error(`Missing config ${key}`);
      }),
    };

    service = new OrgService(
      {} as FilesService,
      prisma as unknown as PrismaService,
      {} as UserService,
      authService as unknown as AuthService,
      emailService as unknown as EmailService,
      configService as unknown as ConfigService,
    );
  });

  it('marks changed contactEmail unverified and requests a new verification code', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Test School',
      location: 'Lahore',
      type: 'SCHOOL',
      contactEmail: 'old@school.test',
      contactEmailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      phone: '123',
      logoUrl: null,
      avatarUpdatedAt: null,
      accentColor: null,
      status: 'PENDING',
      statusHistory: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.organization.update.mockResolvedValue({
      id: 'org-1',
      name: 'Test School',
      location: 'Lahore',
      type: 'SCHOOL',
      contactEmail: 'new@school.test',
      contactEmailVerifiedAt: null,
      contactEmailVerificationExpiresAt: null,
      lastVerificationSentAt: null,
      phone: '123',
      logoUrl: null,
      avatarUpdatedAt: null,
      accentColor: null,
      status: 'PENDING',
      statusHistory: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });

    const result = await service.updateSettings('org-1', {
      name: 'Test School',
      location: 'Lahore',
      contactEmail: 'new@school.test',
      phone: '123',
    });

    expect(result.contactEmailVerifiedAt).toBeNull();
    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactEmail: 'new@school.test',
          contactEmailVerifiedAt: null,
          contactEmailVerificationCodeHash: null,
          contactEmailVerificationExpiresAt: null,
          contactEmailVerificationAttempts: 0,
          lastVerificationSentAt: null,
        }),
      }),
    );
    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'old@school.test',
        html: expect.stringContaining('href="https://app.test/contact"'),
      }),
    );
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', role: Role.ORG_ADMIN },
      select: { id: true },
    });
    expect(authService.issueContactEmailVerification).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        targetUserId: 'admin-1',
        organizationId: 'org-1',
        details: { reason: 'contact_email_changed' },
      }),
    );
  });
});
