import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { UserService } from '../users/user.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';

@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async createGuardian(orgId: string, data: CreateGuardianDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await this.userService.createUser(
          {
            email: data.email,
            password: data.password,
            role: Role.GUARDIAN,
            organizationId: orgId,
            name: data.name,
            phone: data.phone,
          },
          tx,
        );

        return tx.guardianProfile.create({
          data: {
            userId: user.id,
            organizationId: orgId,
            phone: data.phone,
            address: data.address,
            relationshipLabel: data.relationshipLabel,
          },
          include: this.guardianInclude(),
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Guardian account already exists');
      }
      console.error('[CreateGuardian Error]:', error);
      throw new InternalServerErrorException(
        'An unexpected error occurred while creating the guardian account',
      );
    }
  }

  async getGuardians(orgId: string, search?: string) {
    return this.prisma.guardianProfile.findMany({
      where: {
        organizationId: orgId,
        ...(search
          ? {
              OR: [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
                { phone: { contains: search, mode: 'insensitive' } },
                { relationshipLabel: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.guardianInclude(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGuardian(orgId: string, id: string) {
    const guardian = await this.prisma.guardianProfile.findFirst({
      where: { id, organizationId: orgId },
      include: this.guardianInclude(),
    });

    if (!guardian) throw new NotFoundException('Guardian not found');
    return guardian;
  }

  private guardianInclude() {
    return {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          avatarUrl: true,
          avatarUpdatedAt: true,
        },
      },
      students: {
        select: {
          id: true,
          userId: true,
          guardianRelationship: true,
          registrationNumber: true,
          rollNumber: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    } satisfies Prisma.GuardianProfileInclude;
  }
}
