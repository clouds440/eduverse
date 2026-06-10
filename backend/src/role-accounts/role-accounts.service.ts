import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Role, UserStatus } from '../common/enums';
import {
  formatPaginatedResponse,
  getPaginationOptions,
  PaginationOptions,
} from '../common/utils';
import { UserService } from '../users/user.service';

export interface CreateRoleAccountInput {
  email: string;
  password: string;
  name: string;
  phone?: string;
  status?: UserStatus;
}

export interface UpdateRoleAccountInput {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
  status?: UserStatus;
}

const roleAccountSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  status: true,
  organizationId: true,
  avatarUrl: true,
  avatarUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class RoleAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async getAccounts(
    orgId: string,
    role: Role,
    options: PaginationOptions,
  ) {
    const { skip, take, sortBy, sortOrder, status, deleted } =
      getPaginationOptions(options);

    const where = this.buildWhere(orgId, role, options.search, status, deleted);
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [accounts, totalRecords] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: roleAccountSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return formatPaginatedResponse(
      accounts,
      totalRecords,
      options.page,
      options.limit,
    );
  }

  async getAccount(orgId: string, role: Role, id: string, label: string) {
    const account = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: orgId,
        role,
        status: { not: UserStatus.DELETED },
      },
      select: roleAccountSelect,
    });

    if (!account) throw new NotFoundException(`${label} not found`);
    return account;
  }

  async createAccount(
    orgId: string,
    role: Role,
    data: CreateRoleAccountInput,
    label: string,
  ) {
    if (data.status === UserStatus.DELETED) {
      throw new BadRequestException(`New ${label.toLowerCase()}s cannot be created as DELETED`);
    }

    try {
      const user = await this.userService.createUser({
        email: data.email,
        password: data.password,
        role,
        organizationId: orgId,
        name: data.name,
        phone: data.phone,
        status: data.status,
      });
      return this.getAccount(orgId, role, user.id, label);
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      )
        throw error;
      console.error(`[Create${label.replace(/\s/g, '')} Error]:`, error);
      throw new InternalServerErrorException(
        `An unexpected error occurred while creating the ${label.toLowerCase()} account`,
      );
    }
  }

  async updateAccount(
    orgId: string,
    role: Role,
    id: string,
    data: UpdateRoleAccountInput,
    label: string,
  ) {
    const account = await this.prisma.user.findFirst({
      where: { id, organizationId: orgId, role },
    });

    if (!account) throw new NotFoundException(`${label} not found`);

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.password !== undefined && data.password.trim() !== '') {
      updateData.password = data.password;
    }
    if (data.status !== undefined) updateData.status = data.status;

    if (Object.keys(updateData).length === 0) {
      return this.getAccount(orgId, role, id, label);
    }

    await this.userService.updateUser(id, updateData);
    return this.getAccount(orgId, role, id, label);
  }

  async deleteAccount(orgId: string, role: Role, id: string, label: string) {
    const account = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: orgId,
        role,
        status: { not: UserStatus.DELETED },
      },
    });

    if (!account) throw new NotFoundException(`${label} not found`);

    await this.userService.updateUser(id, { status: UserStatus.DELETED });
    return { message: `${label} deleted successfully` };
  }

  async restoreAccount(
    orgId: string,
    role: Role,
    id: string,
    label: string,
    status: UserStatus = UserStatus.ACTIVE,
  ) {
    if (status === UserStatus.DELETED) {
      throw new BadRequestException('Restore status cannot be DELETED');
    }

    const account = await this.prisma.user.findFirst({
      where: {
        id,
        organizationId: orgId,
        role,
        status: UserStatus.DELETED,
      },
    });

    if (!account) throw new NotFoundException(`Deleted ${label.toLowerCase()} not found`);

    await this.userService.updateUser(id, { status });
    return { message: `${label} restored successfully` };
  }

  private buildWhere(
    orgId: string,
    role: Role,
    search: string | undefined,
    status: string | undefined,
    deleted: boolean | undefined,
  ): Prisma.UserWhereInput {
    return {
      organizationId: orgId,
      role,
      status: deleted
        ? UserStatus.DELETED
        : status
          ? { in: status.split(',') as UserStatus[] }
          : { not: UserStatus.DELETED },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private buildOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Prisma.UserOrderByWithRelationInput {
    const allowedSortFields = new Set([
      'name',
      'email',
      'phone',
      'status',
      'createdAt',
      'updatedAt',
    ]);

    return {
      [allowedSortFields.has(sortBy) ? sortBy : 'createdAt']: sortOrder,
    };
  }
}
