import { Module } from '@nestjs/common';
import { RoleAccountsModule } from '../role-accounts/role-accounts.module';
import { FinanceManagersController } from './finance-managers.controller';
import { FinanceManagersService } from './finance-managers.service';

@Module({
  imports: [RoleAccountsModule],
  controllers: [FinanceManagersController],
  providers: [FinanceManagersService],
  exports: [FinanceManagersService],
})
export class FinanceManagersModule {}
