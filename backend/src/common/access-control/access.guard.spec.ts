import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgStatus, UserStatus } from '../enums';
import { ACCESS_LEVEL_KEY } from './access.decorator';
import { AccessGuard } from './access.guard';
import { AccessLevel } from './access-level.enum';

function contextWithUser(user: Record<string, unknown>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AccessGuard signed access claims', () => {
  function guardFor(required: AccessLevel) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === ACCESS_LEVEL_KEY ? required : false,
      ),
    } as unknown as Reflector;
    return new AccessGuard(reflector);
  }

  it('allows a signed access level that meets the route requirement', () => {
    const guard = guardFor(AccessLevel.WRITE);
    expect(
      guard.canActivate(
        contextWithUser({
          accessLevel: AccessLevel.WRITE,
          status: UserStatus.ACTIVE,
          organizationStatus: OrgStatus.APPROVED,
        }),
      ),
    ).toBe(true);
  });

  it('does not recalculate a lower signed access level from statuses', () => {
    const guard = guardFor(AccessLevel.WRITE);
    expect(() =>
      guard.canActivate(
        contextWithUser({
          accessLevel: AccessLevel.READ,
          status: UserStatus.ACTIVE,
          organizationStatus: OrgStatus.APPROVED,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects sessions without a valid signed access level', () => {
    const guard = guardFor(AccessLevel.READ);
    expect(() =>
      guard.canActivate(
        contextWithUser({
          status: UserStatus.ACTIVE,
          organizationStatus: OrgStatus.APPROVED,
        }),
      ),
    ).toThrow('Please sign in again');
  });
});
