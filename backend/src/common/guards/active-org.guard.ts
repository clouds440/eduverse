import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, OrgStatus } from '@/prisma/prisma-client';
import { BYPASS_ACTIVE_ORG_KEY } from '../decorators/bypass-active-org.decorator';

@Injectable()
export class ActiveOrgGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Check for bypass decorator (e.g. @BypassActiveOrg())
    const isBypassed = this.reflector.getAllAndOverride<boolean>(
      BYPASS_ACTIVE_ORG_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isBypassed) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 2. Platform Admins (Super/Platform) are exempt from this guard
    if (
      !user ||
      user.role === Role.SUPER_ADMIN ||
      user.role === Role.PLATFORM_ADMIN
    ) {
      return true;
    }

    // 3. Organization check
    if (!user.organizationId) {
      // Users without an organization (if any exist besides admins)
      // should technically be allowed unless they start performing org actions.
      return true;
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { status: true },
    });

    if (!org) {
      throw new ForbiddenException('Organization not found.');
    }

    // 4. Enforce Status
    if (org.status !== OrgStatus.APPROVED) {
      // Specific exception: Still allow if we are in the RequestsController and creating a Platform Support request
      // (Note: The actual endpoint-level logic can double-check the targetRole,
      // but here we just ensure the Guard is applied correctly).

      const handlerName = context.getHandler().name;
      const className = context.getClass().name;

      // Allow reaching mail BUT only for support
      // This is a coarse filter, the MailService already enforces the targetRole.
      if (className === 'MailController') {
        return true;
      }

      // Also allow Auth logout/profile/status checks
      if (
        className === 'AuthController' ||
        (className === 'OrgController' &&
          (handlerName === 'getOrgData' || handlerName === 'getProfile'))
      ) {
        return true;
      }

      throw new ForbiddenException(
        `Your organization status is currently ${org.status}. Actions are restricted. Please contact platform support.`,
      );
    }

    return true;
  }
}
