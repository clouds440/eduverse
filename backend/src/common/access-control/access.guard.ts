import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_LEVEL_KEY, IS_ANONYMOUS_ACCESS_KEY } from './access.decorator';
import { AccessLevel } from './access-level.enum';
import { resolveAccessLevel } from './access.utils';
import { Role, OrgStatus, UserStatus } from '../enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const isAnonymous = this.reflector.getAllAndOverride<boolean>(IS_ANONYMOUS_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isAnonymous) {
      return true;
    }

    const requiredAccess = this.reflector.getAllAndOverride<AccessLevel>(
      ACCESS_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no access level is specified, we default to WRITE
    const effectiveRequired = requiredAccess ?? AccessLevel.WRITE;

    // NONE level explicitly bypasses status-based restrictions (e.g. for settings/logo during PENDING)
    if (requiredAccess === AccessLevel.NONE) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    // Platform Admins (Super/Platform) are exempt from status-based restrictions
    if (user.role === Role.SUPER_ADMIN || user.role === Role.PLATFORM_ADMIN) {
      return true;
    }

    const effectiveAccess = resolveAccessLevel({
      userStatus: user.status,
      orgStatus: user.organizationStatus || OrgStatus.APPROVED,
    });

    if (effectiveAccess < effectiveRequired) {
      // Detailed error messages for better UX/Debugging
      if (user.organizationStatus && user.organizationStatus !== OrgStatus.APPROVED) {
        throw new ForbiddenException(
          `Organization account is ${user.organizationStatus}. Access level restricted.`,
        );
      }
      
      if (user.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException(
          'Your account has been suspended. Please contact your administrator.',
        );
      }

      throw new ForbiddenException(
        `Insufficient access level for this action (Required: ${effectiveRequired}, Current: ${effectiveAccess})`,
      );
    }

    return true;
  }
}
