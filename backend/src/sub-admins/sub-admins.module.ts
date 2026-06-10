import { Module } from '@nestjs/common';
import { RoleAccountsModule } from '../role-accounts/role-accounts.module';
import { SubAdminsController } from './sub-admins.controller';
import { SubAdminsService } from './sub-admins.service';

@Module({
  imports: [RoleAccountsModule],
  controllers: [SubAdminsController],
  providers: [SubAdminsService],
  exports: [SubAdminsService],
})
export class SubAdminsModule {}
