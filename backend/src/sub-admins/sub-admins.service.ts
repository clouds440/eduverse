import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '../common/enums';
import { PaginationOptions } from '../common/utils';
import { RoleAccountsService } from '../role-accounts/role-accounts.service';
import { CreateSubAdminDto } from './dto/create-sub-admin.dto';
import { UpdateSubAdminDto } from './dto/update-sub-admin.dto';

const SUB_ADMIN_LABEL = 'Sub Admin';

@Injectable()
export class SubAdminsService {
  constructor(private readonly roleAccounts: RoleAccountsService) {}

  getSubAdmins(orgId: string, options: PaginationOptions) {
    return this.roleAccounts.getAccounts(orgId, Role.SUB_ADMIN, options);
  }

  getSubAdmin(orgId: string, id: string) {
    return this.roleAccounts.getAccount(
      orgId,
      Role.SUB_ADMIN,
      id,
      SUB_ADMIN_LABEL,
    );
  }

  createSubAdmin(orgId: string, data: CreateSubAdminDto) {
    return this.roleAccounts.createAccount(
      orgId,
      Role.SUB_ADMIN,
      data,
      SUB_ADMIN_LABEL,
    );
  }

  updateSubAdmin(orgId: string, id: string, data: UpdateSubAdminDto) {
    return this.roleAccounts.updateAccount(
      orgId,
      Role.SUB_ADMIN,
      id,
      data,
      SUB_ADMIN_LABEL,
    );
  }

  deleteSubAdmin(orgId: string, id: string) {
    return this.roleAccounts.deleteAccount(
      orgId,
      Role.SUB_ADMIN,
      id,
      SUB_ADMIN_LABEL,
    );
  }

  restoreSubAdmin(
    orgId: string,
    id: string,
    status: UserStatus = UserStatus.ACTIVE,
  ) {
    return this.roleAccounts.restoreAccount(
      orgId,
      Role.SUB_ADMIN,
      id,
      SUB_ADMIN_LABEL,
      status,
    );
  }
}
