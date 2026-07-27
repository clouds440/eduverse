import { Role } from '../common/enums';
import { assertCanManageOrganizationUserSecurity } from './managed-security-access';

describe('organization security management hierarchy', () => {
  it('allows the organization admin to manage every organization role', () => {
    expect(() =>
      assertCanManageOrganizationUserSecurity(Role.ORG_ADMIN, Role.SUB_ADMIN),
    ).not.toThrow();
    expect(() =>
      assertCanManageOrganizationUserSecurity(Role.ORG_ADMIN, Role.ORG_ADMIN),
    ).not.toThrow();
  });

  it('prevents sub-admins from managing org admins and other sub-admins', () => {
    expect(() =>
      assertCanManageOrganizationUserSecurity(Role.SUB_ADMIN, Role.ORG_ADMIN),
    ).toThrow('not allowed');
    expect(() =>
      assertCanManageOrganizationUserSecurity(Role.SUB_ADMIN, Role.SUB_ADMIN),
    ).toThrow('not allowed');
  });

  it('allows sub-admins to manage ordinary organization users', () => {
    expect(() =>
      assertCanManageOrganizationUserSecurity(Role.SUB_ADMIN, Role.STUDENT),
    ).not.toThrow();
  });
});
