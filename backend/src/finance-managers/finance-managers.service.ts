import { Injectable } from '@nestjs/common';
import { Role, UserStatus } from '../common/enums';
import { PaginationOptions } from '../common/utils';
import { RoleAccountsService } from '../role-accounts/role-accounts.service';
import { CreateFinanceManagerDto } from './dto/create-finance-manager.dto';
import { UpdateFinanceManagerDto } from './dto/update-finance-manager.dto';

const FINANCE_MANAGER_LABEL = 'Finance manager';

@Injectable()
export class FinanceManagersService {
  constructor(private readonly roleAccounts: RoleAccountsService) {}

  getFinanceManagers(orgId: string, options: PaginationOptions) {
    return this.roleAccounts.getAccounts(orgId, Role.FINANCE_MANAGER, options);
  }

  getFinanceManager(orgId: string, id: string) {
    return this.roleAccounts.getAccount(
      orgId,
      Role.FINANCE_MANAGER,
      id,
      FINANCE_MANAGER_LABEL,
    );
  }

  createFinanceManager(orgId: string, data: CreateFinanceManagerDto) {
    return this.roleAccounts.createAccount(
      orgId,
      Role.FINANCE_MANAGER,
      data,
      FINANCE_MANAGER_LABEL,
    );
  }

  updateFinanceManager(orgId: string, id: string, data: UpdateFinanceManagerDto) {
    return this.roleAccounts.updateAccount(
      orgId,
      Role.FINANCE_MANAGER,
      id,
      data,
      FINANCE_MANAGER_LABEL,
    );
  }

  deleteFinanceManager(orgId: string, id: string) {
    return this.roleAccounts.deleteAccount(
      orgId,
      Role.FINANCE_MANAGER,
      id,
      FINANCE_MANAGER_LABEL,
    );
  }

  restoreFinanceManager(
    orgId: string,
    id: string,
    status: UserStatus = UserStatus.ACTIVE,
  ) {
    return this.roleAccounts.restoreAccount(
      orgId,
      Role.FINANCE_MANAGER,
      id,
      FINANCE_MANAGER_LABEL,
      status,
    );
  }
}
