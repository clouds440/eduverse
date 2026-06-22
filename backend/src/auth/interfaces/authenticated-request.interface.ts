import { Request } from 'express';
import { User, Organization } from '@/prisma/prisma-client';

export interface AuthenticatedRequest extends Request {
  user: User & { organization?: Organization | null; sessionId?: string };
}
