import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GpaPoliciesController } from './gpa-policies.controller';
import { GpaPoliciesService } from './gpa-policies.service';
import { GpaService } from './gpa.service';

@Module({
  imports: [PrismaModule],
  controllers: [GpaPoliciesController],
  providers: [GpaPoliciesService, GpaService],
  exports: [GpaPoliciesService, GpaService],
})
export class GpaModule {}

