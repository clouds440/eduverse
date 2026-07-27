import { Request } from 'express';
import { User, Organization } from '@/prisma/prisma-client';
import { AccessLevel } from '../../common/access-control/access-level.enum';
import { OrgStatus } from '../../common/enums';

export interface AuthenticatedRequest extends Request {
  user: User & {
    organization?: Organization | null;
    organizationStatus?: OrgStatus;
    accessLevel: AccessLevel;
    sessionId?: string;
  };
}
