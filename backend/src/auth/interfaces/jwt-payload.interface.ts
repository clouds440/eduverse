import { AccessLevel } from '../../common/access-control/access-level.enum';
import { OrgStatus, Role, UserStatus } from '../../common/enums';

export interface JwtPayload {
  sub: string;
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  orgId?: string | null;
  designation?: string;
  type?: string;
  status: OrgStatus;
  userStatus: UserStatus;
  accessLevel: AccessLevel;
  isFirstLogin?: boolean;
}
