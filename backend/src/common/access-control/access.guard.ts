import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ACCESS_LEVEL_KEY, IS_ANONYMOUS_ACCESS_KEY } from './access.decorator';
import { AccessLevel } from './access-level.enum';
import { OrgStatus, UserStatus } from '../enums';
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

    // This is the route's required level, not a fallback grant for the user.
    // Undecorated protected routes require WRITE so authorization fails closed.
    const effectiveRequiredAccess =
      requiredAccess ?? AccessLevel.WRITE;

    // NONE level explicitly bypasses status-based restrictions (e.g. for settings/logo during PENDING)
    if (requiredAccess === AccessLevel.NONE) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    const effectiveAccess = user.accessLevel;
    if (
      typeof effectiveAccess !== 'number' ||
      !Object.values(AccessLevel).includes(effectiveAccess)
    ) {
      throw new ForbiddenException(
        'This session does not contain a valid access level. Please sign in again.',
      );
    }

    if (effectiveAccess < effectiveRequiredAccess) {
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
        `Insufficient access level for this action (Required: ${effectiveRequiredAccess}, Current: ${effectiveAccess})`,
      );
    }

    return true;
  }
}
