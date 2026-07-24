import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus } from '../common/enums';
import * as bcrypt from 'bcrypt';
import { BCRYPT_ROUNDS } from '../common/utils';
import { Prisma } from '@/prisma/prisma-client';

interface CreateUserInput {
  email: string;
  password: string;
  role: Role;
  organizationId?: string;
  name: string;
  phone?: string;
  avatarUrl?: string;
  status?: UserStatus;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) { }

  async createUser(data: CreateUserInput, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException(
        'A user with this email address already exists in the system',
      );
    }

    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    return db.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        role: data.role,
        organizationId: data.organizationId,
        name: data.name,
        phone: data.phone,
        status: (data.status as unknown as UserStatus) || UserStatus.ACTIVE,
      },
    });
  }

  async updateUser(userId: string, data: Prisma.UserUpdateInput, tx?: Prisma.TransactionClient) {
    const db = tx || this.prisma;
    const user = await db.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const updateData: Prisma.UserUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status as UserStatus;

    if (data.email !== undefined && data.email !== user.email) {
      const existingUser = await db.user.findUnique({
        where: { email: data.email as string },
      });

      if (existingUser) {
        throw new ConflictException('Email address already in use');
      }

      updateData.email = data.email;
    }

    if (data.password !== undefined) {
      updateData.password = await bcrypt.hash(data.password as string, BCRYPT_ROUNDS);
    }

    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
      updateData.avatarUpdatedAt = new Date();
    }

    const updated = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    // Revoke all sessions if status, role, or password actually changed
    const statusChanged = data.status !== undefined && data.status !== user.status;
    const roleChanged = data.role !== undefined && data.role !== user.role;
    const passwordChanged = data.password !== undefined;

    if (statusChanged || roleChanged || passwordChanged) {
      await db.session.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }

    return updated;
  }


  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async getUsersByOrgAndRole(organizationId: string, role: Role) {
    return this.prisma.user.findMany({
      where: { organizationId, role },
    });
  }

  async deleteUser(userId: string) {
    await this.getUserById(userId);

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User deleted successfully' };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.getUserById(userId);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect old password');
    }

    const hashedNew = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNew,
        isFirstLogin: false,
      },
      include: { settings: true },
    });
  }
}
