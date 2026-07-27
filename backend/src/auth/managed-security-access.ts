import { ForbiddenException } from '@nestjs/common';
import { Role } from '../common/enums';

export function assertCanManageOrganizationUserSecurity(
  actorRole: string | undefined,
  targetRole: string,
) {
  if (actorRole === Role.ORG_ADMIN) return;
  if (
    actorRole === Role.SUB_ADMIN &&
    targetRole !== Role.ORG_ADMIN &&
    targetRole !== Role.SUB_ADMIN
  ) {
    return;
  }
  throw new ForbiddenException(
    'You are not allowed to manage security for this account.',
  );
}
