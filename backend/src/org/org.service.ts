import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Role, OrgStatus, TeacherStatus, StudentStatus, UserStatus } from '../common/enums';
import { PrismaService } from '../prisma/prisma.service';

import { UpdateSettingsDto } from './dto/update-settings.dto';
import { FilesService } from '../files/files.service';
import { UserService } from '../users/user.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../security/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrgService {
  private readonly logger = new Logger(OrgService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  private async getOrganizationById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // --- Settings ---
  async getSettings(orgId: string) {
    const org = await this.getOrganizationById(orgId);

    return {
      id: org.id,
      name: org.name,
      location: org.location,
      type: org.type,
      currency: org.currency,
      contactEmail: org.contactEmail,
      contactEmailVerifiedAt: org.contactEmailVerifiedAt,
      contactEmailVerificationExpiresAt: org.contactEmailVerificationExpiresAt,
      lastVerificationSentAt: org.lastVerificationSentAt,
      phone: org.phone,
      logoUrl: org.logoUrl,
      avatarUpdatedAt: org.avatarUpdatedAt,
      accentColor: org.accentColor,
      status: org.status,
      statusHistory: org.statusHistory,
      createdAt: org.createdAt,
    };
  }

  async updateSettings(orgId: string, data: UpdateSettingsDto) {
    const currentOrg = await this.getOrganizationById(orgId);
    const contactEmailChanged =
      data.contactEmail &&
      data.contactEmail.toLowerCase() !== currentOrg.contactEmail.toLowerCase();
    const oldVerifiedContactEmail = contactEmailChanged && currentOrg.contactEmailVerifiedAt
      ? currentOrg.contactEmail
      : null;
    const currencyChanged = Boolean(data.currency && data.currency !== currentOrg.currency);

    const updatedOrg = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...data,
        ...(contactEmailChanged
          ? {
              contactEmailVerifiedAt: null,
              contactEmailVerificationCodeHash: null,
              contactEmailVerificationExpiresAt: null,
              contactEmailVerificationAttempts: 0,
              lastVerificationSentAt: null,
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        location: true,
        type: true,
        currency: true,
        contactEmail: true,
        contactEmailVerifiedAt: true,
        contactEmailVerificationExpiresAt: true,
        lastVerificationSentAt: true,
        phone: true,
        logoUrl: true,
        avatarUpdatedAt: true,
        accentColor: true,
        status: true,
        statusHistory: true,
        createdAt: true,
      },
    });

    if (currencyChanged && data.currency) {
      await this.prisma.financialStructure.updateMany({
        where: { organizationId: orgId },
        data: { currency: data.currency },
      });
    }

    if (contactEmailChanged) {
      if (oldVerifiedContactEmail) {
        await this.sendContactEmailChangeNotification(
          oldVerifiedContactEmail,
          currentOrg.name,
          updatedOrg.contactEmail,
        );
      }

      const admin = await this.prisma.user.findFirst({
        where: { organizationId: orgId, role: Role.ORG_ADMIN },
        select: { id: true },
      });
      await this.authService.issueContactEmailVerification(orgId, {
        targetUserId: admin?.id,
        organizationId: orgId,
        details: { reason: 'contact_email_changed' },
      });
    }

    return updatedOrg;
  }

  private async sendContactEmailChangeNotification(
    oldContactEmail: string,
    organizationName: string,
    newContactEmail: string,
  ) {
    try {
      const contactUrl = `${this.configService
        .getOrThrow<string>('FRONTEND_URL')
        .replace(/\/+$/, '')}/contact`;
      await this.emailService.send({
        to: oldContactEmail,
        subject: 'Your EduVerse contact email was changed',
        text: [
          `The verified contact email for ${organizationName} was changed to ${newContactEmail}.`,
          'Password reset links will not be sent to the new contact email until it is verified.',
          'If you did not make this change, please contact EduVerse support immediately.',
        ].join('\n\n'),
        html: `
          <p>The verified contact email for <strong>${this.escapeHtml(organizationName)}</strong> was changed to <strong>${this.escapeHtml(newContactEmail)}</strong>.</p>
          <p>Password reset links will not be sent to the new contact email until it is verified.</p>
          <p>If you did not make this change, please <a href="${this.escapeHtml(contactUrl)}" style="color:#4f46e5;font-weight:700;">contact</a> EduVerse support immediately.</p>
        `,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send contact email change notification to ${oldContactEmail}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[char];
    });
  }

  async updateLogo(
    orgId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ) {
    const org = await this.getOrganizationById(orgId);

    const publicUrl = await this.filesService.replaceFile(org.logoUrl, file);

    // Save new file record via FilesService (for audit trail)
    await this.filesService.saveFile(
      { orgId, entityType: 'orgLogo', entityId: orgId },
      file,
      uploadedBy,
    );

    // Update org with new logo URL and bump cache-buster timestamp
    // Also update the org admin's avatarUrl with the same logo URL
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrg = await tx.organization.update({
        where: { id: orgId },
        data: {
          logoUrl: publicUrl,
          avatarUpdatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          avatarUpdatedAt: true,
        },
      });

      // Update the org admin's avatarUrl with the organization logo
      await tx.user.updateMany({
        where: {
          organizationId: orgId,
          role: Role.ORG_ADMIN,
        },
        data: {
          avatarUrl: publicUrl,
          avatarUpdatedAt: new Date(),
        },
      });

      return updatedOrg;
    });

    return result;
  }

  async updateUserAvatar(
    userId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ) {
    const user = await this.userService.getUserById(userId);

    const publicUrl = await this.filesService.replaceFile(user.avatarUrl, file);

    // Save new file record via FilesService (for audit trail)
    await this.filesService.saveFile(
      {
        orgId: user.organizationId ?? 'system',
        entityType: 'userAvatar',
        entityId: user.id,
      },
      file,
      uploadedBy,
    );

    // Update user with new avatar URL and bump cache-buster timestamp
    return this.userService.updateUser(userId, { avatarUrl: publicUrl });
  }

  async getUserCounts(orgId: string, requesterRole: string) {
    const [
      financeManagers,
      managers,
      teachers,
      students,
      guardians,
      subAdmins,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: {
          organizationId: orgId,
          role: Role.FINANCE_MANAGER,
          status: { not: UserStatus.DELETED },
        },
      }),
      this.prisma.teacher.count({
        where: {
          organizationId: orgId,
          status: { not: TeacherStatus.DELETED },
          user: { role: Role.ORG_MANAGER, status: { not: UserStatus.DELETED } },
        },
      }),
      this.prisma.teacher.count({
        where: {
          organizationId: orgId,
          status: { not: TeacherStatus.DELETED },
          user: { role: Role.TEACHER, status: { not: UserStatus.DELETED } },
        },
      }),
      this.prisma.student.count({
        where: {
          organizationId: orgId,
          status: { not: StudentStatus.DELETED },
          user: { status: { not: UserStatus.DELETED } },
        },
      }),
      this.prisma.guardianProfile.count({
        where: {
          organizationId: orgId,
          user: { status: { not: UserStatus.DELETED } },
        },
      }),
      this.prisma.user.count({
        where: {
          organizationId: orgId,
          role: Role.SUB_ADMIN,
          status: { not: UserStatus.DELETED },
        },
      }),
    ]);

    return {
      ...(requesterRole === Role.ORG_ADMIN ? { subAdmins } : {}),
      financeManagers,
      managers,
      teachers,
      students,
      guardians,
    };
  }




  async reapply(orgId: string) {
    const org = await this.getOrganizationById(orgId);

    if (org.status !== OrgStatus.REJECTED) {
      throw new BadRequestException('Only rejected organizations can re-apply');
    }

    const history = (org.statusHistory as Prisma.JsonArray) || [];
    const newHistory = [
      ...history,
      {
        status: OrgStatus.PENDING,
        message: 'Organization has re-applied for verification.',
        adminName: 'System',
        adminRole: 'Automation',
        createdAt: new Date().toISOString(),
      },
    ];

    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        status: OrgStatus.PENDING,
        statusHistory: newHistory,
      },
    });
  }

  async approveOrganization(orgId: string, admin: { name: string | null; email: string; role: string; id: string }) {
    const org = await this.getOrganizationById(orgId);

    const history = (org.statusHistory as Prisma.JsonArray) || [];
    const newEntry = {
      status: OrgStatus.APPROVED,
      message: 'Organization approved.',
      adminName: admin.name || admin.email,
      adminRole: admin.role,
      createdAt: new Date(),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrg = await tx.organization.update({
        where: { id: orgId },
        data: {
          status: OrgStatus.APPROVED,
          statusHistory: [...history, newEntry] as Prisma.InputJsonValue,
        },
      });

      return updatedOrg;
    });

    return result;
  }

  async updateOrganizationStatus(
    orgId: string,
    status: OrgStatus.SUSPENDED | OrgStatus.REJECTED,
    reason: string,
    admin: { name: string | null; email: string; role: string; id: string },
  ) {
    const org = await this.getOrganizationById(orgId);

    const history = (org.statusHistory as Prisma.JsonArray) || [];
    const newEntry = {
      status,
      message: reason,
      adminName: admin.name || admin.email,
      adminRole: admin.role,
      createdAt: new Date(),
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedOrg = await tx.organization.update({
        where: { id: orgId },
        data: {
          status,
          statusHistory: [...history, newEntry] as Prisma.InputJsonValue,
        },
      });

      // Instant Revocation for all Org users
      await tx.session.updateMany({
        where: { user: { organizationId: orgId } },
        data: { isActive: false },
      });

      return updatedOrg;
    });

    return result;
  }
}
