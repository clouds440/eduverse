import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrgStatus, Role } from '../common/enums';
import type { User as UserEntity } from '@/prisma/prisma-client';

describe('AdminService updateOrganizationStatus', () => {
  let service: AdminService;
  let prisma: {
    organization: {
      findUnique: jest.Mock;
    };
  };
  let mailService: {
    createMail: jest.Mock;
  };
  let userService: {
    getUsersByOrgAndRole: jest.Mock;
  };
  let orgService: {
    updateOrganizationStatus: jest.Mock;
  };

  const admin = {
    id: 'platform-admin-1',
    role: Role.PLATFORM_ADMIN,
    name: 'Platform Admin',
    email: 'admin@eduverse.test',
  } as UserEntity;

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
      },
    };
    mailService = {
      createMail: jest.fn().mockResolvedValue(undefined),
    };
    userService = {
      getUsersByOrgAndRole: jest.fn(),
    };
    orgService = {
      updateOrganizationStatus: jest.fn(),
    };

    service = new AdminService(
      {} as never,
      prisma as never,
      mailService as never,
      userService as never,
      orgService as never,
    );
  });

  it('assigns suspend/reject mail to the organization admin without broadcasting to all org admins', async () => {
    prisma.organization.findUnique.mockResolvedValue({
      id: 'org-1',
      name: 'Target School',
    });
    orgService.updateOrganizationStatus.mockResolvedValue({
      id: 'org-1',
      status: OrgStatus.SUSPENDED,
    });
    userService.getUsersByOrgAndRole.mockResolvedValue([
      { id: 'org-admin-1', role: Role.ORG_ADMIN, organizationId: 'org-1' },
    ]);

    await service.updateOrganizationStatus(
      'org-1',
      OrgStatus.SUSPENDED,
      'Policy violation',
      admin,
    );

    expect(userService.getUsersByOrgAndRole).toHaveBeenCalledWith(
      'org-1',
      Role.ORG_ADMIN,
    );
    expect(mailService.createMail).toHaveBeenCalledWith(
      expect.not.objectContaining({ targetRole: Role.ORG_ADMIN }),
      expect.any(Object),
    );
    expect(mailService.createMail).toHaveBeenCalledWith(
      expect.objectContaining({
        assigneeIds: ['org-admin-1'],
        noReply: true,
      }),
      expect.objectContaining({
        id: 'platform-admin-1',
        organizationId: 'org-1',
      }),
    );
  });

  it('throws when the organization does not exist', async () => {
    prisma.organization.findUnique.mockResolvedValue(null);

    await expect(
      service.updateOrganizationStatus(
        'missing-org',
        OrgStatus.REJECTED,
        'Incomplete registration',
        admin,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(orgService.updateOrganizationStatus).not.toHaveBeenCalled();
    expect(mailService.createMail).not.toHaveBeenCalled();
  });
});
