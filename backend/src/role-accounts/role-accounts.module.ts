import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserModule } from '../users/user.module';
import { RoleAccountsService } from './role-accounts.service';

@Module({
  imports: [PrismaModule, UserModule],
  providers: [RoleAccountsService],
  exports: [RoleAccountsService],
})
export class RoleAccountsModule {}
